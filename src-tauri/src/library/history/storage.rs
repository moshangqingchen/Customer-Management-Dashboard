use super::super::{
    paths::{self, is_link, rel_string, resolve},
    root, scan,
};
use crate::{
    error::{AppError, Result},
    models::FileEntry,
    Database,
};
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{self, Write},
    path::{Component, Path, PathBuf},
};
use uuid::Uuid;

pub(super) const HISTORY: &str = "_文件历史";

pub(super) fn library_id(root: &Path, create: bool) -> Result<Option<String>> {
    let directory = resolve(root, Path::new(HISTORY))?;
    if !directory.exists() {
        if !create {
            return Ok(None);
        }
        fs::create_dir(&directory)?;
    }
    let path = resolve(root, &Path::new(HISTORY).join(".library-id"))?;
    match fs::read_to_string(&path) {
        Ok(value) => {
            let value = value.trim();
            Uuid::parse_str(value).map_err(|_| {
                AppError::new(
                    "historyInvalid",
                    "文件库历史标识损坏，请保留内部目录并从备份恢复",
                )
            })?;
            Ok(Some(value.to_owned()))
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound && create => {
            let value = Uuid::new_v4().to_string();
            let mut pending = tempfile::NamedTempFile::new_in(&directory)?;
            pending.write_all(value.as_bytes())?;
            pending.as_file().sync_all()?;
            match pending.persist_noclobber(&path) {
                Ok(_) => Ok(Some(value)),
                Err(error) if error.error.kind() == io::ErrorKind::AlreadyExists => {
                    library_id(root, false)
                }
                Err(error) => Err(error.error.into()),
            }
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.into()),
    }
}

pub(super) fn required_library_id(root: &Path) -> Result<String> {
    library_id(root, true)?.ok_or_else(|| AppError::new("historyInvalid", "无法创建文件库历史标识"))
}

pub(super) fn legacy_scope(root: &Path) -> Result<String> {
    Ok(library_id(root, false)?
        .unwrap_or_else(|| format!("path-{:x}", Sha256::digest(paths::display(root).as_bytes()))))
}

pub(super) fn relative_original(root: &Path, path: &Path) -> Result<String> {
    let display_root = PathBuf::from(paths::display(root));
    let relative = path
        .strip_prefix(root)
        .or_else(|_| path.strip_prefix(&display_root))
        .map_err(|_| super::super::outside())?;
    let value = rel_string(relative);
    paths::record_path(root, &value)?;
    Ok(value)
}

pub(super) fn original_location(root: &Path, relative: &str) -> Result<PathBuf> {
    let path = Path::new(relative);
    if path.as_os_str().is_empty() {
        return Err(super::super::outside());
    }
    for (index, component) in path.components().enumerate() {
        let Component::Normal(name) = component else {
            return Err(super::super::outside());
        };
        let name = name.to_string_lossy();
        paths::valid_name(&name)?;
        if index == 0 && paths::reserved_dir(&name) {
            return Err(super::super::outside());
        }
    }
    Ok(root.join(path))
}

pub(super) fn current_file(db: &impl Database, path: &Path) -> Result<(PathBuf, PathBuf, String)> {
    let library_root = root(db)?;
    let file = super::super::checked_file(db, path)?;
    let relative = relative_original(&library_root, &file)?;
    Ok((library_root, file, relative))
}

pub(super) fn context(
    db: &impl Database,
    root: &Path,
    path: &Path,
) -> Result<(Option<String>, Option<String>)> {
    let owners = db.read(scan::owners)?;
    Ok(scan::owner_context(root, path, &owners))
}

pub(super) fn file_entry(db: &impl Database, root: &Path, path: &Path) -> Result<FileEntry> {
    let owners = db.read(scan::owners)?;
    if let Some(file) = scan::with_owner(root, path, &owners)? {
        return Ok(file);
    }
    scan::entry(path, root, root, None, None)
}

pub(super) fn mkdir_parent(root: &Path, path: &Path) -> Result<()> {
    let parent = path.parent().ok_or_else(super::super::outside)?;
    let relative = parent
        .strip_prefix(root)
        .map_err(|_| super::super::outside())?;
    let mut current = PathBuf::new();
    for component in relative.components() {
        if !matches!(component, Component::Normal(_)) {
            return Err(super::super::outside());
        }
        current.push(component);
        let checked = resolve(root, &current)?;
        if !checked.exists() {
            fs::create_dir(&checked)?;
        }
        if !checked.is_dir() {
            return Err(AppError::invalid("恢复位置的上级路径不是文件夹"));
        }
    }
    Ok(())
}

pub(super) fn source_file(path: &Path) -> Result<PathBuf> {
    if !path.is_absolute() {
        return Err(AppError::invalid("请选择本地文件的绝对路径"));
    }
    let metadata = fs::symlink_metadata(path)?;
    if !metadata.is_file() || is_link(&metadata) {
        return Err(AppError::invalid(
            "不能使用文件夹、链接或特殊文件作为新版本",
        ));
    }
    Ok(path.canonicalize()?)
}

pub(super) fn stage_copy(source: &Path, parent: &Path) -> Result<tempfile::NamedTempFile> {
    let mut input = fs::File::open(source)?;
    let mut pending = tempfile::NamedTempFile::new_in(parent)?;
    io::copy(&mut input, &mut pending)?;
    pending.as_file().sync_all()?;
    Ok(pending)
}

pub(super) fn note(value: &str) -> Result<String> {
    let value = value.trim();
    if value.chars().count() > 2000 {
        return Err(AppError::invalid("版本备注最多 2000 字"));
    }
    Ok(value.into())
}
