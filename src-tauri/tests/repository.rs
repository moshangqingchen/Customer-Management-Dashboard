use client_desk_lib::{
    db, library,
    models::*,
    repo::{activities, clients, payments, projects, settings, tags, trash},
};
use rusqlite::Connection;
use serde_json::json;
use tempfile::TempDir;

fn database() -> (TempDir, Connection) {
    let dir = tempfile::tempdir().unwrap();
    let conn = db::open(&dir.path().join("client-desk.db")).unwrap();
    (dir, conn)
}

fn client(conn: &Connection, name: &str) -> Client {
    clients::create(
        conn,
        ClientInput {
            name: name.into(),
            ..Default::default()
        },
    )
    .unwrap()
}

fn project(conn: &Connection, client_id: &str, price: i64) -> Project {
    projects::create(
        conn,
        None,
        ProjectInput {
            client_id: client_id.into(),
            title: "海报".into(),
            price_cents: Some(price),
            ..Default::default()
        },
    )
    .unwrap()
}

fn payment(
    conn: &Connection,
    project_id: &str,
    amount: i64,
    kind: PaymentKind,
    day: &str,
) -> Payment {
    payments::add(
        conn,
        PaymentInput {
            project_id: project_id.into(),
            amount_cents: amount,
            kind: Some(kind),
            paid_at: day.into(),
            method: Some("支付宝".into()),
            ..Default::default()
        },
    )
    .unwrap()
}

#[test]
fn reopen_preserves_schema_data_and_settings() {
    let (dir, conn) = database();
    let original = client(&conn, "印社");
    settings::write(&conn, "lastPaymentMethod", &"银行转账").unwrap();
    db::migrate(&conn).unwrap();
    drop(conn);
    let conn = db::open(&dir.path().join("client-desk.db")).unwrap();
    assert_eq!(
        conn.pragma_query_value(None, "user_version", |r| r.get::<_, i64>(0))
            .unwrap(),
        1
    );
    assert_eq!(
        conn.pragma_query_value(None, "journal_mode", |r| r.get::<_, String>(0))
            .unwrap(),
        "wal"
    );
    assert!(conn
        .pragma_query_value(None, "foreign_keys", |r| r.get::<_, bool>(0))
        .unwrap());
    assert_eq!(clients::get(&conn, &original.id).unwrap().name, "印社");
    assert_eq!(
        settings::get(&conn).unwrap().last_payment_method,
        "银行转账"
    );
}

#[test]
fn edits_status_transitions_duplicate_and_client_timeline() {
    let (_dir, conn) = database();
    let alice = client(&conn, "陈女士");
    assert_eq!(alice.last_activity_at, alice.updated_at);
    assert_eq!(alice.first_project_at, None);
    let bob = client(&conn, "林先生");
    let client_patch:ClientPatch = serde_json::from_value(json!({"name":"陈小姐","company":"四季印社",
        "pinned":true,"phone":"123","wechat":"ink","rating":4,"accounts":[{"platform":"淘宝","handle":"四季"}]})).unwrap();
    let edited = clients::update(&conn, None, &alice.id, client_patch)
        .unwrap()
        .value;
    assert_eq!(edited.accounts[0].handle, "四季");
    assert_eq!(
        (&edited.name, edited.rating, edited.pinned),
        (&String::from("陈小姐"), 4, true)
    );
    assert_eq!(clients::list(&conn).unwrap()[0].id, alice.id);
    let item = project(&conn, &alice.id, 5000);
    assert_eq!(item.status, ProjectStatus::Active);
    assert_eq!((item.folder, item.file_count), (None, 0));
    let patch:ProjectPatch = serde_json::from_value(json!({"title":"画册","brief":"印前核对","sourcePlatform":"淘宝",
        "sourceOrderNo":"ABC","pinned":true,"startDate":"2026-10-15","dueDate":"2026-11-02","costCents":399})).unwrap();
    let item = projects::update(&conn, None, &item.id, patch)
        .unwrap()
        .value;
    assert_eq!(
        (item.brief.as_str(), item.pinned, item.cost_cents),
        ("印前核对", true, 399)
    );
    let clear = serde_json::from_value(json!({"dueDate":null})).unwrap();
    let item = projects::update(&conn, None, &item.id, clear)
        .unwrap()
        .value;
    assert_eq!(item.start_date.as_deref(), Some("2026-10-15"));
    assert_eq!(item.due_date, None);
    let delivered = projects::set_status(&conn, None, &item.id, ProjectStatus::Delivered).unwrap();
    let today = chrono::Local::now().date_naive().to_string();
    assert_eq!(delivered.delivered_at.as_deref(), Some(today.as_str()));
    projects::set_status(&conn, None, &item.id, ProjectStatus::Delivered).unwrap();
    let done = projects::set_status(&conn, None, &item.id, ProjectStatus::Done).unwrap();
    assert_eq!(done.completed_at.as_deref(), Some(today.as_str()));
    let reopened = projects::set_status(&conn, None, &item.id, ProjectStatus::Active).unwrap();
    assert_eq!(reopened.completed_at, None);
    assert_eq!(reopened.delivered_at, delivered.delivered_at);
    let journal = activities::list(&conn, Some(&alice.id), None, None).unwrap();
    assert_eq!(journal.len(), 4);
    assert_eq!(journal[0].meta["from"], "done");
    assert_eq!(journal[0].meta["to"], "active");
    assert_eq!(journal[3].kind, ActivityKind::Created);
    assert_eq!(journal[3].body, "创建了项目");
    assert_eq!(journal[0].client_name, "陈小姐");
    assert_eq!(journal[0].project_title.as_deref(), Some("画册"));
    assert_eq!(
        activities::update_note(&conn, &journal[0].id, "修改")
            .unwrap_err()
            .code,
        "invalid"
    );
    assert_eq!(
        activities::delete(&conn, &journal[0].id).unwrap_err().code,
        "invalid"
    );
    assert_eq!(
        activities::add_note(&conn, &bob.id, Some(&item.id), "跨客户")
            .unwrap_err()
            .code,
        "invalid"
    );
    let note = activities::add_note(&conn, &alice.id, None, "偏好米色").unwrap();
    assert_eq!(
        activities::update_note(&conn, &note.id, "偏好暖色")
            .unwrap()
            .body,
        "偏好暖色"
    );
    let edited = clients::update(
        &conn,
        None,
        &alice.id,
        ClientPatch {
            address: Some("杭州".into()),
            ..Default::default()
        },
    )
    .unwrap()
    .value;
    assert_eq!(edited.last_activity_at, note.created_at);
    activities::delete(&conn, &note.id).unwrap();
    payment(&conn, &item.id, 2000, PaymentKind::Income, "2026-10-15");
    let moved = projects::update(
        &conn,
        None,
        &item.id,
        ProjectPatch {
            client_id: Some(bob.id.clone()),
            ..Default::default()
        },
    )
    .unwrap()
    .value;
    assert_eq!(moved.client_name, "林先生");
    assert!(activities::list(&conn, Some(&alice.id), None, None)
        .unwrap()
        .is_empty());
    assert_eq!(
        activities::list(&conn, Some(&bob.id), None, None)
            .unwrap()
            .len(),
        5
    );
    let copy = projects::duplicate(&conn, None, &item.id).unwrap();
    assert_eq!(copy.title, "画册（副本）");
    assert_eq!(copy.status, ProjectStatus::Lead);
    assert_eq!(
        (
            copy.received_cents,
            copy.payment_count,
            copy.file_count,
            copy.folder
        ),
        (0, 0, 0, None)
    );
    assert_eq!(
        activities::list(&conn, None, Some(&copy.id), None)
            .unwrap()
            .len(),
        1
    );
    let client = clients::get(&conn, &bob.id).unwrap();
    assert_eq!(client.first_project_at, Some(item.created_at));
    assert_eq!((client.project_count, client.open_project_count), (2, 2));
}

#[test]
fn financial_totals_include_refunds_and_cap_outstanding_per_project() {
    let (_dir, conn) = database();
    let client = client(&conn, "石先生");
    let order = project(&conn, &client.id, 10_000);
    let other = project(&conn, &client.id, 8000);
    let cancelled = project(&conn, &client.id, 9000);
    projects::set_status(&conn, None, &cancelled.id, ProjectStatus::Cancelled).unwrap();
    payment(&conn, &other.id, 12000, PaymentKind::Income, "2026-10-01");
    payment(&conn, &cancelled.id, 500, PaymentKind::Income, "2026-10-01");
    payment(&conn, &order.id, 3000, PaymentKind::Income, "2026-10-02");
    let refund = payment(&conn, &order.id, 600, PaymentKind::Refund, "2026-10-08");
    let last_method = settings::get(&conn).unwrap().last_payment_method;
    assert_eq!(last_method, "支付宝");
    let snapshot = clients::get(&conn, &client.id).unwrap();
    assert_eq!(
        (
            snapshot.project_count,
            snapshot.open_project_count,
            snapshot.billed_cents
        ),
        (3, 2, 18_000)
    );
    assert_eq!(
        (snapshot.received_cents, snapshot.outstanding_cents),
        (14900, 7600)
    );
    let order_snapshot = projects::get(&conn, None, &order.id).unwrap();
    assert_eq!(
        (order_snapshot.received_cents, order_snapshot.payment_count),
        (2400, 2)
    );
    assert_eq!(payments::list(&conn, &order.id).unwrap()[0].id, refund.id);
    let latest = payments::all(&conn).unwrap().remove(0);
    assert_eq!(latest.payment.id, refund.id);
    assert_eq!(
        (
            latest.project_title.as_str(),
            latest.client_name.as_str(),
            latest.client_id
        ),
        ("海报", "石先生", client.id.clone())
    );
    let latest = activities::list(&conn, None, Some(&order.id), Some(1))
        .unwrap()
        .remove(0);
    assert_eq!(
        json!(latest.meta),
        json!({"kind":"refund","amountCents":600,"method":"支付宝"})
    );
    assert_eq!(
        payments::update(
            &conn,
            &refund.id,
            PaymentPatch {
                amount_cents: Some(0),
                ..Default::default()
            }
        )
        .unwrap_err()
        .code,
        "invalid"
    );
    let updated = payments::update(
        &conn,
        &refund.id,
        PaymentPatch {
            amount_cents: Some(1200),
            note: Some("改正".into()),
            ..Default::default()
        },
    )
    .unwrap();
    assert_eq!(updated.note, "改正");
    assert_eq!(
        clients::get(&conn, &client.id).unwrap().outstanding_cents,
        8200
    );
    payments::delete(&conn, &refund.id).unwrap();
    let last = activities::list(&conn, None, Some(&order.id), Some(1))
        .unwrap()
        .remove(0);
    assert_eq!(last.body, "删除了退款");
    assert_eq!(last.meta["amountCents"], 1200);
    assert_eq!(
        clients::get(&conn, &client.id).unwrap().outstanding_cents,
        7000
    );
    projects::delete(&conn, &other.id).unwrap();
    assert_eq!(payments::all(&conn).unwrap().len(), 2);
    assert!(payments::list(&conn, &other.id).unwrap().is_empty());
    assert_eq!(
        clients::get(&conn, &client.id).unwrap().received_cents,
        3500
    );
}

#[test]
fn tags_merge_deduplicates_both_relations_and_preserves_restorable_links() {
    let (_dir, conn) = database();
    let client = client(&conn, "铭记设计");
    let active = project(&conn, &client.id, 400);
    let deleted = project(&conn, &client.id, 600);
    let source = tags::create(&conn, "既有", TagColor::Cyan).unwrap();
    let target = tags::create(&conn, "老客户", TagColor::Red).unwrap();
    let sorted = tags::update(
        &conn,
        &target.id,
        TagPatch {
            name: Some("老客".into()),
            color: Some(TagColor::Amber),
            sort: Some(-1),
        },
    )
    .unwrap();
    assert_eq!(sorted.color, TagColor::Amber);
    assert_eq!(tags::list(&conn).unwrap()[0].name, "老客");
    let both = vec![source.id.clone(), target.id.clone(), source.id.clone()];
    tags::set(&conn, &client.id, &both, false).unwrap();
    tags::set(&conn, &active.id, &both, true).unwrap();
    tags::set(&conn, &deleted.id, std::slice::from_ref(&source.id), true).unwrap();
    projects::delete(&conn, &deleted.id).unwrap();
    let merged = tags::merge(&conn, &source.id, &target.id).unwrap();
    assert_eq!((merged.client_count, merged.project_count), (1, 1));
    assert_eq!(tags::get(&conn, &source.id).unwrap_err().code, "notFound");
    assert_eq!(
        clients::get(&conn, &client.id).unwrap().tag_ids,
        vec![target.id.clone()]
    );
    assert_eq!(
        projects::get(&conn, None, &active.id).unwrap().tag_ids,
        vec![target.id.clone()]
    );
    trash::restore(&conn, TrashType::Project, &deleted.id).unwrap();
    assert_eq!(tags::get(&conn, &target.id).unwrap().project_count, 2);
    assert!(tags::set(&conn, &active.id, &["缺失".into()], true).is_err());
    assert_eq!(tags::get(&conn, &target.id).unwrap().project_count, 2);
    tags::delete(&conn, &target.id).unwrap();
    assert!(projects::get(&conn, None, &active.id)
        .unwrap()
        .tag_ids
        .is_empty());
}

#[test]
fn trash_restores_only_items_removed_with_parent_and_purge_cascades() {
    let (dir, conn) = database();
    let client = client(&conn, "画室");
    let active = project(&conn, &client.id, 2000);
    let deleted = project(&conn, &client.id, 1000);
    let tag = tags::create(&conn, "设计", TagColor::Teal).unwrap();
    tags::set(&conn, &client.id, std::slice::from_ref(&tag.id), false).unwrap();
    tags::set(&conn, &active.id, std::slice::from_ref(&tag.id), true).unwrap();
    payment(&conn, &active.id, 2000, PaymentKind::Income, "2026-10-31");
    projects::delete(&conn, &deleted.id).unwrap();
    clients::delete(&conn, &client.id).unwrap();
    assert_eq!(trash::list(&conn).unwrap().len(), 3);
    assert!(clients::list(&conn).unwrap().is_empty());
    assert!(projects::list(&conn, None).unwrap().is_empty());
    assert!(payments::all(&conn).unwrap().is_empty());
    assert!(activities::list(&conn, None, None, None)
        .unwrap()
        .is_empty());
    assert_eq!(tags::get(&conn, &tag.id).unwrap().client_count, 0);
    assert!(trash::restore(&conn, TrashType::Project, &active.id).is_err());
    trash::restore(&conn, TrashType::Client, &client.id).unwrap();
    assert_eq!(trash::list(&conn).unwrap()[0].id, deleted.id);
    assert_eq!(projects::list(&conn, None).unwrap()[0].id, active.id);
    assert_eq!(
        clients::get(&conn, &client.id).unwrap().received_cents,
        2000
    );
    assert!(trash::purge(&conn, TrashType::Client, &client.id).is_err());
    assert_eq!(projects::list(&conn, None).unwrap().len(), 1);
    trash::purge(&conn, TrashType::Project, &deleted.id).unwrap();
    let disk_folder = dir.path().join("画室");
    std::fs::create_dir(&disk_folder).unwrap();
    conn.execute("UPDATE clients SET folder='画室' WHERE id=?1", [&client.id])
        .unwrap();
    clients::delete(&conn, &client.id).unwrap();
    trash::purge(&conn, TrashType::Client, &client.id).unwrap();
    for table in [
        "clients",
        "projects",
        "payments",
        "activities",
        "project_tags",
        "client_tags",
    ] {
        let count: i64 = conn
            .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0, "{table}");
    }
    assert!(disk_folder.is_dir());
}

#[test]
fn failing_activity_insert_rolls_back_the_whole_mutation() {
    let (_dir, conn) = database();
    let client = client(&conn, "工作室");
    let project = project(&conn, &client.id, 2000);
    conn.execute_batch(
        "CREATE TRIGGER reject_activity BEFORE INSERT ON activities BEGIN
        SELECT RAISE(ABORT,'模拟写入失败'); END;",
    )
    .unwrap();
    assert!(projects::set_status(&conn, None, &project.id, ProjectStatus::Done).is_err());
    assert_eq!(
        projects::get(&conn, None, &project.id).unwrap().status,
        ProjectStatus::Active
    );
    let result = payments::add(
        &conn,
        PaymentInput {
            project_id: project.id.clone(),
            amount_cents: 999,
            paid_at: "2026-02-01".into(),
            method: Some("现金".into()),
            ..Default::default()
        },
    );
    assert!(result.is_err());
    assert_eq!(settings::get(&conn).unwrap().last_payment_method, "微信");
    assert!(payments::all(&conn).unwrap().is_empty());
    assert!(projects::create(
        &conn,
        None,
        ProjectInput {
            client_id: client.id,
            title: "模拟项目".into(),
            ..Default::default()
        }
    )
    .is_err());
    assert_eq!(projects::list(&conn, None).unwrap().len(), 1);
}

#[test]
fn transferred_project_keeps_existing_files_through_old_client_rename_and_purge() {
    let (dir, conn) = database();
    let library_root = dir.path().join("文件库");
    std::fs::create_dir(&library_root).unwrap();
    library::set_root(&conn, &library_root).unwrap();
    let original = client(&conn, "原店主");
    let next = client(&conn, "新店主");
    let item = project(&conn, &original.id, 500);
    let target = FileTarget::Project {
        project_id: item.id.clone(),
    };
    let path = library::ensure_folder(&conn, &target).unwrap();
    std::fs::write(path.join("交付成品").join("海报.pdf"), b"sample").unwrap();
    let moved = projects::update(
        &conn,
        Some(&library_root),
        &item.id,
        ProjectPatch {
            client_id: Some(next.id.clone()),
            ..Default::default()
        },
    )
    .unwrap()
    .value;
    assert_eq!(moved.file_count, 1);
    assert!(library::files_list(
        &conn,
        &FileTarget::Client {
            client_id: original.id.clone()
        },
        true
    )
    .unwrap()
    .files
    .is_empty());
    let listed = library::files_list(
        &conn,
        &FileTarget::Client {
            client_id: next.id.clone(),
        },
        true,
    )
    .unwrap();
    assert_eq!(listed.files.len(), 1);
    assert_eq!(listed.files[0].client_id.as_deref(), Some(next.id.as_str()));
    assert_eq!(
        listed.files[0].project_id.as_deref(),
        Some(item.id.as_str())
    );

    let renamed = clients::update(
        &conn,
        Some(&library_root),
        &original.id,
        ClientPatch {
            name: Some("旧画室".into()),
            rename_folder: Some(true),
            ..Default::default()
        },
    )
    .unwrap();
    assert!(renamed.warning.is_none());
    let item = projects::get(&conn, Some(&library_root), &item.id).unwrap();
    assert_eq!(item.file_count, 1);
    assert!(item.folder.as_deref().unwrap().starts_with("旧画室/"));
    clients::delete(&conn, &original.id).unwrap();
    trash::purge(&conn, TrashType::Client, &original.id).unwrap();
    let recent = library::files_recent(&conn, 10).unwrap();
    assert_eq!(recent.len(), 1);
    assert_eq!(recent[0].client_id.as_deref(), Some(next.id.as_str()));
    assert_eq!(recent[0].project_id.as_deref(), Some(item.id.as_str()));
    assert_eq!(recent[0].folder_group, "交付成品");
}
