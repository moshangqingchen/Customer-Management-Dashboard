use super::super::{
    invalidate_file_counts,
    paths::{display, record_path, resolve},
    root,
};
use super::storage;
use crate::models::FileEntry;
use crate::{
    error::{AppError, Result},
    Database,
};
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::{fs, path::Path};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FileVersion {
    pub id: String,
    pub original_path: String,
    pub original_rel_path: String,
    pub snapshot_path: String,
    pub name: String,
    pub size_bytes: u64,
    pub note: String,
    pub created_at: String,
    pub client_id: Option<String>,
    pub project_id: Option<String>,
    pub available: bool,
}

fn row(row: &rusqlite::Row<'_>) -> rusqlite::Result<FileVersion> {
    Ok(FileVersion {
        id: row.get("id")?,
        original_path: String::new(),
        original_rel_path: row.get("original_rel_path")?,
        snapshot_path: row.get("snapshot_rel_path")?,
        name: row.get("file_name")?,
        size_bytes: u64::try_from(row.get::<_, i64>("size_bytes")?).map_err(|error| {
            rusqlite::Error::FromSqlConversionFailure(
                5,
                rusqlite::types::Type::Integer,
                Box::new(error),
            )
        })?,
        note: row.get("note")?,
        created_at: row.get("created_at")?,
        client_id: row.get("client_id")?,
        project_id: row.get("project_id")?,
        available: false,
    })
}

fn hydrate(db: &impl Database, root: &Path, mut value: FileVersion) -> Result<FileVersion> {
    let original = storage::original_location(root, &value.original_rel_path)?;
    let snapshot = resolve(root, Path::new(&value.snapshot_path))?;
    if !Path::new(&value.snapshot_path).starts_with(storage::HISTORY) {
        return Err(super::super::outside());
    }
    value.original_path = display(&original);
    value.snapshot_path = display(&snapshot);
    value.available = snapshot.is_file();
    let (client, project) = storage::context(db, root, &original)?;
    if client.is_some() {
        value.client_id = client;
        value.project_id = project;
    }
    Ok(value)
}

pub fn list_versions(db: &impl Database, path: Option<&Path>) -> Result<Vec<FileVersion>> {
    let root = root(db)?;
    let relative = path
        .map(|path| storage::relative_original(&root, path))
        .transpose()?;
    let Some(library_id) = storage::library_id(&root, false)? else {
        return Ok(Vec::new());
    };
    let records = db.read(|conn| {
        let mut statement = conn.prepare("SELECT * FROM file_versions WHERE library_id=?1 AND (?2 IS NULL OR original_rel_path=?2 COLLATE NOCASE) ORDER BY created_at DESC,id DESC")?;
        let records = statement.query_map(params![library_id, relative], row)?.collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(records)
    })?;
    records
        .into_iter()
        .map(|value| hydrate(db, &root, value))
        .collect()
}

fn save_locked(
    db: &impl Database,
    root: &Path,
    file: &Path,
    relative: &str,
    note: &str,
) -> Result<FileVersion> {
    let note = storage::note(note)?;
    let library_id = storage::required_library_id(root)?;
    let version_id = uuid::Uuid::new_v4().to_string();
    let name = file
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(|| AppError::invalid("文件名称无效"))?
        .to_owned();
    let ext = file
        .extension()
        .map(|value| format!(".{}", value.to_string_lossy()))
        .unwrap_or_default();
    let snapshot_relative = format!("{}/{version_id}{ext}", storage::HISTORY);
    let snapshot = resolve(root, Path::new(&snapshot_relative))?;
    let parent = snapshot.parent().ok_or_else(super::super::outside)?;
    let pending = storage::stage_copy(file, parent)?;
    let size = pending.as_file().metadata()?.len();
    let stored_size =
        i64::try_from(size).map_err(|_| AppError::invalid("文件过大，无法记录版本大小"))?;
    pending
        .persist_noclobber(&snapshot)
        .map_err(|error| AppError::from(error.error))?;
    let (client, project) = storage::context(db, root, file)?;
    let value = FileVersion {
        id: version_id,
        original_path: display(file),
        original_rel_path: relative.into(),
        snapshot_path: display(&snapshot),
        name,
        size_bytes: size,
        note,
        created_at: crate::repo::now(),
        client_id: client,
        project_id: project,
        available: true,
    };
    let saved = db.read(|conn| {
        conn.execute("INSERT INTO file_versions(id,library_id,original_rel_path,snapshot_rel_path,file_name,size_bytes,note,created_at,client_id,project_id) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10)",
            params![value.id, library_id, relative, snapshot_relative, value.name, stored_size, value.note, value.created_at, value.client_id, value.project_id])?;
        Ok(())
    });
    if let Err(error) = saved {
        let _ = fs::remove_file(&snapshot);
        return Err(error);
    }
    let mut permissions = fs::metadata(&snapshot)?.permissions();
    permissions.set_readonly(true);
    fs::set_permissions(&snapshot, permissions)?;
    Ok(value)
}

pub fn save_version(db: &impl Database, path: &Path, note: &str) -> Result<FileVersion> {
    let _guard = db.file_guard()?;
    let (root, file, relative) = storage::current_file(db, path)?;
    save_locked(db, &root, &file, &relative, note)
}

pub fn replace_version(
    db: &impl Database,
    path: &Path,
    source: &Path,
    note: &str,
) -> Result<FileEntry> {
    let _guard = db.file_guard()?;
    let (root, file, relative) = storage::current_file(db, path)?;
    let source = storage::source_file(source)?;
    let note = storage::note(note)?;
    if source == file {
        return Err(AppError::invalid("请选择另一份文件作为新版本"));
    }
    if source
        .extension()
        .map(|v| v.to_string_lossy().to_lowercase())
        != file.extension().map(|v| v.to_string_lossy().to_lowercase())
    {
        return Err(AppError::invalid("新版本的扩展名需与当前文件一致"));
    }
    let parent = file.parent().ok_or_else(super::super::outside)?;
    let pending = storage::stage_copy(&source, parent)?;
    save_locked(
        db,
        &root,
        &file,
        &relative,
        if note.is_empty() {
            "上传新版本前保留"
        } else {
            &note
        },
    )?;
    // tempfile persist replaces the original atomically; until this succeeds the
    // original bytes remain intact and the previous snapshot is already durable.
    pending
        .persist(&file)
        .map_err(|error| AppError::from(error.error))?;
    invalidate_file_counts(&file);
    storage::file_entry(db, &root, &file)
}

pub fn restore_version(db: &impl Database, id: &str) -> Result<FileEntry> {
    let _guard = db.file_guard()?;
    let root = root(db)?;
    let library_id = storage::library_id(&root, false)?.ok_or_else(AppError::not_found)?;
    let value = db.read(|conn| {
        conn.query_row(
            "SELECT * FROM file_versions WHERE id=?1 AND library_id=?2",
            params![id, library_id],
            row,
        )
        .optional()?
        .ok_or_else(AppError::not_found)
    })?;
    let original = record_path(&root, &value.original_rel_path)?;
    let source = resolve(&root, Path::new(&value.snapshot_path))?;
    if !Path::new(&value.snapshot_path).starts_with(storage::HISTORY) || !source.is_file() {
        return Err(AppError::new(
            "notFound",
            "历史版本文件不存在，请检查文件库备份",
        ));
    }
    storage::mkdir_parent(&root, &original)?;
    let parent = original.parent().ok_or_else(super::super::outside)?;
    let pending = storage::stage_copy(&source, parent)?;
    if original.exists() {
        if !original.is_file() {
            return Err(AppError::invalid("原位置已被文件夹占用"));
        }
        save_locked(
            db,
            &root,
            &original,
            &value.original_rel_path,
            "恢复历史版本前保留",
        )?;
        pending
            .persist(&original)
            .map_err(|error| AppError::from(error.error))?;
    } else {
        pending
            .persist_noclobber(&original)
            .map_err(|error| AppError::from(error.error))?;
    }
    invalidate_file_counts(&original);
    storage::file_entry(db, &root, &original)
}
