use super::*;
use crate::repo::clients;
use serde_json::json;

#[test]
fn text_export_replaces_existing_file_and_includes_utf8_bom() {
    let dir = tempfile::tempdir().unwrap();
    let path = dir.path().join("收款流水.csv");
    std::fs::write(&path, "原始内容").unwrap();
    write_text(&path, "项目,金额\r\n海报,1800").unwrap();
    assert_eq!(
        std::fs::read(path).unwrap(),
        "\u{feff}项目,金额\r\n海报,1800".as_bytes()
    );
}

#[test]
fn restoring_from_a_dedicated_connection_refreshes_the_command_connection() {
    let dir = tempfile::tempdir().unwrap();
    let state = AppState::open(dir.path().to_owned()).unwrap();
    let client = state
        .read(|db| {
            clients::create(
                db,
                serde_json::from_value(json!({"name":"备份时的客户"})).unwrap(),
            )
        })
        .unwrap();
    let saved = backup::create(&state.backup_connection().unwrap(), &state.data_dir).unwrap();
    state.read(|db| clients::delete(db, &client.id)).unwrap();
    assert!(state.read(clients::list).unwrap().is_empty());
    backup::restore(
        &mut state.backup_connection().unwrap(),
        &state.data_dir,
        &saved.file_name,
    )
    .unwrap();
    let restored = state.read(|db| clients::get(db, &client.id)).unwrap();
    assert_eq!(restored.name, "备份时的客户");
}
