use crate::{
    backup,
    error::{AppError, Result},
    library::{self, display},
    models::*,
    register_library_path,
    repo::{activities, clients, payments, projects, settings, snippets, tags, trash},
    AppState, Database, DB_FILE,
};
use serde::Deserialize;
use std::{
    io::Write,
    path::{Path, PathBuf},
};
use tauri::{
    ipc::{CommandArg, CommandItem, InvokeError},
    AppHandle, Runtime, State,
};
use tauri_plugin_dialog::{DialogExt, FilePath};
use tauri_plugin_opener::OpenerExt;

// Keep malformed IPC arguments on the same error contract as repository validation.
pub struct Arg<T>(pub(crate) T);

impl<'de, T: Deserialize<'de>, R: Runtime> CommandArg<'de, R> for Arg<T> {
    fn from_command(item: CommandItem<'de, R>) -> std::result::Result<Self, InvokeError> {
        let key = item.key;
        T::deserialize(item)
            .map(Self)
            .map_err(|_| AppError::invalid(format!("调用参数 {key} 缺失或格式不正确")).into())
    }
}

fn selected_path(file: FilePath) -> Result<String> {
    let path = file
        .into_path()
        .map_err(|_| AppError::invalid("请选择本地文件路径"))?;
    Ok(display(&path))
}

fn opener_error(error: tauri_plugin_opener::Error) -> AppError {
    AppError::new("io", format!("无法在系统中打开指定位置（{error}）"))
}

fn open(app: &AppHandle, path: PathBuf) -> Result<()> {
    app.opener()
        .open_path(display(&path), None::<&str>)
        .map_err(opener_error)
}

fn write_text(path: &Path, content: &str) -> Result<()> {
    let parent = path
        .parent()
        .ok_or_else(|| AppError::invalid("请选择有效的保存位置"))?;
    let mut file = tempfile::NamedTempFile::new_in(parent)?;
    file.write_all(b"\xEF\xBB\xBF")?;
    file.write_all(content.as_bytes())?;
    file.as_file().sync_all()?;
    file.persist(path).map_err(|error| error.error)?;
    Ok(())
}

fn read_project(
    state: &AppState,
    query: impl FnOnce(&rusqlite::Connection) -> Result<Project>,
) -> Result<Project> {
    let (mut project, root) =
        state.read(|db| Ok((query(db)?, settings::read::<PathBuf>(db, "libraryRoot")?)))?;
    library::populate_project_files(&mut project, root.as_deref());
    Ok(project)
}

#[cfg(test)]
mod tests;

fn app_information(state: &AppState) -> AppInfo {
    AppInfo {
        version: env!("CARGO_PKG_VERSION").to_owned(),
        data_dir: display(&state.data_dir),
        db_path: display(&state.data_dir.join(DB_FILE)),
        portable: state.portable,
        suggested_library_root: state.suggested_library_root.as_deref().map(display),
    }
}

#[tauri::command(async)]
pub fn app_info(state: State<'_, AppState>) -> Result<AppInfo> {
    Ok(app_information(&state))
}

#[tauri::command(async)]
pub fn app_open_data_dir(state: State<'_, AppState>, app: AppHandle) -> Result<()> {
    open(&app, state.data_dir.clone())
}

#[tauri::command(async)]
pub fn library_status(state: State<'_, AppState>) -> Result<LibraryStatus> {
    library::status(&*state)
}

#[tauri::command(async)]
pub fn library_set_root(
    state: State<'_, AppState>,
    app: AppHandle,
    path: Arg<String>,
) -> Result<LibraryStatus> {
    let status = library::set_root(&*state, Path::new(&path.0))?;
    register_library_path(&app, status.root.as_deref().map(Path::new))?;
    Ok(status)
}

#[tauri::command(async)]
pub fn library_open_root(state: State<'_, AppState>, app: AppHandle) -> Result<()> {
    open(&app, library::root(&*state)?)
}

#[tauri::command(async)]
pub fn clients_list(state: State<'_, AppState>) -> Result<Vec<Client>> {
    state.read(clients::list)
}

#[tauri::command(async)]
pub fn client_get(state: State<'_, AppState>, id: Arg<String>) -> Result<Client> {
    state.read(|db| clients::get(db, &id.0))
}

#[tauri::command(async)]
pub fn client_create(state: State<'_, AppState>, input: Arg<ClientInput>) -> Result<Client> {
    state.read(|db| clients::create(db, input.0))
}

#[tauri::command(async)]
pub fn client_update(
    state: State<'_, AppState>,
    id: Arg<String>,
    patch: Arg<ClientPatch>,
) -> Result<MutationResult<Client>> {
    let (mut result, rename, root) = state.read(|db| {
        let current = clients::get(db, &id.0)?;
        let rename = patch.0.rename_folder.unwrap_or(false)
            && patch
                .0
                .name
                .as_deref()
                .is_some_and(|name| name.trim() != current.name)
            && current.folder.is_some();
        Ok((
            clients::update_record(db, &id.0, patch.0)?,
            rename,
            settings::read::<PathBuf>(db, "libraryRoot")?,
        ))
    })?;
    if rename {
        result.warning = library::rename_client_folder(&*state, root.as_deref(), &id.0)
            .err()
            .map(|error| format!("folderRenameFailed：客户资料已保存。{}", error.message));
        result.value = state.read(|db| clients::get(db, &id.0))?;
    }
    Ok(result)
}

#[tauri::command(async)]
pub fn client_delete(state: State<'_, AppState>, id: Arg<String>) -> Result<()> {
    state.read(|db| clients::delete(db, &id.0))
}

#[tauri::command(async)]
pub fn projects_list(state: State<'_, AppState>) -> Result<Vec<Project>> {
    let (mut projects, root) = state.read(|db| {
        Ok((
            projects::list_records(db)?,
            settings::read::<PathBuf>(db, "libraryRoot")?,
        ))
    })?;
    for project in &mut projects {
        library::populate_project_files(project, root.as_deref());
    }
    Ok(projects)
}

#[tauri::command(async)]
pub fn project_get(state: State<'_, AppState>, id: Arg<String>) -> Result<Project> {
    read_project(&state, |db| projects::get_record(db, &id.0))
}

#[tauri::command(async)]
pub fn project_create(state: State<'_, AppState>, input: Arg<ProjectInput>) -> Result<Project> {
    read_project(&state, |db| projects::create_record(db, input.0))
}

#[tauri::command(async)]
pub fn project_update(
    state: State<'_, AppState>,
    id: Arg<String>,
    patch: Arg<ProjectPatch>,
) -> Result<MutationResult<Project>> {
    let (mut result, rename, root) = state.read(|db| {
        let current = projects::get_record(db, &id.0)?;
        let rename = patch.0.rename_folder.unwrap_or(false)
            && patch
                .0
                .title
                .as_deref()
                .is_some_and(|title| title.trim() != current.title)
            && current.folder.is_some();
        Ok((
            projects::update_record(db, &id.0, patch.0)?,
            rename,
            settings::read::<PathBuf>(db, "libraryRoot")?,
        ))
    })?;
    if rename {
        result.warning = library::rename_project_folder(&*state, root.as_deref(), &id.0)
            .err()
            .map(|error| format!("folderRenameFailed：项目已保存。{}", error.message));
    }
    result.value = read_project(&state, |db| projects::get_record(db, &id.0))?;
    Ok(result)
}

#[tauri::command(async)]
pub fn project_set_status(
    state: State<'_, AppState>,
    id: Arg<String>,
    status: Arg<ProjectStatus>,
) -> Result<Project> {
    read_project(&state, |db| {
        projects::set_status_record(db, &id.0, status.0)
    })
}

#[tauri::command(async)]
pub fn project_duplicate(state: State<'_, AppState>, id: Arg<String>) -> Result<Project> {
    read_project(&state, |db| projects::duplicate_record(db, &id.0))
}

#[tauri::command(async)]
pub fn project_delete(state: State<'_, AppState>, id: Arg<String>) -> Result<()> {
    state.read(|db| projects::delete(db, &id.0))
}

#[tauri::command(async)]
pub fn payments_list(state: State<'_, AppState>, project_id: Arg<String>) -> Result<Vec<Payment>> {
    state.read(|db| payments::list(db, &project_id.0))
}

#[tauri::command(async)]
pub fn payments_all(state: State<'_, AppState>) -> Result<Vec<PaymentWithContext>> {
    state.read(payments::all)
}

#[tauri::command(async)]
pub fn payment_add(state: State<'_, AppState>, input: Arg<PaymentInput>) -> Result<Payment> {
    state.read(|db| payments::add(db, input.0))
}

#[tauri::command(async)]
pub fn payment_update(
    state: State<'_, AppState>,
    id: Arg<String>,
    patch: Arg<PaymentPatch>,
) -> Result<Payment> {
    state.read(|db| payments::update(db, &id.0, patch.0))
}

#[tauri::command(async)]
pub fn payment_delete(state: State<'_, AppState>, id: Arg<String>) -> Result<()> {
    state.read(|db| payments::delete(db, &id.0))
}

#[tauri::command(async)]
pub fn tags_list(state: State<'_, AppState>) -> Result<Vec<Tag>> {
    state.read(tags::list)
}

#[tauri::command(async)]
pub fn tag_create(
    state: State<'_, AppState>,
    name: Arg<String>,
    color: Arg<TagColor>,
) -> Result<Tag> {
    state.read(|db| tags::create(db, &name.0, color.0))
}

#[tauri::command(async)]
pub fn tag_update(
    state: State<'_, AppState>,
    id: Arg<String>,
    patch: Arg<TagPatch>,
) -> Result<Tag> {
    state.read(|db| tags::update(db, &id.0, patch.0))
}

#[tauri::command(async)]
pub fn tag_delete(state: State<'_, AppState>, id: Arg<String>) -> Result<()> {
    state.read(|db| tags::delete(db, &id.0))
}

#[tauri::command(async)]
pub fn tag_merge(
    state: State<'_, AppState>,
    source_id: Arg<String>,
    target_id: Arg<String>,
) -> Result<Tag> {
    state.read(|db| tags::merge(db, &source_id.0, &target_id.0))
}

#[tauri::command(async)]
pub fn client_set_tags(
    state: State<'_, AppState>,
    client_id: Arg<String>,
    tag_ids: Arg<Vec<String>>,
) -> Result<()> {
    state.read(|db| tags::set(db, &client_id.0, &tag_ids.0, false))
}

#[tauri::command(async)]
pub fn project_set_tags(
    state: State<'_, AppState>,
    project_id: Arg<String>,
    tag_ids: Arg<Vec<String>>,
) -> Result<()> {
    state.read(|db| tags::set(db, &project_id.0, &tag_ids.0, true))
}

#[tauri::command(async)]
pub fn activities_list(
    state: State<'_, AppState>,
    client_id: Arg<Option<String>>,
    project_id: Arg<Option<String>>,
    limit: Arg<Option<u32>>,
) -> Result<Vec<Activity>> {
    state.read(|db| activities::list(db, client_id.0.as_deref(), project_id.0.as_deref(), limit.0))
}

#[tauri::command(async)]
pub fn activities_recent(state: State<'_, AppState>, limit: Arg<u32>) -> Result<Vec<Activity>> {
    state.read(|db| activities::list(db, None, None, Some(limit.0)))
}

#[tauri::command(async)]
pub fn activity_add_note(
    state: State<'_, AppState>,
    client_id: Arg<String>,
    project_id: Arg<Option<String>>,
    body: Arg<String>,
) -> Result<Activity> {
    state.read(|db| activities::add_note(db, &client_id.0, project_id.0.as_deref(), &body.0))
}

#[tauri::command(async)]
pub fn activity_update_note(
    state: State<'_, AppState>,
    id: Arg<String>,
    body: Arg<String>,
) -> Result<Activity> {
    state.read(|db| activities::update_note(db, &id.0, &body.0))
}

#[tauri::command(async)]
pub fn activity_delete(state: State<'_, AppState>, id: Arg<String>) -> Result<()> {
    state.read(|db| activities::delete(db, &id.0))
}

#[tauri::command(async)]
pub fn files_list(
    state: State<'_, AppState>,
    target: Arg<FileTarget>,
    include_projects: Arg<Option<bool>>,
) -> Result<FileListResult> {
    library::files_list(&*state, &target.0, include_projects.0.unwrap_or(false))
}

#[tauri::command(async)]
pub fn files_recent(state: State<'_, AppState>, limit: Arg<u32>) -> Result<Vec<FileEntry>> {
    library::files_recent(&*state, limit.0)
}

#[tauri::command(async)]
pub fn files_add(
    state: State<'_, AppState>,
    target: Arg<FileTarget>,
    source_paths: Arg<Vec<String>>,
    subfolder: Arg<Option<String>>,
) -> Result<FilesAddResult> {
    library::files_add(&*state, &target.0, &source_paths.0, subfolder.0.as_deref())
}

#[tauri::command(async)]
pub fn files_pick_and_add(
    state: State<'_, AppState>,
    app: AppHandle,
    target: Arg<FileTarget>,
    subfolder: Arg<Option<String>>,
) -> Result<FilesAddResult> {
    let Some(files) = app
        .dialog()
        .file()
        .set_title("选择要添加的文件")
        .blocking_pick_files()
    else {
        return Ok(FilesAddResult::default());
    };
    let sources = files
        .into_iter()
        .map(selected_path)
        .collect::<Result<Vec<_>>>()?;
    library::files_add(&*state, &target.0, &sources, subfolder.0.as_deref())
}

#[tauri::command(async)]
pub fn file_open(state: State<'_, AppState>, app: AppHandle, path: Arg<String>) -> Result<()> {
    open(&app, library::checked_file(&*state, Path::new(&path.0))?)
}

#[tauri::command(async)]
pub fn file_reveal(state: State<'_, AppState>, app: AppHandle, path: Arg<String>) -> Result<()> {
    let file = library::checked_file(&*state, Path::new(&path.0))?;
    app.opener().reveal_item_in_dir(file).map_err(opener_error)
}

#[tauri::command(async)]
pub fn file_rename(
    state: State<'_, AppState>,
    path: Arg<String>,
    new_name: Arg<String>,
) -> Result<FileEntry> {
    library::file_rename(&*state, Path::new(&path.0), &new_name.0)
}

#[tauri::command(async)]
pub fn file_trash(state: State<'_, AppState>, path: Arg<String>) -> Result<()> {
    library::file_trash(&*state, Path::new(&path.0))
}

#[tauri::command]
pub async fn file_thumbnail(
    state: State<'_, AppState>,
    path: Arg<String>,
    size: Arg<u32>,
) -> Result<Option<String>> {
    crate::thumbnails::file_thumbnail(&*state, &state.data_dir, Path::new(&path.0), size.0).await
}

#[tauri::command(async)]
pub fn files_copy_to_clipboard(state: State<'_, AppState>, paths: Arg<Vec<String>>) -> Result<()> {
    crate::clipboard::files_copy_to_clipboard(&*state, &paths.0)
}

#[tauri::command(async)]
pub fn files_paste(
    state: State<'_, AppState>,
    target: Arg<FileTarget>,
    subfolder: Arg<Option<String>>,
) -> Result<FilesAddResult> {
    crate::clipboard::files_paste(&*state, &state.data_dir, &target.0, subfolder.0.as_deref())
}

#[tauri::command(async)]
pub fn folder_open(
    state: State<'_, AppState>,
    app: AppHandle,
    target: Arg<FileTarget>,
) -> Result<()> {
    open(&app, library::ensure_folder(&*state, &target.0)?)
}

#[tauri::command(async)]
pub fn pick_folder(app: AppHandle, title: Arg<Option<String>>) -> Result<Option<String>> {
    app.dialog()
        .file()
        .set_title(title.0.as_deref().unwrap_or("选择文件夹"))
        .blocking_pick_folder()
        .map(selected_path)
        .transpose()
}

#[tauri::command(async)]
pub fn snippet_groups_list(state: State<'_, AppState>) -> Result<Vec<SnippetGroup>> {
    state.read(snippets::groups_list)
}

#[tauri::command(async)]
pub fn snippet_group_create(state: State<'_, AppState>, name: Arg<String>) -> Result<SnippetGroup> {
    state.read(|db| snippets::group_create(db, &name.0))
}

#[tauri::command(async)]
pub fn snippet_group_update(
    state: State<'_, AppState>,
    id: Arg<String>,
    patch: Arg<SnippetGroupPatch>,
) -> Result<SnippetGroup> {
    state.read(|db| snippets::group_update(db, &id.0, patch.0))
}

#[tauri::command(async)]
pub fn snippet_group_delete(state: State<'_, AppState>, id: Arg<String>) -> Result<()> {
    state.read(|db| snippets::group_delete(db, &id.0))
}

#[tauri::command(async)]
pub fn snippets_list(state: State<'_, AppState>) -> Result<Vec<Snippet>> {
    state.read(snippets::list)
}

#[tauri::command(async)]
pub fn snippet_create(state: State<'_, AppState>, input: Arg<SnippetInput>) -> Result<Snippet> {
    state.read(|db| snippets::create(db, input.0))
}

#[tauri::command(async)]
pub fn snippet_update(
    state: State<'_, AppState>,
    id: Arg<String>,
    patch: Arg<SnippetPatch>,
) -> Result<Snippet> {
    state.read(|db| snippets::update(db, &id.0, patch.0))
}

#[tauri::command(async)]
pub fn snippet_delete(state: State<'_, AppState>, id: Arg<String>) -> Result<()> {
    state.read(|db| snippets::delete(db, &id.0))
}

#[tauri::command(async)]
pub fn snippet_mark_used(state: State<'_, AppState>, id: Arg<String>) -> Result<()> {
    state.read(|db| snippets::mark_used(db, &id.0))
}

#[tauri::command(async)]
pub fn settings_get(state: State<'_, AppState>) -> Result<Settings> {
    state.read(settings::get)
}

#[tauri::command(async)]
pub fn settings_update(state: State<'_, AppState>, patch: Arg<SettingsPatch>) -> Result<Settings> {
    state.read(|db| settings::update(db, patch.0))
}

#[tauri::command(async)]
pub fn backups_list(state: State<'_, AppState>) -> Result<Vec<BackupInfo>> {
    backup::list(&state.backup_connection()?, &state.data_dir)
}

#[tauri::command(async)]
pub fn backup_create(state: State<'_, AppState>) -> Result<BackupInfo> {
    backup::create(&state.backup_connection()?, &state.data_dir)
}

#[tauri::command(async)]
pub fn backup_restore(
    state: State<'_, AppState>,
    app: AppHandle,
    file_name: Arg<String>,
) -> Result<()> {
    let _filesystem = state.file_guard()?;
    let mut db = state.backup_connection()?;
    backup::restore(&mut db, &state.data_dir, &file_name.0)?;
    let root = settings::read::<PathBuf>(&db, "libraryRoot")?;
    register_library_path(&app, root.as_deref())
}

#[tauri::command(async)]
pub fn trash_list(state: State<'_, AppState>) -> Result<Vec<TrashItem>> {
    state.read(trash::list)
}

#[tauri::command(async)]
pub fn trash_restore(
    state: State<'_, AppState>,
    r#type: Arg<TrashType>,
    id: Arg<String>,
) -> Result<()> {
    state.read(|db| trash::restore(db, r#type.0, &id.0))
}

#[tauri::command(async)]
pub fn trash_purge(
    state: State<'_, AppState>,
    r#type: Arg<TrashType>,
    id: Arg<String>,
) -> Result<()> {
    state.read(|db| trash::purge(db, r#type.0, &id.0))
}

#[tauri::command(async)]
pub fn save_text_file(
    app: AppHandle,
    default_name: Arg<String>,
    content: Arg<String>,
) -> Result<Option<String>> {
    let name = library::sanitize(&default_name.0);
    let selected = app
        .dialog()
        .file()
        .set_title("保存文本文件")
        .set_file_name(name)
        .blocking_save_file();
    let Some(path) = selected.map(selected_path).transpose()? else {
        return Ok(None);
    };
    write_text(Path::new(&path), &content.0)?;
    Ok(Some(path))
}
