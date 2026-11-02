use client_desk_lib::{commands, library, AppState};
use serde_json::{json, Value};
use std::{fs, path::Path};
use tauri::{
    ipc::{CallbackFn, InvokeBody},
    test::{get_ipc_response, mock_builder, mock_context, noop_assets, INVOKE_KEY},
    webview::InvokeRequest,
    WebviewWindowBuilder,
};

#[test]
fn project_commands_populate_counts_and_keep_folder_renames_in_sync() {
    let dir = tempfile::tempdir().unwrap();
    let root = dir.path().join("文件库");
    fs::create_dir(&root).unwrap();
    let state = AppState::open(dir.path().join("应用数据")).unwrap();
    library::set_root(&state, &root).unwrap();
    let app = mock_builder()
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::client_create,
            commands::client_update,
            commands::project_create,
            commands::project_get,
            commands::projects_list,
            commands::project_set_status,
            commands::project_update,
            commands::project_duplicate,
            commands::files_add,
            commands::file_trash
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
    let client = invoke("client_create", json!({"input":{"name":"小林"}})).unwrap();
    let client_id = client["id"].as_str().unwrap();
    let project = invoke(
        "project_create",
        json!({"input":{"clientId":client_id,"title":"海报"}}),
    )
    .unwrap();
    let project_id = project["id"].as_str().unwrap();
    assert_eq!(project["fileCount"], 0);
    assert!(project["coverPath"].is_null());
    let source = dir.path().join("素材.png");
    fs::write(&source, b"design").unwrap();
    let added = invoke(
        "files_add",
        json!({"target":{"projectId":project_id},"sourcePaths":[source.to_string_lossy()]}),
    )
    .unwrap();
    let get = || invoke("project_get", json!({"id":project_id})).unwrap();
    assert_eq!(get()["fileCount"], 1);
    assert_eq!(get()["coverPath"], added["added"][0]["path"]);
    assert_eq!(
        invoke("projects_list", json!({})).unwrap()[0]["fileCount"],
        1
    );
    assert_eq!(
        invoke(
            "project_set_status",
            json!({"id":project_id,"status":"review"}),
        )
        .unwrap()["fileCount"],
        1
    );
    let renamed = invoke(
        "project_update",
        json!({"id":project_id,"patch":{"title":"新海报","renameFolder":true}}),
    )
    .unwrap();
    assert!(renamed["warning"].is_null());
    assert_eq!(renamed["value"]["fileCount"], 1);
    assert!(renamed["value"]["coverPath"]
        .as_str()
        .unwrap()
        .contains("新海报"));
    assert!(renamed["value"]["folder"]
        .as_str()
        .unwrap()
        .ends_with("新海报"));
    let updated = invoke(
        "client_update",
        json!({"id":client_id,"patch":{"name":"林女士","renameFolder":true}}),
    )
    .unwrap();
    assert!(updated["warning"].is_null());
    let current = get();
    assert_eq!(current["fileCount"], 1);
    let folder = current["folder"].as_str().unwrap();
    assert!(folder.starts_with("林女士/"));
    assert!(!Path::new(added["added"][0]["path"].as_str().unwrap()).exists());
    let path = root.join(folder).join("素材.png");
    assert_eq!(
        Path::new(current["coverPath"].as_str().unwrap())
            .canonicalize()
            .unwrap(),
        path.canonicalize().unwrap()
    );
    assert_eq!(fs::read(&path).unwrap(), b"design");
    invoke("file_trash", json!({"path":path.to_string_lossy()})).unwrap();
    assert_eq!(get()["fileCount"], 0);
    assert!(get()["coverPath"].is_null());
    let duplicate = invoke("project_duplicate", json!({"id":project_id})).unwrap();
    assert_eq!(duplicate["fileCount"], 0);
    assert!(duplicate["coverPath"].is_null());
    assert!(duplicate["folder"].is_null());
}
