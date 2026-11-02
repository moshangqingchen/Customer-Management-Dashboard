use super::{
    folders::Target,
    paths::{display, is_link, record_path, rel_string, reserved_dir, CLIENT_DOCS},
    root, ProjectFiles,
};
use crate::{
    error::{AppError, Result},
    models::{FileEntry, FileKind, FileListResult, FileTarget},
    Database,
};
use chrono::{DateTime, SecondsFormat, Utc};
use rusqlite::Connection;
use std::{
    fs,
    path::{Path, PathBuf},
};
use walkdir::{DirEntry, WalkDir};

fn kind(ext: &str) -> FileKind {
    match ext {
        "png" | "jpg" | "jpeg" | "webp" | "gif" | "bmp" | "svg" => FileKind::Image,
        "psd" | "psb" | "ai" | "cdr" | "sketch" | "fig" | "xd" | "indd" | "eps" | "afdesign"
        | "afphoto" => FileKind::Design,
        "pdf" => FileKind::Pdf,
        "doc" | "docx" | "xls" | "xlsx" | "ppt" | "pptx" | "txt" | "md" | "wps" | "et" | "dps"
        | "csv" => FileKind::Doc,
        "zip" | "rar" | "7z" => FileKind::Archive,
        "mp4" | "mov" | "avi" | "mkv" | "webm" => FileKind::Video,
        _ => FileKind::Other,
    }
}

pub(super) fn entry(
    path: &Path,
    root: &Path,
    base: &Path,
    client_id: Option<&str>,
    project_id: Option<&str>,
) -> Result<FileEntry> {
    let meta = fs::metadata(path)?;
    let ext = path
        .extension()
        .unwrap_or_default()
        .to_string_lossy()
        .to_lowercase();
    let kind = kind(&ext);
    Ok(FileEntry {
        path: display(path),
        rel_path: rel_string(path.strip_prefix(root).map_err(|_| super::outside())?),
        name: path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .into_owned(),
        ext,
        kind,
        size_bytes: meta.len(),
        modified_at: DateTime::<Utc>::from(meta.modified()?)
            .to_rfc3339_opts(SecondsFormat::Nanos, true),
        folder_group: rel_string(
            path.parent()
                .and_then(|p| p.strip_prefix(base).ok())
                .unwrap_or(Path::new("")),
        ),
        client_id: client_id.map(Into::into),
        project_id: project_id.map(Into::into),
    })
}

fn visible_file(entry: &DirEntry, whole_library: bool) -> bool {
    if entry.depth() == 0 {
        return true;
    }
    let name = entry.file_name().to_string_lossy();
    !(name.starts_with('.')
        || name.starts_with("~$")
        || name.eq_ignore_ascii_case("thumbs.db")
        || name.eq_ignore_ascii_case("desktop.ini")
        || (whole_library && entry.depth() == 1 && reserved_dir(&name))
        || entry.file_type().is_symlink()
        || fs::symlink_metadata(entry.path()).is_ok_and(|m| is_link(&m)))
}

fn walk(
    base: &Path,
    whole_library: bool,
    mut visit: impl FnMut(&Path) -> Result<()>,
) -> Result<()> {
    let mut walker = WalkDir::new(base).follow_links(false);
    if !whole_library {
        walker = walker.max_depth(3);
    }
    for item in walker
        .into_iter()
        .filter_entry(|item| visible_file(item, whole_library))
    {
        let item = item.map_err(|e| AppError::new("io", format!("无法读取文件夹（{e}）")))?;
        if item.file_type().is_file() {
            visit(item.path())?;
        }
    }
    Ok(())
}

pub fn project_file_count(root: Option<&Path>, folder: Option<&str>) -> i64 {
    project_files(root, folder).file_count
}

pub fn project_files(root: Option<&Path>, folder: Option<&str>) -> ProjectFiles {
    let (Some(root), Some(folder)) = (root, folder) else {
        return ProjectFiles::default();
    };
    let Ok(root) = super::canonical_root(root) else {
        return ProjectFiles::default();
    };
    let Ok(base) = record_path(&root, folder) else {
        return ProjectFiles::default();
    };
    super::count_cache::count(&base, || {
        if !base.is_dir() {
            return None;
        }
        let mut files = ProjectFiles::default();
        let mut newest = None;
        walk(&base, false, |path| {
            files.file_count += 1;
            let extension = path
                .extension()
                .unwrap_or_default()
                .to_string_lossy()
                .to_lowercase();
            if matches!(extension.as_str(), "png" | "jpg" | "jpeg" | "webp" | "gif") {
                let metadata = fs::metadata(path)?;
                if metadata.len() <= 25 * 1024 * 1024 {
                    let modified = metadata.modified()?;
                    let candidate = display(path);
                    if newest.is_none_or(|at| modified > at)
                        || newest == Some(modified)
                            && files
                                .cover_path
                                .as_ref()
                                .is_some_and(|current| candidate < *current)
                    {
                        newest = Some(modified);
                        files.cover_path = Some(candidate);
                    }
                }
            }
            Ok(())
        })
        .ok()?;
        Some(files)
    })
}

fn append_files(
    root: &Path,
    target: &Target,
    base: &Path,
    files: &mut Vec<FileEntry>,
) -> Result<()> {
    if base.is_dir() {
        walk(base, false, |path| {
            files.push(entry(
                path,
                root,
                base,
                Some(&target.client_id),
                target.project_id.as_deref(),
            )?);
            Ok(())
        })?;
    }
    Ok(())
}

pub fn files_list(
    db: &impl Database,
    target: &FileTarget,
    include_projects: bool,
) -> Result<FileListResult> {
    let root = root(db)?;
    let (target, projects) = db.read(|conn| {
        let target = Target::load(conn, target)?;
        let projects = if include_projects && target.project_id.is_none() {
            let mut stmt = conn.prepare("SELECT id,folder FROM projects WHERE client_id=?1 AND deleted_at IS NULL AND folder IS NOT NULL ORDER BY id")?;
            let rows = stmt.query_map([&target.client_id], |r| {
                Ok(Target {
                    client_id: target.client_id.clone(),
                    project_id: Some(r.get(0)?),
                    folder: r.get(1)?,
                })
            })?;
            rows.collect::<rusqlite::Result<Vec<_>>>()?
        } else {
            Vec::new()
        };
        Ok((target, projects))
    })?;
    let base = target.base(&root)?;
    let mut files = Vec::new();
    if let Some(base) = &base {
        append_files(&root, &target, base, &mut files)?;
    }
    {
        for project in projects {
            if let Some(base) = project.base(&root)? {
                append_files(&root, &project, &base, &mut files)?;
            }
        }
    }
    files.sort_by(|a, b| a.rel_path.cmp(&b.rel_path));
    Ok(FileListResult {
        files,
        folder: base.as_deref().map(display),
        folder_missing: base.is_some_and(|p| !p.is_dir()),
    })
}

pub(super) struct Owner {
    folder: PathBuf,
    client: String,
    project: Option<String>,
    deleted: bool,
}

pub(super) fn owners(conn: &Connection) -> Result<Vec<Owner>> {
    let mut stmt = conn.prepare("SELECT folder,id,NULL,deleted_at IS NOT NULL FROM clients WHERE folder IS NOT NULL
        UNION ALL SELECT p.folder,p.client_id,p.id,p.deleted_at IS NOT NULL OR c.deleted_at IS NOT NULL
            FROM projects p JOIN clients c ON p.client_id=c.id WHERE p.folder IS NOT NULL ORDER BY 1")?;
    let rows = stmt.query_map([], |r| {
        Ok(Owner {
            folder: PathBuf::from(r.get::<_, String>(0)?),
            client: r.get(1)?,
            project: r.get(2)?,
            deleted: r.get(3)?,
        })
    })?;
    let mut owners: Vec<_> = rows.collect::<rusqlite::Result<_>>()?;
    owners.sort_by_key(|o| std::cmp::Reverse(o.folder.components().count()));
    Ok(owners)
}

pub(super) fn with_owner(root: &Path, path: &Path, owners: &[Owner]) -> Result<Option<FileEntry>> {
    let relative = path.strip_prefix(root).map_err(|_| super::outside())?;
    if let Some(owner) = owners.iter().find(|o| relative.starts_with(&o.folder)) {
        if owner.deleted {
            return Ok(None);
        }
        let mut base = root.join(&owner.folder);
        let doc_base = base.join(CLIENT_DOCS);
        if owner.project.is_none() && path.starts_with(&doc_base) {
            base = doc_base;
        }
        Ok(Some(entry(
            path,
            root,
            &base,
            Some(&owner.client),
            owner.project.as_deref(),
        )?))
    } else {
        Ok(Some(entry(path, root, root, None, None)?))
    }
}

pub fn files_recent(db: &impl Database, limit: u32) -> Result<Vec<FileEntry>> {
    let root = root(db)?;
    if limit == 0 {
        return Ok(vec![]);
    }
    let owners = db.read(owners)?;
    let mut files = Vec::new();
    walk(&root, true, |path| {
        if let Some(file) = with_owner(&root, path, &owners)? {
            files.push(file);
        }
        Ok(())
    })?;
    files.sort_by(|a, b| {
        b.modified_at
            .cmp(&a.modified_at)
            .then_with(|| a.rel_path.cmp(&b.rel_path))
    });
    files.truncate(limit as usize);
    Ok(files)
}
