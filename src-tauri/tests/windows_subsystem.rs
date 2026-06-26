#[test]
fn release_windows_entrypoint_hides_the_console_window() {
    let main_rs = std::fs::read_to_string("src/main.rs").expect("read src/main.rs");

    assert!(
        main_rs.contains("windows_subsystem = \"windows\""),
        "Windows release builds should use the windows subsystem to avoid a startup console"
    );
}
