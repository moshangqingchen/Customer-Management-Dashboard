use serde_json::Value;

#[test]
fn updater_is_enabled_for_the_main_window() {
    let capability: Value = serde_json::from_str(include_str!("../capabilities/default.json"))
        .expect("default capability should be valid JSON");
    let permissions = capability["permissions"]
        .as_array()
        .expect("permissions should be an array");

    assert!(permissions.iter().any(|value| value == "updater:default"));
}

#[test]
fn updater_uses_https_and_has_artifact_signing_enabled() {
    let config: Value = serde_json::from_str(include_str!("../tauri.conf.json"))
        .expect("tauri config should be valid JSON");
    let endpoints = config["plugins"]["updater"]["endpoints"]
        .as_array()
        .expect("updater endpoints should be an array");

    assert!(!endpoints.is_empty());
    assert!(endpoints.iter().all(|value| value
        .as_str()
        .is_some_and(|endpoint| endpoint.starts_with("https://"))));
    assert_eq!(config["bundle"]["createUpdaterArtifacts"], true);
}
