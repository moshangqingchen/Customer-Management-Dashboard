use super::super::{
    invalidate_file_counts,
    paths::{self, display, rel_string, resolve, TRASH},
    root,
};
use super::{legacy, storage};
use crate::{
    error::{AppError, Result},
    models::FileEntry,
    Database,
};
use chrono::{DateTime, SecondsFormat, Utc};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{collections::HashSet, fs, io, path::Path};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileRecycleEntry {
    pub id: String,
    pub original_path: String,
    pub original_rel_path: String,
    pub stored_path: String,
    pub name: String,
    pub size_bytes: u64,
    pub deleted_at: String,
    pub legacy: bool,
    pub client_id: Option<String>,
    pub project_id: Option<String>,
}
struct Row {
    id: String,
    original: String,
    stored: String,
    deleted: String,
    legacy: bool,
    client: Option<String>,
    project: Option<String>,
    restored: Option<String>,
}
fn row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Row> {
    Ok(Row {
        id: row.get("id")?,
        original: row.get("original_rel_path")?,
        stored: row.get("stored_rel_path")?,
        deleted: row.get("deleted_at")?,
        legacy: row.get("legacy")?,
        client: row.get("client_id")?,
        project: row.get("project_id")?,
        restored: row.get("restored_at")?,
    })
}
fn hydrate(db: &impl Database, root: &Path, row: Row) -> Result<FileRecycleEntry> {
    let original = storage::original_location(root, &row.original)?;
    let stored = resolve(root, Path::new(&row.stored))?;
    if !Path::new(&row.stored).starts_with(TRASH) {
        return Err(super::super::outside());
    }
    let size = match fs::metadata(&stored) {
        Ok(meta) => meta.len(),
        Err(error) if error.kind() == io::ErrorKind::NotFound => 0,
        Err(error) => return Err(error.into()),
    };
    let (client, project) = storage::context(db, root, &original)?;
    let (client, project) = if client.is_some() {
        (client, project)
    } else {
        (row.client, row.project)
    };
    Ok(FileRecycleEntry {
        id: row.id,
        original_path: display(&original),
        original_rel_path: row.original,
        stored_path: display(&stored),
        name: original
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned(),
        size_bytes: size,
        deleted_at: row.deleted,
        legacy: row.legacy,
        client_id: client,
        project_id: project,
    })
}

pub fn list_recycle(db: &impl Database) -> Result<Vec<FileRecycleEntry>> {
    let root = root(db)?;
    let legacy_scope = storage::legacy_scope(&root)?;
    let library_id = storage::library_id(&root, false)?;
    let indexed = db.read(|conn| {
        let mut stmt = conn.prepare("SELECT * FROM file_recycle WHERE library_id=?1")?;
        let values = stmt
            .query_map([library_id.as_deref().unwrap_or("")], row)?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(values)
    })?;
    let known: HashSet<_> = indexed
        .iter()
        .map(|value| value.stored.to_lowercase())
        .collect();
    let mut result = Vec::new();
    for record in indexed.into_iter().filter(|value| value.restored.is_none()) {
        let stored = resolve(&root, Path::new(&record.stored))?;
        // An interrupted trash may have committed its index before moving bytes.
        // Keep that reservation for later recovery, but never advertise a missing
        // archive as a restorable zero-byte file.
        match fs::metadata(&stored) {
            Ok(metadata) if metadata.is_file() => result.push(hydrate(db, &root, record)?),
            Ok(_) => {}
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            Err(error) => return Err(error.into()),
        }
    }
    for file in legacy::discover(&root, &known, None)? {
        result.push(hydrate(
            db,
            &root,
            Row {
                id: format!("legacy:{legacy_scope}:{}", file.original),
                original: file.original,
                stored: file.stored,
                deleted: file.deleted,
                legacy: true,
                client: None,
                project: None,
                restored: None,
            },
        )?);
    }
    result.sort_by(|a, b| {
        b.deleted_at
            .cmp(&a.deleted_at)
            .then_with(|| a.id.cmp(&b.id))
    });
    Ok(result)
}

pub fn trash(db: &impl Database, path: &Path) -> Result<()> {
    let _guard = db.file_guard()?;
    let (root, original, relative) = storage::current_file(db, path)?;
    let library_id = storage::required_library_id(&root)?;
    let proposed = resolve(&root, &Path::new(TRASH).join(&relative))?;
    storage::mkdir_parent(&root, &proposed)?;
    let parent = proposed.parent().ok_or_else(super::super::outside)?;
    let name = proposed
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| AppError::invalid("文件名称无效"))?;
    let mut destination = proposed.clone();
    let reserved = db.read(|conn| {
        let mut statement =
            conn.prepare("SELECT stored_rel_path FROM file_recycle WHERE library_id=?1")?;
        let rows = statement
            .query_map([&library_id], |row| row.get::<_, String>(0))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows
            .into_iter()
            .map(|path| path.to_lowercase())
            .collect::<HashSet<_>>())
    })?;
    for index in 1.. {
        destination = parent.join(paths::numbered(name, index, false));
        let relative = rel_string(
            destination
                .strip_prefix(&root)
                .map_err(|_| super::super::outside())?,
        );
        if !paths::exists(&destination)? && !reserved.contains(&relative.to_lowercase()) {
            break;
        }
    }
    let id = uuid::Uuid::new_v4().to_string();
    let created_at = crate::repo::now();
    let stored = rel_string(
        destination
            .strip_prefix(&root)
            .map_err(|_| super::super::outside())?,
    );
    let (client, project) = storage::context(db, &root, &original)?;
    // Commit the recovery location before touching the original. An interrupted
    // rename remains recoverable from either its original or indexed trash path.
    db.read(|conn| { conn.execute("INSERT INTO file_recycle(id,library_id,original_rel_path,stored_rel_path,client_id,project_id,deleted_at) VALUES(?1,?2,?3,?4,?5,?6,?7)", params![id, library_id, relative, stored, client, project, created_at])?; Ok(()) })?;
    if let Err(error) = fs::rename(&original, &destination) {
        let _ = db.read(|conn| {
            conn.execute("DELETE FROM file_recycle WHERE id=?1", [&id])?;
            Ok(())
        });
        return Err(error.into());
    }
    invalidate_file_counts(&original);
    Ok(())
}

pub fn restore_recycled(db: &impl Database, id: &str) -> Result<FileEntry> {
    let _guard = db.file_guard()?;
    let root = root(db)?;
    let legacy = id
        .strip_prefix("legacy:")
        .map(|value| {
            let (scope, relative) = value.split_once(':').ok_or_else(super::super::outside)?;
            if scope != storage::legacy_scope(&root)? {
                return Err(AppError::new(
                    "libraryChanged",
                    "文件库已经切换，请刷新回收站后重试",
                ));
            }
            Ok(relative)
        })
        .transpose()?;
    let library_id = storage::required_library_id(&root)?;
    let record = if let Some(relative) = legacy {
        let original = paths::record_path(&root, relative)?;
        let stored = resolve(&root, &Path::new(TRASH).join(relative))?;
        if !stored.is_file() {
            return Err(AppError::not_found());
        }
        let stored_relative = rel_string(
            stored
                .strip_prefix(&root)
                .map_err(|_| super::super::outside())?,
        );
        let (client, project) = storage::context(db, &root, &original)?;
        let new_id = uuid::Uuid::new_v4().to_string();
        let deleted = DateTime::<Utc>::from(fs::metadata(&stored)?.modified()?)
            .to_rfc3339_opts(SecondsFormat::Nanos, true);
        db.read(|conn| { conn.execute("INSERT OR IGNORE INTO file_recycle(id,library_id,original_rel_path,stored_rel_path,client_id,project_id,deleted_at,legacy) VALUES(?1,?2,?3,?4,?5,?6,?7,1)", params![new_id, library_id, relative, stored_relative, client, project, deleted])?;
            Ok(conn.query_row("SELECT * FROM file_recycle WHERE library_id=?1 AND stored_rel_path=?2 AND restored_at IS NULL", params![library_id, stored_relative], row)?) })?
    } else {
        db.read(|conn| {
            conn.query_row(
                "SELECT * FROM file_recycle WHERE id=?1 AND library_id=?2 AND restored_at IS NULL",
                params![id, library_id],
                row,
            )
            .optional()?
            .ok_or_else(AppError::not_found)
        })?
    };
    let original = paths::record_path(&root, &record.original)?;
    let stored = resolve(&root, Path::new(&record.stored))?;
    if !Path::new(&record.stored).starts_with(TRASH) || !stored.is_file() {
        return Err(AppError::new(
            "notFound",
            "回收文件不存在，请检查文件库备份",
        ));
    }
    storage::mkdir_parent(&root, &original)?;
    let parent = original.parent().ok_or_else(super::super::outside)?;
    let name = original
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| AppError::invalid("文件名称无效"))?;
    let mut restored = None;
    for index in 1.. {
        let candidate = parent.join(paths::numbered(name, index, false));
        if paths::exists(&candidate)? {
            continue;
        }
        let pending = storage::stage_copy(&stored, parent)?;
        match pending.persist_noclobber(&candidate) {
            Ok(_) => {
                restored = Some(candidate);
                break;
            }
            Err(error) if error.error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error.error.into()),
        }
    }
    let restored = restored.ok_or_else(|| AppError::invalid("无法分配恢复文件名"))?;
    let relative = rel_string(
        restored
            .strip_prefix(&root)
            .map_err(|_| super::super::outside())?,
    );
    if let Err(error) = db.read(|conn| {
        conn.execute(
            "UPDATE file_recycle SET restored_at=?1,restored_rel_path=?2 WHERE id=?3",
            params![crate::repo::now(), relative, record.id],
        )?;
        Ok(())
    }) {
        let _ = fs::remove_file(&restored);
        return Err(error);
    }
    // Retain the archived bytes as a recovery copy; indexed restored entries are
    // excluded from both the recycle list and legacy discovery.
    invalidate_file_counts(&restored);
    storage::file_entry(db, &root, &restored)
}
