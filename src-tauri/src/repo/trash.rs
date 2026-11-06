use crate::{
    error::{AppError, Result},
    models::{TrashItem, TrashType},
};
use rusqlite::{params, Connection};

pub fn list(connection: &Connection) -> Result<Vec<TrashItem>> {
    let mut statement = connection.prepare(
        "SELECT 'client' AS type,id,name AS title,company AS subtitle,deleted_at FROM clients WHERE deleted_at IS NOT NULL
         AND NOT EXISTS(SELECT 1 FROM client_management m WHERE m.client_id=clients.id AND m.merged_into IS NOT NULL)
         UNION ALL
         SELECT 'project',p.id,p.title,c.name,p.deleted_at FROM projects p JOIN clients c ON c.id=p.client_id
            WHERE p.deleted_at IS NOT NULL ORDER BY deleted_at DESC,type,id"
    )?;
    let rows = statement.query_map([], |row| {
        Ok(TrashItem {
            r#type: row.get("type")?,
            id: row.get("id")?,
            title: row.get("title")?,
            subtitle: row.get("subtitle")?,
            deleted_at: row.get("deleted_at")?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn restore(connection: &Connection, kind: TrashType, id: &str) -> Result<()> {
    let transaction = connection.unchecked_transaction()?;
    let timestamp = super::now();
    match kind {
        TrashType::Client => {
            crate::customer_management::ensure_not_merged(&transaction, id)?;
            if transaction.execute("UPDATE clients SET deleted_at=NULL,updated_at=?2 WHERE id=?1 AND deleted_at IS NOT NULL", params![id,timestamp])? == 0 {
                return Err(AppError::not_found());
            }
            transaction.execute(
                "UPDATE projects SET deleted_at=NULL,deleted_with_client=0,updated_at=?2
                WHERE client_id=?1 AND deleted_with_client=1 AND deleted_at IS NOT NULL",
                params![id, timestamp],
            )?;
        }
        TrashType::Project => {
            let parent_deleted: bool = transaction.query_row(
                "SELECT c.deleted_at IS NOT NULL FROM projects p JOIN clients c ON c.id=p.client_id
                 WHERE p.id=?1 AND p.deleted_at IS NOT NULL",
                [id],
                |row| row.get(0),
            )?;
            if parent_deleted {
                return Err(AppError::invalid("请先从回收站恢复该项目所属的客户"));
            }
            transaction.execute("UPDATE projects SET deleted_at=NULL,deleted_with_client=0,updated_at=?2 WHERE id=?1",params![id,timestamp])?;
        }
    }
    transaction.commit()?;
    Ok(())
}

pub fn purge(connection: &Connection, kind: TrashType, id: &str) -> Result<()> {
    let transaction = connection.unchecked_transaction()?;
    let removed = match kind {
        TrashType::Project => transaction.execute(
            "DELETE FROM projects WHERE id=?1 AND deleted_at IS NOT NULL",
            [id],
        )?,
        TrashType::Client => {
            crate::customer_management::ensure_not_merged(&transaction, id)?;
            // The first delete is restricted to a trashed parent even on a stale request.
            transaction.execute(
                "DELETE FROM projects WHERE client_id=?1
                AND EXISTS(SELECT 1 FROM clients WHERE id=?1 AND deleted_at IS NOT NULL)",
                [id],
            )?;
            transaction.execute(
                "DELETE FROM clients WHERE id=?1 AND deleted_at IS NOT NULL",
                [id],
            )?
        }
    };
    if removed == 0 {
        return Err(AppError::not_found());
    }
    transaction.commit()?;
    Ok(())
}
