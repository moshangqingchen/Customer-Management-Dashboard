use crate::error::{AppError, Result};
use rusqlite::Connection;
use std::{path::Path, time::Duration};

pub fn open(path: &Path) -> Result<Connection> {
    let connection = Connection::open(path)?;
    configure(&connection)?;
    migrate(&connection)?;
    Ok(connection)
}

pub fn configure(connection: &Connection) -> Result<()> {
    connection.busy_timeout(Duration::from_secs(5))?;
    connection.pragma_update(None, "journal_mode", "WAL")?;
    connection.pragma_update(None, "foreign_keys", "ON")?;
    Ok(())
}

/// Merges committed WAL pages into the main file and empties the WAL. SQLite only does
/// this by itself once the WAL grows large, and a process exit skips the final merge.
pub fn checkpoint(connection: &Connection) -> Result<()> {
    let busy: i64 =
        connection.query_row("PRAGMA wal_checkpoint(TRUNCATE)", [], |row| row.get(0))?;
    if busy != 0 {
        return Err(AppError::new("db", "数据库正在使用，暂时无法合并"));
    }
    Ok(())
}

pub fn migrate(connection: &Connection) -> Result<()> {
    let transaction = connection.unchecked_transaction()?;
    let version: i64 = transaction.pragma_query_value(None, "user_version", |row| row.get(0))?;
    match version {
        0 => {
            transaction.execute_batch(include_str!("schema.sql"))?;
            crate::repo::settings::initialize(&transaction)?;
            transaction.pragma_update(None, "user_version", 1)?;
        }
        1 => {}
        _ => {
            return Err(AppError::new(
                "db",
                "数据库版本高于当前应用，请使用较新版本打开",
            ))
        }
    }
    transaction.commit()?;
    Ok(())
}
