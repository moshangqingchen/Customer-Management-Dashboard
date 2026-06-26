use std::fs;

use chrono::Local;
use rusqlite::params;
use startup_customer_workbench_lib::{
    domain::folder_names::order_folder_name,
    models::{
        AddressInput, NewCustomer, NewOrder, OrderItemInput, PaymentInput, SourceFactoryInput,
        SourceQuoteInput,
    },
    service::AppService,
};
use tempfile::tempdir;

fn sample_address(label: &str, address: &str) -> AddressInput {
    AddressInput {
        label: label.to_string(),
        recipient: "林女士".to_string(),
        phone: "13800138000".to_string(),
        address: address.to_string(),
    }
}

fn sample_customer() -> NewCustomer {
    NewCustomer {
        name: "林女士".to_string(),
        phone: "13800138000".to_string(),
        wechat: "lin-design".to_string(),
        vip_level: 3,
        notes: "喜欢暖色设计".to_string(),
        tags: vec!["复购".to_string()],
        platform_identities: vec![
            startup_customer_workbench_lib::models::PlatformIdentityInput {
                platform: "闲鱼".to_string(),
                handle: "林林的店".to_string(),
                account: "xy-1001".to_string(),
            },
        ],
        addresses: vec![
            sample_address("公司", "上海市浦东新区创意路 18 号"),
            sample_address("家里", "上海市黄浦区复购路 88 号"),
        ],
        qr_code_path: None,
    }
}

fn sample_order(customer_id: &str, external_order_no: &str) -> NewOrder {
    NewOrder {
        customer_id: customer_id.to_string(),
        platform: "闲鱼".to_string(),
        platform_account: "林林的店".to_string(),
        external_order_no: external_order_no.to_string(),
        design_status: "待设计".to_string(),
        fulfillment_status: "待处理".to_string(),
        design_due_at: Some("2026-06-08".to_string()),
        delivery_due_at: Some("2026-06-10".to_string()),
        notes: "A4宣传单".to_string(),
        tags: vec!["加急".to_string()],
        items: vec![
            OrderItemInput {
                item_type: "设计".to_string(),
                name: "宣传单设计".to_string(),
                quantity: 1,
                unit_price_cents: 8_000,
                print_spec: None,
                source_quote_id: None,
                source_factory_id: None,
                source_factory_name: String::new(),
                source_quote_summary: String::new(),
                source_production_cost_cents: 0,
                source_shipping_cost_cents: 0,
            },
            OrderItemInput {
                item_type: "打印".to_string(),
                name: "A4彩印".to_string(),
                quantity: 100,
                unit_price_cents: 80,
                print_spec: Some("A4|铜版纸|双面|彩色|覆膜".to_string()),
                source_quote_id: None,
                source_factory_id: None,
                source_factory_name: String::new(),
                source_quote_summary: String::new(),
                source_production_cost_cents: 0,
                source_shipping_cost_cents: 0,
            },
        ],
        shipment_company: "顺丰".to_string(),
        shipment_tracking_no: "SF123456".to_string(),
        shipping_address: Some(sample_address("公司", "上海市浦东新区创意路 18 号")),
    }
}

fn sample_source_factory() -> SourceFactoryInput {
    SourceFactoryInput {
        name: "华彩印刷源头厂".to_string(),
        contact_name: "陈经理".to_string(),
        phone: "020-88886012".to_string(),
        wechat: "huacai-print".to_string(),
        qq: "285001234".to_string(),
        address: "广州市白云区印刷产业园".to_string(),
        tags: vec!["名片".to_string(), "铜版纸".to_string()],
        shipping_notes: "小件 8 元起".to_string(),
        notes: "常规印刷稳定".to_string(),
    }
}

fn sample_source_quote(factory_id: &str) -> SourceQuoteInput {
    SourceQuoteInput {
        factory_id: factory_id.to_string(),
        item_type: "印刷".to_string(),
        item_name: "A4彩印".to_string(),
        quantity: 100,
        size: "A4 210×297mm".to_string(),
        material: "铜版纸".to_string(),
        paper_weight: "157g".to_string(),
        sides: "双面".to_string(),
        color: "彩色".to_string(),
        finish: "覆膜 / 裁切".to_string(),
        production_cost_cents: 6_800,
        shipping_cost_cents: 1_200,
        lead_time: "1-2 天".to_string(),
        notes: "小批量宣传单".to_string(),
    }
}

#[test]
fn first_order_creates_customer_tree_and_repeat_order_only_adds_order_folder() {
    let temp = tempdir().unwrap();
    let service = AppService::new(temp.path().join("app.db")).unwrap();
    let library = temp.path().join("客户文件库");
    service
        .set_setting("library_root", library.to_string_lossy().as_ref())
        .unwrap();
    let qr_source = temp.path().join("客户二维码.png");
    fs::write(&qr_source, b"qr-image").unwrap();
    let mut input = sample_customer();
    input.qr_code_path = Some(qr_source.to_string_lossy().to_string());
    let customer = service.create_customer(input).unwrap();

    let first = service
        .create_order(sample_order(&customer.id, "XY-001"))
        .unwrap();
    let customer_dir = library.join(format!("林女士_[{}]", &customer.id[..8]));
    assert!(customer_dir.join("客户资料").is_dir());
    assert!(customer_dir
        .join("客户资料")
        .join("客户二维码.png")
        .is_file());
    assert!(service
        .get_customer(&customer.id)
        .unwrap()
        .unwrap()
        .qr_code_path
        .is_some_and(|path| path.ends_with("客户二维码.png")));
    assert!(first
        .folder_path
        .as_ref()
        .is_some_and(|path| fs::metadata(path).is_ok()));

    let second = service
        .create_order(sample_order(&customer.id, "XY-002"))
        .unwrap();
    let order_entries = fs::read_dir(customer_dir.join("订单")).unwrap().count();
    assert_eq!(order_entries, 2);
    assert_ne!(first.folder_path, second.folder_path);
}

#[test]
fn internal_order_folder_uses_project_names_instead_of_internal_order_label() {
    let temp = tempdir().unwrap();
    let service = AppService::new(temp.path().join("app.db")).unwrap();
    let library = temp.path().join("客户文件库");
    service
        .set_setting("library_root", library.to_string_lossy().as_ref())
        .unwrap();
    let customer = service.create_customer(sample_customer()).unwrap();

    let order = service
        .create_order(sample_order(&customer.id, ""))
        .unwrap();
    let folder_path = order.folder_path.as_deref().unwrap();

    assert!(folder_path.contains("宣传单设计、A4彩印"));
    assert!(!folder_path.contains("内部订单"));
    assert!(std::path::Path::new(folder_path).is_dir());
}

#[test]
fn legacy_internal_order_folder_is_renamed_to_project_name_when_loaded() {
    let temp = tempdir().unwrap();
    let service = AppService::new(temp.path().join("app.db")).unwrap();
    let library = temp.path().join("客户文件库");
    service
        .set_setting("library_root", library.to_string_lossy().as_ref())
        .unwrap();
    let customer = service.create_customer(sample_customer()).unwrap();
    let order = service
        .create_order(sample_order(&customer.id, ""))
        .unwrap();
    let desired_folder = std::path::PathBuf::from(order.folder_path.as_ref().unwrap());
    let legacy_folder = desired_folder.parent().unwrap().join(order_folder_name(
        &order.created_at[..10],
        "内部订单",
        &order.id[..8],
    ));
    fs::rename(&desired_folder, &legacy_folder).unwrap();
    rusqlite::Connection::open(service.db_path())
        .unwrap()
        .execute(
            "UPDATE orders SET folder_path=?2 WHERE id=?1",
            params![order.id, legacy_folder.to_string_lossy().as_ref()],
        )
        .unwrap();

    let synced = service.get_order(&order.id).unwrap().unwrap();

    assert_eq!(
        synced.folder_path.as_deref(),
        Some(desired_folder.to_string_lossy().as_ref())
    );
    assert!(desired_folder.is_dir());
    assert!(!legacy_folder.exists());
}

#[test]
fn keeps_order_when_library_root_is_not_writable_and_marks_folder_failed() {
    let temp = tempdir().unwrap();
    let service = AppService::new(temp.path().join("app.db")).unwrap();
    let invalid_root = temp.path().join("not-a-folder");
    fs::write(&invalid_root, "occupied").unwrap();
    service
        .set_setting("library_root", invalid_root.to_string_lossy().as_ref())
        .unwrap();
    let customer = service.create_customer(sample_customer()).unwrap();

    let order = service
        .create_order(sample_order(&customer.id, "XY-FAIL"))
        .unwrap();

    assert_eq!(order.folder_state, "failed");
    assert!(service.get_order(&order.id).unwrap().is_some());
}

#[test]
fn copies_duplicate_files_with_versioned_names_and_searches_across_entities() {
    let temp = tempdir().unwrap();
    let service = AppService::new(temp.path().join("app.db")).unwrap();
    let library = temp.path().join("客户文件库");
    service
        .set_setting("library_root", library.to_string_lossy().as_ref())
        .unwrap();
    let customer = service.create_customer(sample_customer()).unwrap();
    let order = service
        .create_order(sample_order(&customer.id, "XY-SEARCH-001"))
        .unwrap();
    let source = temp.path().join("成品.png");
    fs::write(&source, b"image-data").unwrap();

    let first = service.add_order_file(&order.id, &source, "成品").unwrap();
    let second = service.add_order_file(&order.id, &source, "成品").unwrap();

    assert!(first.relative_path.ends_with("成品.png"));
    assert!(second.relative_path.ends_with("成品 (2).png"));
    assert!(!service.search("林林的店").unwrap().is_empty());
    assert!(!service.search("13800138000").unwrap().is_empty());
    assert!(!service.search("1380013").unwrap().is_empty());
    assert!(!service.search("SF123456").unwrap().is_empty());
    assert!(!service.search("创意路 18 号").unwrap().is_empty());
    assert!(!service.search("SEARCH-001").unwrap().is_empty());
    assert!(!service.search("XY-SEARCH-001").unwrap().is_empty());
}

#[test]
fn manages_source_quotes_and_preserves_order_cost_snapshots() {
    let temp = tempdir().unwrap();
    let service = AppService::new(temp.path().join("app.db")).unwrap();

    let mut invalid_factory = sample_source_factory();
    invalid_factory.name = "  ".to_string();
    assert!(service.create_source_factory(invalid_factory).is_err());

    let factory = service
        .create_source_factory(sample_source_factory())
        .unwrap();
    assert_eq!(factory.qq, "285001234");
    let mut invalid_quote = sample_source_quote(&factory.id);
    invalid_quote.item_name = String::new();
    assert!(service.create_source_quote(invalid_quote).is_err());
    let mut invalid_quote = sample_source_quote(&factory.id);
    invalid_quote.quantity = 0;
    assert!(service.create_source_quote(invalid_quote).is_err());
    let mut invalid_quote = sample_source_quote(&factory.id);
    invalid_quote.production_cost_cents = -1;
    assert!(service.create_source_quote(invalid_quote).is_err());

    let quote = service
        .create_source_quote(sample_source_quote(&factory.id))
        .unwrap();
    assert_eq!(
        service
            .list_source_factories()
            .unwrap()
            .first()
            .unwrap()
            .quote_count,
        1
    );
    assert!(service
        .search("铜版纸")
        .unwrap()
        .iter()
        .any(|hit| hit.entity_type == "factory" && hit.entity_id == factory.id));
    assert!(service
        .search("285001234")
        .unwrap()
        .iter()
        .any(|hit| hit.entity_type == "factory" && hit.entity_id == factory.id));

    let customer = service.create_customer(sample_customer()).unwrap();
    let mut input = sample_order(&customer.id, "XY-SOURCE-COST");
    input.items[1].source_quote_id = Some(quote.id.clone());
    input.items[1].source_factory_id = Some(factory.id.clone());
    input.items[1].source_factory_name = factory.name.clone();
    input.items[1].source_quote_summary =
        "A4彩印 / 100 / A4 210×297mm / 铜版纸 157g / 覆膜 / 裁切".to_string();
    input.items[1].source_production_cost_cents = quote.production_cost_cents;
    input.items[1].source_shipping_cost_cents = quote.shipping_cost_cents;

    let order = service.create_order(input).unwrap();
    let saved_item = order
        .items
        .iter()
        .find(|item| item.name == "A4彩印")
        .unwrap();
    assert_eq!(saved_item.source_factory_name, "华彩印刷源头厂");
    assert_eq!(saved_item.source_production_cost_cents, 6_800);
    assert_eq!(saved_item.source_shipping_cost_cents, 1_200);

    let mut changed_quote = sample_source_quote(&factory.id);
    changed_quote.production_cost_cents = 99_900;
    service
        .update_source_quote(&quote.id, changed_quote)
        .unwrap();
    service.delete_source_quote(&quote.id).unwrap();
    service.delete_source_factory(&factory.id).unwrap();

    let unchanged = service.get_order(&order.id).unwrap().unwrap();
    let unchanged_item = unchanged
        .items
        .iter()
        .find(|item| item.name == "A4彩印")
        .unwrap();
    assert_eq!(unchanged_item.source_factory_name, "华彩印刷源头厂");
    assert_eq!(unchanged_item.source_production_cost_cents, 6_800);
    assert_eq!(unchanged_item.source_shipping_cost_cents, 1_200);
}

#[test]
fn order_keeps_selected_shipping_address_and_can_update_logistics() {
    let temp = tempdir().unwrap();
    let service = AppService::new(temp.path().join("app.db")).unwrap();
    let library = temp.path().join("客户文件库");
    service
        .set_setting("library_root", library.to_string_lossy().as_ref())
        .unwrap();
    let customer = service.create_customer(sample_customer()).unwrap();

    let mut input = sample_order(&customer.id, "XY-ADDR-001");
    input.shipping_address = Some(sample_address("家里", "上海市黄浦区复购路 88 号"));
    let order = service.create_order(input.clone()).unwrap();

    assert_eq!(
        order
            .shipping_address
            .as_ref()
            .map(|address| address.label.as_str()),
        Some("家里")
    );
    assert_eq!(
        order
            .shipping_address
            .as_ref()
            .map(|address| address.address.as_str()),
        Some("上海市黄浦区复购路 88 号")
    );

    input.shipment_company = "中通".to_string();
    input.shipment_tracking_no = "ZT99887766".to_string();
    input.shipping_address = Some(sample_address("公司", "上海市浦东新区创意路 18 号"));
    let updated = service.update_order(&order.id, input).unwrap();

    assert_eq!(updated.shipment_company, "中通");
    assert_eq!(updated.shipment_tracking_no, "ZT99887766");
    assert_eq!(
        updated
            .shipping_address
            .as_ref()
            .map(|address| address.address.as_str()),
        Some("上海市浦东新区创意路 18 号")
    );
}

#[test]
fn soft_deletes_orders_and_customers_from_active_lists() {
    let temp = tempdir().unwrap();
    let service = AppService::new(temp.path().join("app.db")).unwrap();
    let library = temp.path().join("客户文件库");
    service
        .set_setting("library_root", library.to_string_lossy().as_ref())
        .unwrap();
    let customer = service.create_customer(sample_customer()).unwrap();
    let order = service
        .create_order(sample_order(&customer.id, "XY-DELETE-001"))
        .unwrap();

    service.delete_order(&order.id).unwrap();
    assert!(service.get_order(&order.id).unwrap().is_none());
    assert!(service
        .list_orders()
        .unwrap()
        .iter()
        .all(|item| item.id != order.id));

    service.delete_customer(&customer.id).unwrap();
    assert!(service.get_customer(&customer.id).unwrap().is_none());
    assert!(service
        .list_customers(false)
        .unwrap()
        .iter()
        .all(|item| item.id != customer.id));
}

#[test]
fn deleting_customer_removes_the_managed_customer_folder() {
    let temp = tempdir().unwrap();
    let service = AppService::new(temp.path().join("app.db")).unwrap();
    let library = temp.path().join("客户文件库");
    service
        .set_setting("library_root", library.to_string_lossy().as_ref())
        .unwrap();
    let customer = service.create_customer(sample_customer()).unwrap();
    let order = service
        .create_order(sample_order(&customer.id, "XY-FOLDER-DELETE"))
        .unwrap();
    let folder = std::path::PathBuf::from(order.folder_path.unwrap());
    let customer_folder = folder
        .parent()
        .and_then(|path| path.parent())
        .unwrap()
        .to_path_buf();
    assert!(customer_folder.is_dir());

    service.delete_customer(&customer.id).unwrap();

    assert!(!customer_folder.exists());
}

#[test]
fn deleting_order_removes_only_that_managed_order_folder() {
    let temp = tempdir().unwrap();
    let service = AppService::new(temp.path().join("app.db")).unwrap();
    let library = temp.path().join("客户文件库");
    service
        .set_setting("library_root", library.to_string_lossy().as_ref())
        .unwrap();
    let customer = service.create_customer(sample_customer()).unwrap();
    let first = service
        .create_order(sample_order(&customer.id, "XY-ORDER-DELETE-1"))
        .unwrap();
    let second = service
        .create_order(sample_order(&customer.id, "XY-ORDER-DELETE-2"))
        .unwrap();
    let first_folder = std::path::PathBuf::from(first.folder_path.as_ref().unwrap());
    let second_folder = std::path::PathBuf::from(second.folder_path.as_ref().unwrap());
    let customer_folder = first_folder
        .parent()
        .and_then(|path| path.parent())
        .unwrap()
        .to_path_buf();
    assert!(first_folder.is_dir());
    assert!(second_folder.is_dir());

    service.delete_order(&first.id).unwrap();

    assert!(!first_folder.exists());
    assert!(second_folder.exists());
    assert!(customer_folder.exists());
    assert!(service.get_order(&first.id).unwrap().is_none());
}

#[test]
fn externally_deleted_order_folder_is_reflected_when_orders_are_loaded() {
    let temp = tempdir().unwrap();
    let service = AppService::new(temp.path().join("app.db")).unwrap();
    let library = temp.path().join("客户文件库");
    service
        .set_setting("library_root", library.to_string_lossy().as_ref())
        .unwrap();
    let customer = service.create_customer(sample_customer()).unwrap();
    let order = service
        .create_order(sample_order(&customer.id, "XY-FOLDER-SYNC"))
        .unwrap();
    let folder = std::path::PathBuf::from(order.folder_path.as_ref().unwrap());
    assert!(folder.is_dir());

    fs::remove_dir_all(&folder).unwrap();

    let synced = service.get_order(&order.id).unwrap().unwrap();
    assert_eq!(synced.folder_state, "failed");
    assert_eq!(synced.folder_path, order.folder_path);
}

#[test]
fn syncing_managed_library_hides_customers_whose_managed_folder_was_deleted() {
    let temp = tempdir().unwrap();
    let service = AppService::new(temp.path().join("app.db")).unwrap();
    let library = temp.path().join("客户文件库");
    service
        .set_setting("library_root", library.to_string_lossy().as_ref())
        .unwrap();
    let customer = service.create_customer(sample_customer()).unwrap();
    let order = service
        .create_order(sample_order(&customer.id, "XY-FOLDER-REMOVED"))
        .unwrap();
    let order_folder = std::path::PathBuf::from(order.folder_path.as_ref().unwrap());
    let customer_folder = order_folder
        .parent()
        .and_then(|path| path.parent())
        .unwrap()
        .to_path_buf();
    assert!(customer_folder.is_dir());

    fs::remove_dir_all(&customer_folder).unwrap();

    service.sync_managed_library().unwrap();

    assert!(service.get_customer(&customer.id).unwrap().is_none());
    assert!(service.get_order(&order.id).unwrap().is_none());
    assert!(service
        .list_customers(false)
        .unwrap()
        .iter()
        .all(|item| item.id != customer.id));
    assert!(service
        .list_orders()
        .unwrap()
        .iter()
        .all(|item| item.id != order.id));
}

#[test]
fn syncing_managed_library_reconciles_external_order_folder_file_changes() {
    let temp = tempdir().unwrap();
    let service = AppService::new(temp.path().join("app.db")).unwrap();
    let library = temp.path().join("客户文件库");
    service
        .set_setting("library_root", library.to_string_lossy().as_ref())
        .unwrap();
    let customer = service.create_customer(sample_customer()).unwrap();
    let order = service
        .create_order(sample_order(&customer.id, "XY-FILE-SYNC"))
        .unwrap();
    let order_folder = std::path::PathBuf::from(order.folder_path.as_ref().unwrap());
    let source = temp.path().join("已上传.png");
    fs::write(&source, b"uploaded").unwrap();
    let uploaded = service
        .add_order_file(&order.id, &source, "订单文件")
        .unwrap();
    assert!(service
        .list_files()
        .unwrap()
        .iter()
        .any(|file| file.id == uploaded.id));

    fs::remove_file(order_folder.join(&uploaded.name)).unwrap();
    fs::write(order_folder.join("手工加入.png"), b"external").unwrap();

    service.sync_managed_library().unwrap();

    let files = service.list_files().unwrap();
    assert!(files.iter().all(|file| file.id != uploaded.id));
    let external = files
        .iter()
        .find(|file| file.name == "手工加入.png")
        .expect("external file should be imported");
    assert_eq!(external.order_id.as_deref(), Some(order.id.as_str()));
    assert_eq!(external.customer_id, customer.id);
    assert_eq!(external.category, "图片文件");
}

#[test]
fn dashboard_ignores_payments_from_deleted_orders() {
    let temp = tempdir().unwrap();
    let service = AppService::new(temp.path().join("app.db")).unwrap();
    let library = temp.path().join("客户文件库");
    service
        .set_setting("library_root", library.to_string_lossy().as_ref())
        .unwrap();
    let customer = service.create_customer(sample_customer()).unwrap();
    let order = service
        .create_order(sample_order(&customer.id, "XY-DASHBOARD-PAYMENT"))
        .unwrap();
    service
        .add_payment(
            &order.id,
            PaymentInput {
                amount_cents: 2_000,
                paid_at: Local::now().format("%Y-%m-%d").to_string(),
                method: "微信".to_string(),
                notes: "".to_string(),
            },
        )
        .unwrap();
    assert_eq!(service.dashboard().unwrap().month_revenue_cents, 2_000);

    service.delete_order(&order.id).unwrap();

    let summary = service.dashboard().unwrap();
    assert!(summary.recent_orders.is_empty());
    assert_eq!(summary.month_revenue_cents, 0);
}

#[test]
fn dashboard_surfaces_actionable_todo_orders() {
    let temp = tempdir().unwrap();
    let service = AppService::new(temp.path().join("app.db")).unwrap();
    let library = temp.path().join("客户文件库");
    service
        .set_setting("library_root", library.to_string_lossy().as_ref())
        .unwrap();
    let customer = service.create_customer(sample_customer()).unwrap();

    let unpaid_order = service
        .create_order(NewOrder {
            external_order_no: "XY-TODO-UNPAID".to_string(),
            design_status: "设计完成".to_string(),
            fulfillment_status: "已签收".to_string(),
            delivery_due_at: Some(Local::now().format("%Y-%m-%d").to_string()),
            ..sample_order(&customer.id, "XY-TODO-UNPAID")
        })
        .unwrap();
    service
        .add_payment(
            &unpaid_order.id,
            PaymentInput {
                amount_cents: 2_000,
                paid_at: Local::now().format("%Y-%m-%d").to_string(),
                method: "微信".to_string(),
                notes: "".to_string(),
            },
        )
        .unwrap();

    let ready_order = service
        .create_order(NewOrder {
            external_order_no: "XY-TODO-DONE".to_string(),
            design_status: "设计完成".to_string(),
            fulfillment_status: "已签收".to_string(),
            delivery_due_at: Some(Local::now().format("%Y-%m-%d").to_string()),
            ..sample_order(&customer.id, "XY-TODO-DONE")
        })
        .unwrap();
    service
        .add_payment(
            &ready_order.id,
            PaymentInput {
                amount_cents: ready_order.total_cents,
                paid_at: Local::now().format("%Y-%m-%d").to_string(),
                method: "微信".to_string(),
                notes: "".to_string(),
            },
        )
        .unwrap();

    let summary = service.dashboard().unwrap();
    assert!(summary
        .todo_orders
        .iter()
        .any(|order| order.external_order_no == "XY-TODO-UNPAID"));
    assert!(!summary
        .todo_orders
        .iter()
        .any(|order| order.external_order_no == "XY-TODO-DONE"));
}
