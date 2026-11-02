use crate::{
    error::{AppError, Result},
    models::{Client, ClientInput, ClientPatch, MutationResult},
};
use rusqlite::{params, Connection, Row};
use std::path::Path;

const SELECT: &str = "
    WITH project_totals AS (
        SELECT p.id,p.client_id,p.price_cents,p.status,p.created_at,
            COALESCE(SUM(CASE m.kind WHEN 'income' THEN m.amount_cents ELSE -m.amount_cents END),0) AS received
        FROM projects p LEFT JOIN payments m ON m.project_id=p.id
        WHERE p.deleted_at IS NULL GROUP BY p.id
    ), client_totals AS (
        SELECT client_id,COUNT(*) AS project_count,SUM(status NOT IN ('done','cancelled')) AS open_count,
            SUM(CASE WHEN status<>'cancelled' THEN price_cents ELSE 0 END) AS billed,SUM(received) AS received,
            SUM(CASE WHEN status<>'cancelled' THEN MAX(price_cents-received,0) ELSE 0 END) AS outstanding,
            MIN(created_at) AS first_project_at
        FROM project_totals GROUP BY client_id
    )
    SELECT c.*, COALESCE(t.project_count,0) AS project_count, COALESCE(t.open_count,0) AS open_project_count,
        COALESCE(t.billed,0) AS billed_cents, COALESCE(t.received,0) AS received_cents,
        COALESCE(t.outstanding,0) AS outstanding_cents,t.first_project_at,
        (SELECT json_group_array(tag_id) FROM (SELECT tag_id FROM client_tags WHERE client_id=c.id ORDER BY tag_id)) AS tag_ids,
        COALESCE((SELECT MAX(a.created_at) FROM activities a LEFT JOIN projects p ON p.id=a.project_id
            WHERE a.client_id=c.id AND p.deleted_at IS NULL),c.updated_at) AS last_activity_at
    FROM clients c LEFT JOIN client_totals t ON c.id=t.client_id WHERE c.deleted_at IS NULL";

fn from_row(row: &Row<'_>) -> rusqlite::Result<Client> {
    Ok(Client {
        id: row.get("id")?,
        name: row.get("name")?,
        company: row.get("company")?,
        phone: row.get("phone")?,
        wechat: row.get("wechat")?,
        email: row.get("email")?,
        address: row.get("address")?,
        accounts: super::json_column(row, "accounts")?,
        rating: row.get("rating")?,
        pinned: row.get("pinned")?,
        notes: row.get("notes")?,
        folder: row.get("folder")?,
        tag_ids: super::json_column(row, "tag_ids")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        project_count: row.get("project_count")?,
        open_project_count: row.get("open_project_count")?,
        billed_cents: row.get("billed_cents")?,
        received_cents: row.get("received_cents")?,
        outstanding_cents: row.get("outstanding_cents")?,
        first_project_at: row.get("first_project_at")?,
        last_activity_at: row.get("last_activity_at")?,
    })
}

pub fn list(connection: &Connection) -> Result<Vec<Client>> {
    let mut statement = connection.prepare(&format!(
        "{SELECT} ORDER BY c.pinned DESC,c.updated_at DESC,c.id"
    ))?;
    let rows = statement.query_map([], from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn get(connection: &Connection, id: &str) -> Result<Client> {
    Ok(connection.query_row(&format!("{SELECT} AND c.id=?1"), [id], from_row)?)
}

fn validate(name: &str, rating: i64) -> Result<()> {
    super::nonempty(name, "客户名称")?;
    if !(0..=5).contains(&rating) {
        return Err(AppError::invalid("星级必须在 0 到 5 之间"));
    }
    Ok(())
}

pub fn create(connection: &Connection, input: ClientInput) -> Result<Client> {
    validate(&input.name, input.rating.unwrap_or(0))?;
    let id = super::id();
    let timestamp = super::now();
    let transaction = connection.unchecked_transaction()?;
    transaction.execute("INSERT INTO clients(id,name,company,phone,wechat,email,address,accounts,rating,pinned,notes,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?12)", params![id,input.name.trim(),input.company.unwrap_or_default(),input.phone.unwrap_or_default(),input.wechat.unwrap_or_default(),input.email.unwrap_or_default(),input.address.unwrap_or_default(),serde_json::to_string(&input.accounts.unwrap_or_default())?,input.rating.unwrap_or(0),input.pinned.unwrap_or(false),input.notes.unwrap_or_default(),timestamp])?;
    super::tags::assign(&transaction, &id, &input.tag_ids.unwrap_or_default(), false)?;
    transaction.commit()?;
    get(connection, &id)
}

pub fn update(
    connection: &Connection,
    root: Option<&Path>,
    id: &str,
    patch: ClientPatch,
) -> Result<MutationResult<Client>> {
    let current = get(connection, id)?;
    let rename = patch.rename_folder.unwrap_or(false)
        && patch
            .name
            .as_deref()
            .is_some_and(|name| name.trim() != current.name)
        && current.folder.is_some();
    let mut result = update_record(connection, id, patch)?;
    if rename {
        result.warning = crate::library::rename_client_folder(connection, root, id)
            .err()
            .map(|error| format!("folderRenameFailed：客户资料已保存。{}", error.message));
    }
    result.value = get(connection, id)?;
    Ok(result)
}

pub fn update_record(
    connection: &Connection,
    id: &str,
    patch: ClientPatch,
) -> Result<MutationResult<Client>> {
    let transaction = connection.unchecked_transaction()?;
    let current = get(&transaction, id)?;
    let name = patch.name.unwrap_or_else(|| current.name.clone());
    let rating = patch.rating.unwrap_or(current.rating);
    validate(&name, rating)?;
    transaction.execute("UPDATE clients SET name=?1,company=?2,phone=?3,wechat=?4,email=?5,address=?6,accounts=?7,rating=?8,pinned=?9,notes=?10,updated_at=?11 WHERE id=?12", params![name.trim(),patch.company.unwrap_or(current.company),patch.phone.unwrap_or(current.phone),patch.wechat.unwrap_or(current.wechat),patch.email.unwrap_or(current.email),patch.address.unwrap_or(current.address),serde_json::to_string(&patch.accounts.unwrap_or(current.accounts))?,rating,patch.pinned.unwrap_or(current.pinned),patch.notes.unwrap_or(current.notes),super::now(),id])?;
    transaction.commit()?;
    Ok(MutationResult {
        value: get(connection, id)?,
        warning: None,
    })
}

pub fn delete(connection: &Connection, id: &str) -> Result<()> {
    let transaction = connection.unchecked_transaction()?;
    super::active_client(&transaction, id)?;
    let timestamp = super::now();
    transaction.execute(
        "UPDATE clients SET deleted_at=?1,updated_at=?1 WHERE id=?2",
        params![timestamp, id],
    )?;
    transaction.execute("UPDATE projects SET deleted_at=?1,updated_at=?1,deleted_with_client=1 WHERE client_id=?2 AND deleted_at IS NULL", params![timestamp,id])?;
    transaction.commit()?;
    Ok(())
}
