pub mod commands;
mod models;
mod profile;
pub use models::*;

use crate::{
    error::{AppError, Result},
    models::{ActivityKind, Client},
    repo,
};
use rusqlite::{params, Connection, OptionalExtension};
use std::{
    collections::HashSet,
    hash::{Hash, Hasher},
};

pub fn states(connection: &Connection) -> Result<Vec<CustomerManagementState>> {
    let mut statement = connection.prepare(
        "SELECT client_id,archived_at,merged_into FROM client_management ORDER BY client_id",
    )?;
    let rows = statement.query_map([], |row| {
        Ok(CustomerManagementState {
            client_id: row.get(0)?,
            archived_at: row.get(1)?,
            merged_into: row.get(2)?,
        })
    })?;
    Ok(rows.collect::<rusqlite::Result<_>>()?)
}

pub fn ensure_not_merged(connection: &Connection, client_id: &str) -> Result<()> {
    let target: Option<String> = connection
        .query_row(
            "SELECT merged_into FROM client_management WHERE client_id=?1",
            [client_id],
            |row| row.get(0),
        )
        .optional()?
        .flatten();
    if target.is_some() {
        return Err(AppError::new(
            "alreadyMerged",
            "该客户已合并，不能再次操作或从回收站恢复",
        ));
    }
    Ok(())
}

pub fn set_archived(
    connection: &Connection,
    client_id: &str,
    archived: bool,
) -> Result<CustomerManagementState> {
    let transaction = connection.unchecked_transaction()?;
    ensure_not_merged(&transaction, client_id)?;
    repo::active_client(&transaction, client_id)?;
    let previous: Option<String> = transaction
        .query_row(
            "SELECT archived_at FROM client_management WHERE client_id=?1",
            [client_id],
            |row| row.get(0),
        )
        .optional()?
        .flatten();
    let archived_at = if archived {
        Some(previous.clone().unwrap_or_else(repo::now))
    } else {
        None
    };
    transaction.execute(
        "INSERT INTO client_management(client_id,archived_at) VALUES(?1,?2)
         ON CONFLICT(client_id) DO UPDATE SET archived_at=excluded.archived_at",
        params![client_id, archived_at],
    )?;
    if previous != archived_at {
        repo::activities::insert(
            &transaction,
            client_id,
            None,
            ActivityKind::Status,
            if archived {
                "已归档客户，项目、收款与文件继续保留"
            } else {
                "已恢复客户到常用列表"
            },
            serde_json::json!({ "entity": "customerManagement", "event": if archived { "customerArchived" } else { "customerRestored" } }),
        )?;
    }
    transaction.commit()?;
    Ok(CustomerManagementState {
        client_id: client_id.into(),
        archived_at,
        merged_into: None,
    })
}

fn source_folders(connection: &Connection, source: &Client) -> Result<Vec<String>> {
    let mut statement = connection
        .prepare("SELECT folder FROM client_folder_aliases WHERE client_id=?1 ORDER BY folder")?;
    let mut folders = statement
        .query_map([&source.id], |row| row.get::<_, String>(0))?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    if let Some(folder) = &source.folder {
        folders.push(folder.clone());
    }
    folders.sort();
    folders.dedup_by(|a, b| {
        a.replace('\\', "/")
            .eq_ignore_ascii_case(&b.replace('\\', "/"))
    });
    Ok(folders)
}

pub fn preview_merge(
    connection: &Connection,
    source_id: &str,
    target_id: &str,
) -> Result<ClientMergePreview> {
    if source_id == target_id {
        return Err(AppError::invalid("请选择另一位客户作为合并目标"));
    }
    ensure_not_merged(connection, source_id)?;
    ensure_not_merged(connection, target_id)?;
    let source = repo::clients::get(connection, source_id)?;
    let target = repo::clients::get(connection, target_id)?;
    let (project_count, deleted_project_count): (i64, i64) = connection.query_row(
        "SELECT COUNT(*),COALESCE(SUM(deleted_at IS NOT NULL),0) FROM projects WHERE client_id=?1",
        [source_id],
        |row| Ok((row.get(0)?, row.get(1)?)),
    )?;
    let payment_count = connection.query_row(
        "SELECT COUNT(*) FROM payments m JOIN projects p ON p.id=m.project_id WHERE p.client_id=?1",
        [source_id],
        |row| row.get(0),
    )?;
    let activity_count = connection.query_row(
        "SELECT COUNT(*) FROM activities WHERE client_id=?1",
        [source_id],
        |row| row.get(0),
    )?;
    let follow_up_count = connection.query_row(
        "SELECT COUNT(*) FROM follow_ups WHERE client_id=?1",
        [source_id],
        |row| row.get(0),
    )?;
    let folders = source_folders(connection, &source)?;
    let conflicts = profile::conflicts(&source, &target);
    let merged_notes = profile::notes(&source, &target, &conflicts);
    let added_accounts = profile::accounts(&source, &target)
        .len()
        .saturating_sub(target.accounts.len());
    let tag_count = source
        .tag_ids
        .iter()
        .chain(&target.tag_ids)
        .collect::<HashSet<_>>()
        .len();
    let mut preview = ClientMergePreview {
        source,
        target,
        project_count,
        deleted_project_count,
        payment_count,
        activity_count,
        follow_up_count,
        folders,
        conflicts,
        added_accounts,
        tag_count,
        merged_notes,
        preview_token: String::new(),
    };
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    serde_json::to_string(&preview)?.hash(&mut hasher);
    preview.preview_token = format!("{:016x}", hasher.finish());
    Ok(preview)
}

pub fn merge(connection: &Connection, input: ClientMergeInput) -> Result<Client> {
    let transaction = connection.unchecked_transaction()?;
    let preview = preview_merge(&transaction, &input.source_id, &input.target_id)?;
    if preview.preview_token != input.preview_token {
        return Err(AppError::new(
            "mergePreviewChanged",
            "客户资料已变化，请重新查看合并预览后确认",
        ));
    }
    let source = &preview.source;
    let target = &preview.target;
    let timestamp = repo::now();
    let accounts = profile::accounts(source, target);
    transaction.execute(
        "UPDATE clients SET company=?1,phone=?2,wechat=?3,email=?4,address=?5,accounts=?6,notes=?7,rating=?8,pinned=?9,updated_at=?10 WHERE id=?11",
        params![profile::prefer_target(&target.company,&source.company), profile::prefer_target(&target.phone,&source.phone),
            profile::prefer_target(&target.wechat,&source.wechat), profile::prefer_target(&target.email,&source.email), profile::prefer_target(&target.address,&source.address),
            serde_json::to_string(&accounts)?, preview.merged_notes, if target.rating == 0 { source.rating } else { target.rating }, target.pinned || source.pinned, timestamp, target.id],
    )?;
    transaction.execute("INSERT OR IGNORE INTO client_tags(client_id,tag_id) SELECT ?1,tag_id FROM client_tags WHERE client_id=?2", params![target.id,source.id])?;
    transaction.execute("DELETE FROM client_tags WHERE client_id=?1", [&source.id])?;
    // Move identities, never monetary rows or physical files. Soft-deleted projects keep their state.
    transaction.execute(
        "UPDATE projects SET client_id=?1,updated_at=?3 WHERE client_id=?2",
        params![target.id, source.id, timestamp],
    )?;
    transaction.execute(
        "UPDATE activities SET client_id=?1 WHERE client_id=?2",
        params![target.id, source.id],
    )?;
    transaction.execute(
        "UPDATE follow_ups SET client_id=?1 WHERE client_id=?2",
        params![target.id, source.id],
    )?;
    transaction.execute(
        "UPDATE file_versions SET client_id=?1 WHERE client_id=?2",
        params![target.id, source.id],
    )?;
    transaction.execute(
        "UPDATE file_recycle SET client_id=?1 WHERE client_id=?2",
        params![target.id, source.id],
    )?;
    for folder in &preview.folders {
        let owner: Option<String> = transaction
            .query_row(
                "SELECT client_id FROM client_folder_aliases WHERE folder=?1",
                [folder],
                |row| row.get(0),
            )
            .optional()?;
        if owner
            .as_ref()
            .is_some_and(|owner| owner != &source.id && owner != &target.id)
        {
            return Err(AppError::new(
                "folderOwnershipChanged",
                "客户目录归属已改变，请重新核对后合并",
            ));
        }
        transaction.execute(
            "INSERT INTO client_folder_aliases(folder,client_id,source_name) VALUES(?1,?2,?3)
            ON CONFLICT(folder) DO UPDATE SET client_id=excluded.client_id",
            params![folder, target.id, source.name],
        )?;
    }
    transaction.execute(
        "UPDATE client_folder_aliases SET client_id=?1 WHERE client_id=?2",
        params![target.id, source.id],
    )?;
    transaction.execute(
        "INSERT INTO client_management(client_id,merged_into) VALUES(?1,?2)
        ON CONFLICT(client_id) DO UPDATE SET merged_into=excluded.merged_into",
        params![source.id, target.id],
    )?;
    // Flatten prior merges so an old source always points to the current destination.
    transaction.execute(
        "UPDATE client_management SET merged_into=?1 WHERE merged_into=?2",
        params![target.id, source.id],
    )?;
    transaction.execute(
        "UPDATE clients SET deleted_at=?1,updated_at=?1 WHERE id=?2",
        params![timestamp, source.id],
    )?;
    transaction.execute("INSERT INTO client_merge_history(id,source_id,target_id,source_snapshot,target_snapshot,merged_at) VALUES(?1,?2,?3,?4,?5,?6)",
        params![repo::id(),source.id,target.id,serde_json::to_string(source)?,serde_json::to_string(target)?,timestamp])?;
    repo::activities::insert(
        &transaction,
        &target.id,
        None,
        ActivityKind::Status,
        &format!(
            "合并了客户「{}」：{} 个项目、{} 笔收款，文件保留原位置",
            source.name, preview.project_count, preview.payment_count
        ),
        serde_json::json!({ "entity": "customerManagement", "event": "customerMerged", "sourceId": source.id, "sourceName": source.name }),
    )?;
    let result = repo::clients::get(&transaction, &target.id)?;
    transaction.commit()?;
    Ok(result)
}
