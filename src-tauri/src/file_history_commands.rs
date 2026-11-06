use crate::{
    commands::Arg,
    error::{AppError, Result},
    library::{
        self,
        history::{self, FileRecycleEntry, FileVersion},
    },
    models::FileEntry,
    AppState,
};
use std::path::Path;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

#[tauri::command(async)]
pub fn file_versions_list(
    state: State<'_, AppState>,
    path: Arg<Option<String>>,
) -> Result<Vec<FileVersion>> {
    history::list_versions(&*state, path.0.as_deref().map(Path::new))
}
#[tauri::command(async)]
pub fn file_versions_save(
    state: State<'_, AppState>,
    path: Arg<String>,
    note: Arg<Option<String>>,
) -> Result<FileVersion> {
    history::save_version(&*state, Path::new(&path.0), note.0.as_deref().unwrap_or(""))
}
#[tauri::command(async)]
pub fn file_versions_replace(
    state: State<'_, AppState>,
    path: Arg<String>,
    source_path: Arg<String>,
    note: Arg<Option<String>>,
) -> Result<FileEntry> {
    history::replace_version(
        &*state,
        Path::new(&path.0),
        Path::new(&source_path.0),
        note.0.as_deref().unwrap_or(""),
    )
}
#[tauri::command(async)]
pub fn file_versions_pick_replace(
    state: State<'_, AppState>,
    app: AppHandle,
    path: Arg<String>,
    note: Arg<Option<String>>,
) -> Result<Option<FileEntry>> {
    let original = library::checked_file(&*state, Path::new(&path.0))?;
    let mut dialog = app
        .dialog()
        .file()
        .set_title("选择新版本（当前文件会先保留历史版本）");
    if let Some(ext) = original.extension().and_then(|value| value.to_str()) {
        dialog = dialog.add_filter("相同格式的文件", &[ext]);
    }
    let Some(selected) = dialog.blocking_pick_file() else {
        return Ok(None);
    };
    let source = selected
        .into_path()
        .map_err(|_| AppError::invalid("请选择本地文件"))?;
    history::replace_version(&*state, &original, &source, note.0.as_deref().unwrap_or("")).map(Some)
}
#[tauri::command(async)]
pub fn file_versions_restore(state: State<'_, AppState>, id: Arg<String>) -> Result<FileEntry> {
    history::restore_version(&*state, &id.0)
}
#[tauri::command(async)]
pub fn file_recycle_list(state: State<'_, AppState>) -> Result<Vec<FileRecycleEntry>> {
    history::list_recycle(&*state)
}
#[tauri::command(async)]
pub fn file_recycle_restore(state: State<'_, AppState>, id: Arg<String>) -> Result<FileEntry> {
    history::restore_recycled(&*state, &id.0)
}
