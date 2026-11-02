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
