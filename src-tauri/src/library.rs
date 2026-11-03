mod count_cache;
mod folders;
mod paths;
mod scan;
mod transfer;

use count_cache::invalidate_file_counts;
pub use folders::{ensure_folder, rename_client_folder, rename_project_folder};
pub(crate) use paths::display;
pub use paths::sanitize;
pub use scan::{files_list, files_recent, project_file_count, project_files};
pub use transfer::{file_rename, file_trash, files_add, files_add_with_copy_hook};

use crate::{
    error::{AppError, Result},
    models::{LibraryState, LibraryStatus, Project},
    repo::settings,
    Database,
};
use std::{
    fs,
    path::{Path, PathBuf},
};

/// File count and cover always share one scan, cache entry, and invalidation.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct ProjectFiles {
    pub file_count: i64,
    pub cover_path: Option<String>,
}

pub(crate) fn populate_project_files(project: &mut Project, root: Option<&Path>) {
    let files = project_files(root, project.folder.as_deref());
    project.file_count = files.file_count;
    project.cover_path = files.cover_path;
}

fn unavailable() -> AppError {
    AppError::new(
        "libraryUnavailable",
        "文件库不可访问，请检查磁盘或重新选择位置",
    )
}

fn outside() -> AppError {
    AppError::new("outsideLibrary", "路径超出文件库或经过不安全的链接")
}

pub fn root(db: &impl Database) -> Result<PathBuf> {
    let configured = db
        .read(|conn| settings::read::<String>(conn, "libraryRoot"))?
        .ok_or_else(|| AppError::new("libraryNotConfigured", "请先选择文件库位置"))?;
    canonical_root(Path::new(&configured))
}

fn canonical_root(path: &Path) -> Result<PathBuf> {
    if !path.is_absolute() || !path.is_dir() {
        return Err(unavailable());
    }
    path.canonicalize().map_err(|_| unavailable())
}

fn writable(path: &Path) -> bool {
    let test_path = path.join(format!(".client-desk-{}.tmp", uuid::Uuid::new_v4()));
    match fs::File::create_new(&test_path) {
        Ok(file) => {
            drop(file);
            fs::remove_file(test_path).is_ok()
        }
        Err(_) => false,
    }
}

fn describe(path: Option<&Path>) -> LibraryStatus {
    let (state, message, free_bytes) = match path {
        None => (LibraryState::NotConfigured, "请选择文件库位置", None),
        Some(path) if !path.is_absolute() || !path.is_dir() => {
            (LibraryState::Missing, "文件库不存在或不可访问", None)
        }
        Some(path) if !writable(path) => (
            LibraryState::ReadOnly,
            "文件库不可写，请检查文件夹权限",
            fs2::available_space(path).ok(),
        ),
        Some(path) => (
            LibraryState::Ready,
            "文件库可用",
            fs2::available_space(path).ok(),
        ),
    };
    LibraryStatus {
        root: path.map(paths::display),
        state,
        message: message.into(),
        free_bytes,
    }
}

pub fn status(db: &impl Database) -> Result<LibraryStatus> {
    let path = db.read(|conn| settings::read::<String>(conn, "libraryRoot"))?;
    Ok(describe(path.as_deref().map(Path::new)))
}

pub fn set_root(db: &impl Database, path: &Path) -> Result<LibraryStatus> {
    let _guard = db.file_guard()?;
    if !path.is_absolute() {
        return Err(AppError::invalid("文件库位置必须是绝对路径"));
    }
    fs::create_dir_all(path).map_err(|_| unavailable())?;
    let canonical = canonical_root(path)?;
    let value = describe(Some(&canonical));
    if value.state != LibraryState::Ready {
        return Err(AppError::new("libraryUnavailable", value.message));
    }
    db.read(|conn| settings::write(conn, "libraryRoot", &paths::display(&canonical)))?;
    invalidate_file_counts(&canonical);
    Ok(value)
}

pub fn checked_file(db: &impl Database, path: &Path) -> Result<PathBuf> {
    let root = root(db)?;
    if !path.is_absolute()
        || path.components().any(|component| match component {
            std::path::Component::Normal(name) => name.to_string_lossy().contains(':'),
            _ => false,
        })
    {
        return Err(outside());
    }
    let absolute = match path.canonicalize() {
        Ok(path) => path,
        Err(error) => {
            if !path
                .ancestors()
                .find_map(|part| part.canonicalize().ok())
                .is_some_and(|part| part.starts_with(&root))
            {
                return Err(outside());
            }
            return Err(error.into());
        }
    };
    let relative = absolute.strip_prefix(&root).map_err(|_| outside())?;
    let checked = paths::resolve(&root, relative)?;
    if !checked.is_file() {
        return Err(AppError::invalid("请选择文件"));
    }
    Ok(checked)
}
