pub mod backup;
pub mod commands;
pub mod db;
pub mod error;
pub mod library;
pub mod models;
pub mod repo;

use error::{AppError, Result};
use rusqlite::Connection;
use std::{
    path::{Path, PathBuf},
    sync::{Mutex, MutexGuard},
};
use tauri::{AppHandle, Manager};

const DB_FILE: &str = "client-desk.db";

pub struct AppState {
    connection: Mutex<Connection>,
    filesystem: Mutex<()>,
    data_dir: PathBuf,
}

/// Database snapshots are owned values; filesystem work must happen after `read` returns.
pub trait Database {
    fn read<T>(&self, run: impl FnOnce(&Connection) -> Result<T>) -> Result<T>;
    fn file_guard(&self) -> Result<MutexGuard<'_, ()>>;

    fn before_file_copy(&self, _source: &Path) {}
}

impl Database for Connection {
    fn read<T>(&self, run: impl FnOnce(&Connection) -> Result<T>) -> Result<T> {
        run(self)
    }

    fn file_guard(&self) -> Result<MutexGuard<'_, ()>> {
        static FILESYSTEM: Mutex<()> = Mutex::new(());
        FILESYSTEM
            .lock()
            .map_err(|_| AppError::new("io", "文件操作异常，请重新打开应用"))
    }
}

impl AppState {
    pub fn open(data_dir: PathBuf) -> Result<Self> {
        std::fs::create_dir_all(&data_dir)?;
        let connection = Mutex::new(db::open(&data_dir.join(DB_FILE))?);
        Ok(Self {
            connection,
            filesystem: Mutex::new(()),
            data_dir,
        })
    }

    fn lock(&self) -> Result<MutexGuard<'_, Connection>> {
        self.connection
            .lock()
            .map_err(|_| AppError::new("db", "数据库连接异常，请重新打开应用"))
    }

    fn backup_connection(&self) -> Result<Connection> {
        // A dedicated SQLite connection keeps backup I/O off the command mutex.
        db::open(&self.data_dir.join(DB_FILE))
    }
}

impl Database for AppState {
    fn read<T>(&self, run: impl FnOnce(&Connection) -> Result<T>) -> Result<T> {
        let db = self.lock()?;
        run(&db)
    }

    fn file_guard(&self) -> Result<MutexGuard<'_, ()>> {
        self.filesystem
            .lock()
            .map_err(|_| AppError::new("io", "文件操作异常，请重新打开应用"))
    }
}

fn register_library_path(app: &AppHandle, root: Option<&Path>) -> Result<()> {
    if let Some(root) = root {
        app.asset_protocol_scope()
            .allow_directory(root, true)
            .map_err(|e| {
                AppError::new("libraryUnavailable", format!("无法授权文件库缩略图（{e}）"))
            })?;
    }
    Ok(())
}

pub fn run() -> tauri::Result<()> {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") {
                if let Err(error) = window
                    .unminimize()
                    .and_then(|()| window.show())
                    .and_then(|()| window.set_focus())
                {
                    eprintln!("无法聚焦已有窗口（{error}）");
                }
            }
        }))
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let state = AppState::open(app.path().app_data_dir()?)?;
            if let Err(error) = state
                .read(|db| repo::settings::read::<PathBuf>(db, "libraryRoot"))
                .and_then(|root| register_library_path(app.handle(), root.as_deref()))
            {
                eprintln!("文件库授权失败（{error}）");
            }
            if let Err(error) = state
                .backup_connection()
                .and_then(|db| backup::auto(&db, &state.data_dir))
            {
                eprintln!("自动备份失败（{error}）");
            }
            app.manage(state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::app_info,
            commands::library_status,
            commands::library_set_root,
            commands::library_open_root,
            commands::clients_list,
            commands::client_get,
            commands::client_create,
            commands::client_update,
            commands::client_delete,
            commands::projects_list,
            commands::project_get,
            commands::project_create,
            commands::project_update,
            commands::project_set_status,
            commands::project_duplicate,
            commands::project_delete,
            commands::payments_list,
            commands::payments_all,
            commands::payment_add,
            commands::payment_update,
            commands::payment_delete,
            commands::tags_list,
            commands::tag_create,
            commands::tag_update,
            commands::tag_delete,
            commands::tag_merge,
            commands::client_set_tags,
            commands::project_set_tags,
            commands::activities_list,
            commands::activities_recent,
            commands::activity_add_note,
            commands::activity_update_note,
            commands::activity_delete,
            commands::files_list,
            commands::files_recent,
            commands::files_add,
            commands::files_pick_and_add,
            commands::file_open,
            commands::file_reveal,
            commands::file_rename,
            commands::file_trash,
            commands::folder_open,
            commands::pick_folder,
            commands::snippet_groups_list,
            commands::snippet_group_create,
            commands::snippet_group_update,
            commands::snippet_group_delete,
            commands::snippets_list,
            commands::snippet_create,
            commands::snippet_update,
            commands::snippet_delete,
            commands::snippet_mark_used,
            commands::settings_get,
            commands::settings_update,
            commands::backups_list,
            commands::backup_create,
            commands::backup_restore,
            commands::trash_list,
            commands::trash_restore,
            commands::trash_purge,
            commands::save_text_file,
        ])
        .run(tauri::generate_context!())
}
