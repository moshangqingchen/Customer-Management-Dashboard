use client_desk_lib::{
    customer_management::{self as management, ClientMergeInput},
    db, library,
    models::{
        Client, ClientAccount, ClientInput, ClientPatch, FileTarget, PaymentInput, ProjectInput,
        TrashType,
    },
    repo::{activities, clients, payments, projects, tags, trash},
};
use rusqlite::{params, Connection};
use tempfile::TempDir;

fn database() -> (TempDir, Connection) {
    let temp = tempfile::tempdir().unwrap();
    let connection = db::open(&temp.path().join("client-desk.db")).unwrap();
    (temp, connection)
}
fn client(connection: &Connection, name: &str) -> Client {
    clients::create(
        connection,
        ClientInput {
            name: name.into(),
            ..Default::default()
        },
    )
    .unwrap()
}
fn project(connection: &Connection, client_id: &str, price: i64, paid: i64) -> String {
    let project = projects::create(
        connection,
        None,
        ProjectInput {
            client_id: client_id.into(),
            title: "客户项目".into(),
            price_cents: Some(price),
            ..Default::default()
        },
    )
    .unwrap();
    if paid > 0 {
        payments::add(
            connection,
            PaymentInput {
                project_id: project.id.clone(),
                amount_cents: paid,
                paid_at: "2026-11-01".into(),
                ..Default::default()
            },
        )
        .unwrap();
    }
    project.id
}
fn merge(connection: &Connection, source: &str, target: &str) -> Client {
    let preview = management::preview_merge(connection, source, target).unwrap();
    management::merge(
        connection,
        ClientMergeInput {
            source_id: source.into(),
            target_id: target.into(),
            preview_token: preview.preview_token,
        },
    )
    .unwrap()
}

#[test]
fn archive_is_reversible_without_changing_projects_or_financial_totals() {
    let (_temp, connection) = database();
    let customer = client(&connection, "可归档客户");
    let project_id = project(&connection, &customer.id, 10000, 3000);
    let before = clients::get(&connection, &customer.id).unwrap();
    assert!(management::set_archived(&connection, &customer.id, true)
        .unwrap()
        .archived_at
        .is_some());
    let archived = clients::get(&connection, &customer.id).unwrap();
    assert_eq!(
        (
            archived.project_count,
            archived.received_cents,
            archived.outstanding_cents
        ),
        (
            before.project_count,
            before.received_cents,
            before.outstanding_cents
        )
    );
    assert_eq!(
        projects::get(&connection, None, &project_id)
            .unwrap()
            .client_id,
        customer.id
    );
    assert_eq!(payments::all(&connection).unwrap().len(), 1);
    assert!(trash::list(&connection).unwrap().is_empty());
    assert!(management::set_archived(&connection, &customer.id, false)
        .unwrap()
        .archived_at
        .is_none());
}

#[test]
fn merge_retains_conflicts_tags_accounts_and_all_project_states_without_duplicating_money() {
    let (_temp, connection) = database();
    let source = clients::create(
        &connection,
        ClientInput {
            name: "来源客户".into(),
            company: Some("来源店铺".into()),
            phone: Some("13800000001".into()),
            email: Some("source@example.cn".into()),
            notes: Some("偏好蓝色\n旧报价约定".into()),
            accounts: Some(vec![ClientAccount {
                platform: "淘宝".into(),
                handle: "source".into(),
            }]),
            ..Default::default()
        },
    )
    .unwrap();
    let target = clients::create(
        &connection,
        ClientInput {
            name: "目标客户".into(),
            company: Some("目标店铺".into()),
            phone: Some("13800000002".into()),
            notes: Some("目标备注".into()),
            ..Default::default()
        },
    )
    .unwrap();
    let tag = tags::create(
        &connection,
        "合并标签",
        client_desk_lib::models::TagColor::Blue,
    )
    .unwrap();
    connection
        .execute(
            "INSERT INTO client_tags(client_id,tag_id) VALUES(?1,?2)",
            params![source.id, tag.id],
        )
        .unwrap();
    let active = project(&connection, &source.id, 10000, 3000);
    let deleted = project(&connection, &source.id, 50000, 2000);
    projects::delete(&connection, &deleted).unwrap();
    project(&connection, &target.id, 20000, 4000);
    activities::add_note(&connection, &source.id, None, "沟通记录").unwrap();
    connection.execute("INSERT INTO follow_ups(id,client_id,project_id,title,due_at,created_at,updated_at) VALUES('follow',?1,?2,'回访','2026-11-08T10:00:00','2026-11-01T00:00:00Z','2026-11-01T00:00:00Z')", params![source.id,active]).unwrap();
    let preview = management::preview_merge(&connection, &source.id, &target.id).unwrap();
    assert_eq!(
        (
            preview.project_count,
            preview.deleted_project_count,
            preview.payment_count,
            preview.follow_up_count
        ),
        (2, 1, 2, 1)
    );
    let merged = merge(&connection, &source.id, &target.id);
    assert_eq!(merged.name, "目标客户");
    assert_eq!(merged.phone, "13800000002");
    assert_eq!(merged.email, "source@example.cn");
    for text in [
        "目标备注",
        "来源店铺",
        "13800000001",
        "偏好蓝色\n旧报价约定",
    ] {
        assert!(merged.notes.contains(text));
    }
    assert_eq!(merged.accounts.len(), 1);
    assert_eq!(merged.tag_ids, vec![tag.id]);
    assert_eq!(
        (
            merged.project_count,
            merged.received_cents,
            merged.outstanding_cents
        ),
        (2, 7000, 23000)
    );
    assert_eq!(payments::all(&connection).unwrap().len(), 2);
    assert_eq!(
        connection
            .query_row("SELECT COUNT(*) FROM payments", [], |row| row
                .get::<_, i64>(0))
            .unwrap(),
        3
    );
    assert_eq!(
        connection
            .query_row(
                "SELECT client_id FROM projects WHERE id=?1",
                [&deleted],
                |row| row.get::<_, String>(0)
            )
            .unwrap(),
        target.id
    );
    assert!(connection
        .query_row(
            "SELECT deleted_at IS NOT NULL FROM projects WHERE id=?1",
            [&deleted],
            |row| row.get::<_, bool>(0)
        )
        .unwrap());
    assert_eq!(
        connection
            .query_row(
                "SELECT client_id FROM follow_ups WHERE id='follow'",
                [],
                |row| row.get::<_, String>(0)
            )
            .unwrap(),
        target.id
    );
    assert!(clients::get(&connection, &source.id).is_err());
    assert!(!trash::list(&connection)
        .unwrap()
        .iter()
        .any(|item| item.id == source.id));
    assert_eq!(
        trash::restore(&connection, TrashType::Client, &source.id)
            .unwrap_err()
            .code,
        "alreadyMerged"
    );
    assert_eq!(
        management::preview_merge(&connection, &source.id, &target.id)
            .unwrap_err()
            .code,
        "alreadyMerged"
    );
}

#[test]
fn failed_merge_rolls_back_profile_projects_and_history() {
    let (_temp, connection) = database();
    let source = client(&connection, "失败来源");
    let target = client(&connection, "失败目标");
    let project_id = project(&connection, &source.id, 5000, 1000);
    let preview = management::preview_merge(&connection, &source.id, &target.id).unwrap();
    connection.execute_batch("CREATE TRIGGER reject_activity_move BEFORE UPDATE OF client_id ON activities BEGIN SELECT RAISE(ABORT,'test rollback'); END;").unwrap();
    assert!(management::merge(
        &connection,
        ClientMergeInput {
            source_id: source.id.clone(),
            target_id: target.id.clone(),
            preview_token: preview.preview_token
        }
    )
    .is_err());
    assert_eq!(
        projects::get(&connection, None, &project_id)
            .unwrap()
            .client_id,
        source.id
    );
    assert_eq!(clients::get(&connection, &target.id).unwrap().notes, "");
    assert_eq!(
        clients::get(&connection, &source.id).unwrap().project_count,
        1
    );
    assert!(management::states(&connection).unwrap().is_empty());
    assert_eq!(
        connection
            .query_row("SELECT COUNT(*) FROM client_merge_history", [], |row| row
                .get::<_, i64>(
                0
            ))
            .unwrap(),
        0
    );
}

#[test]
fn stale_preview_requires_review_again_and_does_not_transfer_anything() {
    let (_temp, connection) = database();
    let source = client(&connection, "预览来源");
    let target = client(&connection, "预览目标");
    let preview = management::preview_merge(&connection, &source.id, &target.id).unwrap();
    clients::update_record(
        &connection,
        &target.id,
        ClientPatch {
            phone: Some("13900000000".into()),
            ..Default::default()
        },
    )
    .unwrap();
    assert_eq!(
        management::merge(
            &connection,
            ClientMergeInput {
                source_id: source.id.clone(),
                target_id: target.id.clone(),
                preview_token: preview.preview_token
            }
        )
        .unwrap_err()
        .code,
        "mergePreviewChanged"
    );
    assert!(clients::get(&connection, &source.id).is_ok());
}

#[test]
fn original_customer_and_project_files_remain_visible_after_merge_without_moving() {
    let (temp, connection) = database();
    let root = temp.path().join("文件库");
    library::set_root(&connection, &root).unwrap();
    let source = client(&connection, "原客户目录");
    let target = client(&connection, "目标尚无目录");
    let project_id = project(&connection, &source.id, 0, 0);
    let source_path = temp.path().join("品牌资料.txt");
    std::fs::write(&source_path, b"brand").unwrap();
    let incoming = vec![source_path.to_string_lossy().into_owned()];
    let docs = library::files_add(
        &connection,
        &FileTarget::Client {
            client_id: source.id.clone(),
        },
        &incoming,
        None,
    )
    .unwrap();
    let design = library::files_add(
        &connection,
        &FileTarget::Project {
            project_id: project_id.clone(),
        },
        &incoming,
        None,
    )
    .unwrap();
    merge(&connection, &source.id, &target.id);
    let result = library::files_list(
        &connection,
        &FileTarget::Client {
            client_id: target.id.clone(),
        },
        true,
    )
    .unwrap();
    assert_eq!(result.files.len(), 2);
    for path in [&docs.added[0].path, &design.added[0].path] {
        assert!(std::path::Path::new(path).exists());
        assert!(result
            .files
            .iter()
            .any(|file| &file.path == path && file.client_id.as_deref() == Some(&target.id)));
    }
    let recent = library::files_recent(&connection, 100).unwrap();
    assert_eq!(
        recent
            .iter()
            .filter(|file| file.client_id.as_deref() == Some(&target.id))
            .count(),
        2
    );
}
