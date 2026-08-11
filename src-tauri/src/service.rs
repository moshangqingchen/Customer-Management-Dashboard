use std::{
    collections::{HashMap, HashSet},
    fs::{self, File, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
};

use chrono::{DateTime, Local, NaiveDate, Utc};
use rusqlite::{params, Connection, DatabaseName, OpenFlags, OptionalExtension, Transaction};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;
use uuid::Uuid;
use walkdir::WalkDir;
use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

use crate::{
    db,
    domain::{
        folder_names::{customer_folder_name, next_available_name, order_folder_name},
        money::{payment_status, PaymentStatus},
    },
    models::{
        AddressInput, AppSettings, BackupStatus, Customer, CustomerImportOperation,
        DashboardSummary, FileRecord, FullArchiveInspection, FullRestoreResult, ImportCustomerRow,
        ImportResult, LibraryMigrationResult, NewCustomer, NewOrder, Order, OrderItem,
        OrderItemInput, Payment, PaymentInput, PlatformIdentityInput, SearchHit, SourceFactory,
        SourceFactoryInput, SourceFactoryProject, SourceFactoryProjectInput, SourceQuote,
        SourceQuoteInput, StorageHealth,
    },
};

#[derive(Debug, Error)]
pub enum AppError {
    #[error("数据库错误：{0}")]
    Database(#[from] rusqlite::Error),
    #[error("文件错误：{0}")]
    Io(#[from] std::io::Error),
    #[error("序列化错误：{0}")]
    Serialization(#[from] serde_json::Error),
    #[error("{0}")]
    Message(String),
}

pub type AppResult<T> = Result<T, AppError>;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ArchiveFileEntry {
    path: String,
    size_bytes: u64,
    sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct FullArchiveManifest {
    format_version: i64,
    schema_version: i64,
    exported_at: String,
    source_library_root: Option<String>,
    database_sha256: String,
    library_file_count: usize,
    library_bytes: u64,
    library_files: Vec<ArchiveFileEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LibraryMarker {
    format_version: i64,
    source_root: String,
    created_at: String,
    file_count: usize,
    total_bytes: u64,
}

const LIBRARY_MARKER_NAME: &str = ".workbench-library.json";

#[derive(Clone)]
pub struct AppService {
    db_path: PathBuf,
}

impl AppService {
    pub fn new(db_path: PathBuf) -> AppResult<Self> {
        if let Some(parent) = db_path.parent() {
            fs::create_dir_all(parent)?;
        }
        db::open(&db_path)?;
        Ok(Self { db_path })
    }

    fn connection(&self) -> AppResult<Connection> {
        Ok(db::open(&self.db_path)?)
    }

    pub fn db_path(&self) -> &Path {
        &self.db_path
    }

    pub fn set_setting(&self, key: &str, value: &str) -> AppResult<()> {
        self.connection()?.execute(
            "INSERT INTO settings(key, value) VALUES (?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn get_setting(&self, key: &str) -> AppResult<Option<String>> {
        Ok(self
            .connection()?
            .query_row(
                "SELECT value FROM settings WHERE key = ?1",
                params![key],
                |row| row.get(0),
            )
            .optional()?)
    }

    pub fn get_app_preference(&self, key: &str) -> AppResult<Option<String>> {
        let setting_key = app_preference_setting_key(key)?;
        self.get_setting(&setting_key)
    }

    pub fn set_app_preference(&self, key: &str, value: &str) -> AppResult<()> {
        let setting_key = app_preference_setting_key(key)?;
        if value.len() > 2 * 1024 * 1024 {
            return Err(AppError::Message("自定义内容不能超过 2 MB".to_string()));
        }
        serde_json::from_str::<serde_json::Value>(value)
            .map_err(|_| AppError::Message("自定义内容不是有效的 JSON 数据".to_string()))?;
        self.set_setting(&setting_key, value)
    }

    pub fn settings(&self) -> AppResult<AppSettings> {
        Ok(AppSettings {
            library_root: self.get_setting("library_root")?,
            backup_dir: self.get_setting("backup_dir")?,
        })
    }

    pub fn validate_library_root(&self, path: &Path) -> StorageHealth {
        validate_storage_path(path)
    }

    pub fn storage_health(&self) -> AppResult<StorageHealth> {
        Ok(match self.get_setting("library_root")? {
            Some(path) if !path.trim().is_empty() => validate_storage_path(Path::new(&path)),
            _ => StorageHealth {
                status: "notConfigured".to_string(),
                path: None,
                writable: false,
                free_bytes: None,
                message: "尚未设置客户文件库".to_string(),
            },
        })
    }

    pub fn set_backup_dir(&self, path: &Path) -> AppResult<AppSettings> {
        let health = validate_storage_path(path);
        if health.status != "ready" {
            return Err(AppError::Message(format!(
                "备份目录不可用：{}",
                health.message
            )));
        }
        self.set_setting("backup_dir", &path.to_string_lossy())?;
        self.settings()
    }

    pub fn set_library_root(&self, path: &Path) -> AppResult<AppSettings> {
        let health = self.validate_library_root(path);
        if health.status != "ready" {
            return Err(AppError::Message(health.message));
        }
        if let Some(current) = self
            .get_setting("library_root")?
            .filter(|value| !value.trim().is_empty())
            .map(PathBuf::from)
        {
            if !paths_equivalent(&current, path)? {
                let connection = self.connection()?;
                let active_records = connection.query_row(
                    "SELECT
                        (SELECT COUNT(*) FROM customers WHERE deleted_at IS NULL) +
                        (SELECT COUNT(*) FROM orders WHERE deleted_at IS NULL) +
                        (SELECT COUNT(*) FROM files WHERE deleted_at IS NULL)",
                    [],
                    |row| row.get::<_, i64>(0),
                )?;
                if active_records > 0 {
                    return Err(AppError::Message(
                        "当前工作台已有业务数据，不能直接切换文件库；请使用安全迁移功能"
                            .to_string(),
                    ));
                }
            }
        }
        self.set_setting("library_root", &path.to_string_lossy())?;
        self.settings()
    }

    pub fn migrate_library_root(&self, target: &Path) -> AppResult<LibraryMigrationResult> {
        let source = self
            .get_setting("library_root")?
            .filter(|value| !value.trim().is_empty())
            .map(PathBuf::from)
            .ok_or_else(|| AppError::Message("尚未设置原客户文件库".to_string()))?;
        let source_health = self.validate_library_root(&source);
        if source_health.status != "ready" {
            return Err(AppError::Message(format!(
                "原客户文件库当前不可用，无法安全迁移：{}",
                source_health.message
            )));
        }
        let target_health = self.validate_library_root(target);
        if target_health.status != "ready" {
            return Err(AppError::Message(target_health.message));
        }
        if paths_equivalent(&source, target)? {
            return Ok(LibraryMigrationResult {
                old_root: source.to_string_lossy().to_string(),
                new_root: target.to_string_lossy().to_string(),
                copied_files: 0,
                copied_bytes: 0,
                old_root_retained: true,
            });
        }

        let canonical_source = fs::canonicalize(&source)?;
        let canonical_target = fs::canonicalize(target)?;
        if canonical_target.starts_with(&canonical_source)
            || canonical_source.starts_with(&canonical_target)
        {
            return Err(AppError::Message(
                "新旧文件库不能互相包含，请选择独立目录".to_string(),
            ));
        }

        let source_files = collect_directory_manifest(&source, true)?;
        let total_bytes = source_files.iter().try_fold(0_u64, |total, file| {
            total
                .checked_add(file.size_bytes)
                .ok_or_else(|| AppError::Message("文件库大小超出可处理范围".to_string()))
        })?;
        if target_health
            .free_bytes
            .is_some_and(|available| available < total_bytes)
        {
            return Err(AppError::Message(format!(
                "目标磁盘空间不足：至少需要 {total_bytes} 字节"
            )));
        }

        let target_entries = fs::read_dir(target)?.collect::<Result<Vec<_>, _>>()?;
        let marker_path = target.join(LIBRARY_MARKER_NAME);
        let target_is_empty = target_entries.is_empty();
        if target_is_empty {
            let target_parent = target
                .parent()
                .ok_or_else(|| AppError::Message("无法确定目标目录的上级目录".to_string()))?;
            let target_name = target
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("library");
            let staging = target_parent.join(format!(
                ".{target_name}.workbench-migration-{}",
                Uuid::new_v4()
            ));
            let copy_result = (|| -> AppResult<()> {
                fs::create_dir(&staging)?;
                copy_library_tree(&source, &staging)?;
                verify_directory_manifest(&staging, &source_files, true)?;
                let marker = LibraryMarker {
                    format_version: 1,
                    source_root: canonical_source.to_string_lossy().to_string(),
                    created_at: now(),
                    file_count: source_files.len(),
                    total_bytes,
                };
                fs::write(
                    staging.join(LIBRARY_MARKER_NAME),
                    serde_json::to_vec_pretty(&marker)?,
                )?;
                fs::remove_dir(target)?;
                if let Err(error) = fs::rename(&staging, target) {
                    let _ = fs::create_dir(target);
                    return Err(AppError::Io(error));
                }
                Ok(())
            })();
            if let Err(error) = copy_result {
                cleanup_migration_staging(&staging, target_parent);
                return Err(error);
            }
        } else {
            let marker_bytes = fs::read(&marker_path).map_err(|_| {
                AppError::Message(
                    "目标目录不是空目录，也不是此前完成校验的工作台迁移目录".to_string(),
                )
            })?;
            let marker: LibraryMarker = serde_json::from_slice(&marker_bytes)
                .map_err(|_| AppError::Message("目标目录的工作台迁移标记无效".to_string()))?;
            if marker.format_version != 1
                || marker.source_root != canonical_source.to_string_lossy()
            {
                return Err(AppError::Message(
                    "目标目录来自其他文件库，不能直接切换".to_string(),
                ));
            }
            verify_directory_manifest(target, &source_files, true)?;
        }

        self.switch_library_root_in_database(&source, target)?;
        Ok(LibraryMigrationResult {
            old_root: source.to_string_lossy().to_string(),
            new_root: target.to_string_lossy().to_string(),
            copied_files: source_files.len(),
            copied_bytes: total_bytes,
            old_root_retained: true,
        })
    }

    fn switch_library_root_in_database(&self, old_root: &Path, new_root: &Path) -> AppResult<()> {
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        remap_path_column(&transaction, "orders", "folder_path", old_root, new_root)?;
        remap_path_column(
            &transaction,
            "customers",
            "qr_code_path",
            old_root,
            new_root,
        )?;
        remap_path_column(&transaction, "files", "relative_path", old_root, new_root)?;
        transaction.execute(
            "INSERT INTO settings(key, value) VALUES ('library_root', ?1)
             ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            params![new_root.to_string_lossy().as_ref()],
        )?;
        transaction.execute(
            "UPDATE orders SET folder_state=CASE
                WHEN folder_path IS NULL THEN folder_state ELSE 'ready' END
             WHERE deleted_at IS NULL",
            [],
        )?;
        transaction.commit()?;
        Ok(())
    }

    pub fn create_customer(&self, input: NewCustomer) -> AppResult<Customer> {
        if input.name.trim().is_empty() {
            return Err(AppError::Message("客户名称不能为空".to_string()));
        }
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        let id = Uuid::new_v4().to_string();
        let now = now();
        transaction.execute(
            "INSERT INTO customers(
                id, name, phone, wechat, vip_level, notes, tags_json, qr_code_path,
                created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)",
            params![
                id,
                input.name.trim(),
                input.phone.trim(),
                input.wechat.trim(),
                input.vip_level.clamp(0, 5),
                input.notes,
                serde_json::to_string(&input.tags)?,
                input.qr_code_path,
                now,
            ],
        )?;
        insert_platform_identities(&transaction, &id, &input.platform_identities)?;
        insert_addresses(&transaction, &id, &input.addresses)?;
        index_customer(&transaction, &id)?;
        transaction.commit()?;
        self.get_customer(&id)?
            .ok_or_else(|| AppError::Message("创建客户后无法读取记录".to_string()))
    }

    pub fn update_customer(&self, id: &str, input: NewCustomer) -> AppResult<Customer> {
        if input.name.trim().is_empty() {
            return Err(AppError::Message("客户名称不能为空".to_string()));
        }
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        let updated = transaction.execute(
            "UPDATE customers SET name=?2, phone=?3, wechat=?4, vip_level=?5, notes=?6,
             tags_json=?7, qr_code_path=?8, updated_at=?9, version=version+1 WHERE id=?1",
            params![
                id,
                input.name.trim(),
                input.phone.trim(),
                input.wechat.trim(),
                input.vip_level.clamp(0, 5),
                input.notes,
                serde_json::to_string(&input.tags)?,
                input.qr_code_path,
                now(),
            ],
        )?;
        if updated == 0 {
            return Err(AppError::Message("客户不存在".to_string()));
        }
        transaction.execute(
            "DELETE FROM platform_identities WHERE customer_id=?1",
            params![id],
        )?;
        transaction.execute("DELETE FROM addresses WHERE customer_id=?1", params![id])?;
        insert_platform_identities(&transaction, id, &input.platform_identities)?;
        insert_addresses(&transaction, id, &input.addresses)?;
        index_customer(&transaction, id)?;
        let order_ids = transaction
            .prepare("SELECT id FROM orders WHERE customer_id=?1 AND deleted_at IS NULL")?
            .query_map(params![id], |row| row.get::<_, String>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        for order_id in order_ids {
            index_order(&transaction, &order_id)?;
        }
        transaction.commit()?;
        self.get_customer(id)?
            .ok_or_else(|| AppError::Message("客户不存在".to_string()))
    }

    pub fn get_customer(&self, id: &str) -> AppResult<Option<Customer>> {
        load_customer(&self.connection()?, id)
    }

    pub fn list_customers(&self, vip_only: bool) -> AppResult<Vec<Customer>> {
        let connection = self.connection()?;
        let query = if vip_only {
            "SELECT id FROM customers WHERE deleted_at IS NULL AND vip_level > 0
             ORDER BY vip_level DESC, updated_at DESC"
        } else {
            "SELECT id FROM customers WHERE deleted_at IS NULL ORDER BY updated_at DESC"
        };
        let ids = connection
            .prepare(query)?
            .query_map([], |row| row.get::<_, String>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        ids.iter()
            .filter_map(|id| load_customer(&connection, id).transpose())
            .collect()
    }

    pub fn create_source_factory(&self, input: SourceFactoryInput) -> AppResult<SourceFactory> {
        if input.name.trim().is_empty() {
            return Err(AppError::Message("厂家名称不能为空".to_string()));
        }
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        let id = Uuid::new_v4().to_string();
        let now = now();
        transaction.execute(
            "INSERT INTO source_factories(
                id, name, contact_name, phone, wechat, qq, order_url, address, tags_json,
                shipping_notes, notes, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?12)",
            params![
                id,
                input.name.trim(),
                input.contact_name.trim(),
                input.phone.trim(),
                input.wechat.trim(),
                input.qq.trim(),
                input.order_url.trim(),
                input.address.trim(),
                serde_json::to_string(&input.tags)?,
                input.shipping_notes,
                input.notes,
                now,
            ],
        )?;
        index_source_factory(&transaction, &id)?;
        transaction.commit()?;
        self.get_source_factory(&id)?
            .ok_or_else(|| AppError::Message("创建厂家后无法读取记录".to_string()))
    }

    pub fn update_source_factory(
        &self,
        id: &str,
        input: SourceFactoryInput,
    ) -> AppResult<SourceFactory> {
        if input.name.trim().is_empty() {
            return Err(AppError::Message("厂家名称不能为空".to_string()));
        }
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        let updated = transaction.execute(
            "UPDATE source_factories SET name=?2, contact_name=?3, phone=?4, wechat=?5, qq=?6,
             order_url=?7, address=?8, tags_json=?9, shipping_notes=?10, notes=?11, updated_at=?12,
             version=version+1 WHERE id=?1 AND deleted_at IS NULL",
            params![
                id,
                input.name.trim(),
                input.contact_name.trim(),
                input.phone.trim(),
                input.wechat.trim(),
                input.qq.trim(),
                input.order_url.trim(),
                input.address.trim(),
                serde_json::to_string(&input.tags)?,
                input.shipping_notes,
                input.notes,
                now(),
            ],
        )?;
        if updated == 0 {
            return Err(AppError::Message("厂家不存在".to_string()));
        }
        index_source_factory(&transaction, id)?;
        transaction.commit()?;
        self.get_source_factory(id)?
            .ok_or_else(|| AppError::Message("厂家不存在".to_string()))
    }

    pub fn delete_source_factory(&self, id: &str) -> AppResult<()> {
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        let timestamp = now();
        let deleted = transaction.execute(
            "UPDATE source_factories SET deleted_at=?2, updated_at=?2, version=version+1
             WHERE id=?1 AND deleted_at IS NULL",
            params![id, timestamp],
        )?;
        if deleted == 0 {
            return Err(AppError::Message("厂家不存在".to_string()));
        }
        transaction.execute(
            "UPDATE source_factory_quotes SET deleted_at=?2, updated_at=?2, version=version+1
             WHERE factory_id=?1 AND deleted_at IS NULL",
            params![id, timestamp],
        )?;
        transaction.execute(
            "UPDATE source_factory_projects SET deleted_at=?2, updated_at=?2, version=version+1
             WHERE factory_id=?1 AND deleted_at IS NULL",
            params![id, timestamp],
        )?;
        transaction.execute(
            "DELETE FROM search_index WHERE entity_type='factory' AND entity_id=?1",
            params![id],
        )?;
        transaction.commit()?;
        Ok(())
    }

    pub fn get_source_factory(&self, id: &str) -> AppResult<Option<SourceFactory>> {
        load_source_factory(&self.connection()?, id)
    }

    pub fn list_source_factories(&self) -> AppResult<Vec<SourceFactory>> {
        let connection = self.connection()?;
        let ids = connection
            .prepare(
                "SELECT id FROM source_factories WHERE deleted_at IS NULL
                 ORDER BY updated_at DESC",
            )?
            .query_map([], |row| row.get::<_, String>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        ids.iter()
            .filter_map(|id| load_source_factory(&connection, id).transpose())
            .collect()
    }

    pub fn list_source_factory_projects(
        &self,
        factory_id: Option<&str>,
    ) -> AppResult<Vec<SourceFactoryProject>> {
        let connection = self.connection()?;
        let query = "SELECT id, factory_id, category_name, project_name, created_at, updated_at
             FROM source_factory_projects
             WHERE deleted_at IS NULL";
        let projects = if let Some(factory_id) = factory_id {
            connection
                .prepare(&format!(
                    "{query} AND factory_id=?1 ORDER BY category_name ASC, created_at ASC"
                ))?
                .query_map(params![factory_id], map_source_factory_project)?
                .collect::<Result<Vec<_>, _>>()?
        } else {
            connection
                .prepare(&format!(
                    "{query} ORDER BY factory_id ASC, category_name ASC, created_at ASC"
                ))?
                .query_map([], map_source_factory_project)?
                .collect::<Result<Vec<_>, _>>()?
        };
        Ok(projects)
    }

    pub fn create_source_factory_project(
        &self,
        input: SourceFactoryProjectInput,
    ) -> AppResult<SourceFactoryProject> {
        self.validate_source_factory_project_input(&input)?;
        let mut connection = self.connection()?;
        let existing = connection
            .query_row(
                "SELECT id FROM source_factory_projects
                 WHERE factory_id=?1 AND category_name=?2 AND project_name=?3 AND deleted_at IS NULL",
                params![
                    input.factory_id.trim(),
                    input.category_name.trim(),
                    input.project_name.trim()
                ],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        if let Some(id) = existing {
            return self
                .get_source_factory_project(&id)?
                .ok_or_else(|| AppError::Message("厂家项目不存在".to_string()));
        }

        let transaction = connection.transaction()?;
        let id = Uuid::new_v4().to_string();
        let now = now();
        transaction.execute(
            "INSERT INTO source_factory_projects(
                id, factory_id, category_name, project_name, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
            params![
                id,
                input.factory_id.trim(),
                input.category_name.trim(),
                input.project_name.trim(),
                now,
            ],
        )?;
        index_source_factory(&transaction, input.factory_id.trim())?;
        transaction.commit()?;
        self.get_source_factory_project(&id)?
            .ok_or_else(|| AppError::Message("创建厂家项目后无法读取记录".to_string()))
    }

    pub fn delete_source_factory_project(&self, id: &str) -> AppResult<()> {
        let mut connection = self.connection()?;
        let project = self
            .get_source_factory_project(id)?
            .ok_or_else(|| AppError::Message("厂家项目不存在".to_string()))?;
        let quote_count = if project.project_name.trim().is_empty() {
            connection.query_row(
                "SELECT COUNT(*) FROM source_factory_quotes q
                 WHERE q.factory_id=?1 AND q.deleted_at IS NULL
                 AND q.item_name IN (
                    SELECT p.project_name FROM source_factory_projects p
                    WHERE p.factory_id=?1 AND p.category_name=?2
                    AND p.project_name <> '' AND p.deleted_at IS NULL
                 )",
                params![project.factory_id, project.category_name],
                |row| row.get::<_, i64>(0),
            )?
        } else {
            connection.query_row(
                "SELECT COUNT(*) FROM source_factory_quotes
                 WHERE factory_id=?1 AND item_name=?2 AND deleted_at IS NULL",
                params![project.factory_id, project.project_name],
                |row| row.get::<_, i64>(0),
            )?
        };
        if quote_count > 0 {
            return Err(AppError::Message(
                if project.project_name.trim().is_empty() {
                    "该大类下已有报价，不能直接删除"
                } else {
                    "该小类已有报价，不能直接删除"
                }
                .to_string(),
            ));
        }

        let transaction = connection.transaction()?;
        let timestamp = now();
        if project.project_name.trim().is_empty() {
            transaction.execute(
                "UPDATE source_factory_projects SET deleted_at=?3, updated_at=?3, version=version+1
                 WHERE factory_id=?1 AND category_name=?2 AND deleted_at IS NULL",
                params![project.factory_id, project.category_name, timestamp],
            )?;
        } else {
            transaction.execute(
                "UPDATE source_factory_projects SET deleted_at=?2, updated_at=?2, version=version+1
                 WHERE id=?1 AND deleted_at IS NULL",
                params![id, timestamp],
            )?;
        }
        index_source_factory(&transaction, &project.factory_id)?;
        transaction.commit()?;
        Ok(())
    }

    pub fn get_source_factory_project(&self, id: &str) -> AppResult<Option<SourceFactoryProject>> {
        let connection = self.connection()?;
        connection
            .query_row(
                "SELECT id, factory_id, category_name, project_name, created_at, updated_at
                 FROM source_factory_projects
                 WHERE id=?1 AND deleted_at IS NULL",
                params![id],
                map_source_factory_project,
            )
            .optional()
            .map_err(AppError::from)
    }

    pub fn create_source_quote(&self, input: SourceQuoteInput) -> AppResult<SourceQuote> {
        self.validate_source_quote_input(&input)?;
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        let id = Uuid::new_v4().to_string();
        let now = now();
        transaction.execute(
            "INSERT INTO source_factory_quotes(
                id, factory_id, item_type, item_name, quantity, size, material, paper_weight,
                sides, color, finish, production_cost_cents, shipping_cost_cents, lead_time,
                notes, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?16)",
            params![
                id,
                input.factory_id,
                input.item_type.trim(),
                input.item_name.trim(),
                input.quantity,
                input.size.trim(),
                input.material.trim(),
                input.paper_weight.trim(),
                input.sides.trim(),
                input.color.trim(),
                input.finish.trim(),
                input.production_cost_cents,
                input.shipping_cost_cents,
                input.lead_time.trim(),
                input.notes,
                now,
            ],
        )?;
        index_source_factory(&transaction, &input.factory_id)?;
        transaction.commit()?;
        self.get_source_quote(&id)?
            .ok_or_else(|| AppError::Message("创建报价后无法读取记录".to_string()))
    }

    pub fn update_source_quote(&self, id: &str, input: SourceQuoteInput) -> AppResult<SourceQuote> {
        self.validate_source_quote_input(&input)?;
        let mut connection = self.connection()?;
        let previous_factory_id = connection
            .query_row(
                "SELECT factory_id FROM source_factory_quotes WHERE id=?1 AND deleted_at IS NULL",
                params![id],
                |row| row.get::<_, String>(0),
            )
            .optional()?
            .ok_or_else(|| AppError::Message("报价不存在".to_string()))?;
        let transaction = connection.transaction()?;
        let updated = transaction.execute(
            "UPDATE source_factory_quotes SET factory_id=?2, item_type=?3, item_name=?4,
             quantity=?5, size=?6, material=?7, paper_weight=?8, sides=?9, color=?10,
             finish=?11, production_cost_cents=?12, shipping_cost_cents=?13, lead_time=?14,
             notes=?15, updated_at=?16, version=version+1
             WHERE id=?1 AND deleted_at IS NULL",
            params![
                id,
                input.factory_id,
                input.item_type.trim(),
                input.item_name.trim(),
                input.quantity,
                input.size.trim(),
                input.material.trim(),
                input.paper_weight.trim(),
                input.sides.trim(),
                input.color.trim(),
                input.finish.trim(),
                input.production_cost_cents,
                input.shipping_cost_cents,
                input.lead_time.trim(),
                input.notes,
                now(),
            ],
        )?;
        if updated == 0 {
            return Err(AppError::Message("报价不存在".to_string()));
        }
        index_source_factory(&transaction, &previous_factory_id)?;
        if previous_factory_id != input.factory_id {
            index_source_factory(&transaction, &input.factory_id)?;
        }
        transaction.commit()?;
        self.get_source_quote(id)?
            .ok_or_else(|| AppError::Message("报价不存在".to_string()))
    }

    pub fn delete_source_quote(&self, id: &str) -> AppResult<()> {
        let mut connection = self.connection()?;
        let factory_id = connection
            .query_row(
                "SELECT factory_id FROM source_factory_quotes WHERE id=?1 AND deleted_at IS NULL",
                params![id],
                |row| row.get::<_, String>(0),
            )
            .optional()?
            .ok_or_else(|| AppError::Message("报价不存在".to_string()))?;
        let transaction = connection.transaction()?;
        transaction.execute(
            "UPDATE source_factory_quotes SET deleted_at=?2, updated_at=?2, version=version+1
             WHERE id=?1 AND deleted_at IS NULL",
            params![id, now()],
        )?;
        index_source_factory(&transaction, &factory_id)?;
        transaction.commit()?;
        Ok(())
    }

    pub fn get_source_quote(&self, id: &str) -> AppResult<Option<SourceQuote>> {
        let connection = self.connection()?;
        connection
            .query_row(
                "SELECT q.id, q.factory_id, f.name, q.item_type, q.item_name, q.quantity,
                 q.size, q.material, q.paper_weight, q.sides, q.color, q.finish,
                 q.production_cost_cents, q.shipping_cost_cents, q.lead_time, q.notes,
                 q.created_at, q.updated_at
                 FROM source_factory_quotes q
                 JOIN source_factories f ON f.id=q.factory_id
                 WHERE q.id=?1 AND q.deleted_at IS NULL AND f.deleted_at IS NULL",
                params![id],
                map_source_quote,
            )
            .optional()
            .map_err(AppError::from)
    }

    pub fn list_source_quotes(&self, factory_id: Option<&str>) -> AppResult<Vec<SourceQuote>> {
        let connection = self.connection()?;
        let query = "SELECT q.id, q.factory_id, f.name, q.item_type, q.item_name, q.quantity,
             q.size, q.material, q.paper_weight, q.sides, q.color, q.finish,
             q.production_cost_cents, q.shipping_cost_cents, q.lead_time, q.notes,
             q.created_at, q.updated_at
             FROM source_factory_quotes q
             JOIN source_factories f ON f.id=q.factory_id
             WHERE q.deleted_at IS NULL AND f.deleted_at IS NULL";
        let quotes = if let Some(factory_id) = factory_id {
            connection
                .prepare(&format!(
                    "{query} AND q.factory_id=?1 ORDER BY q.updated_at DESC"
                ))?
                .query_map(params![factory_id], map_source_quote)?
                .collect::<Result<Vec<_>, _>>()?
        } else {
            connection
                .prepare(&format!("{query} ORDER BY q.updated_at DESC"))?
                .query_map([], map_source_quote)?
                .collect::<Result<Vec<_>, _>>()?
        };
        Ok(quotes)
    }

    fn validate_source_quote_input(&self, input: &SourceQuoteInput) -> AppResult<()> {
        if self.get_source_factory(&input.factory_id)?.is_none() {
            return Err(AppError::Message("厂家不存在".to_string()));
        }
        if input.item_name.trim().is_empty() {
            return Err(AppError::Message("报价项目名称不能为空".to_string()));
        }
        if input.quantity <= 0 {
            return Err(AppError::Message("报价数量必须大于 0".to_string()));
        }
        if input.production_cost_cents < 0 || input.shipping_cost_cents < 0 {
            return Err(AppError::Message("厂家价格和运费不能为负数".to_string()));
        }
        Ok(())
    }

    fn validate_source_factory_project_input(
        &self,
        input: &SourceFactoryProjectInput,
    ) -> AppResult<()> {
        if self.get_source_factory(input.factory_id.trim())?.is_none() {
            return Err(AppError::Message("厂家不存在".to_string()));
        }
        if input.category_name.trim().is_empty() {
            return Err(AppError::Message("大类名称不能为空".to_string()));
        }
        Ok(())
    }

    pub fn create_order(&self, input: NewOrder) -> AppResult<Order> {
        let customer = self
            .get_customer(&input.customer_id)?
            .ok_or_else(|| AppError::Message("客户不存在".to_string()))?;
        let total_cents = validate_order_input(&input)?;
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        let id = Uuid::new_v4().to_string();
        let now = now();
        let shipping_address = input.shipping_address.as_ref();
        transaction.execute(
            "INSERT INTO orders(
                id, customer_id, platform, platform_account, external_order_no, design_status,
                fulfillment_status, design_due_at, delivery_due_at, notes, tags_json, total_cents,
                shipment_company, shipment_tracking_no, shipping_address_label, shipping_recipient,
                shipping_phone, shipping_address, created_at, updated_at
             ) VALUES (
                ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?19
             )",
            params![
                id,
                input.customer_id,
                input.platform,
                input.platform_account,
                input.external_order_no,
                input.design_status,
                input.fulfillment_status,
                input.design_due_at,
                input.delivery_due_at,
                input.notes,
                serde_json::to_string(&input.tags)?,
                total_cents,
                input.shipment_company,
                input.shipment_tracking_no,
                shipping_address.map_or("", |address| address.label.as_str()),
                shipping_address.map_or("", |address| address.recipient.as_str()),
                shipping_address.map_or("", |address| address.phone.as_str()),
                shipping_address.map_or("", |address| address.address.as_str()),
                now,
            ],
        )?;
        insert_order_items(&transaction, &id, &input.items)?;
        index_order(&transaction, &id)?;
        transaction.commit()?;

        match self.ensure_order_folder(&id, &customer.name) {
            Ok(path) => {
                self.set_order_folder(&id, Some(path.to_string_lossy().as_ref()), "ready")?
            }
            Err(error) => {
                self.set_order_folder(&id, None, "failed")?;
                eprintln!("创建订单文件夹失败：{error}");
            }
        }
        self.get_order(&id)?
            .ok_or_else(|| AppError::Message("创建订单后无法读取记录".to_string()))
    }

    pub fn get_order(&self, id: &str) -> AppResult<Option<Order>> {
        let mut order = load_order(&self.connection()?, id)?;
        if let Some(order) = order.as_mut() {
            self.sync_order_folder_state(order)?;
        }
        Ok(order)
    }

    pub fn list_orders(&self) -> AppResult<Vec<Order>> {
        let connection = self.connection()?;
        let ids = connection
            .prepare("SELECT id FROM orders WHERE deleted_at IS NULL ORDER BY created_at DESC")?
            .query_map([], |row| row.get::<_, String>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        ids.iter()
            .filter_map(|id| self.get_order(id).transpose())
            .collect()
    }

    pub fn sync_managed_library(&self) -> AppResult<()> {
        let Some(library) = self.get_setting("library_root")?.map(PathBuf::from) else {
            return Ok(());
        };
        if !library.is_dir() {
            self.mark_all_order_folders_unavailable()?;
            return Ok(());
        }

        for order in self.list_orders()? {
            self.sync_order_folder_files(&order)?;
        }
        Ok(())
    }

    fn mark_all_order_folders_unavailable(&self) -> AppResult<()> {
        self.connection()?.execute(
            "UPDATE orders SET folder_state='unavailable'
             WHERE deleted_at IS NULL AND folder_path IS NOT NULL AND folder_state!='unavailable'",
            [],
        )?;
        Ok(())
    }

    pub fn update_order(&self, id: &str, input: NewOrder) -> AppResult<Order> {
        self.get_customer(&input.customer_id)?
            .ok_or_else(|| AppError::Message("客户不存在".to_string()))?;
        let total_cents = validate_order_input(&input)?;
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        let existing_customer_id = transaction
            .query_row(
                "SELECT customer_id FROM orders WHERE id=?1 AND deleted_at IS NULL",
                params![id],
                |row| row.get::<_, String>(0),
            )
            .optional()?
            .ok_or_else(|| AppError::Message("订单不存在".to_string()))?;
        if existing_customer_id != input.customer_id {
            return Err(AppError::Message(
                "暂不支持在编辑订单时更换客户，请新建订单".to_string(),
            ));
        }
        let shipping_address = input.shipping_address.as_ref();
        let updated = transaction.execute(
            "UPDATE orders SET platform=?3, platform_account=?4,
             external_order_no=?5, design_status=?6, fulfillment_status=?7, design_due_at=?8,
             delivery_due_at=?9, notes=?10, tags_json=?11, total_cents=?12,
             shipment_company=?13, shipment_tracking_no=?14, shipping_address_label=?15,
             shipping_recipient=?16, shipping_phone=?17, shipping_address=?18, updated_at=?19,
             version=version+1 WHERE id=?1 AND deleted_at IS NULL",
            params![
                id,
                input.customer_id,
                input.platform,
                input.platform_account,
                input.external_order_no,
                input.design_status,
                input.fulfillment_status,
                input.design_due_at,
                input.delivery_due_at,
                input.notes,
                serde_json::to_string(&input.tags)?,
                total_cents,
                input.shipment_company,
                input.shipment_tracking_no,
                shipping_address.map_or("", |address| address.label.as_str()),
                shipping_address.map_or("", |address| address.recipient.as_str()),
                shipping_address.map_or("", |address| address.phone.as_str()),
                shipping_address.map_or("", |address| address.address.as_str()),
                now(),
            ],
        )?;
        if updated == 0 {
            return Err(AppError::Message("订单不存在".to_string()));
        }
        transaction.execute("DELETE FROM order_items WHERE order_id=?1", params![id])?;
        insert_order_items(&transaction, id, &input.items)?;
        index_order(&transaction, id)?;
        transaction.commit()?;
        self.get_order(id)?
            .ok_or_else(|| AppError::Message("订单不存在".to_string()))
    }

    pub fn update_order_status(
        &self,
        id: &str,
        design_status: &str,
        fulfillment_status: &str,
    ) -> AppResult<Order> {
        self.connection()?.execute(
            "UPDATE orders SET design_status=?2, fulfillment_status=?3, updated_at=?4,
             version=version+1 WHERE id=?1",
            params![id, design_status, fulfillment_status, now()],
        )?;
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        index_order(&transaction, id)?;
        transaction.commit()?;
        self.get_order(id)?
            .ok_or_else(|| AppError::Message("订单不存在".to_string()))
    }

    pub fn delete_order(&self, id: &str) -> AppResult<()> {
        let order = self
            .get_order(id)?
            .ok_or_else(|| AppError::Message("订单不存在".to_string()))?;
        let order_folder = order.folder_path.as_ref().map(PathBuf::from);
        let moved = match order_folder.as_ref() {
            Some(folder) => self
                .move_managed_folder_to_recycle(folder, "订单文件夹")?
                .into_iter()
                .collect::<Vec<_>>(),
            None => Vec::new(),
        };
        let database_result = (|| -> AppResult<()> {
            let mut connection = self.connection()?;
            let transaction = connection.transaction()?;
            let timestamp = now();
            let deleted = transaction.execute(
                "UPDATE orders SET deleted_at=?2, updated_at=?2, version=version+1
                 WHERE id=?1 AND deleted_at IS NULL",
                params![id, timestamp],
            )?;
            if deleted == 0 {
                return Err(AppError::Message("订单不存在".to_string()));
            }
            transaction.execute(
                "UPDATE files SET deleted_at=?2 WHERE order_id=?1 AND deleted_at IS NULL",
                params![id, timestamp],
            )?;
            transaction.execute(
                "DELETE FROM search_index WHERE entity_type='order' AND entity_id=?1",
                params![id],
            )?;
            transaction.commit()?;
            Ok(())
        })();
        if let Err(error) = database_result {
            rollback_recycle_moves(&moved);
            return Err(error);
        }
        Ok(())
    }

    pub fn delete_customer(&self, id: &str) -> AppResult<()> {
        let customer = self
            .get_customer(id)?
            .ok_or_else(|| AppError::Message("客户不存在".to_string()))?;
        let customer_folders = self.managed_customer_folders(id, &customer.name)?;
        let moved = self.move_customer_folders_to_recycle(&customer_folders)?;
        let database_result = (|| -> AppResult<()> {
            let mut connection = self.connection()?;
            let transaction = connection.transaction()?;
            let timestamp = now();
            let deleted = transaction.execute(
                "UPDATE customers SET deleted_at=?2, updated_at=?2, version=version+1
                 WHERE id=?1 AND deleted_at IS NULL",
                params![id, timestamp],
            )?;
            if deleted == 0 {
                return Err(AppError::Message("客户不存在".to_string()));
            }
            transaction.execute(
                "UPDATE orders SET deleted_at=?2, updated_at=?2, version=version+1
                 WHERE customer_id=?1 AND deleted_at IS NULL",
                params![id, timestamp],
            )?;
            transaction.execute(
                "UPDATE files SET deleted_at=?2 WHERE customer_id=?1 AND deleted_at IS NULL",
                params![id, timestamp],
            )?;
            transaction.execute(
                "DELETE FROM search_index WHERE entity_type='customer' AND entity_id=?1",
                params![id],
            )?;
            transaction.execute(
                "DELETE FROM search_index WHERE entity_type='order' AND entity_id IN (
                    SELECT id FROM orders WHERE customer_id=?1
                 )",
                params![id],
            )?;
            transaction.commit()?;
            Ok(())
        })();
        if let Err(error) = database_result {
            rollback_recycle_moves(&moved);
            return Err(error);
        }
        Ok(())
    }

    pub fn add_payment(&self, order_id: &str, input: PaymentInput) -> AppResult<Order> {
        if input.amount_cents <= 0 {
            return Err(AppError::Message("收款金额必须大于 0".to_string()));
        }
        validate_payment_date(&input.paid_at)?;
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        let (total_cents, received_cents) = transaction
            .query_row(
                "SELECT total_cents, received_cents FROM orders
                 WHERE id=?1 AND deleted_at IS NULL",
                params![order_id],
                |row| Ok((row.get::<_, i64>(0)?, row.get::<_, i64>(1)?)),
            )
            .optional()?
            .ok_or_else(|| AppError::Message("订单不存在".to_string()))?;
        let next_received = received_cents
            .checked_add(input.amount_cents)
            .ok_or_else(|| AppError::Message("累计收款金额过大".to_string()))?;
        if next_received > total_cents && !input.allow_overpayment {
            return Err(AppError::Message(format!(
                "本次收款将超出订单应收 {} 分，请确认后允许超额收款",
                total_cents
            )));
        }
        transaction.execute(
            "INSERT INTO payments(id, order_id, amount_cents, paid_at, method, notes)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                Uuid::new_v4().to_string(),
                order_id,
                input.amount_cents,
                input.paid_at,
                input.method,
                input.notes,
            ],
        )?;
        transaction.execute(
            "UPDATE orders SET received_cents=?2, updated_at=?3, version=version+1 WHERE id=?1",
            params![order_id, next_received, now()],
        )?;
        transaction.commit()?;
        self.get_order(order_id)?
            .ok_or_else(|| AppError::Message("订单不存在".to_string()))
    }

    pub fn delete_payment(&self, order_id: &str, payment_id: &str) -> AppResult<Order> {
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        let deleted = transaction.execute(
            "DELETE FROM payments WHERE id=?1 AND order_id=?2",
            params![payment_id, order_id],
        )?;
        if deleted == 0 {
            return Err(AppError::Message("收款记录不存在".to_string()));
        }
        let amounts = transaction
            .prepare("SELECT amount_cents FROM payments WHERE order_id=?1")?
            .query_map(params![order_id], |row| row.get::<_, i64>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        let received_cents = amounts.into_iter().try_fold(0_i64, |total, amount| {
            total
                .checked_add(amount)
                .ok_or_else(|| AppError::Message("累计收款金额过大".to_string()))
        })?;
        let updated = transaction.execute(
            "UPDATE orders SET received_cents=?2, updated_at=?3, version=version+1
             WHERE id=?1 AND deleted_at IS NULL",
            params![order_id, received_cents, now()],
        )?;
        if updated == 0 {
            return Err(AppError::Message("订单不存在".to_string()));
        }
        transaction.commit()?;
        self.get_order(order_id)?
            .ok_or_else(|| AppError::Message("订单不存在".to_string()))
    }

    pub fn retry_order_folder(&self, order_id: &str) -> AppResult<Order> {
        let order = self
            .get_order(order_id)?
            .ok_or_else(|| AppError::Message("订单不存在".to_string()))?;
        let path = self.ensure_order_folder(order_id, &order.customer_name)?;
        self.set_order_folder(order_id, Some(path.to_string_lossy().as_ref()), "ready")?;
        self.get_order(order_id)?
            .ok_or_else(|| AppError::Message("订单不存在".to_string()))
    }

    pub fn add_order_file(
        &self,
        order_id: &str,
        source_path: &Path,
        category: &str,
    ) -> AppResult<FileRecord> {
        let order = self
            .get_order(order_id)?
            .ok_or_else(|| AppError::Message("订单不存在".to_string()))?;
        let folder = order
            .folder_path
            .map(PathBuf::from)
            .ok_or_else(|| AppError::Message("订单文件夹尚未创建，请先重试创建".to_string()))?;
        fs::create_dir_all(&folder)?;
        let original_name = source_path
            .file_name()
            .and_then(|name| name.to_str())
            .ok_or_else(|| AppError::Message("无法读取源文件名".to_string()))?;
        let existing = fs::read_dir(&folder)?
            .filter_map(Result::ok)
            .filter_map(|entry| entry.file_name().to_str().map(ToString::to_string))
            .collect::<Vec<_>>();
        let destination_name = next_available_name(original_name, &existing);
        let destination = folder.join(&destination_name);
        fs::copy(source_path, &destination)?;
        let size_bytes = match fs::metadata(&destination) {
            Ok(metadata) => metadata.len() as i64,
            Err(error) => {
                let _ = fs::remove_file(&destination);
                return Err(error.into());
            }
        };
        let library = match self.get_setting("library_root") {
            Ok(Some(path)) => PathBuf::from(path),
            Ok(None) => {
                let _ = fs::remove_file(&destination);
                return Err(AppError::Message("尚未设置客户文件库".to_string()));
            }
            Err(error) => {
                let _ = fs::remove_file(&destination);
                return Err(error);
            }
        };
        let relative_path = destination
            .strip_prefix(&library)
            .unwrap_or(&destination)
            .to_string_lossy()
            .to_string();
        let record = FileRecord {
            id: Uuid::new_v4().to_string(),
            order_id: Some(order_id.to_string()),
            customer_id: order.customer_id,
            category: category.to_string(),
            name: destination_name,
            relative_path,
            size_bytes,
            created_at: now(),
            state: "ready".to_string(),
        };
        let inserted = self.connection().and_then(|connection| {
            connection.execute(
            "INSERT INTO files(id, order_id, customer_id, category, name, relative_path, size_bytes, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            params![
                record.id,
                record.order_id,
                record.customer_id,
                record.category,
                record.name,
                record.relative_path,
                record.size_bytes,
                record.created_at,
            ],
        ).map_err(AppError::from)
        });
        if let Err(error) = inserted {
            let _ = fs::remove_file(&destination);
            return Err(error);
        }
        Ok(record)
    }

    pub fn list_files(&self) -> AppResult<Vec<FileRecord>> {
        let connection = self.connection()?;
        let mut statement = connection.prepare(
            "SELECT id, order_id, customer_id, category, name, relative_path, size_bytes, created_at
             FROM files WHERE deleted_at IS NULL ORDER BY created_at DESC",
        )?;
        let files = statement
            .query_map([], map_file)?
            .collect::<Result<Vec<_>, _>>()?;
        drop(statement);
        drop(connection);
        self.sync_file_records(files)
    }

    pub fn move_file_to_recycle_bin(&self, file_id: &str) -> AppResult<()> {
        let connection = self.connection()?;
        let record = connection
            .query_row(
                "SELECT id, order_id, customer_id, category, name, relative_path, size_bytes, created_at
                 FROM files WHERE id=?1 AND deleted_at IS NULL",
                params![file_id],
                map_file,
            )
            .optional()?
            .ok_or_else(|| AppError::Message("文件记录不存在".to_string()))?;
        let library = self
            .get_setting("library_root")?
            .map(PathBuf::from)
            .ok_or_else(|| AppError::Message("尚未设置客户文件库".to_string()))?;
        let source = library.join(&record.relative_path);
        let recycle = library.join("_回收站");
        fs::create_dir_all(&recycle)?;
        let existing = fs::read_dir(&recycle)?
            .filter_map(Result::ok)
            .filter_map(|entry| entry.file_name().to_str().map(ToString::to_string))
            .collect::<Vec<_>>();
        let name = next_available_name(&record.name, &existing);
        let destination = recycle.join(name);
        let moved = if source.exists() {
            fs::rename(&source, &destination)?;
            true
        } else {
            false
        };
        if let Err(error) = connection.execute(
            "UPDATE files SET deleted_at=?2 WHERE id=?1",
            params![file_id, now()],
        ) {
            if moved {
                let _ = fs::rename(&destination, &source);
            }
            return Err(error.into());
        }
        Ok(())
    }

    pub fn search(&self, query: &str) -> AppResult<Vec<SearchHit>> {
        if query.trim().is_empty() {
            return Ok(vec![]);
        }
        let connection = self.connection()?;
        let match_query = format!("\"{}\"", query.trim().replace('"', "\"\""));
        let like_query = format!("%{}%", query.trim());
        let mut statement = connection.prepare(
            "SELECT entity_type, entity_id, MAX(title), MAX(subtitle)
             FROM (
                SELECT entity_type, entity_id, title,
                snippet(search_index, 3, '', '', ' … ', 16) AS subtitle
                FROM search_index WHERE search_index MATCH ?1
                UNION ALL
                SELECT entity_type, entity_id, title, substr(content, 1, 160) AS subtitle
                FROM search_index WHERE title LIKE ?2 OR content LIKE ?2
             )
             GROUP BY entity_type, entity_id
             LIMIT 30",
        )?;
        let hits = statement
            .query_map(params![match_query, like_query], |row| {
                Ok(SearchHit {
                    entity_type: row.get(0)?,
                    entity_id: row.get(1)?,
                    title: row.get(2)?,
                    subtitle: row.get(3)?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(hits)
    }

    pub fn dashboard(&self) -> AppResult<DashboardSummary> {
        let connection = self.connection()?;
        let today = Local::now().format("%Y-%m-%d").to_string();
        let due_limit = (Local::now() + chrono::Duration::days(3))
            .format("%Y-%m-%d")
            .to_string();
        let pending_design = scalar(
            &connection,
            "SELECT COUNT(*) FROM orders WHERE deleted_at IS NULL
             AND design_status IN ('待设计','设计中','待确认')",
            [],
        )?;
        let due_soon = connection.query_row(
            "SELECT COUNT(*) FROM orders WHERE deleted_at IS NULL
             AND NOT (
                (design_status IN ('待设计','设计中','待确认') AND design_due_at < ?1)
                OR (fulfillment_status NOT IN ('已签收','已取消') AND delivery_due_at < ?1)
             )
             AND (
                (design_status IN ('待设计','设计中','待确认') AND design_due_at BETWEEN ?1 AND ?2)
                OR (fulfillment_status NOT IN ('已签收','已取消') AND delivery_due_at BETWEEN ?1 AND ?2)
             )",
            params![today, due_limit],
            |row| row.get(0),
        )?;
        let overdue = connection.query_row(
            "SELECT COUNT(*) FROM orders WHERE deleted_at IS NULL
             AND (
                (design_status IN ('待设计','设计中','待确认') AND design_due_at < ?1)
                OR (fulfillment_status NOT IN ('已签收','已取消') AND delivery_due_at < ?1)
             )",
            params![today],
            |row| row.get(0),
        )?;
        let pending_shipment = scalar(
            &connection,
            "SELECT COUNT(*) FROM orders WHERE deleted_at IS NULL AND fulfillment_status='待发货'",
            [],
        )?;
        let unpaid_cents = scalar(
            &connection,
            "SELECT COALESCE(SUM(total_cents-received_cents),0) FROM orders
             WHERE deleted_at IS NULL AND received_cents < total_cents",
            [],
        )?;
        let month_start = Local::now().format("%Y-%m-01").to_string();
        let month_revenue_cents = connection.query_row(
            "SELECT COALESCE(SUM(p.amount_cents),0)
             FROM payments p
             JOIN orders o ON o.id=p.order_id
             JOIN customers c ON c.id=o.customer_id
             WHERE p.paid_at >= ?1 AND p.paid_at < date(?1, '+1 month')
             AND o.deleted_at IS NULL AND c.deleted_at IS NULL",
            params![month_start],
            |row| row.get(0),
        )?;
        let all_orders = self.list_orders()?;
        let todo_orders = dashboard_todo_orders(&all_orders, &today);
        let recent_orders = all_orders.into_iter().take(8).collect();
        let recent_files = self.list_files()?.into_iter().take(8).collect();
        Ok(DashboardSummary {
            pending_design,
            due_soon,
            overdue,
            pending_shipment,
            unpaid_cents,
            month_revenue_cents,
            todo_orders,
            recent_orders,
            recent_files,
        })
    }

    pub fn import_customers(&self, rows: Vec<ImportCustomerRow>) -> AppResult<ImportResult> {
        let mut errors = Vec::new();
        let mut valid_rows = Vec::new();
        for row in rows {
            if row.name.trim().is_empty() {
                errors.push(format!("第 {} 行：客户名称不能为空", row.row_number));
            } else if !(0..=5).contains(&row.vip_level) {
                errors.push(format!(
                    "第 {} 行：VIP 星级必须在 0 到 5 之间",
                    row.row_number
                ));
            } else {
                valid_rows.push(row);
            }
        }

        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        let mut duplicate_warnings = Vec::new();
        let mut imported = 0;
        let mut duplicate_skipped = 0;
        for row in &valid_rows {
            if !row.phone.trim().is_empty() {
                let duplicate: Option<String> = transaction
                    .query_row(
                        "SELECT name FROM customers WHERE phone=?1 AND deleted_at IS NULL LIMIT 1",
                        params![row.phone.trim()],
                        |result| result.get(0),
                    )
                    .optional()?;
                if let Some(name) = duplicate {
                    duplicate_warnings.push(format!(
                        "第 {} 行手机号与“{}”相同，已按安全默认值跳过",
                        row.row_number, name
                    ));
                    duplicate_skipped += 1;
                    continue;
                }
            }
            let id = Uuid::new_v4().to_string();
            let timestamp = now();
            transaction.execute(
                "INSERT INTO customers(
                    id, name, phone, wechat, vip_level, notes, tags_json, created_at, updated_at
                 ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
                params![
                    id,
                    row.name.trim(),
                    row.phone.trim(),
                    row.wechat.trim(),
                    row.vip_level,
                    row.notes,
                    serde_json::to_string(&row.tags)?,
                    timestamp,
                ],
            )?;
            if !row.platform.trim().is_empty() || !row.platform_handle.trim().is_empty() {
                insert_platform_identities(
                    &transaction,
                    &id,
                    &[PlatformIdentityInput {
                        platform: row.platform.clone(),
                        handle: row.platform_handle.clone(),
                        account: String::new(),
                    }],
                )?;
            }
            index_customer(&transaction, &id)?;
            imported += 1;
        }
        transaction.commit()?;
        Ok(ImportResult {
            imported,
            updated: 0,
            skipped: errors.len() + duplicate_skipped,
            errors,
            duplicate_warnings,
        })
    }

    pub fn apply_customer_import(
        &self,
        batch_id: &str,
        operations: Vec<CustomerImportOperation>,
    ) -> AppResult<ImportResult> {
        let batch_id = batch_id.trim();
        if batch_id.is_empty() || batch_id.len() > 128 {
            return Err(AppError::Message(
                "导入批次标识无效，请重新选择表格".to_string(),
            ));
        }
        if operations.is_empty() {
            return Err(AppError::Message("当前没有可处理的导入行".to_string()));
        }

        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        let previous = transaction
            .query_row(
                "SELECT result_json FROM import_batches WHERE batch_id=?1",
                params![batch_id],
                |row| row.get::<_, String>(0),
            )
            .optional()?;
        if let Some(result_json) = previous {
            return Ok(serde_json::from_str(&result_json)?);
        }

        let mut result = ImportResult {
            imported: 0,
            updated: 0,
            skipped: 0,
            errors: Vec::new(),
            duplicate_warnings: Vec::new(),
        };
        for operation in operations {
            match operation.action.as_str() {
                "skip" => result.skipped += 1,
                "create" => {
                    let input = operation.customer.ok_or_else(|| {
                        AppError::Message(format!(
                            "第 {} 行缺少待创建的客户数据",
                            operation.row_number
                        ))
                    })?;
                    validate_import_customer(operation.row_number, &input)?;
                    let id = Uuid::new_v4().to_string();
                    let timestamp = now();
                    transaction.execute(
                        "INSERT INTO customers(
                            id, name, phone, wechat, vip_level, notes, tags_json, qr_code_path,
                            created_at, updated_at
                         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?9)",
                        params![
                            id,
                            input.name.trim(),
                            input.phone.trim(),
                            input.wechat.trim(),
                            input.vip_level,
                            input.notes,
                            serde_json::to_string(&input.tags)?,
                            input.qr_code_path,
                            timestamp,
                        ],
                    )?;
                    insert_platform_identities(&transaction, &id, &input.platform_identities)?;
                    insert_addresses(&transaction, &id, &input.addresses)?;
                    index_customer(&transaction, &id)?;
                    result.imported += 1;
                }
                "update" => {
                    let customer_id = operation
                        .customer_id
                        .filter(|value| !value.trim().is_empty())
                        .ok_or_else(|| {
                            AppError::Message(format!(
                                "第 {} 行缺少要更新的客户",
                                operation.row_number
                            ))
                        })?;
                    let input = operation.customer.ok_or_else(|| {
                        AppError::Message(format!(
                            "第 {} 行缺少待更新的客户数据",
                            operation.row_number
                        ))
                    })?;
                    validate_import_customer(operation.row_number, &input)?;
                    let updated = transaction.execute(
                        "UPDATE customers SET name=?2, phone=?3, wechat=?4, vip_level=?5,
                         notes=?6, tags_json=?7, qr_code_path=?8, updated_at=?9,
                         version=version+1 WHERE id=?1 AND deleted_at IS NULL",
                        params![
                            customer_id,
                            input.name.trim(),
                            input.phone.trim(),
                            input.wechat.trim(),
                            input.vip_level,
                            input.notes,
                            serde_json::to_string(&input.tags)?,
                            input.qr_code_path,
                            now(),
                        ],
                    )?;
                    if updated == 0 {
                        return Err(AppError::Message(format!(
                            "第 {} 行要更新的客户已不存在，请刷新后重新审核",
                            operation.row_number
                        )));
                    }
                    transaction.execute(
                        "DELETE FROM platform_identities WHERE customer_id=?1",
                        params![customer_id],
                    )?;
                    transaction.execute(
                        "DELETE FROM addresses WHERE customer_id=?1",
                        params![customer_id],
                    )?;
                    insert_platform_identities(
                        &transaction,
                        &customer_id,
                        &input.platform_identities,
                    )?;
                    insert_addresses(&transaction, &customer_id, &input.addresses)?;
                    index_customer(&transaction, &customer_id)?;
                    let order_ids = transaction
                        .prepare(
                            "SELECT id FROM orders WHERE customer_id=?1 AND deleted_at IS NULL",
                        )?
                        .query_map(params![customer_id], |row| row.get::<_, String>(0))?
                        .collect::<Result<Vec<_>, _>>()?;
                    for order_id in order_ids {
                        index_order(&transaction, &order_id)?;
                    }
                    result.updated += 1;
                }
                _ => {
                    return Err(AppError::Message(format!(
                        "第 {} 行包含未知处理方式",
                        operation.row_number
                    )))
                }
            }
        }
        let result_json = serde_json::to_string(&result)?;
        transaction.execute(
            "INSERT INTO import_batches(batch_id, completed_at, result_json) VALUES (?1, ?2, ?3)",
            params![batch_id, now(), result_json],
        )?;
        transaction.commit()?;
        Ok(result)
    }

    pub fn create_database_backup(&self, backup_dir: &Path) -> AppResult<PathBuf> {
        let result = self.create_database_backup_inner(backup_dir);
        match &result {
            Ok(path) => self.record_backup_success(path),
            Err(error) => self.record_backup_error(error),
        }
        result
    }

    fn create_database_backup_inner(&self, backup_dir: &Path) -> AppResult<PathBuf> {
        fs::create_dir_all(backup_dir)?;
        if !backup_dir.is_dir() {
            return Err(AppError::Message("备份路径不是文件夹".to_string()));
        }
        let filename = format!(
            "workbench-{}.db",
            Local::now().format("%Y-%m-%d_%H-%M-%S-%3f")
        );
        let destination = backup_dir.join(filename);
        snapshot_database(&self.connection()?, &destination)?;
        Ok(destination)
    }

    pub fn resolved_backup_dir(&self, default_backup_dir: &Path) -> AppResult<PathBuf> {
        Ok(self
            .get_setting("backup_dir")?
            .filter(|value| !value.trim().is_empty())
            .map(PathBuf::from)
            .unwrap_or_else(|| default_backup_dir.to_path_buf()))
    }

    pub fn create_manual_backup(&self, default_backup_dir: &Path) -> AppResult<PathBuf> {
        let backup_dir = self.resolved_backup_dir(default_backup_dir)?;
        let backup = self.create_database_backup(&backup_dir)?;
        self.prune_database_backups(&backup_dir)?;
        Ok(backup)
    }

    pub fn create_daily_backup(&self, default_backup_dir: &Path) -> AppResult<PathBuf> {
        let result = self.create_daily_backup_inner(default_backup_dir);
        if let Err(error) = &result {
            self.record_backup_error(error);
        }
        result
    }

    fn create_daily_backup_inner(&self, default_backup_dir: &Path) -> AppResult<PathBuf> {
        let backup_dir = self.resolved_backup_dir(default_backup_dir)?;
        fs::create_dir_all(&backup_dir)?;
        let today_prefix = format!("workbench-{}", Local::now().format("%Y-%m-%d"));
        let existing_today = fs::read_dir(&backup_dir)?
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .find(|path| {
                path.file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| name.starts_with(&today_prefix) && name.ends_with(".db"))
            });
        let backup = match existing_today {
            Some(path) => {
                self.record_backup_success(&path);
                path
            }
            None => self.create_database_backup(&backup_dir)?,
        };
        self.prune_database_backups(&backup_dir)?;
        Ok(backup)
    }

    fn prune_database_backups(&self, backup_dir: &Path) -> AppResult<()> {
        let mut backups = fs::read_dir(backup_dir)?
            .filter_map(Result::ok)
            .map(|entry| entry.path())
            .filter(|path| {
                path.file_name()
                    .and_then(|name| name.to_str())
                    .is_some_and(|name| name.starts_with("workbench-") && name.ends_with(".db"))
            })
            .collect::<Vec<_>>();
        backups.sort();
        let remove_count = backups.len().saturating_sub(30);
        for old_backup in backups.into_iter().take(remove_count) {
            fs::remove_file(old_backup)?;
        }
        Ok(())
    }

    fn record_backup_success(&self, path: &Path) {
        let _ = self.set_setting("backup_last_path", &path.to_string_lossy());
        let _ = self.set_setting("backup_last_at", &now());
        let _ = self.set_setting("backup_last_error", "");
    }

    fn record_backup_error(&self, error: &AppError) {
        let _ = self.set_setting("backup_last_error", &error.to_string());
    }

    pub fn backup_status(&self, default_backup_dir: &Path) -> AppResult<BackupStatus> {
        let backup_dir = self.resolved_backup_dir(default_backup_dir)?;
        let last_backup_path = self
            .get_setting("backup_last_path")?
            .filter(|value| !value.trim().is_empty());
        let last_backup_at = self
            .get_setting("backup_last_at")?
            .filter(|value| !value.trim().is_empty());
        let last_error = self
            .get_setting("backup_last_error")?
            .filter(|value| !value.trim().is_empty());
        Ok(BackupStatus {
            backup_dir: backup_dir.to_string_lossy().to_string(),
            last_backup_path,
            last_backup_at,
            last_error,
        })
    }

    pub fn restore_database_backup(&self, backup_path: &Path) -> AppResult<PathBuf> {
        if !backup_path.is_file() {
            return Err(AppError::Message("所选数据库备份不存在".to_string()));
        }
        let staging_dir = self
            .db_path
            .parent()
            .ok_or_else(|| AppError::Message("无法确定数据库目录".to_string()))?;
        let staged_source =
            staging_dir.join(format!(".workbench-restore-source-{}.db", Uuid::new_v4()));
        fs::copy(backup_path, &staged_source)?;
        if let Err(error) = validate_database_file(&staged_source) {
            let _ = fs::remove_file(&staged_source);
            return Err(error);
        }

        let safety_copy = self.db_path.with_file_name(format!(
            "workbench-before-restore-{}-{}.db",
            Local::now().format("%Y%m%d%H%M%S"),
            &Uuid::new_v4().to_string()[..8]
        ));
        snapshot_database(&self.connection()?, &safety_copy)?;

        let restore_result = (|| -> AppResult<()> {
            let mut connection = self.connection()?;
            connection.restore(
                DatabaseName::Main,
                &staged_source,
                None::<fn(rusqlite::backup::Progress)>,
            )?;
            drop(connection);
            db::open(&self.db_path)?;
            validate_database_file(&self.db_path)?;
            Ok(())
        })();
        let _ = fs::remove_file(&staged_source);

        if let Err(error) = restore_result {
            let rollback_result = (|| -> AppResult<()> {
                let mut connection = self.connection()?;
                connection.restore(
                    DatabaseName::Main,
                    &safety_copy,
                    None::<fn(rusqlite::backup::Progress)>,
                )?;
                drop(connection);
                db::open(&self.db_path)?;
                Ok(())
            })();
            return match rollback_result {
                Ok(()) => Err(AppError::Message(format!(
                    "恢复失败，已自动回滚到恢复前数据：{error}"
                ))),
                Err(rollback_error) => Err(AppError::Message(format!(
                    "恢复失败且自动回滚失败。恢复前安全副本位于 {}。原错误：{error}；回滚错误：{rollback_error}",
                    safety_copy.display()
                ))),
            };
        }
        Ok(safety_copy)
    }

    pub fn export_full(&self, destination: &Path) -> AppResult<PathBuf> {
        let parent = destination.parent().unwrap_or_else(|| Path::new("."));
        fs::create_dir_all(parent)?;
        let library_root = self.get_setting("library_root")?.map(PathBuf::from);
        if let Some(library_root) = library_root.as_ref() {
            if library_root.is_dir() && path_is_inside(destination, library_root)? {
                return Err(AppError::Message(
                    "完整导出不能保存到客户文件库内部，请选择文件库以外的位置".to_string(),
                ));
            }
        }
        let library_files = match library_root.as_ref().filter(|path| path.is_dir()) {
            Some(path) => collect_directory_manifest(path, false)?,
            None => Vec::new(),
        };
        let library_bytes = library_files.iter().try_fold(0_u64, |total, entry| {
            total
                .checked_add(entry.size_bytes)
                .ok_or_else(|| AppError::Message("文件库大小超出可处理范围".to_string()))
        })?;

        let archive_temp = parent.join(format!(".workbench-export-{}.tmp", Uuid::new_v4()));
        let database_temp = parent.join(format!(".workbench-export-db-{}.tmp", Uuid::new_v4()));
        let export_result = (|| -> AppResult<()> {
            snapshot_database(&self.connection()?, &database_temp)?;
            let manifest = FullArchiveManifest {
                format_version: 1,
                schema_version: db::LATEST_SCHEMA_VERSION,
                exported_at: now(),
                source_library_root: library_root
                    .as_ref()
                    .map(|path| path.to_string_lossy().to_string()),
                database_sha256: sha256_file(&database_temp)?,
                library_file_count: library_files.len(),
                library_bytes,
                library_files: library_files.clone(),
            };
            let file = File::create(&archive_temp)?;
            let mut archive = ZipWriter::new(file);
            let options =
                SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
            archive
                .start_file("database/workbench.db", options)
                .map_err(zip_error)?;
            let mut database = File::open(&database_temp)?;
            std::io::copy(&mut database, &mut archive)?;

            archive
                .start_file("config/settings.json", options)
                .map_err(zip_error)?;
            let settings = self.settings()?;
            archive.write_all(serde_json::to_string_pretty(&settings)?.as_bytes())?;

            archive
                .start_file("manifest.json", options)
                .map_err(zip_error)?;
            archive.write_all(serde_json::to_string_pretty(&manifest)?.as_bytes())?;

            if let Some(library_root) = library_root.as_ref().filter(|path| path.is_dir()) {
                for entry in &library_files {
                    archive
                        .start_file(format!("library/{}", entry.path), options)
                        .map_err(zip_error)?;
                    let mut source = File::open(library_root.join(&entry.path))?;
                    std::io::copy(&mut source, &mut archive)?;
                }
            }
            let finished = archive.finish().map_err(zip_error)?;
            finished.sync_all()?;
            validate_full_archive(&archive_temp)?;
            replace_file_safely(&archive_temp, destination)?;
            Ok(())
        })();
        let _ = fs::remove_file(&database_temp);
        if let Err(error) = export_result {
            let _ = fs::remove_file(&archive_temp);
            return Err(error);
        }
        Ok(destination.to_path_buf())
    }

    pub fn inspect_full_archive(&self, source: &Path) -> AppResult<FullArchiveInspection> {
        let manifest = validate_full_archive(source)?;
        let staged_database = self
            .db_path
            .with_file_name(format!(".workbench-archive-inspect-{}.db", Uuid::new_v4()));
        let result = (|| -> AppResult<()> {
            extract_archive_entry(source, "database/workbench.db", &staged_database)?;
            validate_database_file(&staged_database)
        })();
        let _ = fs::remove_file(&staged_database);
        result?;
        Ok(FullArchiveInspection {
            format_version: manifest.format_version,
            schema_version: manifest.schema_version,
            exported_at: manifest.exported_at,
            library_file_count: manifest.library_file_count,
            library_bytes: manifest.library_bytes,
            source_library_root: manifest.source_library_root,
            message: "完整归档已通过清单、文件校验和数据库完整性检查".to_string(),
        })
    }

    pub fn restore_full_archive(
        &self,
        source: &Path,
        target_library_root: &Path,
    ) -> AppResult<FullRestoreResult> {
        let inspection = self.inspect_full_archive(source)?;
        let manifest = read_full_archive_manifest(source)?;
        let target_health = self.validate_library_root(target_library_root);
        if target_health.status != "ready" {
            return Err(AppError::Message(target_health.message));
        }
        if fs::read_dir(target_library_root)?.next().is_some() {
            return Err(AppError::Message(
                "完整恢复的目标文件夹必须为空，避免覆盖现有文件".to_string(),
            ));
        }
        if target_health
            .free_bytes
            .is_some_and(|available| available < manifest.library_bytes)
        {
            return Err(AppError::Message(format!(
                "目标磁盘空间不足：至少需要 {} 字节",
                manifest.library_bytes
            )));
        }
        if let Some(current_root) = self.get_setting("library_root")?.map(PathBuf::from) {
            if current_root.exists() {
                let current = fs::canonicalize(&current_root)?;
                let target = fs::canonicalize(target_library_root)?;
                if target.starts_with(&current) || current.starts_with(&target) {
                    return Err(AppError::Message(
                        "恢复目标必须与当前文件库相互独立".to_string(),
                    ));
                }
            }
        }

        let target_parent = target_library_root
            .parent()
            .ok_or_else(|| AppError::Message("无法确定恢复目标的上级目录".to_string()))?;
        let target_name = target_library_root
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("library");
        let staging_library = target_parent.join(format!(
            ".{target_name}.workbench-restore-{}",
            Uuid::new_v4()
        ));
        let staged_database = self
            .db_path
            .with_file_name(format!(".workbench-full-restore-{}.db", Uuid::new_v4()));

        let prepare_result = (|| -> AppResult<()> {
            fs::create_dir(&staging_library)?;
            extract_archive_library(source, &manifest, &staging_library)?;
            verify_directory_manifest(&staging_library, &manifest.library_files, false)?;
            extract_archive_entry(source, "database/workbench.db", &staged_database)?;
            validate_database_file(&staged_database)?;
            fs::remove_dir(target_library_root)?;
            if let Err(error) = fs::rename(&staging_library, target_library_root) {
                let _ = fs::create_dir(target_library_root);
                return Err(AppError::Io(error));
            }
            Ok(())
        })();
        if let Err(error) = prepare_result {
            cleanup_restore_staging(&staging_library, target_parent);
            let _ = fs::remove_file(&staged_database);
            return Err(error);
        }

        let safety_archive = self.db_path.with_file_name(format!(
            "workbench-before-full-restore-{}-{}.zip",
            Local::now().format("%Y%m%d%H%M%S"),
            &Uuid::new_v4().to_string()[..8]
        ));
        if let Err(error) = self.export_full(&safety_archive) {
            let retained = retain_failed_restore_target(target_library_root, target_parent);
            let _ = fs::remove_file(&staged_database);
            return Err(AppError::Message(format!(
                "创建恢复前安全备份失败，未改动数据库。已提取的文件保留在 {}：{error}",
                retained.display()
            )));
        }

        let database_restore = self.restore_database_backup(&staged_database);
        let _ = fs::remove_file(&staged_database);
        let safety_database = match database_restore {
            Ok(path) => path,
            Err(error) => {
                let retained = retain_failed_restore_target(target_library_root, target_parent);
                return Err(AppError::Message(format!(
                    "数据库恢复失败；恢复前完整安全备份位于 {}，提取文件保留在 {}：{error}",
                    safety_archive.display(),
                    retained.display()
                )));
            }
        };

        let restored_old_root = self
            .get_setting("library_root")?
            .map(PathBuf::from)
            .or_else(|| manifest.source_library_root.as_deref().map(PathBuf::from));
        let switch_result = match restored_old_root.as_ref() {
            Some(old_root) => self.switch_library_root_in_database(old_root, target_library_root),
            None => self.set_setting("library_root", &target_library_root.to_string_lossy()),
        };
        if let Err(error) = switch_result {
            let rollback = self.restore_database_backup(&safety_database);
            let retained = retain_failed_restore_target(target_library_root, target_parent);
            return match rollback {
                Ok(_) => Err(AppError::Message(format!(
                    "恢复后的文件库路径更新失败，数据库已回滚；提取文件保留在 {}：{error}",
                    retained.display()
                ))),
                Err(rollback_error) => Err(AppError::Message(format!(
                    "恢复后的文件库路径更新失败且数据库回滚失败。安全备份位于 {}，提取文件位于 {}。原错误：{error}；回滚错误：{rollback_error}",
                    safety_archive.display(),
                    retained.display()
                ))),
            };
        }

        Ok(FullRestoreResult {
            library_root: target_library_root.to_string_lossy().to_string(),
            restored_files: inspection.library_file_count,
            restored_bytes: inspection.library_bytes,
            safety_backup_path: safety_archive.to_string_lossy().to_string(),
            previous_library_retained: true,
        })
    }

    pub fn export_cloud_read_model(&self, destination: &Path) -> AppResult<PathBuf> {
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent)?;
        }
        let payload = serde_json::json!({
            "schemaVersion": 1,
            "exportedAt": now(),
            "customers": self.list_customers(false)?,
            "orders": self.list_orders()?,
            "files": self.list_files()?,
            "sourceFactories": self.list_source_factories()?,
            "sourceFactoryQuotes": self.list_source_quotes(None)?,
        });
        fs::write(destination, serde_json::to_vec_pretty(&payload)?)?;
        Ok(destination.to_path_buf())
    }

    fn ensure_order_folder(&self, order_id: &str, customer_name: &str) -> AppResult<PathBuf> {
        let library = self
            .get_setting("library_root")?
            .map(PathBuf::from)
            .ok_or_else(|| AppError::Message("尚未设置客户文件库".to_string()))?;
        let order = self
            .get_order(order_id)?
            .ok_or_else(|| AppError::Message("订单不存在".to_string()))?;
        let customer_dir =
            library.join(customer_folder_name(customer_name, &order.customer_id[..8]));
        let customer_materials = customer_dir.join("客户资料");
        fs::create_dir_all(&customer_materials)?;
        if let Some(customer) = self.get_customer(&order.customer_id)? {
            if let Some(qr_code_path) = customer.qr_code_path {
                let source = PathBuf::from(&qr_code_path);
                if source.is_file() && !source.starts_with(&customer_materials) {
                    let extension = source
                        .extension()
                        .and_then(|value| value.to_str())
                        .filter(|value| !value.is_empty())
                        .map(|value| format!(".{value}"))
                        .unwrap_or_default();
                    let destination = customer_materials.join(format!("客户二维码{extension}"));
                    let token = Uuid::new_v4().to_string();
                    let temporary = customer_materials.join(format!(".二维码-{token}.tmp"));
                    let previous = customer_materials.join(format!(".二维码-{token}.previous"));
                    fs::copy(&source, &temporary)?;
                    let had_previous = destination.exists();
                    if had_previous {
                        fs::rename(&destination, &previous)?;
                    }
                    if let Err(error) = fs::rename(&temporary, &destination) {
                        if had_previous {
                            let _ = fs::rename(&previous, &destination);
                        }
                        let _ = fs::remove_file(&temporary);
                        return Err(error.into());
                    }
                    if let Err(error) = self.connection()?.execute(
                        "UPDATE customers SET qr_code_path=?2, updated_at=?3, version=version+1 WHERE id=?1",
                        params![order.customer_id, destination.to_string_lossy().as_ref(), now()],
                    ) {
                        let _ = fs::remove_file(&destination);
                        if had_previous {
                            let _ = fs::rename(&previous, &destination);
                        }
                        return Err(error.into());
                    }
                    if had_previous {
                        let _ = fs::remove_file(&previous);
                    }
                    for entry in fs::read_dir(&customer_materials)?.filter_map(Result::ok) {
                        let path = entry.path();
                        let is_old_qr = path != destination
                            && path.is_file()
                            && path
                                .file_stem()
                                .and_then(|value| value.to_str())
                                .is_some_and(|value| value == "客户二维码");
                        if is_old_qr {
                            let _ = fs::remove_file(path);
                        }
                    }
                }
            }
        }
        let folder_label = order_folder_label(&order);
        let order_dir = customer_dir.join("订单").join(order_folder_name(
            &order.created_at[..10],
            &folder_label,
            &order.id[..8],
        ));
        fs::create_dir_all(&order_dir)?;
        Ok(order_dir)
    }

    fn set_order_folder(&self, order_id: &str, path: Option<&str>, state: &str) -> AppResult<()> {
        self.connection()?.execute(
            "UPDATE orders SET folder_path=?2, folder_state=?3, updated_at=?4 WHERE id=?1",
            params![order_id, path, state, now()],
        )?;
        Ok(())
    }

    fn sync_order_folder_state(&self, order: &mut Order) -> AppResult<()> {
        let Some(path) = order.folder_path.as_ref() else {
            return Ok(());
        };
        let mut path = PathBuf::from(path);
        let library_available = self
            .get_setting("library_root")?
            .map(PathBuf::from)
            .is_some_and(|library| library.is_dir());
        if library_available && path.is_dir() {
            self.rename_legacy_internal_order_folder(order, &mut path)?;
        }
        let next_state = if !library_available {
            "unavailable"
        } else if path.is_dir() {
            "ready"
        } else {
            "failed"
        };
        let next_path = path.to_string_lossy().to_string();
        if order.folder_state != next_state || order.folder_path.as_deref() != Some(&next_path) {
            self.set_order_folder(&order.id, Some(&next_path), next_state)?;
            order.folder_state = next_state.to_string();
            order.folder_path = Some(next_path);
        }
        Ok(())
    }

    fn rename_legacy_internal_order_folder(
        &self,
        order: &Order,
        current_path: &mut PathBuf,
    ) -> AppResult<()> {
        if !order.external_order_no.trim().is_empty() {
            return Ok(());
        }
        let desired_label = order_folder_label(order);
        if desired_label == "内部订单" {
            return Ok(());
        }
        let legacy_name = order_folder_name(&order.created_at[..10], "内部订单", &order.id[..8]);
        let desired_name =
            order_folder_name(&order.created_at[..10], &desired_label, &order.id[..8]);
        let Some(current_name) = current_path.file_name().and_then(|value| value.to_str()) else {
            return Ok(());
        };
        if current_name != legacy_name || current_name == desired_name {
            return Ok(());
        }
        let Some(parent) = current_path.parent() else {
            return Ok(());
        };
        let destination = parent.join(desired_name);
        if destination.exists() {
            return Ok(());
        }

        fs::rename(&current_path, &destination)?;
        self.update_file_paths_after_folder_rename(order, current_path, &destination)?;
        *current_path = destination;
        Ok(())
    }

    fn update_file_paths_after_folder_rename(
        &self,
        order: &Order,
        old_folder: &Path,
        new_folder: &Path,
    ) -> AppResult<()> {
        let Some(library) = self.get_setting("library_root")?.map(PathBuf::from) else {
            return Ok(());
        };
        let old_absolute = old_folder.to_string_lossy().to_string();
        let new_absolute = new_folder.to_string_lossy().to_string();
        let old_relative = old_folder
            .strip_prefix(&library)
            .unwrap_or(old_folder)
            .to_string_lossy()
            .to_string();
        let new_relative = new_folder
            .strip_prefix(&library)
            .unwrap_or(new_folder)
            .to_string_lossy()
            .to_string();

        let mut connection = self.connection()?;
        let records = connection
            .prepare(
                "SELECT id, relative_path FROM files WHERE order_id=?1 AND deleted_at IS NULL",
            )?
            .query_map(params![order.id], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        let transaction = connection.transaction()?;
        for (id, path) in records {
            let next_path = if path.starts_with(&old_relative) {
                Some(path.replacen(&old_relative, &new_relative, 1))
            } else if path.starts_with(&old_absolute) {
                Some(path.replacen(&old_absolute, &new_absolute, 1))
            } else {
                None
            };
            if let Some(next_path) = next_path {
                transaction.execute(
                    "UPDATE files SET relative_path=?2 WHERE id=?1",
                    params![id, next_path],
                )?;
            }
        }
        transaction.commit()?;
        Ok(())
    }

    fn managed_customer_folders(
        &self,
        customer_id: &str,
        customer_name: &str,
    ) -> AppResult<Vec<PathBuf>> {
        let Some(library) = self.get_setting("library_root")?.map(PathBuf::from) else {
            return Ok(Vec::new());
        };
        let mut folders = HashSet::new();
        let connection = self.connection()?;
        let mut statement = connection.prepare(
            "SELECT folder_path FROM orders WHERE customer_id=?1 AND folder_path IS NOT NULL",
        )?;
        let order_folders = statement
            .query_map(params![customer_id], |row| row.get::<_, String>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        for order_folder in order_folders {
            let folder = PathBuf::from(order_folder);
            if let Some(customer_folder) = folder.parent().and_then(Path::parent) {
                if customer_folder.starts_with(&library) && customer_folder != library {
                    folders.insert(customer_folder.to_path_buf());
                }
            }
        }
        let fallback = library.join(customer_folder_name(customer_name, &customer_id[..8]));
        if fallback.starts_with(&library) && fallback != library {
            folders.insert(fallback);
        }
        Ok(folders.into_iter().collect())
    }

    fn move_customer_folders_to_recycle(
        &self,
        folders: &[PathBuf],
    ) -> AppResult<Vec<(PathBuf, PathBuf)>> {
        let mut moved = Vec::new();
        for folder in folders {
            match self.move_managed_folder_to_recycle(folder, "客户文件夹") {
                Ok(Some(paths)) => moved.push(paths),
                Ok(None) => {}
                Err(error) => {
                    rollback_recycle_moves(&moved);
                    return Err(error);
                }
            }
        }
        Ok(moved)
    }

    fn move_managed_folder_to_recycle(
        &self,
        folder: &Path,
        fallback_name: &str,
    ) -> AppResult<Option<(PathBuf, PathBuf)>> {
        let Some(library) = self.get_setting("library_root")?.map(PathBuf::from) else {
            return Ok(None);
        };
        if !folder.exists() {
            return Ok(None);
        }
        if !folder.is_dir() || !folder.starts_with(&library) || folder == library {
            return Ok(None);
        }
        let recycle = library.join("_回收站");
        fs::create_dir_all(&recycle)?;
        let original_name = folder
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or(fallback_name);
        let timestamp = Local::now().format("%Y%m%d%H%M%S");
        let base_name = format!("{original_name}_已删除_{timestamp}");
        let existing = fs::read_dir(&recycle)?
            .filter_map(Result::ok)
            .filter_map(|entry| entry.file_name().to_str().map(ToString::to_string))
            .collect::<Vec<_>>();
        let destination = recycle.join(next_available_name(&base_name, &existing));
        fs::rename(folder, &destination)?;
        Ok(Some((folder.to_path_buf(), destination)))
    }

    fn sync_file_records(&self, files: Vec<FileRecord>) -> AppResult<Vec<FileRecord>> {
        let Some(library) = self.get_setting("library_root")?.map(PathBuf::from) else {
            return Ok(files);
        };
        let library_available = library.is_dir();
        let mut records = Vec::with_capacity(files.len());
        for mut file in files {
            let path = if Path::new(&file.relative_path).is_absolute() {
                PathBuf::from(&file.relative_path)
            } else {
                library.join(&file.relative_path)
            };
            file.state = if !library_available {
                "unavailable".to_string()
            } else if path.is_file() {
                "ready".to_string()
            } else {
                "missing".to_string()
            };
            records.push(file);
        }
        Ok(records)
    }

    fn sync_order_folder_files(&self, order: &Order) -> AppResult<()> {
        let Some(folder_path) = order.folder_path.as_ref() else {
            return Ok(());
        };
        let folder = PathBuf::from(folder_path);
        if !folder.is_dir() {
            return Ok(());
        }
        let Some(library) = self.get_setting("library_root")?.map(PathBuf::from) else {
            return Ok(());
        };

        let disk_files =
            collect_order_folder_files(&folder, &library, &order.id, &order.customer_id);
        let disk_by_path = disk_files
            .into_iter()
            .map(|file| (normalized_file_path_key(&file.relative_path), file))
            .collect::<HashMap<_, _>>();

        let mut connection = self.connection()?;
        let mut statement = connection.prepare(
            "SELECT id, relative_path FROM files WHERE order_id=?1 AND deleted_at IS NULL",
        )?;
        let existing_by_path = statement
            .query_map(params![order.id], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?
            .map(|row| {
                row.map(|(id, relative_path)| (normalized_file_path_key(&relative_path), id))
            })
            .collect::<Result<HashMap<_, _>, _>>()?;
        drop(statement);

        let transaction = connection.transaction()?;
        for (path_key, file) in disk_by_path {
            if let Some(id) = existing_by_path.get(&path_key) {
                transaction.execute(
                    "UPDATE files SET category=?2, name=?3, size_bytes=?4, created_at=?5
                     WHERE id=?1 AND deleted_at IS NULL",
                    params![
                        id,
                        file.category,
                        file.name,
                        file.size_bytes,
                        file.created_at
                    ],
                )?;
            } else {
                transaction.execute(
                    "INSERT INTO files(id, order_id, customer_id, category, name, relative_path, size_bytes, created_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
                    params![
                        file.id,
                        file.order_id,
                        file.customer_id,
                        file.category,
                        file.name,
                        file.relative_path,
                        file.size_bytes,
                        file.created_at,
                    ],
                )?;
            }
        }
        transaction.commit()?;
        Ok(())
    }
}

fn now() -> String {
    Utc::now().to_rfc3339()
}

fn validate_storage_path(path: &Path) -> StorageHealth {
    let display_path = path.to_string_lossy().to_string();
    if display_path.trim().is_empty() {
        return StorageHealth {
            status: "notConfigured".to_string(),
            path: None,
            writable: false,
            free_bytes: None,
            message: "请选择客户文件库目录".to_string(),
        };
    }
    if !path.exists() {
        return StorageHealth {
            status: "missing".to_string(),
            path: Some(display_path),
            writable: false,
            free_bytes: None,
            message: "客户文件库目录不存在，可能是磁盘未连接".to_string(),
        };
    }
    if !path.is_dir() {
        return StorageHealth {
            status: "notDirectory".to_string(),
            path: Some(display_path),
            writable: false,
            free_bytes: None,
            message: "所选路径不是文件夹".to_string(),
        };
    }

    let probe_path = path.join(format!(".workbench-write-probe-{}", Uuid::new_v4()));
    let probe_result = (|| -> std::io::Result<()> {
        let mut probe = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&probe_path)?;
        probe.write_all(b"workbench-storage-check")?;
        probe.sync_all()
    })();
    let _ = fs::remove_file(&probe_path);
    let free_bytes = fs2::available_space(path).ok();

    match probe_result {
        Ok(()) => StorageHealth {
            status: "ready".to_string(),
            path: Some(display_path),
            writable: true,
            free_bytes,
            message: "客户文件库可正常读写".to_string(),
        },
        Err(error) if error.kind() == std::io::ErrorKind::PermissionDenied => StorageHealth {
            status: "readOnly".to_string(),
            path: Some(display_path),
            writable: false,
            free_bytes,
            message: "客户文件库不可写，请检查目录权限或磁盘状态".to_string(),
        },
        Err(error) => StorageHealth {
            status: "error".to_string(),
            path: Some(display_path),
            writable: false,
            free_bytes,
            message: format!("无法验证客户文件库：{error}"),
        },
    }
}

fn snapshot_database(source: &Connection, destination: &Path) -> AppResult<()> {
    let parent = destination
        .parent()
        .ok_or_else(|| AppError::Message("无法确定备份目录".to_string()))?;
    fs::create_dir_all(parent)?;
    let staged = parent.join(format!(".workbench-db-snapshot-{}.tmp", Uuid::new_v4()));
    let result = (|| -> AppResult<()> {
        source.backup(DatabaseName::Main, &staged, None)?;
        validate_database_file(&staged)?;
        replace_file_safely(&staged, destination)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&staged);
    }
    result
}

fn validate_database_file(path: &Path) -> AppResult<()> {
    let connection = Connection::open_with_flags(path, OpenFlags::SQLITE_OPEN_READ_ONLY)?;
    let quick_check =
        connection.query_row("PRAGMA quick_check", [], |row| row.get::<_, String>(0))?;
    if quick_check != "ok" {
        return Err(AppError::Message(format!(
            "数据库完整性检查失败：{quick_check}"
        )));
    }
    let schema_version = connection
        .query_row("SELECT MAX(version) FROM schema_migrations", [], |row| {
            row.get::<_, Option<i64>>(0)
        })?
        .ok_or_else(|| AppError::Message("备份缺少数据库版本信息".to_string()))?;
    if schema_version > db::LATEST_SCHEMA_VERSION {
        return Err(AppError::Message(format!(
            "备份来自更新版本（数据库版本 {schema_version}），当前应用无法安全恢复"
        )));
    }
    let required_tables = connection.query_row(
        "SELECT COUNT(*) FROM sqlite_master
         WHERE type='table' AND name IN ('customers','orders','payments','files')",
        [],
        |row| row.get::<_, i64>(0),
    )?;
    if required_tables != 4 {
        return Err(AppError::Message(
            "所选文件不是有效的工作台数据库备份".to_string(),
        ));
    }
    let mut statement = connection.prepare("PRAGMA foreign_key_check")?;
    let mut violations = statement.query([])?;
    if violations.next()?.is_some() {
        return Err(AppError::Message(
            "数据库外键检查失败，备份可能已损坏".to_string(),
        ));
    }
    Ok(())
}

fn replace_file_safely(staged: &Path, destination: &Path) -> AppResult<()> {
    let parent = destination
        .parent()
        .ok_or_else(|| AppError::Message("无法确定目标目录".to_string()))?;
    fs::create_dir_all(parent)?;
    let previous = parent.join(format!(".workbench-previous-{}.tmp", Uuid::new_v4()));
    let had_previous = destination.exists();
    if had_previous {
        fs::rename(destination, &previous)?;
    }
    match fs::rename(staged, destination) {
        Ok(()) => {
            if had_previous {
                let _ = fs::remove_file(previous);
            }
            Ok(())
        }
        Err(error) => {
            if had_previous {
                let _ = fs::rename(&previous, destination);
            }
            Err(AppError::Io(error))
        }
    }
}

fn path_is_inside(path: &Path, root: &Path) -> AppResult<bool> {
    let canonical_root = fs::canonicalize(root)?;
    let parent = path.parent().unwrap_or_else(|| Path::new("."));
    let canonical_parent = fs::canonicalize(parent)?;
    let filename = path
        .file_name()
        .ok_or_else(|| AppError::Message("导出文件名无效".to_string()))?;
    Ok(canonical_parent.join(filename).starts_with(canonical_root))
}

fn paths_equivalent(left: &Path, right: &Path) -> AppResult<bool> {
    Ok(fs::canonicalize(left)? == fs::canonicalize(right)?)
}

fn collect_directory_manifest(
    root: &Path,
    exclude_library_marker: bool,
) -> AppResult<Vec<ArchiveFileEntry>> {
    let mut files = Vec::new();
    for entry in WalkDir::new(root) {
        let entry = entry.map_err(|error| AppError::Message(format!("遍历文件库失败：{error}")))?;
        if entry.path() == root {
            continue;
        }
        if entry.file_type().is_symlink() {
            return Err(AppError::Message(format!(
                "文件库包含不支持的符号链接：{}",
                entry.path().display()
            )));
        }
        if !entry.file_type().is_file() {
            continue;
        }
        let relative = safe_relative_path(entry.path(), root)?;
        if exclude_library_marker && relative == LIBRARY_MARKER_NAME {
            continue;
        }
        let metadata = entry.metadata().map_err(|error| {
            AppError::Message(format!(
                "读取文件属性失败（{}）：{error}",
                entry.path().display()
            ))
        })?;
        files.push(ArchiveFileEntry {
            path: relative,
            size_bytes: metadata.len(),
            sha256: sha256_file(entry.path())?,
        });
    }
    files.sort_by(|left, right| left.path.cmp(&right.path));
    Ok(files)
}

fn verify_directory_manifest(
    root: &Path,
    expected: &[ArchiveFileEntry],
    exclude_library_marker: bool,
) -> AppResult<()> {
    let actual = collect_directory_manifest(root, exclude_library_marker)?;
    if actual != expected {
        return Err(AppError::Message(
            "文件库复制校验失败，源目录与目标目录的文件不一致".to_string(),
        ));
    }
    Ok(())
}

fn copy_library_tree(source: &Path, destination: &Path) -> AppResult<()> {
    for entry in WalkDir::new(source) {
        let entry = entry.map_err(|error| AppError::Message(format!("遍历文件库失败：{error}")))?;
        if entry.path() == source {
            continue;
        }
        if entry.file_type().is_symlink() {
            return Err(AppError::Message(format!(
                "文件库包含不支持的符号链接：{}",
                entry.path().display()
            )));
        }
        let relative = entry
            .path()
            .strip_prefix(source)
            .map_err(|_| AppError::Message("无法生成文件库相对路径".to_string()))?;
        if relative == Path::new(LIBRARY_MARKER_NAME) {
            continue;
        }
        let target = destination.join(relative);
        if entry.file_type().is_dir() {
            fs::create_dir_all(&target)?;
        } else if entry.file_type().is_file() {
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent)?;
            }
            fs::copy(entry.path(), &target)?;
        }
    }
    Ok(())
}

fn cleanup_migration_staging(staging: &Path, expected_parent: &Path) {
    let has_safe_name = staging
        .file_name()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.starts_with('.') && value.contains(".workbench-migration-"));
    let parent_is_verified = staging
        .parent()
        .and_then(|parent| fs::canonicalize(parent).ok())
        .zip(fs::canonicalize(expected_parent).ok())
        .is_some_and(|(actual, expected)| actual == expected);
    if has_safe_name && parent_is_verified && staging != expected_parent {
        let _ = fs::remove_dir_all(staging);
    }
}

fn sha256_file(path: &Path) -> AppResult<String> {
    let mut file = File::open(path)?;
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn safe_relative_path(path: &Path, root: &Path) -> AppResult<String> {
    let relative = path
        .strip_prefix(root)
        .map_err(|_| AppError::Message("无法生成相对路径".to_string()))?;
    if relative.components().any(|component| {
        matches!(
            component,
            std::path::Component::ParentDir
                | std::path::Component::RootDir
                | std::path::Component::Prefix(_)
        )
    }) {
        return Err(AppError::Message("检测到不安全的文件路径".to_string()));
    }
    Ok(relative.to_string_lossy().replace('\\', "/"))
}

fn remap_path_column(
    transaction: &Transaction<'_>,
    table: &str,
    column: &str,
    old_root: &Path,
    new_root: &Path,
) -> AppResult<()> {
    let select = format!("SELECT id, {column} FROM {table} WHERE {column} IS NOT NULL");
    let rows = transaction
        .prepare(&select)?
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })?
        .collect::<Result<Vec<_>, _>>()?;
    let update = format!("UPDATE {table} SET {column}=?2 WHERE id=?1");
    for (id, value) in rows {
        let path = Path::new(&value);
        if !path.is_absolute() {
            continue;
        }
        let Ok(relative) = path.strip_prefix(old_root) else {
            continue;
        };
        let remapped = new_root.join(relative).to_string_lossy().to_string();
        transaction.execute(&update, params![id, remapped])?;
    }
    Ok(())
}

fn read_full_archive_manifest(source: &Path) -> AppResult<FullArchiveManifest> {
    if !source.is_file() {
        return Err(AppError::Message("完整归档文件不存在".to_string()));
    }
    let file = File::open(source)?;
    let mut archive = zip::ZipArchive::new(file).map_err(zip_error)?;
    let manifest = match archive.by_name("manifest.json") {
        Ok(mut manifest_file) => {
            if manifest_file.size() > 4 * 1024 * 1024 {
                return Err(AppError::Message("归档清单异常过大".to_string()));
            }
            let mut bytes = Vec::with_capacity(manifest_file.size() as usize);
            manifest_file.read_to_end(&mut bytes)?;
            let manifest: FullArchiveManifest = serde_json::from_slice(&bytes)
                .map_err(|_| AppError::Message("完整归档清单格式无效".to_string()))?;
            Some(manifest)
        }
        Err(zip::result::ZipError::FileNotFound) => None,
        Err(error) => return Err(zip_error(error)),
    };
    match manifest {
        Some(manifest) => Ok(manifest),
        None => build_legacy_archive_manifest(&mut archive),
    }
}

fn build_legacy_archive_manifest(
    archive: &mut zip::ZipArchive<File>,
) -> AppResult<FullArchiveManifest> {
    let mut library_files = Vec::new();
    for index in 0..archive.len() {
        let mut entry = archive.by_index(index).map_err(zip_error)?;
        let name = validated_zip_entry_name(&entry)?;
        if entry.is_dir() || !name.starts_with("library/") {
            continue;
        }
        let relative = name.trim_start_matches("library/").to_string();
        validate_archive_relative_path(&relative)?;
        let size_bytes = entry.size();
        let sha256 = sha256_reader(&mut entry)?;
        library_files.push(ArchiveFileEntry {
            path: relative,
            size_bytes,
            sha256,
        });
    }
    library_files.sort_by(|left, right| left.path.cmp(&right.path));
    let library_bytes = library_files.iter().try_fold(0_u64, |total, entry| {
        total
            .checked_add(entry.size_bytes)
            .ok_or_else(|| AppError::Message("归档文件大小超出可处理范围".to_string()))
    })?;
    let database_sha256 = {
        let mut database = archive
            .by_name("database/workbench.db")
            .map_err(zip_error)?;
        sha256_reader(&mut database)?
    };
    let source_library_root = match archive.by_name("config/settings.json") {
        Ok(mut settings_file) if settings_file.size() <= 4 * 1024 * 1024 => {
            let mut bytes = Vec::with_capacity(settings_file.size() as usize);
            settings_file.read_to_end(&mut bytes)?;
            serde_json::from_slice::<AppSettings>(&bytes)
                .ok()
                .and_then(|settings| settings.library_root)
        }
        _ => None,
    };
    Ok(FullArchiveManifest {
        format_version: 0,
        schema_version: 1,
        exported_at: "旧版归档（未记录导出时间）".to_string(),
        source_library_root,
        database_sha256,
        library_file_count: library_files.len(),
        library_bytes,
        library_files,
    })
}

fn validate_full_archive(source: &Path) -> AppResult<FullArchiveManifest> {
    let manifest = read_full_archive_manifest(source)?;
    if !(0..=1).contains(&manifest.format_version) {
        return Err(AppError::Message(format!(
            "不支持的完整归档格式版本：{}",
            manifest.format_version
        )));
    }
    if manifest.schema_version > db::LATEST_SCHEMA_VERSION {
        return Err(AppError::Message(format!(
            "归档来自更新版本（数据库版本 {}），当前应用无法安全恢复",
            manifest.schema_version
        )));
    }
    let mut expected_paths = HashSet::new();
    let mut expected_bytes = 0_u64;
    for entry in &manifest.library_files {
        validate_archive_relative_path(&entry.path)?;
        if !expected_paths.insert(entry.path.clone()) {
            return Err(AppError::Message(format!(
                "归档清单包含重复文件：{}",
                entry.path
            )));
        }
        expected_bytes = expected_bytes
            .checked_add(entry.size_bytes)
            .ok_or_else(|| AppError::Message("归档文件大小超出可处理范围".to_string()))?;
    }
    if manifest.library_file_count != manifest.library_files.len()
        || manifest.library_bytes != expected_bytes
    {
        return Err(AppError::Message("归档清单统计信息不一致".to_string()));
    }

    let file = File::open(source)?;
    let mut archive = zip::ZipArchive::new(file).map_err(zip_error)?;
    let mut names = HashSet::new();
    let mut actual_library_paths = HashSet::new();
    let mut has_database = false;
    for index in 0..archive.len() {
        let entry = archive.by_index(index).map_err(zip_error)?;
        let name = validated_zip_entry_name(&entry)?;
        if !names.insert(name.clone()) {
            return Err(AppError::Message(format!("归档包含重复条目：{name}")));
        }
        if entry.is_dir() {
            continue;
        }
        match name.as_str() {
            "database/workbench.db" => has_database = true,
            "manifest.json" | "config/settings.json" => {}
            _ if name.starts_with("library/") => {
                let relative = name.trim_start_matches("library/").to_string();
                validate_archive_relative_path(&relative)?;
                actual_library_paths.insert(relative);
            }
            _ => return Err(AppError::Message(format!("归档包含未识别的文件：{name}"))),
        }
    }
    if !has_database {
        return Err(AppError::Message("归档缺少工作台数据库".to_string()));
    }
    if actual_library_paths != expected_paths {
        return Err(AppError::Message(
            "归档中的文件与清单不一致，可能已损坏".to_string(),
        ));
    }

    {
        let mut database = archive
            .by_name("database/workbench.db")
            .map_err(zip_error)?;
        if sha256_reader(&mut database)? != manifest.database_sha256 {
            return Err(AppError::Message("归档数据库校验失败".to_string()));
        }
    }
    for expected in &manifest.library_files {
        let name = format!("library/{}", expected.path);
        let mut entry = archive.by_name(&name).map_err(zip_error)?;
        if entry.size() != expected.size_bytes || sha256_reader(&mut entry)? != expected.sha256 {
            return Err(AppError::Message(format!(
                "归档文件校验失败：{}",
                expected.path
            )));
        }
    }
    Ok(manifest)
}

fn validated_zip_entry_name(entry: &zip::read::ZipFile<'_>) -> AppResult<String> {
    let name = entry.name();
    if name.contains('\\') || entry.enclosed_name().is_none() {
        return Err(AppError::Message(format!("归档包含不安全路径：{name}")));
    }
    Ok(name.to_string())
}

fn validate_archive_relative_path(value: &str) -> AppResult<()> {
    if value.is_empty() || value.contains('\\') || value.starts_with('/') || value.contains(':') {
        return Err(AppError::Message(format!("归档包含不安全路径：{value}")));
    }
    let path = Path::new(value);
    if path.components().any(|component| {
        matches!(
            component,
            std::path::Component::ParentDir
                | std::path::Component::RootDir
                | std::path::Component::Prefix(_)
        )
    }) {
        return Err(AppError::Message(format!("归档包含不安全路径：{value}")));
    }
    Ok(())
}

fn sha256_reader(reader: &mut impl Read) -> AppResult<String> {
    let mut hasher = Sha256::new();
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = reader.read(&mut buffer)?;
        if read == 0 {
            break;
        }
        hasher.update(&buffer[..read]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

fn extract_archive_entry(source: &Path, name: &str, destination: &Path) -> AppResult<()> {
    let file = File::open(source)?;
    let mut archive = zip::ZipArchive::new(file).map_err(zip_error)?;
    let mut entry = archive.by_name(name).map_err(zip_error)?;
    validated_zip_entry_name(&entry)?;
    if let Some(parent) = destination.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut output = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(destination)?;
    std::io::copy(&mut entry, &mut output)?;
    output.sync_all()?;
    Ok(())
}

fn extract_archive_library(
    source: &Path,
    manifest: &FullArchiveManifest,
    destination: &Path,
) -> AppResult<()> {
    let file = File::open(source)?;
    let mut archive = zip::ZipArchive::new(file).map_err(zip_error)?;
    for expected in &manifest.library_files {
        validate_archive_relative_path(&expected.path)?;
        let name = format!("library/{}", expected.path);
        let mut entry = archive.by_name(&name).map_err(zip_error)?;
        validated_zip_entry_name(&entry)?;
        let target = destination.join(Path::new(&expected.path));
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent)?;
        }
        let mut output = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&target)?;
        std::io::copy(&mut entry, &mut output)?;
        output.sync_all()?;
    }
    Ok(())
}

fn cleanup_restore_staging(staging: &Path, expected_parent: &Path) {
    let has_safe_name = staging
        .file_name()
        .and_then(|value| value.to_str())
        .is_some_and(|value| value.starts_with('.') && value.contains(".workbench-restore-"));
    let parent_is_verified = staging
        .parent()
        .and_then(|parent| fs::canonicalize(parent).ok())
        .zip(fs::canonicalize(expected_parent).ok())
        .is_some_and(|(actual, expected)| actual == expected);
    if has_safe_name && parent_is_verified && staging != expected_parent {
        let _ = fs::remove_dir_all(staging);
    }
}

fn retain_failed_restore_target(target: &Path, expected_parent: &Path) -> PathBuf {
    let target_name = target
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("library");
    let retained = expected_parent.join(format!(
        ".{target_name}.workbench-restore-failed-{}",
        Uuid::new_v4()
    ));
    if target.parent() == Some(expected_parent) && fs::rename(target, &retained).is_ok() {
        let _ = fs::create_dir(target);
        retained
    } else {
        target.to_path_buf()
    }
}

fn validate_order_input(input: &NewOrder) -> AppResult<i64> {
    if input.items.is_empty() {
        return Err(AppError::Message("订单至少需要一个项目".to_string()));
    }
    let mut total = 0_i64;
    for (index, item) in input.items.iter().enumerate() {
        let row = index + 1;
        if item.name.trim().is_empty() {
            return Err(AppError::Message(format!(
                "第 {row} 个订单项目名称不能为空"
            )));
        }
        if item.quantity <= 0 {
            return Err(AppError::Message(format!(
                "第 {row} 个订单项目数量必须大于 0"
            )));
        }
        if item.unit_price_cents < 0 {
            return Err(AppError::Message(format!(
                "第 {row} 个订单项目单价不能为负数"
            )));
        }
        if item.source_production_cost_cents < 0 || item.source_shipping_cost_cents < 0 {
            return Err(AppError::Message(format!(
                "第 {row} 个订单项目的生产成本和运费不能为负数"
            )));
        }
        let line_total = item
            .quantity
            .checked_mul(item.unit_price_cents)
            .ok_or_else(|| AppError::Message(format!("第 {row} 个订单项目金额过大")))?;
        total = total
            .checked_add(line_total)
            .ok_or_else(|| AppError::Message("订单总金额过大".to_string()))?;
    }
    for (label, value) in [
        ("设计截止日期", input.design_due_at.as_deref()),
        ("交付截止日期", input.delivery_due_at.as_deref()),
    ] {
        if let Some(value) = value.filter(|value| !value.trim().is_empty()) {
            NaiveDate::parse_from_str(value, "%Y-%m-%d")
                .map_err(|_| AppError::Message(format!("{label}格式无效")))?;
        }
    }
    Ok(total)
}

fn validate_payment_date(value: &str) -> AppResult<()> {
    NaiveDate::parse_from_str(value.trim(), "%Y-%m-%d")
        .map(|_| ())
        .map_err(|_| AppError::Message("收款日期无效，请使用 YYYY-MM-DD 格式".to_string()))
}

fn order_folder_label(order: &Order) -> String {
    let external = order.external_order_no.trim();
    if !external.is_empty() {
        return external.to_string();
    }
    let project_names = order
        .items
        .iter()
        .map(|item| item.name.trim())
        .filter(|name| !name.is_empty())
        .collect::<Vec<_>>();
    if project_names.is_empty() {
        "内部订单".to_string()
    } else {
        project_names.join("、")
    }
}

fn system_time_to_rfc3339(value: std::time::SystemTime) -> String {
    DateTime::<Utc>::from(value).to_rfc3339()
}

fn file_category(path: &Path) -> String {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "cdr" => "CorelDRAW".to_string(),
        "psd" => "PSD".to_string(),
        "ai" => "AI".to_string(),
        "pdf" => "PDF".to_string(),
        "txt" => "文本文档".to_string(),
        "jpg" | "jpeg" | "png" | "webp" | "gif" | "svg" => "图片文件".to_string(),
        "zip" | "rar" | "7z" => "压缩包".to_string(),
        "" => "文件".to_string(),
        extension => extension.to_uppercase(),
    }
}

fn normalized_file_path_key(path: &str) -> String {
    path.replace('\\', "/").to_lowercase()
}

fn collect_order_folder_files(
    folder: &Path,
    library: &Path,
    order_id: &str,
    customer_id: &str,
) -> Vec<FileRecord> {
    WalkDir::new(folder)
        .min_depth(1)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
        .filter_map(|entry| {
            let path = entry.path();
            let metadata = entry.metadata().ok()?;
            let name = path.file_name()?.to_str()?.to_string();
            let relative_path = path
                .strip_prefix(library)
                .unwrap_or(path)
                .to_string_lossy()
                .to_string();
            let created_at = metadata
                .modified()
                .map(system_time_to_rfc3339)
                .unwrap_or_else(|_| now());
            Some(FileRecord {
                id: Uuid::new_v4().to_string(),
                order_id: Some(order_id.to_string()),
                customer_id: customer_id.to_string(),
                category: file_category(path),
                name,
                relative_path,
                size_bytes: metadata.len() as i64,
                created_at,
                state: "ready".to_string(),
            })
        })
        .collect()
}

fn insert_platform_identities(
    transaction: &Transaction<'_>,
    customer_id: &str,
    identities: &[PlatformIdentityInput],
) -> AppResult<()> {
    for identity in identities {
        transaction.execute(
            "INSERT INTO platform_identities(id, customer_id, platform, handle, account)
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![
                Uuid::new_v4().to_string(),
                customer_id,
                identity.platform,
                identity.handle,
                identity.account,
            ],
        )?;
    }
    Ok(())
}

fn validate_import_customer(row_number: usize, customer: &NewCustomer) -> AppResult<()> {
    if customer.name.trim().is_empty() {
        return Err(AppError::Message(format!(
            "第 {row_number} 行：客户名称不能为空"
        )));
    }
    if !(0..=5).contains(&customer.vip_level) {
        return Err(AppError::Message(format!(
            "第 {row_number} 行：VIP 星级必须在 0 到 5 之间"
        )));
    }
    Ok(())
}

fn app_preference_setting_key(key: &str) -> AppResult<String> {
    match key {
        "quick_reply_library" | "order_item_templates" => Ok(format!("preference.{key}")),
        _ => Err(AppError::Message("不支持的自定义设置项".to_string())),
    }
}

fn rollback_recycle_moves(moves: &[(PathBuf, PathBuf)]) {
    for (source, destination) in moves.iter().rev() {
        if destination.exists() && !source.exists() {
            let _ = fs::rename(destination, source);
        }
    }
}

fn insert_addresses(
    transaction: &Transaction<'_>,
    customer_id: &str,
    addresses: &[AddressInput],
) -> AppResult<()> {
    for address in addresses {
        transaction.execute(
            "INSERT INTO addresses(id, customer_id, label, recipient, phone, address)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![
                Uuid::new_v4().to_string(),
                customer_id,
                address.label,
                address.recipient,
                address.phone,
                address.address,
            ],
        )?;
    }
    Ok(())
}

fn insert_order_items(
    transaction: &Transaction<'_>,
    order_id: &str,
    items: &[OrderItemInput],
) -> AppResult<()> {
    for item in items {
        transaction.execute(
            "INSERT INTO order_items(
                id, order_id, item_type, name, quantity, unit_price_cents, print_spec,
                source_quote_id, source_factory_id, source_factory_name, source_quote_summary,
                source_production_cost_cents, source_shipping_cost_cents
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                Uuid::new_v4().to_string(),
                order_id,
                item.item_type,
                item.name,
                item.quantity,
                item.unit_price_cents,
                item.print_spec,
                item.source_quote_id,
                item.source_factory_id,
                item.source_factory_name,
                item.source_quote_summary,
                item.source_production_cost_cents.max(0),
                item.source_shipping_cost_cents.max(0),
            ],
        )?;
    }
    Ok(())
}

fn index_customer(transaction: &Transaction<'_>, customer_id: &str) -> AppResult<()> {
    transaction.execute(
        "DELETE FROM search_index WHERE entity_type='customer' AND entity_id=?1",
        params![customer_id],
    )?;
    transaction.execute(
        "INSERT INTO search_index(entity_type, entity_id, title, content)
         SELECT 'customer', c.id, c.name,
         c.name || ' ' || c.phone || ' ' || c.wechat || ' ' || c.notes || ' ' || c.tags_json || ' ' ||
         COALESCE((SELECT group_concat(platform || ' ' || handle || ' ' || account, ' ')
                   FROM platform_identities WHERE customer_id=c.id), '') || ' ' ||
         COALESCE((SELECT group_concat(recipient || ' ' || phone || ' ' || address, ' ')
                   FROM addresses WHERE customer_id=c.id), '')
         FROM customers c WHERE c.id=?1",
        params![customer_id],
    )?;
    Ok(())
}

fn index_order(transaction: &Transaction<'_>, order_id: &str) -> AppResult<()> {
    transaction.execute(
        "DELETE FROM search_index WHERE entity_type='order' AND entity_id=?1",
        params![order_id],
    )?;
    transaction.execute(
        "INSERT INTO search_index(entity_type, entity_id, title, content)
         SELECT 'order', o.id, COALESCE(NULLIF(o.external_order_no,''), '内部订单'),
         c.name || ' ' || c.phone || ' ' || c.wechat || ' ' ||
         o.external_order_no || ' ' || o.platform || ' ' || o.platform_account || ' ' ||
         o.shipment_company || ' ' || o.shipment_tracking_no || ' ' ||
         o.shipping_address_label || ' ' || o.shipping_recipient || ' ' ||
         o.shipping_phone || ' ' || o.shipping_address || ' ' ||
         o.notes || ' ' || o.tags_json
         FROM orders o JOIN customers c ON c.id=o.customer_id WHERE o.id=?1",
        params![order_id],
    )?;
    Ok(())
}

fn index_source_factory(transaction: &Transaction<'_>, factory_id: &str) -> AppResult<()> {
    transaction.execute(
        "DELETE FROM search_index WHERE entity_type='factory' AND entity_id=?1",
        params![factory_id],
    )?;
    transaction.execute(
        "INSERT INTO search_index(entity_type, entity_id, title, content)
         SELECT 'factory', f.id, f.name,
         f.name || ' ' || f.contact_name || ' ' || f.phone || ' ' || f.wechat || ' ' || f.qq || ' ' ||
         f.order_url || ' ' || f.address || ' ' || f.shipping_notes || ' ' || f.notes || ' ' || f.tags_json || ' ' ||
          COALESCE((
              SELECT group_concat(
                 q.item_type || ' ' || q.item_name || ' ' || q.quantity || ' ' ||
                q.size || ' ' || q.material || ' ' || q.paper_weight || ' ' ||
                q.sides || ' ' || q.color || ' ' || q.finish || ' ' ||
                q.lead_time || ' ' || q.notes,
                ' '
             )
              FROM source_factory_quotes q
              WHERE q.factory_id=f.id AND q.deleted_at IS NULL
          ), '') || ' ' ||
          COALESCE((
              SELECT group_concat(p.category_name || ' ' || p.project_name, ' ')
              FROM source_factory_projects p
              WHERE p.factory_id=f.id AND p.deleted_at IS NULL
          ), '')
          FROM source_factories f WHERE f.id=?1 AND f.deleted_at IS NULL",
        params![factory_id],
    )?;
    Ok(())
}

fn load_customer(connection: &Connection, id: &str) -> AppResult<Option<Customer>> {
    let row = connection
        .query_row(
            "SELECT c.id, c.name, c.phone, c.wechat, c.vip_level, c.notes, c.tags_json,
             c.qr_code_path, c.created_at, c.updated_at,
             (SELECT COUNT(*) FROM orders o WHERE o.customer_id=c.id AND o.deleted_at IS NULL),
             (SELECT COALESCE(SUM(total_cents),0) FROM orders o WHERE o.customer_id=c.id AND o.deleted_at IS NULL)
             FROM customers c WHERE c.id=?1 AND c.deleted_at IS NULL",
            params![id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, i64>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, Option<String>>(7)?,
                    row.get::<_, String>(8)?,
                    row.get::<_, String>(9)?,
                    row.get::<_, i64>(10)?,
                    row.get::<_, i64>(11)?,
                ))
            },
        )
        .optional()?;
    let Some(row) = row else { return Ok(None) };
    let platform_identities = connection
        .prepare("SELECT platform, handle, account FROM platform_identities WHERE customer_id=?1")?
        .query_map(params![id], |row| {
            Ok(PlatformIdentityInput {
                platform: row.get(0)?,
                handle: row.get(1)?,
                account: row.get(2)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    let addresses = connection
        .prepare("SELECT label, recipient, phone, address FROM addresses WHERE customer_id=?1")?
        .query_map(params![id], |row| {
            Ok(AddressInput {
                label: row.get(0)?,
                recipient: row.get(1)?,
                phone: row.get(2)?,
                address: row.get(3)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(Some(Customer {
        id: row.0,
        name: row.1,
        phone: row.2,
        wechat: row.3,
        vip_level: row.4,
        notes: row.5,
        tags: serde_json::from_str(&row.6)?,
        qr_code_path: row.7,
        created_at: row.8,
        updated_at: row.9,
        order_count: row.10,
        total_spent_cents: row.11,
        platform_identities,
        addresses,
    }))
}

fn load_source_factory(connection: &Connection, id: &str) -> AppResult<Option<SourceFactory>> {
    let row = connection
        .query_row(
            "SELECT f.id, f.name, f.contact_name, f.phone, f.wechat, f.qq, f.order_url, f.address, f.tags_json,
             f.shipping_notes, f.notes, f.created_at, f.updated_at,
             (SELECT COUNT(*) FROM source_factory_quotes q
              WHERE q.factory_id=f.id AND q.deleted_at IS NULL)
             FROM source_factories f WHERE f.id=?1 AND f.deleted_at IS NULL",
            params![id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, String>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, String>(7)?,
                    row.get::<_, String>(8)?,
                    row.get::<_, String>(9)?,
                    row.get::<_, String>(10)?,
                    row.get::<_, String>(11)?,
                    row.get::<_, String>(12)?,
                    row.get::<_, i64>(13)?,
                ))
            },
        )
        .optional()?;
    let Some(row) = row else { return Ok(None) };
    Ok(Some(SourceFactory {
        id: row.0,
        name: row.1,
        contact_name: row.2,
        phone: row.3,
        wechat: row.4,
        qq: row.5,
        order_url: row.6,
        address: row.7,
        tags: serde_json::from_str(&row.8)?,
        shipping_notes: row.9,
        notes: row.10,
        created_at: row.11,
        updated_at: row.12,
        quote_count: row.13,
    }))
}

fn map_source_quote(row: &rusqlite::Row<'_>) -> rusqlite::Result<SourceQuote> {
    Ok(SourceQuote {
        id: row.get(0)?,
        factory_id: row.get(1)?,
        factory_name: row.get(2)?,
        item_type: row.get(3)?,
        item_name: row.get(4)?,
        quantity: row.get(5)?,
        size: row.get(6)?,
        material: row.get(7)?,
        paper_weight: row.get(8)?,
        sides: row.get(9)?,
        color: row.get(10)?,
        finish: row.get(11)?,
        production_cost_cents: row.get(12)?,
        shipping_cost_cents: row.get(13)?,
        lead_time: row.get(14)?,
        notes: row.get(15)?,
        created_at: row.get(16)?,
        updated_at: row.get(17)?,
    })
}

fn map_source_factory_project(row: &rusqlite::Row<'_>) -> rusqlite::Result<SourceFactoryProject> {
    Ok(SourceFactoryProject {
        id: row.get(0)?,
        factory_id: row.get(1)?,
        category_name: row.get(2)?,
        project_name: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

fn dashboard_todo_orders(orders: &[Order], today: &str) -> Vec<Order> {
    let mut todos = orders
        .iter()
        .filter(|order| dashboard_todo_score(order, today).is_some())
        .collect::<Vec<_>>();
    todos.sort_by_key(|order| {
        (
            dashboard_todo_score(order, today).unwrap_or(99),
            active_order_deadline(order)
                .unwrap_or("9999-12-31")
                .to_string(),
            std::cmp::Reverse(order.created_at.clone()),
        )
    });
    todos.into_iter().take(10).cloned().collect()
}

fn dashboard_todo_score(order: &Order, today: &str) -> Option<i32> {
    let due_date = active_order_deadline(order);
    if due_date.is_some_and(|date| date < today) {
        return Some(0);
    }
    if order.received_cents < order.total_cents {
        return Some(1);
    }
    if order.fulfillment_status == "待发货" {
        return Some(2);
    }
    if matches!(order.design_status.as_str(), "待设计" | "设计中" | "待确认") {
        return Some(4);
    }
    due_date.map(|_| 5)
}

fn active_order_deadline(order: &Order) -> Option<&str> {
    let design_due = matches!(order.design_status.as_str(), "待设计" | "设计中" | "待确认")
        .then_some(order.design_due_at.as_deref())
        .flatten();
    let delivery_due = (!matches!(order.fulfillment_status.as_str(), "已签收" | "已取消"))
        .then_some(order.delivery_due_at.as_deref())
        .flatten();
    match (design_due, delivery_due) {
        (Some(design), Some(delivery)) => Some(design.min(delivery)),
        (Some(design), None) => Some(design),
        (None, Some(delivery)) => Some(delivery),
        (None, None) => None,
    }
}

fn load_order(connection: &Connection, id: &str) -> AppResult<Option<Order>> {
    let row = connection
        .query_row(
            "SELECT o.id, o.customer_id, c.name, c.phone, c.wechat, c.vip_level, o.platform, o.platform_account,
             o.external_order_no, o.design_status, o.fulfillment_status, o.design_due_at,
             o.delivery_due_at, o.notes, o.tags_json, o.total_cents, o.received_cents,
             o.shipment_company, o.shipment_tracking_no, o.shipping_address_label,
             o.shipping_recipient, o.shipping_phone, o.shipping_address, o.folder_path, o.folder_state,
             o.created_at, o.updated_at
             FROM orders o JOIN customers c ON c.id=o.customer_id
             WHERE o.id=?1 AND o.deleted_at IS NULL",
            params![id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, String>(4)?,
                    row.get::<_, i64>(5)?,
                    row.get::<_, String>(6)?,
                    row.get::<_, String>(7)?,
                    row.get::<_, String>(8)?,
                    row.get::<_, String>(9)?,
                    row.get::<_, String>(10)?,
                    row.get::<_, Option<String>>(11)?,
                    row.get::<_, Option<String>>(12)?,
                    row.get::<_, String>(13)?,
                    row.get::<_, String>(14)?,
                    row.get::<_, i64>(15)?,
                    row.get::<_, i64>(16)?,
                    row.get::<_, String>(17)?,
                    row.get::<_, String>(18)?,
                    row.get::<_, String>(19)?,
                    row.get::<_, String>(20)?,
                    row.get::<_, String>(21)?,
                    row.get::<_, String>(22)?,
                    row.get::<_, Option<String>>(23)?,
                    row.get::<_, String>(24)?,
                    row.get::<_, String>(25)?,
                    row.get::<_, String>(26)?,
                ))
            },
        )
        .optional()?;
    let Some(row) = row else { return Ok(None) };
    let items = connection
        .prepare(
            "SELECT id, order_id, item_type, name, quantity, unit_price_cents, print_spec,
             source_quote_id, source_factory_id, source_factory_name, source_quote_summary,
             source_production_cost_cents, source_shipping_cost_cents
             FROM order_items WHERE order_id=?1",
        )?
        .query_map(params![id], |row| {
            Ok(OrderItem {
                id: row.get(0)?,
                order_id: row.get(1)?,
                item_type: row.get(2)?,
                name: row.get(3)?,
                quantity: row.get(4)?,
                unit_price_cents: row.get(5)?,
                print_spec: row.get(6)?,
                source_quote_id: row.get(7)?,
                source_factory_id: row.get(8)?,
                source_factory_name: row.get(9)?,
                source_quote_summary: row.get(10)?,
                source_production_cost_cents: row.get(11)?,
                source_shipping_cost_cents: row.get(12)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    let payments = connection
        .prepare(
            "SELECT id, order_id, amount_cents, paid_at, method, notes FROM payments WHERE order_id=?1
             ORDER BY paid_at DESC",
        )?
        .query_map(params![id], |row| {
            Ok(Payment {
                id: row.get(0)?,
                order_id: row.get(1)?,
                amount_cents: row.get(2)?,
                paid_at: row.get(3)?,
                method: row.get(4)?,
                notes: row.get(5)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    let status = match payment_status(row.15, row.16) {
        PaymentStatus::Unpaid => "未收",
        PaymentStatus::Partial => "部分收款",
        PaymentStatus::Paid => "已结清",
    };
    let shipping_address = if [&row.19, &row.20, &row.21, &row.22]
        .iter()
        .any(|value| !value.trim().is_empty())
    {
        Some(AddressInput {
            label: row.19.clone(),
            recipient: row.20.clone(),
            phone: row.21.clone(),
            address: row.22.clone(),
        })
    } else {
        None
    };
    Ok(Some(Order {
        id: row.0,
        customer_id: row.1,
        customer_name: row.2,
        customer_phone: row.3,
        customer_wechat: row.4,
        customer_vip_level: row.5,
        platform: row.6,
        platform_account: row.7,
        external_order_no: row.8,
        design_status: row.9,
        fulfillment_status: row.10,
        design_due_at: row.11,
        delivery_due_at: row.12,
        notes: row.13,
        tags: serde_json::from_str(&row.14)?,
        total_cents: row.15,
        received_cents: row.16,
        payment_status: status.to_string(),
        shipment_company: row.17,
        shipment_tracking_no: row.18,
        shipping_address,
        folder_path: row.23,
        folder_state: row.24,
        created_at: row.25,
        updated_at: row.26,
        items,
        payments,
    }))
}

fn map_file(row: &rusqlite::Row<'_>) -> rusqlite::Result<FileRecord> {
    Ok(FileRecord {
        id: row.get(0)?,
        order_id: row.get(1)?,
        customer_id: row.get(2)?,
        category: row.get(3)?,
        name: row.get(4)?,
        relative_path: row.get(5)?,
        size_bytes: row.get(6)?,
        created_at: row.get(7)?,
        state: "unknown".to_string(),
    })
}

fn scalar<P>(connection: &Connection, query: &str, params: P) -> rusqlite::Result<i64>
where
    P: rusqlite::Params,
{
    connection.query_row(query, params, |row| row.get(0))
}

fn zip_error(error: zip::result::ZipError) -> AppError {
    AppError::Message(format!("压缩包错误：{error}"))
}
