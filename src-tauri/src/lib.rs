pub mod core;
pub mod gpu;
mod bridge;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            bridge::get_antenna_templates,
            bridge::simulate_antenna,
            bridge::get_simulation_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
