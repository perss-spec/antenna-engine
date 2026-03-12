use serde_json;

#[tauri::command]
pub fn create_antenna(params: serde_json::Value) -> Result<String, String> {
    let _ = params;
    Ok("not implemented".to_string())
}

#[tauri::command]
pub fn run_simulation(config: serde_json::Value) -> Result<String, String> {
    let _ = config;
    Ok("not implemented".to_string())
}

#[tauri::command]
pub fn get_simulation_status() -> Result<String, String> {
    Ok("not implemented".to_string())
}

#[tauri::command]
pub fn load_touchstone(path: String) -> Result<String, String> {
    let _ = path;
    Ok("not implemented".to_string())
}
