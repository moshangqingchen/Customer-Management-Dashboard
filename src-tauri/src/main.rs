#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if let Err(error) = client_desk_lib::run() {
        eprintln!("客户工作台启动失败（{error}）");
        client_desk_lib::portable::show_startup_error(&error);
        std::process::exit(1);
    }
}
