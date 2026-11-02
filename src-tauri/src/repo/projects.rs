use crate::{
    error::{AppError, Result},
    library,
    models::{ActivityKind, MutationResult, Project, ProjectInput, ProjectPatch, ProjectStatus},
};
use chrono::Local;
use rusqlite::{params, Connection, Row};
use serde_json::json;
use std::path::Path;

const SELECT: &str = "
    SELECT p.*, c.name AS client_name,
        (SELECT json_group_array(tag_id) FROM
            (SELECT tag_id FROM project_tags WHERE project_id=p.id ORDER BY tag_id)) AS tag_ids,
        (SELECT COALESCE(SUM(CASE kind WHEN 'income' THEN amount_cents ELSE -amount_cents END),0)
            FROM payments WHERE project_id=p.id) AS received_cents,
        (SELECT COUNT(*) FROM payments WHERE project_id=p.id) AS payment_count
    FROM projects p JOIN clients c ON c.id=p.client_id
    WHERE p.deleted_at IS NULL AND c.deleted_at IS NULL";

fn from_row(row: &Row<'_>) -> rusqlite::Result<Project> {
    let folder: Option<String> = row.get("folder")?;
    Ok(Project {
        id: row.get("id")?,
        client_id: row.get("client_id")?,
        client_name: row.get("client_name")?,
        title: row.get("title")?,
        status: row.get("status")?,
        pinned: row.get("pinned")?,
        brief: row.get("brief")?,
        source_platform: row.get("source_platform")?,
        source_order_no: row.get("source_order_no")?,
        start_date: row.get("start_date")?,
        due_date: row.get("due_date")?,
        delivered_at: row.get("delivered_at")?,
        completed_at: row.get("completed_at")?,
        price_cents: row.get("price_cents")?,
        cost_cents: row.get("cost_cents")?,
        tag_ids: super::json_column(row, "tag_ids")?,
        // Filesystem-derived fields are populated after releasing the database lock.
        file_count: 0,
        cover_path: None,
        folder,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
        received_cents: row.get("received_cents")?,
        payment_count: row.get("payment_count")?,
    })
}

pub fn list(connection: &Connection, root: Option<&Path>) -> Result<Vec<Project>> {
    let mut projects = list_records(connection)?;
    for project in &mut projects {
        library::populate_project_files(project, root);
    }
    Ok(projects)
}

pub fn list_records(connection: &Connection) -> Result<Vec<Project>> {
    let sql = format!(
        "{SELECT} ORDER BY p.pinned DESC,p.due_date IS NULL,p.due_date,p.updated_at DESC,p.id"
    );
    let mut statement = connection.prepare(&sql)?;
    let rows = statement.query_map([], from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn get(connection: &Connection, root: Option<&Path>, id: &str) -> Result<Project> {
    let mut project = get_record(connection, id)?;
    library::populate_project_files(&mut project, root);
    Ok(project)
}

pub fn get_record(connection: &Connection, id: &str) -> Result<Project> {
    Ok(connection.query_row(&format!("{SELECT} AND p.id=?1"), [id], from_row)?)
}

fn validate(
    title: &str,
    start_date: Option<&str>,
    due_date: Option<&str>,
    price: i64,
    cost: i64,
) -> Result<()> {
    super::nonempty(title, "项目名称")?;
    for date in [start_date, due_date].into_iter().flatten() {
        super::date(date)?;
    }
    if price < 0 || cost < 0 {
        return Err(AppError::invalid("报价和成本必须为非负整数"));
    }
    Ok(())
}

pub fn create(
    connection: &Connection,
    _root: Option<&Path>,
    input: ProjectInput,
) -> Result<Project> {
    create_record(connection, input)
}

pub fn create_record(connection: &Connection, input: ProjectInput) -> Result<Project> {
    let price = input.price_cents.unwrap_or(0);
    let cost = input.cost_cents.unwrap_or(0);
    validate(
        &input.title,
        input.start_date.as_deref(),
        input.due_date.as_deref(),
        price,
        cost,
    )?;
    let status = input.status.unwrap_or(ProjectStatus::Active);
    let today = Local::now().date_naive().to_string();
    let id = super::id();
    let timestamp = super::now();
    let transaction = connection.unchecked_transaction()?;
    super::active_client(&transaction, &input.client_id)?;
    transaction.execute(
        "INSERT INTO projects(id,client_id,title,status,pinned,brief,source_platform,source_order_no,
            start_date,due_date,delivered_at,completed_at,price_cents,cost_cents,created_at,updated_at)
         VALUES(?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15,?15)",
        params![id,input.client_id,input.title.trim(),status.as_str(),input.pinned.unwrap_or(false),input.brief.unwrap_or_default(),
            input.source_platform.unwrap_or_default(),input.source_order_no.unwrap_or_default(),input.start_date,input.due_date,
            (status==ProjectStatus::Delivered).then_some(&today),(status==ProjectStatus::Done).then_some(&today),
            price,cost,timestamp],
    )?;
    super::tags::assign(&transaction, &id, &input.tag_ids.unwrap_or_default(), true)?;
    super::activities::insert(
        &transaction,
        &input.client_id,
        Some(&id),
        ActivityKind::Created,
        "创建了项目",
        json!({}),
    )?;
    let project = get_record(&transaction, &id)?;
    transaction.commit()?;
    Ok(project)
}

pub fn update(
    connection: &Connection,
    root: Option<&Path>,
    id: &str,
    patch: ProjectPatch,
) -> Result<MutationResult<Project>> {
    let current = get_record(connection, id)?;
    let rename = patch.rename_folder.unwrap_or(false)
        && patch
            .title
            .as_deref()
            .is_some_and(|title| title.trim() != current.title)
        && current.folder.is_some();
    let mut result = update_record(connection, id, patch)?;
    if rename {
        result.warning = library::rename_project_folder(connection, root, id)
            .err()
            .map(|error| format!("folderRenameFailed：项目已保存。{}", error.message));
    }
    result.value = get(connection, root, id)?;
    Ok(result)
}

pub fn update_record(
    connection: &Connection,
    id: &str,
    patch: ProjectPatch,
) -> Result<MutationResult<Project>> {
    let transaction = connection.unchecked_transaction()?;
    let current = get_record(&transaction, id)?;
    let client_id = patch.client_id.as_deref().unwrap_or(&current.client_id);
    let title = patch.title.as_deref().unwrap_or(&current.title).trim();
    let start = patch.start_date.unwrap_or(current.start_date);
    let due = patch.due_date.unwrap_or(current.due_date);
    let price = patch.price_cents.unwrap_or(current.price_cents);
    let cost = patch.cost_cents.unwrap_or(current.cost_cents);
    validate(title, start.as_deref(), due.as_deref(), price, cost)?;
    if client_id != current.client_id {
        super::active_client(&transaction, client_id)?;
        transaction.execute(
            "UPDATE activities SET client_id=?2 WHERE project_id=?1",
            params![id, client_id],
        )?;
    }
    transaction.execute(
        "UPDATE projects SET client_id=?2,title=?3,pinned=?4,brief=?5,source_platform=?6,source_order_no=?7,
            start_date=?8,due_date=?9,price_cents=?10,cost_cents=?11,updated_at=?12 WHERE id=?1",
        params![id,client_id,title,patch.pinned.unwrap_or(current.pinned),patch.brief.unwrap_or(current.brief),
            patch.source_platform.unwrap_or(current.source_platform),patch.source_order_no.unwrap_or(current.source_order_no),
            start,due,price,cost,super::now()],
    )?;
    transaction.commit()?;
    Ok(MutationResult {
        value: get_record(connection, id)?,
        warning: None,
    })
}

pub fn set_status(
    connection: &Connection,
    root: Option<&Path>,
    id: &str,
    status: ProjectStatus,
) -> Result<Project> {
    let mut project = set_status_record(connection, id, status)?;
    library::populate_project_files(&mut project, root);
    Ok(project)
}

pub fn set_status_record(
    connection: &Connection,
    id: &str,
    status: ProjectStatus,
) -> Result<Project> {
    let transaction = connection.unchecked_transaction()?;
    let current = get_record(&transaction, id)?;
    if status != current.status {
        let today = Local::now().date_naive().to_string();
        transaction.execute(
            "UPDATE projects SET status=?2,
              delivered_at=CASE WHEN ?2='delivered' THEN COALESCE(delivered_at,?3) ELSE delivered_at END,
              completed_at=CASE WHEN ?2='done' THEN ?3 ELSE NULL END,updated_at=?4 WHERE id=?1",
            params![id,status.as_str(),today,super::now()],
        )?;
        super::activities::insert(
            &transaction,
            &current.client_id,
            Some(id),
            ActivityKind::Status,
            "变更了项目状态",
            json!({"from":current.status,"to":status}),
        )?;
    }
    let project = get_record(&transaction, id)?;
    transaction.commit()?;
    Ok(project)
}

pub fn duplicate(connection: &Connection, _root: Option<&Path>, id: &str) -> Result<Project> {
    duplicate_record(connection, id)
}

pub fn duplicate_record(connection: &Connection, id: &str) -> Result<Project> {
    let original = get_record(connection, id)?;
    create_record(
        connection,
        ProjectInput {
            client_id: original.client_id,
            title: format!("{}（副本）", original.title),
            status: Some(ProjectStatus::Lead),
            pinned: Some(original.pinned),
            brief: Some(original.brief),
            source_platform: Some(original.source_platform),
            source_order_no: Some(original.source_order_no),
            start_date: original.start_date,
            due_date: original.due_date,
            price_cents: Some(original.price_cents),
            cost_cents: Some(original.cost_cents),
            tag_ids: Some(original.tag_ids),
        },
    )
}

pub fn delete(connection: &Connection, id: &str) -> Result<()> {
    let changed = connection.execute(
        "UPDATE projects SET deleted_at=?2,updated_at=?2,deleted_with_client=0
         WHERE id=?1 AND deleted_at IS NULL AND client_id IN (SELECT id FROM clients WHERE deleted_at IS NULL)",
        params![id,super::now()],
    )?;
    if changed == 0 {
        return Err(AppError::not_found());
    }
    Ok(())
}
