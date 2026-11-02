use crate::{
    error::{AppError, Result},
    models::{Tag, TagColor, TagPatch},
};
use rusqlite::{params, Connection, Row};

const SELECT: &str = "SELECT t.*, (SELECT COUNT(*) FROM client_tags ct JOIN clients c ON c.id=ct.client_id WHERE ct.tag_id=t.id AND c.deleted_at IS NULL) AS client_count, (SELECT COUNT(*) FROM project_tags pt JOIN projects p ON p.id=pt.project_id JOIN clients c ON c.id=p.client_id WHERE pt.tag_id=t.id AND p.deleted_at IS NULL AND c.deleted_at IS NULL) AS project_count FROM tags t";

fn from_row(row: &Row<'_>) -> rusqlite::Result<Tag> {
    Ok(Tag {
        id: row.get("id")?,
        name: row.get("name")?,
        color: row.get("color")?,
        sort: row.get("sort")?,
        client_count: row.get("client_count")?,
        project_count: row.get("project_count")?,
    })
}

pub fn list(connection: &Connection) -> Result<Vec<Tag>> {
    let mut statement = connection.prepare(&format!("{SELECT} ORDER BY t.sort,t.name"))?;
    let rows = statement.query_map([], from_row)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn get(connection: &Connection, id: &str) -> Result<Tag> {
    Ok(connection.query_row(&format!("{SELECT} WHERE t.id=?1"), [id], from_row)?)
}

pub fn create(connection: &Connection, name: &str, color: TagColor) -> Result<Tag> {
    super::nonempty(name, "标签名称")?;
    let id = super::id();
    connection.execute("INSERT INTO tags(id,name,color,sort,created_at) VALUES(?1,?2,?3,COALESCE((SELECT MAX(sort)+1 FROM tags),0),?4)", params![id,name.trim(),color.as_str(),super::now()])?;
    get(connection, &id)
}

pub fn update(connection: &Connection, id: &str, patch: TagPatch) -> Result<Tag> {
    let current = get(connection, id)?;
    let name = patch.name.unwrap_or(current.name);
    super::nonempty(&name, "标签名称")?;
    connection.execute(
        "UPDATE tags SET name=?1,color=?2,sort=?3 WHERE id=?4",
        params![
            name.trim(),
            patch.color.unwrap_or(current.color).as_str(),
            patch.sort.unwrap_or(current.sort),
            id
        ],
    )?;
    get(connection, id)
}

pub fn delete(connection: &Connection, id: &str) -> Result<()> {
    get(connection, id)?;
    connection.execute("DELETE FROM tags WHERE id=?1", [id])?;
    Ok(())
}

pub fn merge(connection: &Connection, source_id: &str, target_id: &str) -> Result<Tag> {
    if source_id == target_id {
        return Err(AppError::invalid("不能将标签合并到自身"));
    }
    let transaction = connection.unchecked_transaction()?;
    get(&transaction, source_id)?;
    get(&transaction, target_id)?;
    transaction.execute("INSERT OR IGNORE INTO client_tags(client_id,tag_id) SELECT client_id,?2 FROM client_tags WHERE tag_id=?1", params![source_id,target_id])?;
    transaction.execute("INSERT OR IGNORE INTO project_tags(project_id,tag_id) SELECT project_id,?2 FROM project_tags WHERE tag_id=?1", params![source_id,target_id])?;
    transaction.execute("DELETE FROM tags WHERE id=?1", [source_id])?;
    transaction.commit()?;
    get(connection, target_id)
}

pub(crate) fn assign(
    connection: &Connection,
    owner_id: &str,
    tag_ids: &[String],
    project: bool,
) -> Result<()> {
    let (delete_sql, insert_sql) = if project {
        super::project_client(connection, owner_id)?;
        (
            "DELETE FROM project_tags WHERE project_id=?1",
            "INSERT OR IGNORE INTO project_tags(project_id,tag_id) VALUES(?1,?2)",
        )
    } else {
        super::active_client(connection, owner_id)?;
        (
            "DELETE FROM client_tags WHERE client_id=?1",
            "INSERT OR IGNORE INTO client_tags(client_id,tag_id) VALUES(?1,?2)",
        )
    };
    for tag_id in tag_ids {
        get(connection, tag_id)?;
    }
    connection.execute(delete_sql, [owner_id])?;
    for tag_id in tag_ids {
        connection.execute(insert_sql, params![owner_id, tag_id])?;
    }
    Ok(())
}

pub fn set(
    connection: &Connection,
    owner_id: &str,
    tag_ids: &[String],
    project: bool,
) -> Result<()> {
    let transaction = connection.unchecked_transaction()?;
    assign(&transaction, owner_id, tag_ids, project)?;
    let sql = if project {
        "UPDATE projects SET updated_at=?1 WHERE id=?2"
    } else {
        "UPDATE clients SET updated_at=?1 WHERE id=?2"
    };
    transaction.execute(sql, params![super::now(), owner_id])?;
    transaction.commit()?;
    Ok(())
}
