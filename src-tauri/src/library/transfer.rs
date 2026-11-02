use super::{
    checked_file, ensure_folder,
    folders::Target,
    invalidate_file_counts,
    paths::{exists, is_link, numbered, reserved_dir, resolve, valid_name, Created, TRASH},
    root,
    scan::{entry, owners, with_owner},
};
use crate::{
    error::{AppError, Result},
    models::{ActivityKind, FileAddFailure, FileEntry, FileTarget, FilesAddResult},
    repo::{self, activities},
    Database,
};
use rusqlite::params;
use std::{
    fs,
    io::{self, ErrorKind},
    path::{Component, Path, PathBuf},
};
use walkdir::WalkDir;

// Only a partially written file is rolled back; completed files remain recoverable.
fn copy_file(
    db: &impl Database,
    source: &Path,
    dest: &Path,
    before_copy: &impl Fn(&Path),
) -> Result<bool> {
    let mut input = fs::File::open(source)?;
    let created = {
        let _guard = db.file_guard()?;
        fs::File::create_new(dest)
    };
    let mut output = match created {
        Ok(output) => output,
        Err(error) if error.kind() == ErrorKind::AlreadyExists => return Ok(false),
        Err(error) => return Err(error.into()),
    };
    let mut pending = Created::default();
    pending.push(dest, false);
    before_copy(source);
    let result = io::copy(&mut input, &mut output);
    drop(output);
    result?;
    pending.commit();
    invalidate_file_counts(dest);
    Ok(true)
}

fn verify_source(path: &Path) -> Result<fs::Metadata> {
    let meta = fs::symlink_metadata(path)?;
    if is_link(&meta) || (!meta.is_file() && !meta.is_dir()) {
        return Err(AppError::invalid("无法添加链接或特殊文件"));
    }
    Ok(meta)
}

struct CopyFailure {
    name: String,
    error: AppError,
}

fn failed(path: &Path, error: AppError, failures: &mut Vec<CopyFailure>) {
    failures.push(CopyFailure {
        name: path
            .file_name()
            .unwrap_or(path.as_os_str())
            .to_string_lossy()
            .into_owned(),
        error,
    });
}

fn copy_tree(
    db: &impl Database,
    source: &Path,
    dest: &Path,
    root: &Path,
    files: &mut Vec<PathBuf>,
    failures: &mut Vec<CopyFailure>,
    before_copy: &impl Fn(&Path),
) -> Result<()> {
    let mut directories = Created::default();
    directories.push(dest, true);
    let start_count = files.len();
    let start_failures = failures.len();
    for item in WalkDir::new(source).min_depth(1).follow_links(false) {
        let item = match item {
            Ok(item) => item,
            Err(error) => {
                failed(
                    error.path().unwrap_or(source),
                    AppError::new("io", format!("无法复制文件夹（{error}）")),
                    failures,
                );
                continue;
            }
        };
        let result = (|| {
            let meta = verify_source(item.path())?;
            let relative = item
                .path()
                .strip_prefix(source)
                .map_err(|_| super::outside())?;
            let absolute = dest.join(relative);
            let destination = resolve(
                root,
                absolute.strip_prefix(root).map_err(|_| super::outside())?,
            )?;
            if meta.is_dir() {
                fs::create_dir(&destination)?;
                directories.push(&destination, true);
            } else if copy_file(db, item.path(), &destination, before_copy)? {
                files.push(destination);
            } else {
                return Err(AppError::new("exists", "同名文件已存在"));
            }
            Ok(())
        })();
        if let Err(error) = result {
            failed(item.path(), error, failures);
        }
    }
    if files.len() > start_count || failures.len() == start_failures {
        directories.commit();
    }
    Ok(())
}

fn copy_source(
    db: &impl Database,
    source: &Path,
    parent: &Path,
    root: &Path,
    files: &mut Vec<PathBuf>,
    failures: &mut Vec<CopyFailure>,
    before_copy: &impl Fn(&Path),
) -> Result<()> {
    if !source.is_absolute() {
        return Err(AppError::invalid("源文件位置必须是绝对路径"));
    }
    let meta = verify_source(source)?;
    let source = source.canonicalize()?;
    let name = source
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| AppError::invalid("源文件名无效"))?;
    valid_name(name)?;
    if meta.is_dir() && parent.starts_with(&source) {
        return Err(AppError::invalid("不能把文件夹复制到它自身或子文件夹"));
    }
    for index in 1.. {
        let destination = parent.join(numbered(name, index, meta.is_dir()));
        if meta.is_file() {
            if !copy_file(db, &source, &destination, before_copy)? {
                continue;
            }
            files.push(destination);
        } else {
            match fs::create_dir(&destination) {
                Ok(()) => {}
                Err(error) if error.kind() == ErrorKind::AlreadyExists => continue,
                Err(error) => return Err(error.into()),
            }
            copy_tree(
                db,
                &source,
                &destination,
                root,
                files,
                failures,
                before_copy,
            )?;
        }
        return Ok(());
    }
    Err(AppError::invalid("无法分配文件名称"))
}

pub fn files_add(
    db: &impl Database,
    target: &FileTarget,
    sources: &[String],
    subfolder: Option<&str>,
) -> Result<FilesAddResult> {
    files_add_with_copy_hook(db, target, sources, subfolder, |_| {})
}

/// Runs the callback immediately before copying bytes, without a database lock.
#[doc(hidden)]
pub fn files_add_with_copy_hook(
    db: &impl Database,
    target: &FileTarget,
    sources: &[String],
    subfolder: Option<&str>,
    before_copy: impl Fn(&Path),
) -> Result<FilesAddResult> {
    let root = root(db)?;
    let info = db.read(|conn| Target::load(conn, target))?;
    if sources.is_empty() {
        return Ok(FilesAddResult::default());
    }
    let base = ensure_folder(db, target)?;
    let relative_base = base.strip_prefix(&root).map_err(|_| super::outside())?;
    let base = resolve(&root, relative_base)?;
    let destination = resolve(&base, Path::new(subfolder.unwrap_or("")))?;
    if !destination.is_dir() {
        return Err(AppError::invalid("目标子文件夹不存在"));
    }
    invalidate_file_counts(&base);
    let mut copied = Vec::new();
    let mut failures = Vec::new();
    let copy_hook = |source: &Path| {
        db.before_file_copy(source);
        before_copy(source);
    };
    for source in sources {
        let source = Path::new(source);
        if let Err(error) = copy_source(
            db,
            source,
            &destination,
            &root,
            &mut copied,
            &mut failures,
            &copy_hook,
        ) {
            failed(source, error, &mut failures);
        }
    }
    invalidate_file_counts(&base);
    let mut files = Vec::new();
    for path in copied {
        match entry(
            &path,
            &root,
            &base,
            Some(&info.client_id),
            info.project_id.as_deref(),
        ) {
            Ok(file) => files.push(file),
            Err(error) => failed(&path, error, &mut failures),
        }
    }
    let names: Vec<_> = files.iter().map(|file| file.name.clone()).collect();
    let errors: Vec<_> = failures
        .iter()
        .map(|failure| format!("{}：{}", failure.name, failure.error.message))
        .collect();
    let failed_names: Vec<_> = failures.iter().map(|failure| &failure.name).collect();
    if !files.is_empty() {
        let mut body = format!("添加了 {} 个文件", files.len());
        if !errors.is_empty() {
            let message = format!("以下文件添加失败：{}", errors.join("；"));
            eprintln!("{message}");
            body.push_str(&format!("；{message}"));
        }
        let client_id = db.read(|conn| {
            let tx = conn.unchecked_transaction()?;
            // Ownership may change while bytes are copied without the database lock.
            let client_id: String = if let Some(project_id) = &info.project_id {
                tx.query_row(
                    "SELECT client_id FROM projects WHERE id=?1",
                    [project_id],
                    |row| row.get(0),
                )?
            } else {
                tx.query_row(
                    "SELECT id FROM clients WHERE id=?1",
                    [&info.client_id],
                    |row| row.get(0),
                )?
            };
            activities::insert(
                &tx,
                &client_id,
                info.project_id.as_deref(),
                ActivityKind::File,
                &body,
                serde_json::json!({ "names": names, "failedNames": failed_names, "errors": errors }),
            )?;
            let now = repo::now();
            if let Some(id) = &info.project_id {
                tx.execute(
                    "UPDATE projects SET updated_at=?1 WHERE id=?2",
                    params![now, id],
                )?;
            }
            tx.execute(
                "UPDATE clients SET updated_at=?1 WHERE id=?2",
                params![now, client_id],
            )?;
            tx.commit()?;
            Ok(client_id)
        })?;
        for file in &mut files {
            file.client_id = Some(client_id.clone());
        }
    }
    Ok(FilesAddResult {
        added: files,
        failed: failures
            .into_iter()
            .map(|failure| FileAddFailure {
                name: failure.name,
                message: failure.error.message,
            })
            .collect(),
    })
}

fn ordinary_file(db: &impl Database, path: &Path, root: &Path) -> Result<PathBuf> {
    let path = checked_file(db, path)?;
    let relative = path.strip_prefix(root).map_err(|_| super::outside())?;
    if matches!(relative.components().next(), Some(Component::Normal(name)) if reserved_dir(&name.to_string_lossy()))
    {
        return Err(AppError::invalid("不能修改备份或回收站中的文件"));
    }
    Ok(path)
}

pub fn file_rename(db: &impl Database, path: &Path, new_name: &str) -> Result<FileEntry> {
    let _guard = db.file_guard()?;
    valid_name(new_name)?;
    let root = root(db)?;
    let owners = db.read(owners)?;
    let old = ordinary_file(db, path, &root)?;
    let destination = old.with_file_name(new_name);
    let old_entry = with_owner(&root, &old, &owners)?.ok_or_else(AppError::not_found)?;
    invalidate_file_counts(&old);
    if old == destination {
        return Ok(old_entry);
    }
    if exists(&destination)?
        && (is_link(&fs::symlink_metadata(&destination)?) || destination.canonicalize()? != old)
    {
        return Err(AppError::new("exists", "文件夹中已有同名文件"));
    }
    let result = fs::rename(&old, &destination);
    invalidate_file_counts(&old);
    invalidate_file_counts(&destination);
    result?;
    with_owner(&root, &destination, &owners)?.ok_or_else(AppError::not_found)
}

pub fn file_trash(db: &impl Database, path: &Path) -> Result<()> {
    let _guard = db.file_guard()?;
    let root = root(db)?;
    let old = ordinary_file(db, path, &root)?;
    let relative = old.strip_prefix(&root).map_err(|_| super::outside())?;
    let target = resolve(&root, &Path::new(TRASH).join(relative))?;
    let parent = target.parent().ok_or_else(super::outside)?;
    fs::create_dir_all(parent)?;
    let mut destination = target.clone();
    if exists(&destination)? {
        let stamp = chrono::Utc::now().format("%Y%m%d-%H%M%S-%9f");
        let stem = target.file_stem().unwrap_or_default().to_string_lossy();
        let extension = target
            .extension()
            .map(|value| format!(".{}", value.to_string_lossy()))
            .unwrap_or_default();
        let name = format!("{stem}-{stamp}{extension}");
        for index in 1.. {
            destination = parent.join(numbered(&name, index, false));
            if !exists(&destination)? {
                break;
            }
        }
    }
    invalidate_file_counts(&old);
    let result = fs::rename(&old, destination);
    invalidate_file_counts(&old);
    result?;
    Ok(())
}
