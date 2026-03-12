pub mod core;
pub mod gpu;
mod bridge;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            bridge::create_antenna,
            bridge::run_simulation,
            bridge::get_simulation_status,
            bridge::load_touchstone,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
