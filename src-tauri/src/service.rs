use std::{
    collections::{HashMap, HashSet},
    fs::{self, File},
    io::Write,
    path::{Path, PathBuf},
};

use chrono::{DateTime, Local, Utc};
use rusqlite::{params, Connection, OptionalExtension, Transaction};
use thiserror::Error;
use uuid::Uuid;
use walkdir::WalkDir;
use zip::{write::SimpleFileOptions, CompressionMethod, ZipWriter};

use crate::{
    db,
    domain::{
        folder_names::{customer_folder_name, next_available_name, order_folder_name},
        money::{payment_status, total_amount, OrderLine, PaymentStatus},
    },
    models::{
        AddressInput, AppSettings, Customer, DashboardSummary, FileRecord, ImportCustomerRow,
        ImportResult, NewCustomer, NewOrder, Order, OrderItem, OrderItemInput, Payment,
        PaymentInput, PlatformIdentityInput, SearchHit, SourceFactory, SourceFactoryInput,
        SourceQuote, SourceQuoteInput,
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

    pub fn settings(&self) -> AppResult<AppSettings> {
        Ok(AppSettings {
            library_root: self.get_setting("library_root")?,
            backup_dir: self.get_setting("backup_dir")?,
        })
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
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        transaction.execute(
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
        transaction.execute(
            "DELETE FROM platform_identities WHERE customer_id=?1",
            params![id],
        )?;
        transaction.execute("DELETE FROM addresses WHERE customer_id=?1", params![id])?;
        insert_platform_identities(&transaction, id, &input.platform_identities)?;
        insert_addresses(&transaction, id, &input.addresses)?;
        index_customer(&transaction, id)?;
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
                id, name, contact_name, phone, wechat, address, tags_json,
                shipping_notes, notes, created_at, updated_at
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)",
            params![
                id,
                input.name.trim(),
                input.contact_name.trim(),
                input.phone.trim(),
                input.wechat.trim(),
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
            "UPDATE source_factories SET name=?2, contact_name=?3, phone=?4, wechat=?5,
             address=?6, tags_json=?7, shipping_notes=?8, notes=?9, updated_at=?10,
             version=version+1 WHERE id=?1 AND deleted_at IS NULL",
            params![
                id,
                input.name.trim(),
                input.contact_name.trim(),
                input.phone.trim(),
                input.wechat.trim(),
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

    pub fn create_order(&self, input: NewOrder) -> AppResult<Order> {
        let customer = self
            .get_customer(&input.customer_id)?
            .ok_or_else(|| AppError::Message("客户不存在".to_string()))?;
        let total_cents = total_amount(
            &input
                .items
                .iter()
                .map(|item| OrderLine {
                    quantity: item.quantity,
                    unit_price_cents: item.unit_price_cents,
                })
                .collect::<Vec<_>>(),
        );
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
            return Ok(());
        }

        let connection = self.connection()?;
        let customers = connection
            .prepare("SELECT id, name FROM customers WHERE deleted_at IS NULL")?
            .query_map([], |row| {
                Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
            })?
            .collect::<Result<Vec<_>, _>>()?;
        drop(connection);

        for (customer_id, customer_name) in customers {
            let customer_folders =
                self.active_managed_customer_folders(&customer_id, &customer_name)?;
            if customer_folders.is_empty() {
                continue;
            }
            if customer_folders.iter().all(|folder| !folder.is_dir()) {
                self.hide_customer_after_external_folder_delete(&customer_id)?;
            }
        }

        for order in self.list_orders()? {
            self.sync_order_folder_files(&order)?;
        }
        Ok(())
    }

    pub fn update_order(&self, id: &str, input: NewOrder) -> AppResult<Order> {
        self.get_customer(&input.customer_id)?
            .ok_or_else(|| AppError::Message("客户不存在".to_string()))?;
        let total_cents = total_amount(
            &input
                .items
                .iter()
                .map(|item| OrderLine {
                    quantity: item.quantity,
                    unit_price_cents: item.unit_price_cents,
                })
                .collect::<Vec<_>>(),
        );
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        let shipping_address = input.shipping_address.as_ref();
        let updated = transaction.execute(
            "UPDATE orders SET customer_id=?2, platform=?3, platform_account=?4,
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
        if let Some(folder) = order_folder.as_ref() {
            self.move_managed_folder_to_recycle(folder, "订单文件夹")?;
        }
        Ok(())
    }

    pub fn delete_customer(&self, id: &str) -> AppResult<()> {
        let customer = self
            .get_customer(id)?
            .ok_or_else(|| AppError::Message("客户不存在".to_string()))?;
        let customer_folders = self.managed_customer_folders(id, &customer.name)?;
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
        self.move_customer_folders_to_recycle(&customer_folders)?;
        Ok(())
    }

    pub fn add_payment(&self, order_id: &str, input: PaymentInput) -> AppResult<Order> {
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
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
            "UPDATE orders SET received_cents=(
                SELECT COALESCE(SUM(amount_cents), 0) FROM payments WHERE order_id=?1
             ), updated_at=?2, version=version+1 WHERE id=?1",
            params![order_id, now()],
        )?;
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
        let size_bytes = fs::metadata(&destination)?.len() as i64;
        let library = self
            .get_setting("library_root")?
            .map(PathBuf::from)
            .ok_or_else(|| AppError::Message("尚未设置客户文件库".to_string()))?;
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
        };
        self.connection()?.execute(
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
        )?;
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
        if source.exists() {
            fs::rename(source, recycle.join(name))?;
        }
        connection.execute(
            "UPDATE files SET deleted_at=?2 WHERE id=?1",
            params![file_id, now()],
        )?;
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
             AND COALESCE(delivery_due_at, design_due_at) BETWEEN ?1 AND ?2
             AND fulfillment_status NOT IN ('已签收','已取消')",
            params![today, due_limit],
            |row| row.get(0),
        )?;
        let overdue = connection.query_row(
            "SELECT COUNT(*) FROM orders WHERE deleted_at IS NULL
             AND COALESCE(delivery_due_at, design_due_at) < ?1
             AND fulfillment_status NOT IN ('已签收','已取消')",
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
             WHERE p.paid_at >= ?1 AND o.deleted_at IS NULL AND c.deleted_at IS NULL",
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
                        "第 {} 行手机号与“{}”相同，已作为独立客户导入",
                        row.row_number, name
                    ));
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
        }
        transaction.commit()?;
        Ok(ImportResult {
            imported: valid_rows.len(),
            skipped: errors.len(),
            errors,
            duplicate_warnings,
        })
    }

    pub fn create_database_backup(&self, backup_dir: &Path) -> AppResult<PathBuf> {
        fs::create_dir_all(backup_dir)?;
        self.connection()?
            .execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")?;
        let filename = format!("workbench-{}.db", Local::now().format("%Y-%m-%d_%H-%M-%S"));
        let destination = backup_dir.join(filename);
        fs::copy(&self.db_path, &destination)?;
        Ok(destination)
    }

    pub fn create_daily_backup(&self, default_backup_dir: &Path) -> AppResult<PathBuf> {
        let backup_dir = self
            .get_setting("backup_dir")?
            .map(PathBuf::from)
            .unwrap_or_else(|| default_backup_dir.to_path_buf());
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
            Some(path) => path,
            None => self.create_database_backup(&backup_dir)?,
        };
        let mut backups = fs::read_dir(&backup_dir)?
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
        Ok(backup)
    }

    pub fn restore_database_backup(&self, backup_path: &Path) -> AppResult<PathBuf> {
        let backup_connection = Connection::open(backup_path)?;
        backup_connection.query_row(
            "SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1",
            [],
            |row| row.get::<_, i64>(0),
        )?;
        drop(backup_connection);
        self.connection()?
            .execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")?;
        let safety_copy = self.db_path.with_file_name(format!(
            "workbench-before-restore-{}.db",
            Local::now().format("%Y%m%d%H%M%S")
        ));
        fs::copy(&self.db_path, &safety_copy)?;
        let wal = PathBuf::from(format!("{}-wal", self.db_path.to_string_lossy()));
        let shm = PathBuf::from(format!("{}-shm", self.db_path.to_string_lossy()));
        if wal.exists() {
            fs::remove_file(wal)?;
        }
        if shm.exists() {
            fs::remove_file(shm)?;
        }
        fs::copy(backup_path, &self.db_path)?;
        db::open(&self.db_path)?;
        Ok(safety_copy)
    }

    pub fn export_full(&self, destination: &Path) -> AppResult<PathBuf> {
        self.connection()?
            .execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")?;
        if let Some(parent) = destination.parent() {
            fs::create_dir_all(parent)?;
        }
        let file = File::create(destination)?;
        let mut archive = ZipWriter::new(file);
        let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
        archive
            .start_file("database/workbench.db", options)
            .map_err(zip_error)?;
        let mut database = File::open(&self.db_path)?;
        std::io::copy(&mut database, &mut archive)?;

        archive
            .start_file("config/settings.json", options)
            .map_err(zip_error)?;
        let settings = self.settings()?;
        archive.write_all(serde_json::to_string_pretty(&settings)?.as_bytes())?;

        if let Some(library_root) = self.get_setting("library_root")?.map(PathBuf::from) {
            if library_root.is_dir() {
                for entry in WalkDir::new(&library_root)
                    .into_iter()
                    .filter_map(Result::ok)
                {
                    if !entry.file_type().is_file() {
                        continue;
                    }
                    let relative = entry
                        .path()
                        .strip_prefix(&library_root)
                        .unwrap_or(entry.path())
                        .to_string_lossy()
                        .replace('\\', "/");
                    archive
                        .start_file(format!("library/{relative}"), options)
                        .map_err(zip_error)?;
                    let mut source = File::open(entry.path())?;
                    std::io::copy(&mut source, &mut archive)?;
                }
            }
        }
        archive.finish().map_err(zip_error)?;
        Ok(destination.to_path_buf())
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
                    if !destination.exists() {
                        fs::copy(&source, &destination)?;
                    }
                    self.connection()?.execute(
                        "UPDATE customers SET qr_code_path=?2, updated_at=?3, version=version+1 WHERE id=?1",
                        params![order.customer_id, destination.to_string_lossy().as_ref(), now()],
                    )?;
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
        if path.is_dir() {
            self.rename_legacy_internal_order_folder(order, &mut path)?;
        }
        let next_state = if path.is_dir() { "ready" } else { "failed" };
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

    fn active_managed_customer_folders(
        &self,
        customer_id: &str,
        customer_name: &str,
    ) -> AppResult<Vec<PathBuf>> {
        let Some(library) = self.get_setting("library_root")?.map(PathBuf::from) else {
            return Ok(Vec::new());
        };
        let connection = self.connection()?;
        let mut statement = connection.prepare(
            "SELECT folder_path FROM orders
             WHERE customer_id=?1 AND deleted_at IS NULL AND folder_path IS NOT NULL",
        )?;
        let order_folders = statement
            .query_map(params![customer_id], |row| row.get::<_, String>(0))?
            .collect::<Result<Vec<_>, _>>()?;
        if order_folders.is_empty() {
            return Ok(Vec::new());
        }

        let mut folders = HashSet::new();
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

    fn hide_customer_after_external_folder_delete(&self, customer_id: &str) -> AppResult<()> {
        let mut connection = self.connection()?;
        let transaction = connection.transaction()?;
        let timestamp = now();
        transaction.execute(
            "UPDATE customers SET deleted_at=?2, updated_at=?2, version=version+1
             WHERE id=?1 AND deleted_at IS NULL",
            params![customer_id, timestamp],
        )?;
        transaction.execute(
            "UPDATE orders SET deleted_at=?2, updated_at=?2, version=version+1
             WHERE customer_id=?1 AND deleted_at IS NULL",
            params![customer_id, timestamp],
        )?;
        transaction.execute(
            "UPDATE files SET deleted_at=?2 WHERE customer_id=?1 AND deleted_at IS NULL",
            params![customer_id, timestamp],
        )?;
        transaction.execute(
            "DELETE FROM search_index WHERE entity_type='customer' AND entity_id=?1",
            params![customer_id],
        )?;
        transaction.execute(
            "DELETE FROM search_index WHERE entity_type='order' AND entity_id IN (
                SELECT id FROM orders WHERE customer_id=?1
             )",
            params![customer_id],
        )?;
        transaction.commit()?;
        Ok(())
    }

    fn move_customer_folders_to_recycle(&self, folders: &[PathBuf]) -> AppResult<()> {
        for folder in folders {
            self.move_managed_folder_to_recycle(folder, "客户文件夹")?;
        }
        Ok(())
    }

    fn move_managed_folder_to_recycle(&self, folder: &Path, fallback_name: &str) -> AppResult<()> {
        let Some(library) = self.get_setting("library_root")?.map(PathBuf::from) else {
            return Ok(());
        };
        if !folder.exists() {
            return Ok(());
        }
        if !folder.is_dir() || !folder.starts_with(&library) || folder == library {
            return Ok(());
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
        fs::rename(folder, destination)?;
        Ok(())
    }

    fn sync_file_records(&self, files: Vec<FileRecord>) -> AppResult<Vec<FileRecord>> {
        let Some(library) = self.get_setting("library_root")?.map(PathBuf::from) else {
            return Ok(files);
        };
        let mut visible = Vec::new();
        let mut missing = Vec::new();
        for file in files {
            let path = if Path::new(&file.relative_path).is_absolute() {
                PathBuf::from(&file.relative_path)
            } else {
                library.join(&file.relative_path)
            };
            if path.is_file() {
                visible.push(file);
            } else {
                missing.push(file.id);
            }
        }
        if !missing.is_empty() {
            let timestamp = now();
            let mut connection = self.connection()?;
            let transaction = connection.transaction()?;
            for id in missing {
                transaction.execute(
                    "UPDATE files SET deleted_at=?2 WHERE id=?1 AND deleted_at IS NULL",
                    params![id, timestamp],
                )?;
            }
            transaction.commit()?;
        }
        Ok(visible)
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
        let timestamp = now();
        for (path_key, id) in &existing_by_path {
            if !disk_by_path.contains_key(path_key) {
                transaction.execute(
                    "UPDATE files SET deleted_at=?2 WHERE id=?1 AND deleted_at IS NULL",
                    params![id, timestamp],
                )?;
            }
        }

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
         f.name || ' ' || f.contact_name || ' ' || f.phone || ' ' || f.wechat || ' ' ||
         f.address || ' ' || f.shipping_notes || ' ' || f.notes || ' ' || f.tags_json || ' ' ||
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
            "SELECT f.id, f.name, f.contact_name, f.phone, f.wechat, f.address, f.tags_json,
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
                    row.get::<_, i64>(11)?,
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
        address: row.5,
        tags: serde_json::from_str(&row.6)?,
        shipping_notes: row.7,
        notes: row.8,
        created_at: row.9,
        updated_at: row.10,
        quote_count: row.11,
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

fn dashboard_todo_orders(orders: &[Order], today: &str) -> Vec<Order> {
    let mut todos = orders
        .iter()
        .filter(|order| dashboard_todo_score(order, today).is_some())
        .collect::<Vec<_>>();
    todos.sort_by_key(|order| {
        (
            dashboard_todo_score(order, today).unwrap_or(99),
            order
                .delivery_due_at
                .as_deref()
                .or(order.design_due_at.as_deref())
                .unwrap_or("9999-12-31")
                .to_string(),
            std::cmp::Reverse(order.created_at.clone()),
        )
    });
    todos.into_iter().take(10).cloned().collect()
}

fn dashboard_todo_score(order: &Order, today: &str) -> Option<i32> {
    if order.fulfillment_status == "已签收" || order.fulfillment_status == "已取消" {
        return if order.received_cents < order.total_cents { Some(3) } else { None };
    }
    let due_date = order
        .delivery_due_at
        .as_deref()
        .or(order.design_due_at.as_deref());
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
