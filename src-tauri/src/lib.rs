pub mod cloud;
pub mod commands;
pub mod db;
pub mod domain;
pub mod import_service;
pub mod models;
pub mod service;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            use tauri::Manager;

            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;

            let app_data = app.path().app_data_dir()?;
            let service = service::AppService::new(app_data.join("workbench.db"))
                .map_err(|error| Box::<dyn std::error::Error>::from(error.to_string()))?;
            if let Ok(documents) = app.path().document_dir() {
                let default_backup = documents.join("创业客户管理工作台备份");
                let _ = service.create_daily_backup(&default_backup);
            }
            app.manage(service);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::choose_directory,
            commands::choose_file,
            commands::choose_save_file,
            commands::read_image_data_url,
            commands::preview_customer_spreadsheet,
            commands::get_settings,
            commands::set_library_root,
            commands::set_backup_dir,
            commands::list_customers,
            commands::list_source_factories,
            commands::create_source_factory,
            commands::update_source_factory,
            commands::delete_source_factory,
            commands::list_source_quotes,
            commands::create_source_quote,
            commands::update_source_quote,
            commands::delete_source_quote,
            commands::create_customer,
            commands::update_customer,
            commands::list_orders,
            commands::sync_managed_library,
            commands::create_order,
            commands::update_order,
            commands::update_order_status,
            commands::delete_order,
            commands::delete_customer,
            commands::add_payment,
            commands::retry_order_folder,
            commands::list_files,
            commands::list_order_folder_files,
            commands::add_order_file,
            commands::delete_file,
            commands::search,
            commands::dashboard,
            commands::import_customers,
            commands::run_backup,
            commands::export_full,
            commands::restore_backup,
            commands::export_cloud_read_model,
            commands::open_in_explorer,
            commands::restart_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running application");
}
