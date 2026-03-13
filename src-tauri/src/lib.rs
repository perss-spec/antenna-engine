pub mod types;
pub mod element;
pub mod solver;
pub mod bridge;
pub mod materials;
pub mod core;
pub mod gpu;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            bridge::create_antenna,
            bridge::run_simulation,
            bridge::get_simulation_status,
            bridge::load_touchstone,
            bridge::save_project,
            bridge::load_project,
            bridge::get_gpu_capabilities,
            bridge::run_benchmark,
            bridge::predict_with_ai,
            bridge::optimize_antenna,
            bridge::export_touchstone,
            bridge::generate_report
        ])
        .setup(|app| {
            // Initialize material database
            let materials = materials::MaterialDatabase::new();
            app.manage(materials);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}