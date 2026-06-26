use std::{fs, io::Read};

use startup_customer_workbench_lib::{
    models::{ImportCustomerRow, NewCustomer},
    service::AppService,
};
use tempfile::tempdir;

fn customer(name: &str, phone: &str) -> NewCustomer {
    NewCustomer {
        name: name.to_string(),
        phone: phone.to_string(),
        wechat: String::new(),
        vip_level: 0,
        notes: String::new(),
        tags: vec![],
        platform_identities: vec![],
        addresses: vec![],
        qr_code_path: None,
    }
}

#[test]
fn imports_valid_rows_skips_errors_and_warns_without_merging_duplicates() {
    let temp = tempdir().unwrap();
    let service = AppService::new(temp.path().join("app.db")).unwrap();
    service
        .create_customer(customer("已有客户", "13800138000"))
        .unwrap();

    let result = service
        .import_customers(vec![
            ImportCustomerRow {
                row_number: 2,
                name: "新客户".to_string(),
                phone: "13900139000".to_string(),
                wechat: "new-user".to_string(),
                platform: "淘宝".to_string(),
                platform_handle: "新店".to_string(),
                notes: String::new(),
                vip_level: 2,
                tags: vec!["首次".to_string()],
            },
            ImportCustomerRow {
                row_number: 3,
                name: String::new(),
                phone: String::new(),
                wechat: String::new(),
                platform: String::new(),
                platform_handle: String::new(),
                notes: String::new(),
                vip_level: 0,
                tags: vec![],
            },
            ImportCustomerRow {
                row_number: 4,
                name: "同号客户".to_string(),
                phone: "13800138000".to_string(),
                wechat: String::new(),
                platform: "微信".to_string(),
                platform_handle: "另一个昵称".to_string(),
                notes: String::new(),
                vip_level: 1,
                tags: vec![],
            },
        ])
        .unwrap();

    assert_eq!(result.imported, 2);
    assert_eq!(result.skipped, 1);
    assert_eq!(result.duplicate_warnings.len(), 1);
    assert_eq!(service.list_customers(false).unwrap().len(), 3);
}

#[test]
fn database_backup_restores_previous_state_and_full_export_contains_library_files() {
    let temp = tempdir().unwrap();
    let service = AppService::new(temp.path().join("app.db")).unwrap();
    let library = temp.path().join("客户文件库");
    fs::create_dir_all(&library).unwrap();
    fs::write(library.join("说明.txt"), "客户文件").unwrap();
    service
        .set_setting("library_root", library.to_string_lossy().as_ref())
        .unwrap();
    service.create_customer(customer("备份前", "100")).unwrap();
    let backup = service
        .create_database_backup(&temp.path().join("backups"))
        .unwrap();
    service.create_customer(customer("备份后", "200")).unwrap();

    service.restore_database_backup(&backup).unwrap();
    assert_eq!(service.list_customers(false).unwrap().len(), 1);

    let archive = temp.path().join("完整导出.zip");
    service.export_full(&archive).unwrap();
    let file = fs::File::open(&archive).unwrap();
    let mut zip = zip::ZipArchive::new(file).unwrap();
    assert!(zip.by_name("database/workbench.db").is_ok());
    let mut library_file = zip.by_name("library/说明.txt").unwrap();
    let mut text = String::new();
    library_file.read_to_string(&mut text).unwrap();
    assert_eq!(text, "客户文件");
}

#[test]
fn exports_versioned_cloud_read_model_json() {
    let temp = tempdir().unwrap();
    let service = AppService::new(temp.path().join("app.db")).unwrap();
    service
        .create_customer(customer("云端查询客户", "18800001111"))
        .unwrap();
    let output = temp.path().join("cloud-read-model.json");

    service.export_cloud_read_model(&output).unwrap();

    let json: serde_json::Value =
        serde_json::from_str(&fs::read_to_string(output).unwrap()).unwrap();
    assert_eq!(json["schemaVersion"], 1);
    assert_eq!(json["customers"][0]["name"], "云端查询客户");
}
