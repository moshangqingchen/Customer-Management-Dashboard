use super::outside;
use crate::error::{AppError, Result};
use std::{
    fs, io,
    path::{Component, Path, PathBuf},
};

pub(super) const CLIENT_DOCS: &str = "_客户资料";
pub(super) const TRASH: &str = "_回收站";
pub(super) const BACKUPS: &str = "_备份";

fn forbidden(c: char) -> bool {
    c.is_control() || "\\/:*?\"<>|".contains(c)
}

fn reserved(value: &str) -> bool {
    let stem = value
        .split('.')
        .next()
        .unwrap_or_default()
        .trim_end()
        .to_ascii_uppercase();
    matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        || ["COM", "LPT"].iter().any(|prefix| {
            stem.strip_prefix(prefix).is_some_and(|suffix| {
                matches!(suffix, "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9")
            })
        })
}

pub fn sanitize(value: &str) -> String {
    let clean: String = value
        .chars()
        .map(|c| if forbidden(c) { '_' } else { c })
        .collect();
    let mut limited: String = clean
        .trim_matches(|c: char| c.is_whitespace() || c == '.')
        .chars()
        .take(80)
        .collect();
    limited.truncate(
        limited
            .trim_end_matches(|c: char| c.is_whitespace() || c == '.')
            .len(),
    );
    if limited.is_empty() {
        return "未命名".into();
    }
    if reserved(&limited) {
        let pos = limited.find('.').unwrap_or(limited.len());
        limited.insert(pos, '_');
        limited = limited.chars().take(80).collect();
    }
    limited
}

pub(super) fn valid_name(name: &str) -> Result<()> {
    if name.is_empty()
        || name == "."
        || name == ".."
        || name.chars().any(forbidden)
        || name.ends_with(['.', ' '])
        || reserved(name)
    {
        return Err(AppError::invalid("文件名称为空或包含非法字符"));
    }
    Ok(())
}

pub(super) fn reserved_dir(name: &str) -> bool {
    name == TRASH || name == BACKUPS
}

pub(crate) fn display(path: &Path) -> String {
    let raw = path.to_string_lossy();
    if let Some(rest) = raw.strip_prefix(r"\\?\UNC\") {
        return format!(r"\\{rest}");
    }
    raw.strip_prefix(r"\\?\").unwrap_or(&raw).to_string()
}

pub(super) fn rel_string(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}

pub(super) fn is_link(meta: &fs::Metadata) -> bool {
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        meta.file_attributes() & 0x400 != 0
    }
    #[cfg(not(windows))]
    meta.is_symlink()
}

// Walk each existing component so missing descendants of a junction cannot escape.
pub(super) fn resolve(root: &Path, relative: &Path) -> Result<PathBuf> {
    let mut path = root.to_path_buf();
    for part in relative.components() {
        let Component::Normal(name) = part else {
            return Err(outside());
        };
        valid_name(&name.to_string_lossy()).map_err(|_| outside())?;
        path.push(name);
        match fs::symlink_metadata(&path) {
            Ok(meta) => {
                if is_link(&meta) || !path.canonicalize()?.starts_with(root) {
                    return Err(outside());
                }
            }
            Err(e) if e.kind() == io::ErrorKind::NotFound => {}
            Err(e) => return Err(e.into()),
        }
    }
    Ok(path)
}

pub(super) fn record_path(root: &Path, relative: &str) -> Result<PathBuf> {
    let path = Path::new(relative);
    if !matches!(path.components().next(), Some(Component::Normal(n)) if !reserved_dir(&n.to_string_lossy()))
    {
        return Err(outside());
    }
    resolve(root, path)
}

pub(super) fn exists(path: &Path) -> Result<bool> {
    match fs::symlink_metadata(path) {
        Ok(_) => Ok(true),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(false),
        Err(e) => Err(e.into()),
    }
}

pub(crate) fn numbered(name: &str, index: usize, is_dir: bool) -> String {
    if index == 1 {
        return name.into();
    }
    if !is_dir {
        if let (Some(stem), Some(ext)) = (Path::new(name).file_stem(), Path::new(name).extension())
        {
            return format!(
                "{} ({index}).{}",
                stem.to_string_lossy(),
                ext.to_string_lossy()
            );
        }
    }
    format!("{name} ({index})")
}

// Remove only individual entries created by the failed operation, in reverse order.
// A concurrently populated directory is left intact.
#[derive(Default)]
pub(super) struct Created {
    paths: Vec<(PathBuf, bool)>,
}

impl Created {
    pub fn push(&mut self, path: &Path, is_dir: bool) {
        self.paths.push((path.to_path_buf(), is_dir));
    }
    pub fn commit(&mut self) {
        self.paths.clear();
    }
}

impl Drop for Created {
    fn drop(&mut self) {
        for (path, is_dir) in self.paths.drain(..).rev() {
            let result = if is_dir {
                fs::remove_dir(path)
            } else {
                fs::remove_file(path)
            };
            if let Err(error) = result {
                eprintln!("撤销新增文件时出现错误：{error}");
            }
        }
    }
}
