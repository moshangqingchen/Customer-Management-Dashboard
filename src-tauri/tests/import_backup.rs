use std::{fs, io::Read, path::Path};

use startup_customer_workbench_lib::{
    models::{CustomerImportOperation, ImportCustomerRow, NewCustomer},
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
fn customer_import_batch_is_atomic_and_idempotent() {
    let temp = tempdir().unwrap();
    let service = AppService::new(temp.path().join("app.db")).unwrap();
    let existing = service
        .create_customer(customer("原客户", "13800138000"))
        .unwrap();

    let failed = service.apply_customer_import(
        "atomic-failure",
        vec![
            CustomerImportOperation {
                row_number: 2,
                action: "update".to_string(),
                customer_id: Some(existing.id.clone()),
                customer: Some(customer("不应保留的更新", "13800138000")),
            },
            CustomerImportOperation {
                row_number: 3,
                action: "create".to_string(),
                customer_id: None,
                customer: Some(customer("", "13900139000")),
            },
        ],
    );
    assert!(failed.is_err());
    assert_eq!(
        service.get_customer(&existing.id).unwrap().unwrap().name,
        "原客户"
    );
    assert_eq!(service.list_customers(false).unwrap().len(), 1);

    let operations = vec![
        CustomerImportOperation {
            row_number: 2,
            action: "update".to_string(),
            customer_id: Some(existing.id.clone()),
            customer: Some(customer("已更新客户", "13800138000")),
        },
        CustomerImportOperation {
            row_number: 3,
            action: "create".to_string(),
            customer_id: None,
            customer: Some(customer("新客户", "13900139000")),
        },
        CustomerImportOperation {
            row_number: 4,
            action: "skip".to_string(),
            customer_id: None,
            customer: None,
        },
    ];
    let first = service
        .apply_customer_import("stable-batch", operations.clone())
        .unwrap();
    let retry = service
        .apply_customer_import("stable-batch", operations)
        .unwrap();

    assert_eq!(first.imported, 1);
    assert_eq!(first.updated, 1);
    assert_eq!(first.skipped, 1);
    assert_eq!(retry.imported, first.imported);
    assert_eq!(service.list_customers(false).unwrap().len(), 2);
    assert_eq!(
        service.get_customer(&existing.id).unwrap().unwrap().name,
        "已更新客户"
    );
}

#[test]
fn imports_valid_rows_and_safely_skips_errors_and_phone_duplicates() {
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

    assert_eq!(result.imported, 1);
    assert_eq!(result.skipped, 2);
    assert_eq!(result.duplicate_warnings.len(), 1);
    assert_eq!(service.list_customers(false).unwrap().len(), 2);
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
fn full_archive_round_trip_restores_database_and_library_to_a_new_root() {
    let temp = tempdir().unwrap();
    let service = AppService::new(temp.path().join("app.db")).unwrap();
    let library = temp.path().join("原文件库");
    fs::create_dir_all(library.join("客户甲")).unwrap();
    fs::write(library.join("客户甲").join("设计稿.txt"), "归档内容").unwrap();
    service.set_library_root(&library).unwrap();
    service
        .create_customer(customer("归档客户", "100"))
        .unwrap();
    let archive = temp.path().join("完整归档.zip");
    service.export_full(&archive).unwrap();

    service
        .create_customer(customer("归档后新增", "200"))
        .unwrap();
    fs::write(library.join("不应恢复.txt"), "newer").unwrap();
    let target = temp.path().join("恢复后的文件库");
    fs::create_dir(&target).unwrap();

    let restored = service.restore_full_archive(&archive, &target).unwrap();

    let customers = service.list_customers(false).unwrap();
    assert_eq!(customers.len(), 1);
    assert_eq!(customers[0].name, "归档客户");
    assert_eq!(
        fs::read_to_string(target.join("客户甲").join("设计稿.txt")).unwrap(),
        "归档内容"
    );
    assert!(!target.join("不应恢复.txt").exists());
    assert_eq!(restored.restored_files, 1);
    assert!(Path::new(&restored.safety_backup_path).is_file());
    assert!(library.is_dir());
    assert_eq!(
        service.settings().unwrap().library_root.as_deref(),
        Some(target.to_string_lossy().as_ref())
    );
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

#[test]
fn stores_only_allowlisted_json_preferences_in_the_database() {
    let temp = tempdir().unwrap();
    let service = AppService::new(temp.path().join("app.db")).unwrap();

    service
        .set_app_preference("quick_reply_library", "[{\"id\":\"demo\"}]")
        .unwrap();

    assert_eq!(
        service
            .get_app_preference("quick_reply_library")
            .unwrap()
            .as_deref(),
        Some("[{\"id\":\"demo\"}]")
    );
    assert!(service
        .set_app_preference("quick_reply_library", "not-json")
        .is_err());
    assert!(service.get_app_preference("arbitrary_setting").is_err());
}
