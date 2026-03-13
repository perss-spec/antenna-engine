pub mod core;
pub mod gpu;
pub mod bridge;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            bridge::get_antenna_templates,
            bridge::simulate_antenna,
            bridge::simulate_sweep,
            bridge::get_simulation_status,
            bridge::export_touchstone_s1p
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
