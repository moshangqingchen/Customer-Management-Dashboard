use client_desk_lib::{commands, AppState};
use serde_json::{json, Value};
use tauri::{
    ipc::{CallbackFn, InvokeBody},
    test::{get_ipc_response, mock_builder, mock_context, noop_assets, INVOKE_KEY},
    webview::InvokeRequest,
    WebviewWindowBuilder,
};

#[test]
fn frontend_arguments_and_error_payloads_round_trip_through_ipc() {
    let dir = tempfile::tempdir().unwrap();
    let app = mock_builder()
        .manage(AppState::open(dir.path().to_owned()).unwrap())
        .invoke_handler(tauri::generate_handler![
            commands::client_create,
            commands::client_delete,
            commands::client_get,
            commands::activities_list,
            commands::tag_merge,
            commands::trash_restore
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
    let client = invoke("client_create", json!({"input":{"name":"林女士"}})).unwrap();
    assert_eq!(client["outstandingCents"], 0);
    let id = &client["id"];
    assert_eq!(
        invoke("activities_list", json!({"clientId": id})).unwrap(),
        json!([])
    );
    invoke("client_delete", json!({"id":id})).unwrap();
    assert_eq!(
        invoke("client_get", json!({"id":id})).unwrap_err()["code"],
        "notFound"
    );
    invoke("trash_restore", json!({"type":"client", "id":id})).unwrap();
    assert_eq!(
        invoke("client_get", json!({"id":id})).unwrap()["name"],
        "林女士"
    );
    assert_eq!(
        invoke("tag_merge", json!({"sourceId":"a","targetId":"b"})).unwrap_err()["code"],
        "notFound"
    );
    let invalid = invoke(
        "client_create",
        json!({"input":{"name":"林","rating":"错误"}}),
    )
    .unwrap_err();
    assert_eq!(
        invalid,
        json!({"code":"invalid","message":"调用参数 input 缺失或格式不正确"})
    );
}
