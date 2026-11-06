use client_desk_lib::{
    commands, customer_management, file_history_commands, followups, repo::settings, AppState,
    Database,
};
use serde_json::{json, Value};
use tauri::{
    ipc::{CallbackFn, InvokeBody},
    test::{get_ipc_response, mock_builder, mock_context, noop_assets, INVOKE_KEY},
    webview::InvokeRequest,
    WebviewWindowBuilder,
};

#[test]
fn management_commands_work_through_real_ipc_with_persistent_records_and_file_bytes() {
    let dir = tempfile::tempdir().unwrap();
    let library = dir.path().join("文件库");
    std::fs::create_dir(&library).unwrap();
    let state = AppState::open(dir.path().join("数据")).unwrap();
    state
        .read(|db| settings::write(db, "libraryRoot", &library.to_string_lossy().to_string()))
        .unwrap();
    let app = mock_builder()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::client_create,
            commands::client_get,
            commands::file_trash,
            customer_management::commands::customer_management_states,
            customer_management::commands::customer_set_archived,
            customer_management::commands::customer_merge_preview,
            customer_management::commands::customer_merge,
            followups::commands::follow_ups_list,
            followups::commands::follow_up_create,
            followups::commands::follow_up_claim_reminder,
            file_history_commands::file_versions_save,
            file_history_commands::file_versions_replace,
            file_history_commands::file_versions_list,
            file_history_commands::file_versions_restore,
            file_history_commands::file_recycle_list,
            file_history_commands::file_recycle_restore,
        ])
        .build(mock_context(noop_assets()))
        .unwrap();
    let view = WebviewWindowBuilder::new(&app, "main", Default::default())
        .build()
        .unwrap();
    let invoke = |command: &str, body: Value| {
        get_ipc_response(
            &view,
            InvokeRequest {
                cmd: command.to_owned(),
                callback: CallbackFn(0),
                error: CallbackFn(1),
                url: "http://tauri.localhost".parse().unwrap(),
                body: InvokeBody::Json(body),
                headers: Default::default(),
                invoke_key: INVOKE_KEY.into(),
            },
        )
        .map(|response| response.deserialize::<Value>().unwrap())
    };
    let source = invoke(
        "client_create",
        json!({"input":{"name":"来源客户","phone":"13800138000"}}),
    )
    .unwrap();
    let target = invoke(
        "client_create",
        json!({"input":{"name":"保留客户","email":"target@example.test"}}),
    )
    .unwrap();
    let source_id = &source["id"];
    let target_id = &target["id"];
    let follow = invoke("follow_up_create", json!({"input":{"clientId":source_id,"title":"确认交付反馈","dueAt":"2020-01-01T00:00:00Z"}})).unwrap();
    assert!(follow["projectAvailable"].as_bool().unwrap());
    assert_eq!(
        invoke(
            "follow_up_claim_reminder",
            json!({"id":follow["id"],"revision":follow["revision"]})
        )
        .unwrap(),
        json!(true)
    );
    assert_eq!(
        invoke(
            "follow_up_claim_reminder",
            json!({"id":follow["id"],"revision":follow["revision"]})
        )
        .unwrap(),
        json!(false)
    );
    assert!(invoke(
        "customer_set_archived",
        json!({"clientId":source_id,"archived":true})
    )
    .unwrap()["archivedAt"]
        .is_string());
    let preview = invoke(
        "customer_merge_preview",
        json!({"sourceId":source_id,"targetId":target_id}),
    )
    .unwrap();
    assert_eq!(preview["followUpCount"], 1);
    let merged = invoke("customer_merge", json!({"input":{"sourceId":source_id,"targetId":target_id,"previewToken":preview["previewToken"]}})).unwrap();
    assert_eq!(merged["phone"], "13800138000");
    assert_eq!(merged["email"], "target@example.test");
    assert_eq!(
        invoke("client_get", json!({"id":source_id})).unwrap_err()["code"],
        "notFound"
    );
    let follows = invoke("follow_ups_list", json!({"filter":{"clientId":target_id}})).unwrap();
    assert_eq!(follows[0]["id"], follow["id"]);
    assert_eq!(follows[0]["clientName"], "保留客户");
    let malformed = invoke(
        "customer_set_archived",
        json!({"clientId":target_id,"archived":"错误"}),
    )
    .unwrap_err();
    assert_eq!(malformed["code"], "invalid");

    let file = library.join("设计稿.txt");
    let replacement = dir.path().join("新版.txt");
    std::fs::write(&file, b"original bytes").unwrap();
    std::fs::write(&replacement, b"new bytes").unwrap();
    let version = invoke(
        "file_versions_save",
        json!({"path":file,"note":"客户确认前"}),
    )
    .unwrap();
    assert_eq!(version["note"], "客户确认前");
    invoke(
        "file_versions_replace",
        json!({"path":file,"sourcePath":replacement,"note":"第二稿"}),
    )
    .unwrap();
    assert_eq!(std::fs::read(&file).unwrap(), b"new bytes");
    invoke("file_versions_restore", json!({"id":version["id"]})).unwrap();
    assert_eq!(std::fs::read(&file).unwrap(), b"original bytes");
    invoke("file_trash", json!({"path":file})).unwrap();
    assert!(!file.exists());
    let trash = invoke("file_recycle_list", json!({})).unwrap();
    assert_eq!(trash.as_array().unwrap().len(), 1);
    std::fs::write(&file, b"new occupant").unwrap();
    let recovered = invoke("file_recycle_restore", json!({"id":trash[0]["id"]})).unwrap();
    assert_eq!(std::fs::read(&file).unwrap(), b"new occupant");
    assert_eq!(
        std::fs::read(recovered["path"].as_str().unwrap()).unwrap(),
        b"original bytes"
    );
    assert!(invoke("file_recycle_list", json!({}))
        .unwrap()
        .as_array()
        .unwrap()
        .is_empty());
}
