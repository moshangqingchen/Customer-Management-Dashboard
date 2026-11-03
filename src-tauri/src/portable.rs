use crate::{
    error::{AppError, Result},
    library::display,
};
use serde::Deserialize;
use std::{
    fs,
    io::{ErrorKind, Write},
    path::{Component, Path, PathBuf},
};

#[derive(Debug, PartialEq, Eq)]
pub enum DataMode {
    Standard,
    Portable {
        data_dir: PathBuf,
        suggested_library_root: Option<PathBuf>,
    },
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Config {
    data_dir: String,
    library_dir: Option<String>,
}

fn config_error(config_path: &Path, reason: impl std::fmt::Display) -> AppError {
    AppError::new(
        "portableConfig",
        format!(
            "无法使用便携模式。\n配置文件：{}\n原因：{reason}\n请修正配置或目录权限后重新启动。",
            display(config_path)
        ),
    )
}

fn resolve(base: &Path, value: &str) -> Result<PathBuf> {
    if value.trim().is_empty() {
        return Err(AppError::invalid("目录路径不能为空"));
    }
    if matches!(
        Path::new(value).components().next(),
        Some(Component::Prefix(_))
    ) && !Path::new(value).is_absolute()
    {
        return Err(AppError::invalid("带盘符的路径必须是完整的绝对路径"));
    }
    let absolute = std::path::absolute(base.join(value))?;
    let mut normalized = PathBuf::new();
    for component in absolute.components() {
        match component {
            Component::CurDir => {}
            Component::ParentDir => {
                normalized.pop();
            }
            _ => normalized.push(component.as_os_str()),
        }
    }
    Ok(normalized)
}

/// Resolve before constructing Tauri so an invalid portable file cannot create AppData.
pub fn detect() -> Result<DataMode> {
    from_executable(&std::env::current_exe()?)
}

pub fn from_executable(executable: &Path) -> Result<DataMode> {
    let base = executable
        .parent()
        .ok_or_else(|| AppError::invalid("无法确定程序所在目录"))?;
    let config_path = base.join("portable.json");
    let bytes = match fs::read(&config_path) {
        Ok(bytes) => bytes,
        Err(error)
            if error.kind() == ErrorKind::NotFound
                && matches!(fs::symlink_metadata(&config_path), Err(e) if e.kind() == ErrorKind::NotFound) =>
        {
            return Ok(DataMode::Standard);
        }
        Err(error) => {
            return Err(config_error(
                &config_path,
                format!("无法读取配置（{error}）"),
            ))
        }
    };
    // Accept UTF-8 BOM files written by Windows editors.
    let bytes = bytes.strip_prefix(b"\xef\xbb\xbf").unwrap_or(&bytes);
    let config: Config = serde_json::from_slice(bytes)
        .map_err(|error| config_error(&config_path, format!("JSON 格式不正确（{error}）")))?;
    let data_dir =
        resolve(base, &config.data_dir).map_err(|error| config_error(&config_path, error))?;
    let suggested_library_root = config
        .library_dir
        .as_deref()
        .map(|path| resolve(base, path))
        .transpose()
        .map_err(|error| config_error(&config_path, error))?;
    fs::create_dir_all(&data_dir).map_err(|error| {
        config_error(
            &config_path,
            format!("无法创建数据目录 {}（{error}）", display(&data_dir)),
        )
    })?;
    let data_dir = data_dir
        .canonicalize()
        .map_err(|error| config_error(&config_path, format!("无法解析数据目录（{error}）")))?;
    let mut probe = tempfile::NamedTempFile::new_in(&data_dir)
        .map_err(|error| config_error(&config_path, format!("数据目录不可写（{error}）")))?;
    probe
        .write_all(b"client-desk portable write check")
        .and_then(|()| probe.as_file().sync_all())
        .map_err(|error| config_error(&config_path, format!("数据目录不可写（{error}）")))?;
    probe.close().map_err(|error| {
        config_error(&config_path, format!("无法清理数据目录测试文件（{error}）"))
    })?;
    // Strip Windows verbatim prefixes for WebView2 and user-visible paths.
    Ok(DataMode::Portable {
        data_dir: PathBuf::from(display(&data_dir)),
        suggested_library_root,
    })
}

impl DataMode {
    pub fn startup_error(&self, error: impl std::fmt::Display) -> AppError {
        match self {
            Self::Standard => AppError::new("startup", format!("应用启动失败（{error}）")),
            Self::Portable { .. } => {
                let path = std::env::current_exe()
                    .ok()
                    .and_then(|exe| exe.parent().map(|base| base.join("portable.json")))
                    .unwrap_or_else(|| PathBuf::from("portable.json"));
                config_error(&path, error)
            }
        }
    }
}

/// Native dialog works even before the runtime or any webview has been created.
pub fn show_startup_error(error: &AppError) {
    #[cfg(windows)]
    {
        #[link(name = "user32")]
        extern "system" {
            fn MessageBoxW(
                window: *mut std::ffi::c_void,
                text: *const u16,
                caption: *const u16,
                flags: u32,
            ) -> i32;
        }
        let text: Vec<u16> = error.message.encode_utf16().chain(Some(0)).collect();
        let caption: Vec<u16> = "客户工作台 — 启动失败"
            .encode_utf16()
            .chain(Some(0))
            .collect();
        // SAFETY: both UTF-16 buffers are NUL-terminated and live throughout the modal call.
        unsafe {
            MessageBoxW(std::ptr::null_mut(), text.as_ptr(), caption.as_ptr(), 0x10);
        }
    }
    #[cfg(not(windows))]
    eprintln!("客户工作台启动失败：{error}");
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn missing_file_is_standard_without_creating_directories() {
        let temp = tempfile::tempdir().unwrap();
        assert_eq!(
            from_executable(&temp.path().join("client-desk.exe")).unwrap(),
            DataMode::Standard
        );
        assert_eq!(fs::read_dir(temp.path()).unwrap().count(), 0);
    }

    #[test]
    fn relative_paths_use_executable_parent_and_library_is_only_a_suggestion() {
        let temp = tempfile::tempdir().unwrap();
        let app = temp.path().join("app");
        fs::create_dir(&app).unwrap();
        fs::write(
            app.join("portable.json"),
            r#"{"dataDir":"../data/./nested/..","libraryDir":"../lib"}"#,
        )
        .unwrap();
        let DataMode::Portable {
            data_dir,
            suggested_library_root,
        } = from_executable(&app.join("client-desk.exe")).unwrap()
        else {
            panic!("expected portable")
        };
        assert_eq!(
            data_dir.canonicalize().unwrap(),
            temp.path().join("data").canonicalize().unwrap()
        );
        assert_eq!(
            suggested_library_root,
            Some(PathBuf::from(display(temp.path())).join("lib"))
        );
        assert!(!data_dir.components().any(|c| c == Component::ParentDir));
        assert!(!temp.path().join("lib").exists());
        assert_eq!(fs::read_dir(data_dir).unwrap().count(), 0);
    }

    #[test]
    fn absolute_path_and_omitted_library_are_supported() {
        let temp = tempfile::tempdir().unwrap();
        let data = temp.path().join("数据");
        fs::write(
            temp.path().join("portable.json"),
            json!({"dataDir": data}).to_string(),
        )
        .unwrap();
        let DataMode::Portable {
            data_dir,
            suggested_library_root,
        } = from_executable(&temp.path().join("client-desk.exe")).unwrap()
        else {
            panic!("expected portable")
        };
        assert_eq!(
            data_dir.canonicalize().unwrap(),
            data.canonicalize().unwrap()
        );
        assert_eq!(suggested_library_root, None);
    }

    #[test]
    fn invalid_or_missing_data_dir_never_falls_back() {
        let temp = tempfile::tempdir().unwrap();
        let config = temp.path().join("portable.json");
        for invalid in ["{", "{}", r#"{"dataDir":""}"#, r#"{"dataDir":42}"#] {
            fs::write(&config, invalid).unwrap();
            let error = from_executable(&temp.path().join("client-desk.exe")).unwrap_err();
            assert_eq!(error.code, "portableConfig");
            assert!(error.message.contains(&display(&config)));
        }
    }

    #[test]
    fn data_directory_blocked_by_a_file_is_reported() {
        let temp = tempfile::tempdir().unwrap();
        fs::write(temp.path().join("blocked"), "occupied").unwrap();
        fs::write(
            temp.path().join("portable.json"),
            r#"{"dataDir":"blocked/child"}"#,
        )
        .unwrap();
        let error = from_executable(&temp.path().join("client-desk.exe")).unwrap_err();
        assert_eq!(error.code, "portableConfig");
        assert!(error.message.contains("无法创建数据目录"));
    }

    #[cfg(windows)]
    #[test]
    fn drive_relative_paths_are_rejected_instead_of_using_the_process_directory() {
        let temp = tempfile::tempdir().unwrap();
        fs::write(
            temp.path().join("portable.json"),
            r#"{"dataDir":"C:relative"}"#,
        )
        .unwrap();
        let error = from_executable(&temp.path().join("client-desk.exe")).unwrap_err();
        assert!(error.message.contains("完整的绝对路径"));
    }
}
