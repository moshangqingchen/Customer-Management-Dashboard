use client_desk_lib::{
    backup, db,
    models::{BackupKind, SettingsPatch, SnippetGroupPatch, SnippetInput, SnippetPatch, Theme},
    repo::{settings, snippets},
};
use rusqlite::Connection;
use std::{fs, path::Path};
use tempfile::tempdir;

fn marker(conn: &Connection) -> String {
    settings::read(conn, "testMarker").unwrap().unwrap()
}

fn check_pragma(conn: &Connection, key: &str) -> i64 {
    conn.pragma_query_value(None, key, |row| row.get(0))
        .unwrap()
}

#[test]
fn migration_is_atomic_idempotent_and_preserves_defaults_and_existing_settings() {
    let tmp = tempdir().unwrap();
    let path = tmp.path().join("client-desk.db");
    let conn = db::open(&path).unwrap();
    assert_eq!(check_pragma(&conn, "user_version"), 1);
    assert_eq!(check_pragma(&conn, "foreign_keys"), 1);
    let mode: String = conn
        .pragma_query_value(None, "journal_mode", |row| row.get(0))
        .unwrap();
    assert_eq!(mode, "wal");
    let defaults = settings::get(&conn).unwrap();
    assert_eq!(defaults.theme, Theme::System);
    assert_eq!(
        defaults.subfolder_template,
        ["参考资料", "过程稿", "交付成品"]
    );
    assert_eq!(defaults.last_payment_method, "微信");
    assert_eq!(
        defaults.payment_methods,
        ["微信", "支付宝", "淘宝", "闲鱼", "银行转账", "现金", "其他"]
    );
    assert_eq!(
        defaults.source_platforms,
        ["淘宝", "闲鱼", "小红书", "微信", "抖音", "转介绍", "其他"]
    );
    assert_eq!(
        settings::read::<String>(&conn, "lastAutoBackupDate")
            .unwrap()
            .as_deref(),
        Some("")
    );
    assert_eq!(
        settings::read::<String>(&conn, "libraryRoot").unwrap(),
        None
    );

    settings::update(
        &conn,
        SettingsPatch {
            theme: Some(Theme::Dark),
            subfolder_template: Some(vec![]),
            ..Default::default()
        },
    )
    .unwrap();
    db::migrate(&conn).unwrap();
    drop(conn);
    let conn = db::open(&path).unwrap();
    let current = settings::get(&conn).unwrap();
    assert_eq!(current.theme, Theme::Dark);
    assert!(current.subfolder_template.is_empty());
    let err = settings::update(
        &conn,
        SettingsPatch {
            theme: Some(Theme::Light),
            subfolder_template: Some(vec!["../外部".into()]),
            ..Default::default()
        },
    )
    .unwrap_err();
    assert_eq!(err.code, "invalid");
    assert_eq!(settings::get(&conn).unwrap().theme, Theme::Dark);
    conn.pragma_update(None, "user_version", 2).unwrap();
    assert_eq!(db::migrate(&conn).unwrap_err().code, "db");
    assert_eq!(check_pragma(&conn, "user_version"), 2);

    let bad = Connection::open(tmp.path().join("conflict.db")).unwrap();
    bad.execute_batch("CREATE TABLE projects(id TEXT)").unwrap();
    assert!(db::migrate(&bad).is_err());
    assert_eq!(check_pragma(&bad, "user_version"), 0);
    let created: bool = bad
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM sqlite_schema WHERE name='clients')",
            [],
            |r| r.get(0),
        )
        .unwrap();
    assert!(!created);
}

#[test]
fn snippets_keep_multiline_content_sort_move_and_cascade_with_groups() {
    let tmp = tempdir().unwrap();
    let conn = db::open(&tmp.path().join("client-desk.db")).unwrap();
    let a = snippets::group_create(&conn, "常用").unwrap();
    let b = snippets::group_create(&conn, "交接").unwrap();
    assert!(a.sort < b.sort);
    let b = snippets::group_update(
        &conn,
        &b.id,
        SnippetGroupPatch {
            name: Some("售后".into()),
            sort: Some(-1),
        },
    )
    .unwrap();
    assert_eq!(snippets::groups_list(&conn).unwrap()[0].name, "售后");
    assert_eq!(
        snippets::group_create(&conn, "  ").unwrap_err().code,
        "invalid"
    );
    let body = "  您好！\n文件已经发出。\n";
    let item = snippets::create(
        &conn,
        SnippetInput {
            group_id: a.id.clone(),
            title: "交付".into(),
            body: body.into(),
        },
    )
    .unwrap();
    let other = snippets::create(
        &conn,
        SnippetInput {
            group_id: a.id.clone(),
            title: "进度".into(),
            body: "今天完成".into(),
        },
    )
    .unwrap();
    assert_eq!(item.body, body);
    assert_eq!(other.sort, item.sort + 1);
    snippets::mark_used(&conn, &item.id).unwrap();
    let edited = snippets::update(
        &conn,
        &item.id,
        SnippetPatch {
            title: Some("回访".into()),
            group_id: Some(b.id.clone()),
            sort: Some(5),
            ..Default::default()
        },
    )
    .unwrap();
    assert_eq!(edited.body, body);
    assert_eq!(edited.use_count, 1);
    assert_eq!(edited.sort, 5);
    assert_eq!(snippets::list(&conn).unwrap()[0].id, item.id);
    snippets::group_delete(&conn, &b.id).unwrap();
    assert_eq!(
        snippets::mark_used(&conn, &item.id).unwrap_err().code,
        "notFound"
    );
    assert_eq!(snippets::list(&conn).unwrap().len(), 1);
    snippets::delete(&conn, &other.id).unwrap();
    assert_eq!(
        snippets::delete(&conn, &other.id).unwrap_err().code,
        "notFound"
    );
    assert!(snippets::list(&conn).unwrap().is_empty());
}

#[test]
fn backup_round_trip_preserves_both_states_and_rejects_bad_sources() {
    let data = tempdir().unwrap();
    let library = tempdir().unwrap();
    let mut conn = db::open(&data.path().join("client-desk.db")).unwrap();
    settings::write(&conn, "testMarker", &"第一版").unwrap();
    let local = backup::create(&conn, data.path()).unwrap();
    assert_eq!(local.kind, BackupKind::Manual);
    assert!(Path::new(&local.path)
        .canonicalize()
        .unwrap()
        .starts_with(data.path().join("backups").canonicalize().unwrap()));
    settings::write(&conn, "libraryRoot", &library.path()).unwrap();
    let archive = backup::create(&conn, data.path()).unwrap();
    let second = backup::create(&conn, data.path()).unwrap();
    assert_ne!(second.path, archive.path);
    assert!(archive.file_name.ends_with("-manual.db"));
    assert!(archive.size_bytes > 0);
    assert!(Path::new(&archive.path)
        .canonicalize()
        .unwrap()
        .starts_with(library.path().join("_备份").canonicalize().unwrap()));

    settings::write(&conn, "testMarker", &"第二版").unwrap();
    backup::restore(&mut conn, data.path(), &archive.file_name).unwrap();
    assert_eq!(marker(&conn), "第一版");
    assert_eq!(check_pragma(&conn, "foreign_keys"), 1);
    let backups = backup::list(&conn, data.path()).unwrap();
    let before = backups
        .iter()
        .find(|b| b.kind == BackupKind::BeforeRestore)
        .unwrap();
    assert!(before.file_name.ends_with("-before-restore.db"));
    assert_eq!(marker(&Connection::open(&before.path).unwrap()), "第二版");
    assert_eq!(
        backup::restore(&mut conn, data.path(), "../client-desk.db")
            .unwrap_err()
            .code,
        "outsideLibrary"
    );

    let damaged = library
        .path()
        .join("_备份")
        .join("client-desk-19991201-050000.db");
    fs::copy(&archive.path, &damaged).unwrap();
    let wrong = Connection::open(&damaged).unwrap();
    wrong
        .execute_batch("ALTER TABLE clients RENAME COLUMN company TO unexpected")
        .unwrap();
    drop(wrong);
    assert_eq!(
        backup::restore(&mut conn, data.path(), "client-desk-19991201-050000.db")
            .unwrap_err()
            .code,
        "invalid"
    );
    assert_eq!(marker(&conn), "第一版");
    settings::write(&conn, "libraryRoot", &library.path().join("离线")).unwrap();
    assert_eq!(
        backup::create(&conn, data.path()).unwrap_err().code,
        "libraryUnavailable"
    );
    assert!(!library.path().join("离线").exists());
}

#[test]
fn daily_backup_rotates_only_automatic_snapshots_and_records_success_once() {
    let data = tempdir().unwrap();
    let conn = db::open(&data.path().join("client-desk.db")).unwrap();
    assert!(backup::list(&conn, data.path()).unwrap().is_empty());
    let manual = backup::create(&conn, data.path()).unwrap();
    let dir = data.path().join("backups");
    let before = dir.join("client-desk-19990101-000000-before-restore.db");
    fs::copy(&manual.path, &before).unwrap();
    for day in 1..=31 {
        fs::copy(
            &manual.path,
            dir.join(format!("client-desk-199901{day:02}-120000.db")),
        )
        .unwrap();
    }
    fs::write(dir.join("无关文件.db"), "保留").unwrap();
    backup::auto(&conn, data.path()).unwrap();
    let first = backup::list(&conn, data.path()).unwrap();
    assert_eq!(first.len(), 32);
    assert_eq!(
        first.iter().filter(|b| b.kind == BackupKind::Auto).count(),
        30
    );
    assert!(!dir.join("client-desk-19990101-120000.db").exists());
    assert!(!dir.join("client-desk-19990102-120000.db").exists());
    assert!(dir.join("client-desk-19990103-120000.db").is_file());
    assert!(Path::new(&manual.path).is_file());
    assert!(before.is_file());
    assert!(dir.join("无关文件.db").is_file());
    backup::auto(&conn, data.path()).unwrap();
    assert_eq!(
        first.iter().map(|b| &b.file_name).collect::<Vec<_>>(),
        backup::list(&conn, data.path())
            .unwrap()
            .iter()
            .map(|b| &b.file_name)
            .collect::<Vec<_>>()
    );
    assert_eq!(
        settings::read::<String>(&conn, "lastAutoBackupDate")
            .unwrap()
            .unwrap(),
        chrono::Local::now().date_naive().to_string()
    );
}

#[test]
fn checkpoint_leaves_all_data_in_the_main_database_file() {
    let tmp = tempdir().unwrap();
    let path = tmp.path().join("client-desk.db");
    let conn = db::open(&path).unwrap();
    settings::write(&conn, "testMarker", &"已合并").unwrap();
    let wal = tmp.path().join("client-desk.db-wal");
    assert!(fs::metadata(&wal).unwrap().len() > 0);

    db::checkpoint(&conn).unwrap();

    assert_eq!(fs::metadata(&wal).unwrap().len(), 0);
    // conn stays open, like a process that exits without closing it.
    let copy = tmp.path().join("copy.db");
    fs::copy(&path, &copy).unwrap();
    assert_eq!(marker(&Connection::open(&copy).unwrap()), "已合并");
}

#[test]
fn checkpoint_reports_busy_while_a_reader_holds_the_wal_and_keeps_data() {
    let tmp = tempdir().unwrap();
    let path = tmp.path().join("client-desk.db");
    let conn = db::open(&path).unwrap();
    conn.busy_timeout(std::time::Duration::ZERO).unwrap();
    settings::write(&conn, "testMarker", &"还在").unwrap();
    let mut reader = Connection::open(&path).unwrap();
    let snapshot = reader.transaction().unwrap();
    assert_eq!(marker(&snapshot), "还在");

    assert!(db::checkpoint(&conn).is_err());

    drop(snapshot);
    assert_eq!(marker(&conn), "还在");
    db::checkpoint(&conn).unwrap();
    assert_eq!(marker(&conn), "还在");
}
