use serde::Serialize;

#[derive(Debug, thiserror::Error, Serialize)]
#[error("{message}")]
#[serde(rename_all = "camelCase")]
pub struct AppError {
    pub code: String,
    pub message: String,
}

pub type Result<T> = std::result::Result<T, AppError>;

impl AppError {
    pub fn new(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }

    pub fn invalid(message: impl Into<String>) -> Self {
        Self::new("invalid", message)
    }

    pub fn not_found() -> Self {
        Self::new("notFound", "记录不存在或已删除")
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(error: rusqlite::Error) -> Self {
        match error {
            rusqlite::Error::QueryReturnedNoRows => Self::not_found(),
            rusqlite::Error::SqliteFailure(ref failure, _) if failure.extended_code == 2067 => {
                Self::new("exists", "同名记录已存在")
            }
            rusqlite::Error::SqliteFailure(ref failure, _)
                if failure.code == rusqlite::ErrorCode::ConstraintViolation =>
            {
                Self::invalid("数据不符合约束，请检查关联记录及输入内容")
            }
            _ => {
                eprintln!("数据库操作失败（{error}）");
                Self::new("db", "数据库操作失败，请检查磁盘空间和数据库权限")
            }
        }
    }
}

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        use std::io::ErrorKind;
        eprintln!("文件操作失败（{error}）");
        match error.kind() {
            ErrorKind::AlreadyExists => Self::new("exists", "同名文件或文件夹已存在"),
            ErrorKind::PermissionDenied => {
                Self::new("io", "无法访问文件，请检查权限和文件占用情况")
            }
            ErrorKind::NotFound => Self::new("io", "找不到指定的文件或文件夹"),
            _ => Self::new("io", "文件操作失败，请检查磁盘空间和文件位置"),
        }
    }
}

impl From<serde_json::Error> for AppError {
    fn from(error: serde_json::Error) -> Self {
        eprintln!("数据格式不正确（{error}）");
        Self::invalid("数据格式不正确")
    }
}
