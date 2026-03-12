pub mod core;
pub mod gpu;
mod bridge;

pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            bridge::simulate_antenna,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
