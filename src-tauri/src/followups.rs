pub mod commands;

use crate::{
    error::{AppError, Result},
    models::ActivityKind,
    repo,
};
use chrono::{DateTime, SecondsFormat, Utc};
use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Deserializer, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FollowUp {
    pub id: String,
    pub client_id: String,
    pub client_name: String,
    pub project_id: Option<String>,
    pub project_title: Option<String>,
    pub project_available: bool,
    pub title: String,
    pub due_at: String,
    pub notes: String,
    pub status: String,
    pub result: String,
    pub completed_at: Option<String>,
    pub revision: i64,
    pub reminded_revision: Option<i64>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FollowUpInput {
    pub client_id: String,
    pub project_id: Option<String>,
    pub title: String,
    pub due_at: String,
    #[serde(default)]
    pub notes: String,
}

fn nullable<'de, D: Deserializer<'de>>(
    deserializer: D,
) -> std::result::Result<Option<Option<String>>, D::Error> {
    Option::<String>::deserialize(deserializer).map(Some)
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FollowUpPatch {
    #[serde(default, deserialize_with = "nullable")]
    pub project_id: Option<Option<String>>,
    pub title: Option<String>,
    pub due_at: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Default, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct FollowUpFilter {
    pub client_id: Option<String>,
    pub status: Option<String>,
}

const SELECT: &str = "SELECT f.*,c.name AS client_name,p.title AS project_title,
    (f.project_id IS NULL OR (p.id IS NOT NULL AND p.deleted_at IS NULL AND p.client_id=f.client_id)) AS project_available
    FROM follow_ups f JOIN clients c ON c.id=f.client_id LEFT JOIN projects p ON p.id=f.project_id
    WHERE c.deleted_at IS NULL";

fn from_row(row: &Row<'_>) -> rusqlite::Result<FollowUp> {
    Ok(FollowUp {
        id: row.get("id")?,
        client_id: row.get("client_id")?,
        client_name: row.get("client_name")?,
        project_id: row.get("project_id")?,
        project_title: row.get("project_title")?,
        project_available: row.get("project_available")?,
        title: row.get("title")?,
        due_at: row.get("due_at")?,
        notes: row.get("notes")?,
        status: row.get("status")?,
        result: row.get("result")?,
        completed_at: row.get("completed_at")?,
        revision: row.get("revision")?,
        reminded_revision: row.get("reminded_revision")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

fn canonical_time(value: &str) -> Result<String> {
    DateTime::parse_from_rfc3339(value)
        .map(|time| {
            time.with_timezone(&Utc)
                .to_rfc3339_opts(SecondsFormat::Millis, true)
        })
        .map_err(|_| AppError::invalid("请选择有效的跟进日期和时间"))
}
fn current_time() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}
fn validate_status(value: &str) -> Result<()> {
    if !["pending", "completed", "cancelled"].contains(&value) {
        return Err(AppError::invalid("跟进状态无效"));
    }
    Ok(())
}
fn validate_relation(db: &Connection, client_id: &str, project_id: Option<&str>) -> Result<()> {
    repo::active_client(db, client_id)?;
    if let Some(project_id) = project_id {
        if repo::project_client(db, project_id)? != client_id {
            return Err(AppError::invalid("关联项目不属于这个客户"));
        }
    }
    Ok(())
}
pub fn get(db: &Connection, id: &str) -> Result<FollowUp> {
    Ok(db.query_row(&format!("{SELECT} AND f.id=?1"), [id], from_row)?)
}
pub fn list(db: &Connection, filter: FollowUpFilter) -> Result<Vec<FollowUp>> {
    if let Some(status) = &filter.status {
        validate_status(status)?;
    }
    let mut statement = db.prepare(&format!("{SELECT} AND (?1 IS NULL OR f.client_id=?1) AND (?2 IS NULL OR f.status=?2) ORDER BY f.due_at,f.id"))?;
    let rows = statement.query_map(params![filter.client_id, filter.status], from_row)?;
    Ok(rows.collect::<rusqlite::Result<Vec<_>>>()?)
}
fn event(db: &Connection, item: &FollowUp, body: &str) -> Result<()> {
    repo::activities::insert(
        db,
        &item.client_id,
        if item.project_available {
            item.project_id.as_deref()
        } else {
            None
        },
        ActivityKind::Status,
        body,
        serde_json::json!({"entity":"followUp","followUpId":item.id,"status":item.status}),
    )?;
    Ok(())
}
pub fn create(db: &Connection, input: FollowUpInput) -> Result<FollowUp> {
    repo::nonempty(&input.title, "跟进主题")?;
    let due_at = canonical_time(&input.due_at)?;
    let tx = db.unchecked_transaction()?;
    validate_relation(&tx, &input.client_id, input.project_id.as_deref())?;
    let id = repo::id();
    let now = current_time();
    tx.execute("INSERT INTO follow_ups(id,client_id,project_id,title,due_at,notes,created_at,updated_at) VALUES(?1,?2,?3,?4,?5,?6,?7,?7)",
        params![id,input.client_id,input.project_id,input.title.trim(),due_at,input.notes.trim(),now])?;
    let item = get(&tx, &id)?;
    event(&tx, &item, &format!("安排了客户跟进：{}", item.title))?;
    tx.commit()?;
    Ok(item)
}
pub fn update(db: &Connection, id: &str, patch: FollowUpPatch) -> Result<FollowUp> {
    let tx = db.unchecked_transaction()?;
    let current = get(&tx, id)?;
    if current.status != "pending" {
        return Err(AppError::invalid("请先重新开启跟进，再修改计划"));
    }
    if let Some(project_id) = &patch.project_id {
        validate_relation(&tx, &current.client_id, project_id.as_deref())?;
    }
    let project_id = patch.project_id.unwrap_or(current.project_id);
    let title = patch.title.unwrap_or(current.title);
    repo::nonempty(&title, "跟进主题")?;
    let due_at = patch
        .due_at
        .map(|value| canonical_time(&value))
        .transpose()?
        .unwrap_or_else(|| current.due_at.clone());
    let rescheduled = due_at != current.due_at;
    tx.execute("UPDATE follow_ups SET project_id=?2,title=?3,due_at=?4,notes=?5,updated_at=?6,
        revision=revision+?7,reminded_revision=CASE WHEN ?7=1 THEN NULL ELSE reminded_revision END WHERE id=?1",
        params![id,project_id,title.trim(),due_at,patch.notes.unwrap_or(current.notes).trim(),current_time(),i64::from(rescheduled)])?;
    let item = get(&tx, id)?;
    if rescheduled {
        event(&tx, &item, &format!("调整了跟进时间：{}", item.title))?;
    }
    tx.commit()?;
    Ok(item)
}
pub fn set_status(
    db: &Connection,
    id: &str,
    status: &str,
    result: Option<&str>,
) -> Result<FollowUp> {
    validate_status(status)?;
    let tx = db.unchecked_transaction()?;
    let current = get(&tx, id)?;
    if status == current.status {
        return Ok(current);
    }
    let result = if status == "completed" {
        let result = result.unwrap_or("");
        repo::nonempty(result, "跟进结果")?;
        result.trim()
    } else {
        &current.result
    };
    tx.execute("UPDATE follow_ups SET status=?2,result=?3,completed_at=CASE WHEN ?2='completed' THEN ?4 WHEN ?2='pending' THEN NULL ELSE completed_at END,
        revision=revision+CASE WHEN ?2='pending' THEN 1 ELSE 0 END,reminded_revision=CASE WHEN ?2='pending' THEN NULL ELSE reminded_revision END,updated_at=?4 WHERE id=?1",
        params![id,status,result,current_time()])?;
    let item = get(&tx, id)?;
    let body = match status {
        "completed" => format!("完成了客户跟进：{}\n结果：{}", item.title, item.result),
        "cancelled" => format!("取消了客户跟进：{}", item.title),
        _ => format!("重新开启了客户跟进：{}", item.title),
    };
    event(&tx, &item, &body)?;
    tx.commit()?;
    Ok(item)
}
pub fn claim_at(db: &Connection, id: &str, revision: i64, at: &str) -> Result<bool> {
    let at = canonical_time(at)?;
    let changed = db.execute("UPDATE follow_ups SET reminded_revision=?2 WHERE id=?1 AND revision=?2 AND status='pending' AND due_at<=?3
        AND (reminded_revision IS NULL OR reminded_revision<>?2)
        AND client_id IN (SELECT id FROM clients WHERE deleted_at IS NULL)
        AND (project_id IS NULL OR project_id IN (SELECT id FROM projects WHERE deleted_at IS NULL AND client_id=follow_ups.client_id))",
        params![id,revision,at])?;
    Ok(changed == 1)
}
pub fn claim(db: &Connection, id: &str, revision: i64) -> Result<bool> {
    claim_at(db, id, revision, &current_time())
}
