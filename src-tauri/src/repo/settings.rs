use crate::{
    error::{AppError, Result},
    models::{Settings, SettingsPatch},
};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{de::DeserializeOwned, Serialize};
use serde_json::json;

pub(crate) fn initialize(connection: &Connection) -> Result<()> {
    for (key, value) in [
        (
            "subfolderTemplate",
            json!(["参考资料", "过程稿", "交付成品"]),
        ),
        (
            "paymentMethods",
            json!(["微信", "支付宝", "淘宝", "闲鱼", "银行转账", "现金", "其他"]),
        ),
        (
            "sourcePlatforms",
            json!(["淘宝", "闲鱼", "小红书", "微信", "抖音", "转介绍", "其他"]),
        ),
        ("lastPaymentMethod", json!("微信")),
        ("theme", json!("system")),
        ("lastAutoBackupDate", json!("")),
    ] {
        connection.execute(
            "INSERT INTO settings(key,value) VALUES(?1,?2)",
            params![key, value.to_string()],
        )?;
    }
    Ok(())
}

pub fn read<T: DeserializeOwned>(connection: &Connection, key: &str) -> Result<Option<T>> {
    let value: Option<String> = connection
        .query_row("SELECT value FROM settings WHERE key=?1", [key], |row| {
            row.get(0)
        })
        .optional()?;
    value
        .map(|value| serde_json::from_str(&value).map_err(Into::into))
        .transpose()
}

pub fn write<T: Serialize>(connection: &Connection, key: &str, value: &T) -> Result<()> {
    connection.execute("INSERT INTO settings(key,value) VALUES(?1,?2) ON CONFLICT(key) DO UPDATE SET value=excluded.value", params![key, serde_json::to_string(value)?])?;
    Ok(())
}

pub fn get(connection: &Connection) -> Result<Settings> {
    let mut object = serde_json::Map::new();
    for key in [
        "theme",
        "subfolderTemplate",
        "paymentMethods",
        "sourcePlatforms",
        "lastPaymentMethod",
    ] {
        object.insert(
            key.into(),
            read(connection, key)?.ok_or_else(|| AppError::new("db", "默认设置缺失"))?,
        );
    }
    Ok(serde_json::from_value(object.into())?)
}

pub fn update(connection: &Connection, patch: SettingsPatch) -> Result<Settings> {
    let transaction = connection.unchecked_transaction()?;
    if let Some(value) = patch.theme {
        write(&transaction, "theme", &value)?;
    }
    if let Some(value) = patch.subfolder_template {
        let mut names = std::collections::HashSet::new();
        for name in &value {
            if name != &crate::library::sanitize(name) || !names.insert(name.to_lowercase()) {
                return Err(AppError::invalid("子文件夹模板包含非法名称或重名"));
            }
        }
        write(&transaction, "subfolderTemplate", &value)?;
    }
    if let Some(value) = patch.payment_methods {
        validate_names(&value)?;
        write(&transaction, "paymentMethods", &value)?;
    }
    if let Some(value) = patch.source_platforms {
        validate_names(&value)?;
        write(&transaction, "sourcePlatforms", &value)?;
    }
    if let Some(value) = patch.last_payment_method {
        write(&transaction, "lastPaymentMethod", &value)?;
    }
    let current = get(&transaction)?;
    transaction.commit()?;
    Ok(current)
}

fn validate_names(names: &[String]) -> Result<()> {
    let mut unique = std::collections::HashSet::new();
    for name in names {
        super::nonempty(name, "名称")?;
        if !unique.insert(name.trim().to_lowercase()) {
            return Err(AppError::invalid("名称不能重复"));
        }
    }
    Ok(())
}
