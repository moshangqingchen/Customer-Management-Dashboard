use crate::{
    db,
    error::{AppError, Result},
    models::{BackupInfo, BackupKind},
    repo::settings,
};
use chrono::{Local, NaiveDateTime, SecondsFormat, Utc};
use rusqlite::{
    backup::{Backup, StepResult},
    Connection, OpenFlags, MAIN_DB,
};
use std::{
    fs,
    io::ErrorKind,
    path::{Path, PathBuf},
    time::{Duration, Instant},
};
use uuid::Uuid;

const AUTO_LIMIT: usize = 30;
const STAMP_FORMAT: &str = "%Y%m%d-%H%M%S";

fn directory(conn: &Connection, data_dir: &Path, create_dir: bool) -> Result<Option<PathBuf>> {
    let configured: Option<PathBuf> = settings::read(conn, "libraryRoot")?;
    let (base, name) = match configured.as_deref() {
        Some(root) if root.is_absolute() && root.is_dir() => (root, "_备份"),
        Some(_) => {
            return Err(AppError::new(
                "libraryUnavailable",
                "文件库不可用，无法访问备份",
            ))
        }
        None => (data_dir, "backups"),
    };
    let base = base.canonicalize()?;
    let dir = base.join(name);
    if create_dir {
        match fs::create_dir(&dir) {
            Err(e) if e.kind() == ErrorKind::AlreadyExists => {}
            result => result?,
        }
    }
    let canonical = match dir.canonicalize() {
        Err(e) if !create_dir && e.kind() == ErrorKind::NotFound => return Ok(None),
        result => result?,
    };
    if !canonical.starts_with(&base) || canonical == base {
        return Err(AppError::new("outsideLibrary", "备份目录超出允许范围"));
    }
    if !canonical.is_dir() {
        return Err(AppError::new("io", "备份位置不是文件夹"));
    }
    Ok(Some(canonical))
}

fn parse_name(name: &str) -> Option<(String, BackupKind)> {
    let stem = name.strip_prefix("client-desk-")?.strip_suffix(".db")?;
    let (stamp, kind) = if let Some(value) = stem.strip_suffix("-before-restore") {
        (value, BackupKind::BeforeRestore)
    } else if let Some(value) = stem.strip_suffix("-manual") {
        (value, BackupKind::Manual)
    } else {
        (stem, BackupKind::Auto)
    };
    let time = NaiveDateTime::parse_from_str(stamp, STAMP_FORMAT).ok()?;
    if time.format(STAMP_FORMAT).to_string() != stamp {
        return None;
    }
    Some((
        time.and_utc().to_rfc3339_opts(SecondsFormat::Secs, true),
        kind,
    ))
}

fn info(path: PathBuf, name: String, created_at: String, kind: BackupKind) -> Result<BackupInfo> {
    Ok(BackupInfo {
        size_bytes: fs::metadata(&path)?.len(),
        path: crate::library::display(&path),
        file_name: name,
        created_at,
        kind,
    })
}

pub fn list(conn: &Connection, data_dir: &Path) -> Result<Vec<BackupInfo>> {
    let Some(dir) = directory(conn, data_dir, false)? else {
        return Ok(vec![]);
    };
    let mut backups = Vec::new();
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let name = entry.file_name();
        let Some((created, kind)) = name.to_str().and_then(parse_name) else {
            continue;
        };
        if entry.file_type()?.is_file() && entry.metadata()?.len() > 0 {
            backups.push(info(
                entry.path(),
                name.to_string_lossy().into_owned(),
                created,
                kind,
            )?);
        }
    }
    backups.sort_by(|a, b| {
        b.created_at
            .cmp(&a.created_at)
            .then_with(|| b.file_name.cmp(&a.file_name))
    });
    Ok(backups)
}

// Keep the exact filename format even for two manual backups requested in the same second.
fn publish(dir: &Path, pending: &Path, kind: BackupKind) -> Result<BackupInfo> {
    let suffix = match kind {
        BackupKind::Auto => "",
        BackupKind::Manual => "-manual",
        BackupKind::BeforeRestore => "-before-restore",
    };
    let started = Instant::now();
    loop {
        let time = Utc::now();
        let name = format!("client-desk-{}{suffix}.db", time.format(STAMP_FORMAT));
        let path = dir.join(&name);
        match fs::File::create_new(&path) {
            Ok(file) => {
                drop(file);
                if let Err(error) = fs::rename(pending, &path) {
                    let _ = fs::remove_file(&path);
                    return Err(error.into());
                }
                return info(
                    path,
                    name,
                    time.to_rfc3339_opts(SecondsFormat::Secs, true),
                    kind,
                );
            }
            Err(e)
                if e.kind() == ErrorKind::AlreadyExists
                    && started.elapsed() < Duration::from_secs(5) =>
            {
                std::thread::sleep(Duration::from_millis(50));
            }
            Err(e) => return Err(e.into()),
        }
    }
}

fn snapshot(conn: &Connection, data_dir: &Path, kind: BackupKind) -> Result<BackupInfo> {
    let dir =
        directory(conn, data_dir, true)?.ok_or_else(|| AppError::new("io", "无法创建备份目录"))?;
    let pending = dir.join(format!(".{}.tmp", Uuid::new_v4()));
    // SQLite only opens the staging path after we have exclusively created it.
    fs::File::create_new(&pending)?;
    let result = (|| {
        conn.backup(MAIN_DB, &pending, None)?;
        // Publish a standalone file, including any pages originally in the source WAL.
        Connection::open(&pending)?.pragma_update(None, "journal_mode", "DELETE")?;
        publish(&dir, &pending, kind)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&pending);
    }
    result
}

pub fn create(conn: &Connection, data_dir: &Path) -> Result<BackupInfo> {
    snapshot(conn, data_dir, BackupKind::Manual)
}

pub fn auto(conn: &Connection, data_dir: &Path) -> Result<()> {
    let today = Local::now().date_naive().to_string();
    if settings::read::<String>(conn, "lastAutoBackupDate")?.as_deref() == Some(&today) {
        return Ok(());
    }
    snapshot(conn, data_dir, BackupKind::Auto)?;
    for old in list(conn, data_dir)?
        .into_iter()
        .filter(|item| item.kind == BackupKind::Auto)
        .skip(AUTO_LIMIT)
    {
        fs::remove_file(old.path)?;
    }
    settings::write(conn, "lastAutoBackupDate", &today)
}

fn validate_source(conn: &Connection) -> Result<()> {
    let version: i64 = conn.pragma_query_value(None, "user_version", |r| r.get(0))?;
    if !(1..=db::SCHEMA_VERSION).contains(&version) {
        return Err(AppError::invalid("备份文件的数据库版本不兼容"));
    }
    // Validate against the source's schema before upgrading a private copy.
    let expected = Connection::open_in_memory()?;
    if version == 1 {
        expected.execute_batch(include_str!("schema.sql"))?;
    } else {
        db::migrate(&expected)?;
    }
    let check: String = conn.query_row("PRAGMA quick_check(1)", [], |r| r.get(0))?;
    if schema_signature(conn)? != schema_signature(&expected)?
        || check != "ok"
        || conn.prepare("PRAGMA foreign_key_check")?.exists([])?
    {
        return Err(AppError::invalid("备份数据库结构或数据不完整"));
    }
    settings::get(conn)?;
    Ok(())
}

fn schema_signature(conn: &Connection) -> Result<Vec<(String, String, String)>> {
    // These are application-owned snapshots. Compare the full definitions, including
    // foreign keys, CHECK/UNIQUE constraints and indexes, not just compatible columns.
    let mut stmt = conn.prepare(
        "SELECT type,name,sql FROM sqlite_schema
         WHERE type IN ('table','index','trigger') AND name NOT LIKE 'sqlite_%'
         AND sql IS NOT NULL ORDER BY type,name",
    )?;
    let rows = stmt.query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn restore(conn: &mut Connection, data_dir: &Path, file_name: &str) -> Result<()> {
    if file_name.contains(['/', '\\', ':']) {
        return Err(AppError::new("outsideLibrary", "请选择备份目录内的文件"));
    }
    if parse_name(file_name).is_none() {
        return Err(AppError::invalid("请选择有效的客户工作台备份文件"));
    }
    let dir = directory(conn, data_dir, false)?.ok_or_else(AppError::not_found)?;
    let selected = dir.join(file_name);
    let path = selected.canonicalize()?;
    if !path.starts_with(&dir) || !selected.symlink_metadata()?.is_file() {
        return Err(AppError::new("outsideLibrary", "备份文件不在备份目录内"));
    }
    let source = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let source_tx = source.unchecked_transaction()?;
    validate_source(&source_tx)?;
    // Upgrade off to the side. Invalid/failed migrations leave the live database untouched.
    let mut upgraded = Connection::open_in_memory()?;
    {
        let copy = Backup::new(&source_tx, &mut upgraded)?;
        if !matches!(copy.step(-1)?, StepResult::Done) {
            return Err(AppError::new("db", "暂时无法读取备份，请稍后重试"));
        }
    }
    db::migrate(&upgraded)?;
    validate_source(&upgraded)?;
    snapshot(conn, data_dir, BackupKind::BeforeRestore)?;
    {
        let restore = Backup::new(&upgraded, conn)?;
        if !matches!(restore.step(-1)?, StepResult::Done) {
            return Err(AppError::new("db", "数据库正在使用，请稍后重试恢复"));
        }
    }
    db::configure(conn)
}
