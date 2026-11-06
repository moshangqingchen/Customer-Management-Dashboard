use client_desk_lib::{backup, db, repo::settings};
use rusqlite::Connection;
use tempfile::tempdir;

fn legacy(path: &std::path::Path) -> Connection {
    let conn = Connection::open(path).unwrap();
    db::configure(&conn).unwrap();
    conn.execute_batch(include_str!("../src/schema.sql"))
        .unwrap();
    for (key, value) in [
        ("theme", serde_json::json!("dark")),
        ("subfolderTemplate", serde_json::json!(["参考资料"])),
        ("paymentMethods", serde_json::json!(["微信"])),
        ("sourcePlatforms", serde_json::json!(["微信"])),
        ("lastPaymentMethod", serde_json::json!("微信")),
        ("lastAutoBackupDate", serde_json::json!("")),
    ] {
        settings::write(&conn, key, &value).unwrap();
    }
    conn.pragma_update(None, "user_version", 1).unwrap();
    conn.execute("INSERT INTO clients(id,name,phone,created_at,updated_at) VALUES ('old-client','迁移前客户','13800138000','2025-01-01T00:00:00Z','2025-01-01T00:00:00Z')", []).unwrap();
    conn.execute("INSERT INTO projects(id,client_id,title,price_cents,created_at,updated_at) VALUES ('old-project','old-client','原项目',128000,'2025-01-01T00:00:00Z','2025-01-01T00:00:00Z')", []).unwrap();
    conn.execute("INSERT INTO payments(id,project_id,amount_cents,paid_at,created_at) VALUES ('old-payment','old-project',68000,'2025-01-02','2025-01-02T00:00:00Z')", []).unwrap();
    settings::write(&conn, "testMarker", &"旧库").unwrap();
    conn
}

fn check_original_data(conn: &Connection) {
    let value: (String, String, i64, i64) = conn.query_row("SELECT c.name,c.phone,p.price_cents,m.amount_cents FROM clients c JOIN projects p ON p.client_id=c.id JOIN payments m ON m.project_id=p.id WHERE c.id='old-client'", [], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?))).unwrap();
    assert_eq!(
        value,
        ("迁移前客户".into(), "13800138000".into(), 128000, 68000)
    );
    assert_eq!(
        conn.pragma_query_value(None, "user_version", |r| r.get::<_, i64>(0))
            .unwrap(),
        db::SCHEMA_VERSION
    );
    assert!(!conn
        .prepare("PRAGMA foreign_key_check")
        .unwrap()
        .exists([])
        .unwrap());
}

#[test]
fn v1_upgrade_preserves_clients_projects_payments_and_is_idempotent() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("legacy.db");
    let conn = legacy(&path);
    db::migrate(&conn).unwrap();
    db::migrate(&conn).unwrap();
    check_original_data(&conn);
    assert_eq!(
        settings::read::<String>(&conn, "testMarker")
            .unwrap()
            .as_deref(),
        Some("旧库")
    );
    drop(conn);
    check_original_data(&db::open(&path).unwrap());
}

#[test]
fn migration_failure_does_not_publish_partial_schema_or_change_v1_data() {
    let dir = tempdir().unwrap();
    let conn = legacy(&dir.path().join("conflict.db"));
    conn.execute_batch("CREATE TABLE follow_ups(unexpected TEXT)")
        .unwrap();
    assert!(db::migrate(&conn).is_err());
    assert_eq!(
        conn.pragma_query_value(None, "user_version", |r| r.get::<_, i64>(0))
            .unwrap(),
        1
    );
    assert_eq!(
        conn.query_row(
            "SELECT COUNT(*) FROM payments WHERE amount_cents=68000",
            [],
            |r| r.get::<_, i64>(0)
        )
        .unwrap(),
        1
    );
    assert!(!conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_schema WHERE name='client_management')",
            [],
            |r| r.get::<_, bool>(0)
        )
        .unwrap());
}

#[test]
fn restore_v1_backup_upgrades_before_replacing_live_database_and_keeps_safety_copy() {
    let dir = tempdir().unwrap();
    let backup_dir = dir.path().join("backups");
    std::fs::create_dir(&backup_dir).unwrap();
    let name = "client-desk-20000101-000000-manual.db";
    drop(legacy(&backup_dir.join(name)));
    let mut conn = db::open(&dir.path().join("current.db")).unwrap();
    settings::write(&conn, "testMarker", &"恢复前的数据").unwrap();
    backup::restore(&mut conn, dir.path(), name).unwrap();
    check_original_data(&conn);
    let safety = backup::list(&conn, dir.path())
        .unwrap()
        .into_iter()
        .find(|value| value.file_name.ends_with("-before-restore.db"))
        .unwrap();
    let before = Connection::open(safety.path).unwrap();
    assert_eq!(
        settings::read::<String>(&before, "testMarker")
            .unwrap()
            .as_deref(),
        Some("恢复前的数据")
    );
    let source = Connection::open(backup_dir.join(name)).unwrap();
    assert_eq!(
        source
            .pragma_query_value(None, "user_version", |r| r.get::<_, i64>(0))
            .unwrap(),
        1
    );
}

#[test]
fn restore_rejects_missing_history_constraint_and_future_version_before_touching_live_data() {
    let dir = tempdir().unwrap();
    let mut conn = db::open(&dir.path().join("current.db")).unwrap();
    settings::write(&conn, "testMarker", &"现有数据").unwrap();
    let original = backup::create(&conn, dir.path()).unwrap();
    let backup_dir = dir.path().join("backups");
    let missing_name = "client-desk-20000102-000000-manual.db";
    std::fs::copy(&original.path, backup_dir.join(missing_name)).unwrap();
    let broken = Connection::open(backup_dir.join(missing_name)).unwrap();
    broken
        .execute_batch("DROP INDEX idx_file_recycle_path")
        .unwrap();
    drop(broken);
    assert_eq!(
        backup::restore(&mut conn, dir.path(), missing_name)
            .unwrap_err()
            .code,
        "invalid"
    );
    let future_name = "client-desk-20000103-000000-manual.db";
    std::fs::copy(&original.path, backup_dir.join(future_name)).unwrap();
    let future = Connection::open(backup_dir.join(future_name)).unwrap();
    future
        .pragma_update(None, "user_version", db::SCHEMA_VERSION + 1)
        .unwrap();
    settings::write(&future, "testMarker", &"未来备份").unwrap();
    drop(future);
    assert_eq!(
        backup::restore(&mut conn, dir.path(), future_name)
            .unwrap_err()
            .code,
        "invalid"
    );
    assert_eq!(
        settings::read::<String>(&conn, "testMarker")
            .unwrap()
            .as_deref(),
        Some("现有数据")
    );
    let source = Connection::open(backup_dir.join(future_name)).unwrap();
    assert_eq!(
        settings::read::<String>(&source, "testMarker")
            .unwrap()
            .as_deref(),
        Some("未来备份")
    );
    assert_eq!(
        source
            .pragma_query_value(None, "user_version", |r| r.get::<_, i64>(0))
            .unwrap(),
        db::SCHEMA_VERSION + 1
    );
    assert!(!backup::list(&conn, dir.path())
        .unwrap()
        .iter()
        .any(|value| value.file_name.ends_with("-before-restore.db")));
}
