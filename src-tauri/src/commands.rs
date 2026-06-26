use std::{path::PathBuf, process::Command};

use base64::Engine;
use chrono::{DateTime, Utc};
use tauri::State;
use walkdir::WalkDir;

use crate::{
    models::{
        AppSettings, Customer, DashboardSummary, FileRecord, ImportCustomerRow, ImportResult,
        NewCustomer, NewOrder, Order, PaymentInput, SearchHit, SourceFactory, SourceFactoryInput,
        SourceQuote, SourceQuoteInput, SpreadsheetPreview,
    },
    service::AppService,
};

type CommandResult<T> = Result<T, String>;

fn command_error(error: impl std::fmt::Display) -> String {
    error.to_string()
}

#[tauri::command]
pub fn choose_directory() -> Option<String> {
    rfd::FileDialog::new()
        .pick_folder()
        .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn choose_file() -> Option<String> {
    rfd::FileDialog::new()
        .pick_file()
        .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn choose_save_file(default_name: String, extension: String) -> Option<String> {
    rfd::FileDialog::new()
        .set_file_name(default_name)
        .add_filter(extension.to_uppercase(), &[extension.as_str()])
        .save_file()
        .map(|path| path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn read_image_data_url(path: String) -> CommandResult<String> {
    let path = PathBuf::from(path);
    let bytes = std::fs::read(&path).map_err(command_error)?;
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let mime = match extension.as_str() {
        "jpg" | "jpeg" => "image/jpeg",
        "webp" => "image/webp",
        "gif" => "image/gif",
        "svg" => "image/svg+xml",
        _ => "image/png",
    };
    Ok(format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(bytes)
    ))
}

#[tauri::command]
pub fn preview_customer_spreadsheet(path: String) -> CommandResult<SpreadsheetPreview> {
    crate::import_service::preview_spreadsheet(&PathBuf::from(path)).map_err(command_error)
}

#[tauri::command]
pub fn get_settings(service: State<'_, AppService>) -> CommandResult<AppSettings> {
    service.settings().map_err(command_error)
}

#[tauri::command]
pub fn set_library_root(
    service: State<'_, AppService>,
    path: String,
) -> CommandResult<AppSettings> {
    service
        .set_setting("library_root", &path)
        .map_err(command_error)?;
    service.settings().map_err(command_error)
}

#[tauri::command]
pub fn set_backup_dir(service: State<'_, AppService>, path: String) -> CommandResult<AppSettings> {
    service
        .set_setting("backup_dir", &path)
        .map_err(command_error)?;
    service.settings().map_err(command_error)
}

#[tauri::command]
pub fn list_customers(
    service: State<'_, AppService>,
    vip_only: bool,
) -> CommandResult<Vec<Customer>> {
    service.list_customers(vip_only).map_err(command_error)
}

#[tauri::command]
pub fn list_source_factories(service: State<'_, AppService>) -> CommandResult<Vec<SourceFactory>> {
    service.list_source_factories().map_err(command_error)
}

#[tauri::command]
pub fn create_source_factory(
    service: State<'_, AppService>,
    input: SourceFactoryInput,
) -> CommandResult<SourceFactory> {
    service.create_source_factory(input).map_err(command_error)
}

#[tauri::command]
pub fn update_source_factory(
    service: State<'_, AppService>,
    id: String,
    input: SourceFactoryInput,
) -> CommandResult<SourceFactory> {
    service
        .update_source_factory(&id, input)
        .map_err(command_error)
}

#[tauri::command]
pub fn delete_source_factory(service: State<'_, AppService>, id: String) -> CommandResult<()> {
    service.delete_source_factory(&id).map_err(command_error)
}

#[tauri::command]
pub fn list_source_quotes(
    service: State<'_, AppService>,
    factory_id: Option<String>,
) -> CommandResult<Vec<SourceQuote>> {
    service
        .list_source_quotes(factory_id.as_deref())
        .map_err(command_error)
}

#[tauri::command]
pub fn create_source_quote(
    service: State<'_, AppService>,
    input: SourceQuoteInput,
) -> CommandResult<SourceQuote> {
    service.create_source_quote(input).map_err(command_error)
}

#[tauri::command]
pub fn update_source_quote(
    service: State<'_, AppService>,
    id: String,
    input: SourceQuoteInput,
) -> CommandResult<SourceQuote> {
    service
        .update_source_quote(&id, input)
        .map_err(command_error)
}

#[tauri::command]
pub fn delete_source_quote(service: State<'_, AppService>, id: String) -> CommandResult<()> {
    service.delete_source_quote(&id).map_err(command_error)
}

#[tauri::command]
pub fn create_customer(
    service: State<'_, AppService>,
    input: NewCustomer,
) -> CommandResult<Customer> {
    service.create_customer(input).map_err(command_error)
}

#[tauri::command]
pub fn update_customer(
    service: State<'_, AppService>,
    id: String,
    input: NewCustomer,
) -> CommandResult<Customer> {
    service.update_customer(&id, input).map_err(command_error)
}

#[tauri::command]
pub fn list_orders(service: State<'_, AppService>) -> CommandResult<Vec<Order>> {
    service.list_orders().map_err(command_error)
}

#[tauri::command]
pub fn sync_managed_library(service: State<'_, AppService>) -> CommandResult<()> {
    service.sync_managed_library().map_err(command_error)
}

#[tauri::command]
pub fn create_order(service: State<'_, AppService>, input: NewOrder) -> CommandResult<Order> {
    service.create_order(input).map_err(command_error)
}

#[tauri::command]
pub fn update_order_status(
    service: State<'_, AppService>,
    id: String,
    design_status: String,
    fulfillment_status: String,
) -> CommandResult<Order> {
    service
        .update_order_status(&id, &design_status, &fulfillment_status)
        .map_err(command_error)
}

#[tauri::command]
pub fn update_order(
    service: State<'_, AppService>,
    id: String,
    input: NewOrder,
) -> CommandResult<Order> {
    service.update_order(&id, input).map_err(command_error)
}

#[tauri::command]
pub fn delete_order(service: State<'_, AppService>, id: String) -> CommandResult<()> {
    service.delete_order(&id).map_err(command_error)
}

#[tauri::command]
pub fn delete_customer(service: State<'_, AppService>, id: String) -> CommandResult<()> {
    service.delete_customer(&id).map_err(command_error)
}

#[tauri::command]
pub fn add_payment(
    service: State<'_, AppService>,
    order_id: String,
    input: PaymentInput,
) -> CommandResult<Order> {
    service.add_payment(&order_id, input).map_err(command_error)
}

#[tauri::command]
pub fn retry_order_folder(
    service: State<'_, AppService>,
    order_id: String,
) -> CommandResult<Order> {
    service.retry_order_folder(&order_id).map_err(command_error)
}

#[tauri::command]
pub fn list_files(service: State<'_, AppService>) -> CommandResult<Vec<FileRecord>> {
    service.list_files().map_err(command_error)
}

fn file_category(path: &std::path::Path) -> String {
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

fn system_time_to_rfc3339(value: std::time::SystemTime) -> String {
    DateTime::<Utc>::from(value).to_rfc3339()
}

#[tauri::command]
pub fn list_order_folder_files(
    folder_path: String,
    order_id: String,
    customer_id: String,
) -> CommandResult<Vec<FileRecord>> {
    let root = PathBuf::from(folder_path);
    if !root.is_dir() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    for entry in WalkDir::new(&root)
        .min_depth(1)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
    {
        let path = entry.path();
        let metadata = match entry.metadata() {
            Ok(value) => value,
            Err(_) => continue,
        };
        let name = path
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("文件")
            .to_string();
        let modified = metadata
            .modified()
            .map(system_time_to_rfc3339)
            .unwrap_or_else(|_| Utc::now().to_rfc3339());
        let absolute_path = path.to_string_lossy().to_string();
        files.push(FileRecord {
            id: format!("folder-file:{absolute_path}"),
            order_id: Some(order_id.clone()),
            customer_id: customer_id.clone(),
            category: file_category(path),
            name,
            relative_path: absolute_path,
            size_bytes: metadata.len() as i64,
            created_at: modified,
        });
    }
    files.sort_by(|left, right| {
        right
            .created_at
            .cmp(&left.created_at)
            .then_with(|| left.name.cmp(&right.name))
    });
    Ok(files)
}

#[tauri::command]
pub fn add_order_file(
    service: State<'_, AppService>,
    order_id: String,
    source_path: String,
    category: String,
) -> CommandResult<FileRecord> {
    service
        .add_order_file(&order_id, &PathBuf::from(source_path), &category)
        .map_err(command_error)
}

#[tauri::command]
pub fn delete_file(service: State<'_, AppService>, file_id: String) -> CommandResult<()> {
    service
        .move_file_to_recycle_bin(&file_id)
        .map_err(command_error)
}

#[tauri::command]
pub fn search(service: State<'_, AppService>, query: String) -> CommandResult<Vec<SearchHit>> {
    service.search(&query).map_err(command_error)
}

#[tauri::command]
pub fn dashboard(service: State<'_, AppService>) -> CommandResult<DashboardSummary> {
    service.dashboard().map_err(command_error)
}

#[tauri::command]
pub fn import_customers(
    service: State<'_, AppService>,
    rows: Vec<ImportCustomerRow>,
) -> CommandResult<ImportResult> {
    service.import_customers(rows).map_err(command_error)
}

#[tauri::command]
pub fn run_backup(service: State<'_, AppService>, default_dir: String) -> CommandResult<String> {
    service
        .create_daily_backup(&PathBuf::from(default_dir))
        .map(|path| path.to_string_lossy().to_string())
        .map_err(command_error)
}

#[tauri::command]
pub fn export_full(service: State<'_, AppService>, destination: String) -> CommandResult<String> {
    service
        .export_full(&PathBuf::from(destination))
        .map(|path| path.to_string_lossy().to_string())
        .map_err(command_error)
}

#[tauri::command]
pub fn restore_backup(service: State<'_, AppService>, source: String) -> CommandResult<String> {
    service
        .restore_database_backup(&PathBuf::from(source))
        .map(|path| path.to_string_lossy().to_string())
        .map_err(command_error)
}

#[tauri::command]
pub fn export_cloud_read_model(
    service: State<'_, AppService>,
    destination: String,
) -> CommandResult<String> {
    service
        .export_cloud_read_model(&PathBuf::from(destination))
        .map(|path| path.to_string_lossy().to_string())
        .map_err(command_error)
}

#[tauri::command]
pub fn open_in_explorer(path: String) -> CommandResult<()> {
    Command::new("explorer")
        .arg(path)
        .spawn()
        .map(|_| ())
        .map_err(command_error)
}

#[tauri::command]
pub fn restart_app(app: tauri::AppHandle) -> CommandResult<()> {
    app.restart()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lists_files_from_an_order_folder() {
        let directory = tempfile::tempdir().expect("create temp order folder");
        let cdr = directory.path().join("新建 CorelDRAW 2024 Graphic.cdr");
        let txt = directory.path().join("新建 文本文档.txt");
        std::fs::write(&cdr, b"cdr").expect("write cdr");
        std::fs::write(&txt, b"txt").expect("write txt");

        let files = list_order_folder_files(
            directory.path().to_string_lossy().to_string(),
            "order-001".to_string(),
            "customer-lin".to_string(),
        )
        .expect("list order folder files");

        assert_eq!(files.len(), 2);
        assert!(files
            .iter()
            .any(|file| file.name == "新建 CorelDRAW 2024 Graphic.cdr"
                && file.category == "CorelDRAW"
                && file.order_id.as_deref() == Some("order-001")
                && file.customer_id == "customer-lin"));
        assert!(files
            .iter()
            .any(|file| file.name == "新建 文本文档.txt" && file.category == "文本文档"));
    }
}
