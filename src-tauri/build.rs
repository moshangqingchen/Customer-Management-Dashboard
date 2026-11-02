fn main() -> Result<(), Box<dyn std::error::Error>> {
    tauri_build::build();
    // Tauri embeds the desktop manifest in app binaries. IPC test executables
    // also link native dialogs and need Common Controls v6 at load time.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows")
        && std::env::var("CARGO_CFG_TARGET_ENV").as_deref() == Ok("msvc")
    {
        let resources = std::path::PathBuf::from(std::env::var("OUT_DIR")?).join("resource.lib");
        println!("cargo:rustc-link-arg-tests={}", resources.display());
    }
    Ok(())
}
