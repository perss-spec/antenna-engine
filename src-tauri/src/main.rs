#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod core;
mod gpu;
mod bridge;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            bridge::simulate_antenna,
            bridge::sweep_frequencies,
            bridge::predict_antenna,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}