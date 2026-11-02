use crate::{
    error::{AppError, Result},
    models::{Activity, ActivityKind},
};
use rusqlite::{params, Connection, Row};
use serde_json::Value;

const SELECT: &str = "SELECT a.*, c.name AS client_name, p.title AS project_title FROM activities a JOIN clients c ON c.id=a.client_id LEFT JOIN projects p ON p.id=a.project_id WHERE c.deleted_at IS NULL AND (a.project_id IS NULL OR p.deleted_at IS NULL)";

fn from_row(row: &Row<'_>) -> rusqlite::Result<Activity> {
    Ok(Activity {
        id: row.get("id")?,
        client_id: row.get("client_id")?,
        project_id: row.get("project_id")?,
        client_name: row.get("client_name")?,
        project_title: row.get("project_title")?,
        kind: row.get("kind")?,
        body: row.get("body")?,
        meta: super::json_column(row, "meta")?,
        created_at: row.get("created_at")?,
    })
}

pub fn insert(
    connection: &Connection,
    client_id: &str,
    project_id: Option<&str>,
    kind: ActivityKind,
    body: &str,
    meta: Value,
) -> Result<String> {
    let id = super::id();
    connection.execute("INSERT INTO activities(id,client_id,project_id,kind,body,meta,created_at) VALUES(?1,?2,?3,?4,?5,?6,?7)", params![id, client_id, project_id, kind.as_str(), body, meta.to_string(), super::now()])?;
    Ok(id)
}

pub fn get(connection: &Connection, id: &str) -> Result<Activity> {
    Ok(connection.query_row(&format!("{SELECT} AND a.id=?1"), [id], from_row)?)
}

pub fn list(
    connection: &Connection,
    client_id: Option<&str>,
    project_id: Option<&str>,
    limit: Option<u32>,
) -> Result<Vec<Activity>> {
    let mut statement = connection.prepare(&format!(
        "{SELECT} AND (?1 IS NULL OR a.client_id=?1) AND (?2 IS NULL OR a.project_id=?2)
         ORDER BY a.created_at DESC,a.rowid DESC LIMIT ?3"
    ))?;
    let rows = statement.query_map(
        params![client_id, project_id, limit.map(i64::from).unwrap_or(-1)],
        from_row,
    )?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}

pub fn add_note(
    connection: &Connection,
    client_id: &str,
    project_id: Option<&str>,
    body: &str,
) -> Result<Activity> {
    super::nonempty(body, "备注")?;
    let transaction = connection.unchecked_transaction()?;
    super::active_client(&transaction, client_id)?;
    if let Some(project_id) = project_id {
        if super::project_client(&transaction, project_id)? != client_id {
            return Err(AppError::invalid("项目与客户不匹配"));
        }
    }
    let id = insert(
        &transaction,
        client_id,
        project_id,
        ActivityKind::Note,
        body,
        serde_json::json!({}),
    )?;
    transaction.commit()?;
    get(connection, &id)
}

pub fn update_note(connection: &Connection, id: &str, body: &str) -> Result<Activity> {
    super::nonempty(body, "备注")?;
    let activity = get(connection, id)?;
    if activity.kind != ActivityKind::Note {
        return Err(AppError::invalid("只能编辑手写备注"));
    }
    connection.execute(
        "UPDATE activities SET body=?1 WHERE id=?2 AND kind='note'",
        params![body, id],
    )?;
    get(connection, id)
}

pub fn delete(connection: &Connection, id: &str) -> Result<()> {
    if get(connection, id)?.kind != ActivityKind::Note {
        return Err(AppError::invalid("只能删除手写备注"));
    }
    connection.execute("DELETE FROM activities WHERE id=?1 AND kind='note'", [id])?;
    Ok(())
}
