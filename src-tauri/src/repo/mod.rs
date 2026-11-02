pub mod activities;
pub mod clients;
pub mod payments;
pub mod projects;
pub mod settings;
pub mod snippets;
pub mod tags;
pub mod trash;

use crate::error::{AppError, Result};
use chrono::{NaiveDate, SecondsFormat, Utc};
use rusqlite::{Connection, Row};
use serde::de::DeserializeOwned;

pub fn now() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Nanos, true)
}

pub fn id() -> String {
    uuid::Uuid::new_v4().to_string()
}

pub fn nonempty(value: &str, label: &str) -> Result<()> {
    if value.trim().is_empty() {
        return Err(AppError::invalid(format!("{label}不能为空")));
    }
    Ok(())
}

pub fn date(value: &str) -> Result<()> {
    if value.len() != 10 || NaiveDate::parse_from_str(value, "%Y-%m-%d").is_err() {
        return Err(AppError::invalid("日期必须为有效的 YYYY-MM-DD 日期"));
    }
    Ok(())
}

pub fn json_column<T: DeserializeOwned>(row: &Row<'_>, name: &str) -> rusqlite::Result<T> {
    let value: String = row.get(name)?;
    serde_json::from_str(&value).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(
            row.as_ref().column_index(name).unwrap_or(0),
            rusqlite::types::Type::Text,
            Box::new(error),
        )
    })
}

pub fn active_client(connection: &Connection, id: &str) -> Result<()> {
    connection.query_row(
        "SELECT id FROM clients WHERE id=?1 AND deleted_at IS NULL",
        [id],
        |_| Ok(()),
    )?;
    Ok(())
}

pub fn project_client(connection: &Connection, id: &str) -> Result<String> {
    Ok(connection.query_row("SELECT p.client_id FROM projects p JOIN clients c ON c.id=p.client_id WHERE p.id=?1 AND p.deleted_at IS NULL AND c.deleted_at IS NULL", [id], |row| row.get(0))?)
}
