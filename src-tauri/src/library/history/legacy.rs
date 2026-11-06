use super::super::{
    paths::{self, rel_string, resolve, TRASH},
    scan,
};
use super::storage;
use crate::error::{AppError, Result};
use chrono::{DateTime, SecondsFormat, Utc};
use rusqlite::{params, Connection};
use std::{collections::HashSet, fs, path::Path};
use walkdir::WalkDir;

pub(super) struct LegacyFile {
    pub original: String,
    pub stored: String,
    pub deleted: String,
}

pub(super) fn discover(
    root: &Path,
    known: &HashSet<String>,
    prefix: Option<&str>,
) -> Result<Vec<LegacyFile>> {
    let trash = resolve(root, Path::new(TRASH))?;
    let start = match prefix {
        Some(prefix) => resolve(root, &Path::new(TRASH).join(prefix))?,
        None => trash.clone(),
    };
    if !paths::exists(&start)? {
        return Ok(Vec::new());
    }
    let mut result = Vec::new();
    for item in WalkDir::new(&start)
        .follow_links(false)
        .into_iter()
        .filter_entry(|item| {
            item.depth() == 0
                || (!item.file_name().to_string_lossy().starts_with('.')
                    && !item.file_type().is_symlink()
                    && !fs::symlink_metadata(item.path()).is_ok_and(|meta| paths::is_link(&meta)))
        })
    {
        let item =
            item.map_err(|error| AppError::new("io", format!("无法读取旧回收站（{error}）")))?;
        if !item.file_type().is_file() {
            continue;
        }
        let stored = rel_string(
            item.path()
                .strip_prefix(root)
                .map_err(|_| super::super::outside())?,
        );
        if known.contains(&stored.to_lowercase()) {
            continue;
        }
        let original = rel_string(
            item.path()
                .strip_prefix(&trash)
                .map_err(|_| super::super::outside())?,
        );
        storage::original_location(root, &original)?;
        let meta = item
            .metadata()
            .map_err(|error| AppError::new("io", format!("无法读取回收文件（{error}）")))?;
        result.push(LegacyFile {
            original,
            stored,
            deleted: DateTime::<Utc>::from(meta.modified()?)
                .to_rfc3339_opts(SecondsFormat::Nanos, true),
        });
    }
    Ok(result)
}

/// Index legacy bytes before the rename transaction changes their original path.
/// Nothing in the recovery directory is moved, so rollback only affects metadata.
pub(super) fn index_prefix(conn: &Connection, root: &Path, old: &str, next: &str) -> Result<()> {
    let identity = storage::library_id(root, false)?;
    let known = {
        let mut statement =
            conn.prepare("SELECT stored_rel_path FROM file_recycle WHERE library_id=?1")?;
        let rows = statement
            .query_map([identity.as_deref().unwrap_or("")], |row| {
                row.get::<_, String>(0)
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        rows.into_iter().map(|path| path.to_lowercase()).collect()
    };
    let files = discover(root, &known, Some(old))?;
    if files.is_empty() {
        return Ok(());
    }
    let identity = storage::required_library_id(root)?;
    let owners = scan::owners(conn)?;
    for file in files {
        let mapped = format!("{}{}", next, &file.original[old.len()..]);
        let (client, project) =
            scan::owner_context(root, &storage::original_location(root, &mapped)?, &owners);
        conn.execute("INSERT INTO file_recycle(id,library_id,original_rel_path,stored_rel_path,client_id,project_id,deleted_at,legacy) VALUES(?1,?2,?3,?4,?5,?6,?7,1)",
            params![uuid::Uuid::new_v4().to_string(),identity,file.original,file.stored,client,project,file.deleted])?;
    }
    Ok(())
}
