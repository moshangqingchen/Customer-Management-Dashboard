use super::{
    invalidate_file_counts,
    paths::{
        exists, numbered, record_path, rel_string, reserved_dir, resolve, sanitize, Created,
        CLIENT_DOCS,
    },
    root, unavailable,
};
use crate::{
    error::{AppError, Result},
    models::FileTarget,
    repo::settings,
    Database,
};
use rusqlite::{params, Connection};
use std::{
    collections::HashSet,
    fs, io,
    path::{Path, PathBuf},
};

pub(super) struct Target {
    pub client_id: String,
    pub project_id: Option<String>,
    pub folder: Option<String>,
}

impl Target {
    pub fn load(conn: &Connection, target: &FileTarget) -> Result<Self> {
        match target {
            FileTarget::Project { project_id } => Ok(conn.query_row(
                "SELECT p.client_id,p.folder FROM projects p JOIN clients c ON p.client_id=c.id
                 WHERE p.id=?1 AND p.deleted_at IS NULL AND c.deleted_at IS NULL",
                [project_id],
                |r| {
                    Ok(Self {
                        client_id: r.get(0)?,
                        project_id: Some(project_id.clone()),
                        folder: r.get(1)?,
                    })
                },
            )?),
            FileTarget::Client { client_id } => Ok(conn.query_row(
                "SELECT folder FROM clients WHERE id=?1 AND deleted_at IS NULL",
                [client_id],
                |r| {
                    Ok(Self {
                        client_id: client_id.clone(),
                        project_id: None,
                        folder: r.get(0)?,
                    })
                },
            )?),
        }
    }

    pub fn base(&self, root: &Path) -> Result<Option<PathBuf>> {
        self.folder
            .as_deref()
            .map(|folder| {
                let path = record_path(root, folder)?;
                if self.project_id.is_some() {
                    Ok(path)
                } else {
                    resolve(root, &Path::new(folder).join(CLIENT_DOCS))
                }
            })
            .transpose()
    }
}

fn project_name(created: &str, title: &str) -> Result<String> {
    let date = chrono::DateTime::parse_from_rfc3339(created)
        .map_err(|_| AppError::new("db", "项目的创建日期无效"))?;
    Ok(format!(
        "{} {}",
        date.with_timezone(&chrono::Local).format("%Y-%m"),
        sanitize(title)
    ))
}

fn relative(root: &Path, path: &Path) -> Result<String> {
    Ok(rel_string(
        path.strip_prefix(root).map_err(|_| super::outside())?,
    ))
}

// Missing recorded folders still reserve their names. The owned snapshot does not
// keep either a statement or the command database mutex alive during disk I/O.
fn assigned(conn: &Connection) -> Result<HashSet<String>> {
    let mut statement = conn.prepare(
        "SELECT folder FROM clients WHERE folder IS NOT NULL
         UNION ALL SELECT folder FROM projects WHERE folder IS NOT NULL
         UNION ALL SELECT folder FROM client_folder_aliases",
    )?;
    let rows = statement.query_map([], |row| row.get::<_, String>(0))?;
    Ok(rows
        .collect::<rusqlite::Result<Vec<_>>>()?
        .into_iter()
        .map(|path| path.replace('\\', "/").to_ascii_lowercase())
        .collect())
}

fn new_folder(
    assigned: &HashSet<String>,
    root: &Path,
    parent: &Path,
    name: &str,
    created: &mut Created,
) -> Result<PathBuf> {
    for index in 1.. {
        let name = numbered(name, index, true);
        if parent == root && reserved_dir(&name) {
            continue;
        }
        let candidate = parent.join(name);
        if assigned.contains(&relative(root, &candidate)?.to_ascii_lowercase()) {
            continue;
        }
        match fs::create_dir(&candidate) {
            Ok(()) => {
                created.push(&candidate, true);
                return Ok(candidate);
            }
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error.into()),
        }
    }
    Err(AppError::invalid("无法分配文件夹名称"))
}

fn existing_folder(root: &Path, relative: &str) -> Result<PathBuf> {
    let path = record_path(root, relative)?;
    if !path.is_dir() {
        return Err(AppError::new(
            "libraryUnavailable",
            "已记录的文件夹不存在，请检查文件库位置",
        ));
    }
    Ok(path)
}

fn create_child(root: &Path, parent: &Path, name: &str, created: &mut Created) -> Result<PathBuf> {
    super::paths::valid_name(name)?;
    let path = resolve(
        root,
        &parent
            .strip_prefix(root)
            .map_err(|_| super::outside())?
            .join(name),
    )?;
    if !path.is_dir() {
        fs::create_dir(&path)?;
        created.push(&path, true);
    }
    Ok(path)
}

struct FolderPlan {
    target: Target,
    client_name: String,
    client_folder: Option<String>,
    project_name: Option<String>,
    template: Vec<String>,
    assigned: HashSet<String>,
}

impl FolderPlan {
    fn load(conn: &Connection, target: &FileTarget) -> Result<Self> {
        let target = Target::load(conn, target)?;
        let (client_name, client_folder) = conn.query_row(
            "SELECT name,folder FROM clients WHERE id=?1 AND deleted_at IS NULL",
            [&target.client_id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )?;
        let project_name = target
            .project_id
            .as_deref()
            .map(|id| {
                let (title, date): (String, String) = conn.query_row(
                    "SELECT title,created_at FROM projects WHERE id=?1",
                    [id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )?;
                project_name(&date, &title)
            })
            .transpose()?;
        Ok(Self {
            target,
            client_name,
            client_folder,
            project_name,
            template: settings::get(conn)?.subfolder_template,
            assigned: assigned(conn)?,
        })
    }
}

pub fn ensure_folder(db: &impl Database, target: &FileTarget) -> Result<PathBuf> {
    // This lock coordinates folder assignment only; ordinary database queries and
    // the subsequent potentially large file copies never take it.
    let _guard = db.file_guard()?;
    let root = root(db)?;
    let plan = db.read(|conn| FolderPlan::load(conn, target))?;
    if plan.target.project_id.is_some() {
        if let Some(folder) = &plan.target.folder {
            let path = existing_folder(&root, folder)?;
            invalidate_file_counts(&path);
            return Ok(path);
        }
    }
    let mut created = Created::default();
    let parent = match &plan.client_folder {
        Some(folder) => existing_folder(&root, folder)?,
        None => {
            let path = new_folder(
                &plan.assigned,
                &root,
                &root,
                &sanitize(&plan.client_name),
                &mut created,
            )?;
            create_child(&root, &path, CLIENT_DOCS, &mut created)?;
            path
        }
    };
    let path = match &plan.project_name {
        Some(name) => {
            let path = new_folder(&plan.assigned, &root, &parent, name, &mut created)?;
            for name in &plan.template {
                create_child(&root, &path, name, &mut created)?;
            }
            path
        }
        None => create_child(&root, &parent, CLIENT_DOCS, &mut created)?,
    };
    let client_relative = relative(&root, &parent)?;
    let project_relative = relative(&root, &path)?;
    db.read(|conn| {
        let tx = conn.unchecked_transaction()?;
        let current = Target::load(&tx, target)?;
        if current.client_id != plan.target.client_id || current.folder != plan.target.folder {
            return Err(AppError::new("db", "文件夹记录已改变，请重试"));
        }
        if plan.client_folder.is_none() && tx.execute(
            "UPDATE clients SET folder=?1 WHERE id=?2 AND folder IS NULL AND deleted_at IS NULL",
            params![client_relative, plan.target.client_id],
        )? != 1 {
            return Err(AppError::new("db", "客户文件夹记录已改变，请重试"));
        }
        if let Some(id) = &plan.target.project_id {
            if tx.execute("UPDATE projects SET folder=?1 WHERE id=?2 AND folder IS NULL AND deleted_at IS NULL",
                params![project_relative, id])? != 1 {
                return Err(AppError::new("db", "项目文件夹记录已改变，请重试"));
            }
        }
        tx.commit()?;
        Ok(())
    })?;
    created.commit();
    invalidate_file_counts(&path);
    Ok(path)
}

/// Existing projects may predate the current template. Only the selected,
/// currently configured template child may be created while importing files.
pub(super) fn import_directory(
    db: &impl Database,
    target: &FileTarget,
    root: &Path,
    base: &Path,
    subfolder: Option<&str>,
) -> Result<PathBuf> {
    let _guard = db.file_guard()?;
    if root != super::root(db)? {
        return Err(unavailable());
    }
    let base = resolve(root, base.strip_prefix(root).map_err(|_| super::outside())?)?;
    if !base.is_dir() {
        return Err(AppError::new(
            "libraryUnavailable",
            "已记录的文件夹不存在，请检查文件库位置",
        ));
    }
    let name = subfolder.unwrap_or("");
    let destination = resolve(&base, Path::new(name))?;
    if !destination.is_dir() {
        let is_template = matches!(target, FileTarget::Project { .. })
            && db.read(|conn| {
                Ok(settings::get(conn)?
                    .subfolder_template
                    .iter()
                    .any(|item| item == name))
            })?;
        if !is_template {
            return Err(AppError::invalid("目标子文件夹不存在，请重新选择存入位置"));
        }
        super::paths::valid_name(name)?;
        match fs::create_dir(&destination) {
            Ok(()) => {}
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => {}
            Err(error) => return Err(error.into()),
        }
    }
    let destination = resolve(&base, Path::new(name))?;
    if !destination.is_dir() {
        return Err(AppError::invalid("目标位置不是文件夹"));
    }
    Ok(destination)
}

fn rename_folder(
    db: &impl Database,
    configured: Option<&Path>,
    target: &FileTarget,
    name: impl FnOnce(&Connection) -> Result<String>,
) -> Result<()> {
    let _guard = db.file_guard()?;
    let root = super::canonical_root(configured.ok_or_else(unavailable)?)?;
    if root != super::root(db)? {
        return Err(unavailable());
    }
    let (info, assigned, new_name) =
        db.read(|conn| Ok((Target::load(conn, target)?, assigned(conn)?, name(conn)?)))?;
    let Some(old_relative) = info.folder.as_deref() else {
        return Ok(());
    };
    let old = existing_folder(&root, old_relative)?;
    let parent = old.parent().ok_or_else(super::outside)?;
    let mut destination = None;
    for index in 1.. {
        let name = numbered(&new_name, index, true);
        if parent == root && reserved_dir(&name) {
            continue;
        }
        let path = parent.join(name);
        if path == old {
            return Ok(());
        }
        let available = if exists(&path)? {
            !super::paths::is_link(&fs::symlink_metadata(&path)?) && path.canonicalize()? == old
        } else {
            !assigned.contains(&relative(&root, &path)?.to_ascii_lowercase())
        };
        if available {
            destination = Some(path);
            break;
        }
    }
    let destination = destination.ok_or_else(|| AppError::invalid("无法分配文件夹名称"))?;
    let new_relative = relative(&root, &destination)?;
    invalidate_file_counts(&old);
    invalidate_file_counts(&destination);
    fs::rename(&old, &destination)?;
    let result = db.read(|conn| {
        let tx = conn.unchecked_transaction()?;
        let current = Target::load(&tx, target)?;
        if current.folder != info.folder {
            return Err(AppError::new("db", "文件夹记录已改变，请重试"));
        }
        match target {
            FileTarget::Project { project_id } => {
                tx.execute(
                    "UPDATE projects SET folder=?1 WHERE id=?2",
                    params![new_relative, project_id],
                )?;
            }
            FileTarget::Client { client_id } => {
                tx.execute(
                    "UPDATE clients SET folder=?1 WHERE id=?2",
                    params![new_relative, client_id],
                )?;
                let prefix = format!("{}/", rel_string(Path::new(old_relative)));
                tx.execute(
                    "UPDATE projects SET folder=?1 || substr(replace(folder,'\\','/'),length(?2)+1)
                     WHERE substr(replace(folder,'\\','/'),1,length(?2))=?2",
                    params![format!("{new_relative}/"), prefix],
                )?;
            }
        }
        let old_prefix = format!("{}/", rel_string(Path::new(old_relative)));
        tx.execute(
            "UPDATE client_folder_aliases SET folder=CASE WHEN replace(folder,'\\','/')=?1 THEN ?2
             ELSE ?3 || substr(replace(folder,'\\','/'),length(?4)+1) END
             WHERE replace(folder,'\\','/')=?1 OR substr(replace(folder,'\\','/'),1,length(?4))=?4",
            params![
                rel_string(Path::new(old_relative)),
                new_relative,
                format!("{new_relative}/"),
                old_prefix
            ],
        )?;
        crate::library::history::rename_prefix(&tx, &root, old_relative, &new_relative)?;
        tx.commit()?;
        Ok(())
    });
    invalidate_file_counts(&old);
    invalidate_file_counts(&destination);
    if let Err(error) = result {
        fs::rename(&destination, &old)?;
        return Err(error);
    }
    Ok(())
}

fn rename_error(error: AppError) -> AppError {
    AppError::new(
        "folderRenameFailed",
        format!("文件夹重命名失败。{}", error.message),
    )
}

pub fn rename_client_folder(db: &impl Database, root: Option<&Path>, id: &str) -> Result<()> {
    rename_folder(
        db,
        root,
        &FileTarget::Client {
            client_id: id.into(),
        },
        |conn| {
            let name: String =
                conn.query_row("SELECT name FROM clients WHERE id=?1", [id], |row| {
                    row.get(0)
                })?;
            Ok(sanitize(&name))
        },
    )
    .map_err(rename_error)
}

pub fn rename_project_folder(db: &impl Database, root: Option<&Path>, id: &str) -> Result<()> {
    rename_folder(
        db,
        root,
        &FileTarget::Project {
            project_id: id.into(),
        },
        |conn| {
            let (title, created): (String, String) = conn.query_row(
                "SELECT title,created_at FROM projects WHERE id=?1",
                [id],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )?;
            project_name(&created, &title)
        },
    )
    .map_err(rename_error)
}
