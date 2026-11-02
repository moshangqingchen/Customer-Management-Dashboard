use super::{id, nonempty, now};
use crate::{
    error::{AppError, Result},
    models::{Snippet, SnippetGroup, SnippetGroupPatch, SnippetInput, SnippetPatch},
};
use rusqlite::{params, Connection, Row};

fn group(row: &Row<'_>) -> rusqlite::Result<SnippetGroup> {
    Ok(SnippetGroup {
        id: row.get("id")?,
        name: row.get("name")?,
        sort: row.get("sort")?,
    })
}

fn snippet(row: &Row<'_>) -> rusqlite::Result<Snippet> {
    Ok(Snippet {
        id: row.get("id")?,
        group_id: row.get("group_id")?,
        title: row.get("title")?,
        body: row.get("body")?,
        sort: row.get("sort")?,
        use_count: row.get("use_count")?,
        updated_at: row.get("updated_at")?,
    })
}

pub fn groups_list(conn: &Connection) -> Result<Vec<SnippetGroup>> {
    let mut stmt = conn.prepare("SELECT * FROM snippet_groups ORDER BY sort, name, id")?;
    let rows = stmt.query_map([], group)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn group_create(conn: &Connection, name: &str) -> Result<SnippetGroup> {
    nonempty(name, "分组名称")?;
    Ok(conn.query_row(
        "INSERT INTO snippet_groups(id, name, sort)
         SELECT ?1, ?2, COALESCE(MAX(sort), -1) + 1 FROM snippet_groups RETURNING *",
        params![id(), name.trim()],
        group,
    )?)
}

pub fn group_update(conn: &Connection, id: &str, patch: SnippetGroupPatch) -> Result<SnippetGroup> {
    if let Some(name) = &patch.name {
        nonempty(name, "分组名称")?;
    }
    Ok(conn.query_row(
        "UPDATE snippet_groups SET name=COALESCE(?2, name), sort=COALESCE(?3, sort)
         WHERE id=?1 RETURNING *",
        params![id, patch.name.as_deref().map(str::trim), patch.sort],
        group,
    )?)
}

pub fn group_delete(conn: &Connection, id: &str) -> Result<()> {
    require_changed(conn.execute("DELETE FROM snippet_groups WHERE id=?1", [id])?)
}

pub fn list(conn: &Connection) -> Result<Vec<Snippet>> {
    let mut stmt = conn.prepare(
        "SELECT s.* FROM snippets s JOIN snippet_groups g ON g.id=s.group_id
         ORDER BY g.sort, g.name, g.id, s.sort, s.title, s.id",
    )?;
    let rows = stmt.query_map([], snippet)?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn create(conn: &Connection, input: SnippetInput) -> Result<Snippet> {
    nonempty(&input.title, "话术标题")?;
    nonempty(&input.body, "话术内容")?;
    Ok(conn.query_row(
        "INSERT INTO snippets(id, group_id, title, body, sort, updated_at)
         SELECT ?1, id, ?3, ?4, (SELECT COALESCE(MAX(sort), -1) + 1 FROM snippets WHERE group_id=?2), ?5
         FROM snippet_groups WHERE id=?2 RETURNING *",
        params![id(), input.group_id, input.title.trim(), input.body, now()], snippet,
    )?)
}

pub fn update(conn: &Connection, id: &str, patch: SnippetPatch) -> Result<Snippet> {
    if let Some(title) = &patch.title {
        nonempty(title, "话术标题")?;
    }
    if let Some(body) = &patch.body {
        nonempty(body, "话术内容")?;
    }
    Ok(conn.query_row(
        "UPDATE snippets SET group_id=COALESCE(?2, group_id), title=COALESCE(?3, title),
         body=COALESCE(?4, body), sort=COALESCE(?5, sort), updated_at=?6 WHERE id=?1 RETURNING *",
        params![
            id,
            patch.group_id,
            patch.title.as_deref().map(str::trim),
            patch.body,
            patch.sort,
            now()
        ],
        snippet,
    )?)
}

pub fn delete(conn: &Connection, id: &str) -> Result<()> {
    require_changed(conn.execute("DELETE FROM snippets WHERE id=?1", [id])?)
}

pub fn mark_used(conn: &Connection, id: &str) -> Result<()> {
    require_changed(conn.execute(
        "UPDATE snippets SET use_count=use_count+1 WHERE id=?1",
        [id],
    )?)
}

fn require_changed(count: usize) -> Result<()> {
    if count == 0 {
        Err(AppError::not_found())
    } else {
        Ok(())
    }
}
