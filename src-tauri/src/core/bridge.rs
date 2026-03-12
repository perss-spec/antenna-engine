use crate::core::types::*;
use tauri::State;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Tauri command interfaces for IPC communication

#[tauri::command]
pub async fn create_antenna(
    params: AntennaParams,
    state: State<'_, Arc<Mutex<AntennaEngine>>>,
) -> Result<String> {
    let engine = state.lock().await;
    engine.create_antenna(params).await
}

#[tauri::command]
pub async fn update_antenna(
    id: String,
    params: AntennaParams,
    state: State<'_, Arc<Mutex<AntennaEngine>>>,
) -> Result<()> {
    let engine = state.lock().await;
    engine.update_antenna(id, params).await
}

#[tauri::command]
pub async fn delete_antenna(
    id: String,
    state: State<'_, Arc<Mutex<AntennaEngine>>>,
) -> Result<()> {
    let engine = state.lock().await;
    engine.delete_antenna(id).await
}

#[tauri::command]
pub async fn start_simulation(
    antenna_id: String,
    params: SimulationParams,
    state: State<'_, Arc<Mutex<AntennaEngine>>>,
) -> Result<String> {
    let engine = state.lock().await;
    engine.start_simulation(antenna_id, params).await
}

#[tauri::command]
pub async fn get_simulation_progress(
    simulation_id: String,
    state: State<'_, Arc<Mutex<AntennaEngine>>>,
) -> Result<SimulationProgress> {
    let engine = state.lock().await;
    engine.get_simulation_progress(simulation_id).await
}

#[tauri::command]
pub async fn get_simulation_results(
    simulation_id: String,
    state: State<'_, Arc<Mutex<AntennaEngine>>>,
) -> Result<SimulationResults> {
    let engine = state.lock().await;
    engine.get_simulation_results(simulation_id).await
}

#[tauri::command]
pub async fn cancel_simulation(
    simulation_id: String,
    state: State<'_, Arc<Mutex<AntennaEngine>>>,
) -> Result<()> {
    let engine = state.lock().await;
    engine.cancel_simulation(simulation_id).await
}

#[tauri::command]
pub async fn start_optimization(
    config: OptimizationConfig,
    state: State<'_, Arc<Mutex<AntennaEngine>>>,
) -> Result<String> {
    let engine = state.lock().await;
    engine.start_optimization(config).await
}

#[tauri::command]
pub async fn get_optimization_progress(
    optimization_id: String,
    state: State<'_, Arc<Mutex<AntennaEngine>>>,
) -> Result<OptimizationProgress> {
    let engine = state.lock().await;
    engine.get_optimization_progress(optimization_id).await
}

#[tauri::command]
pub async fn get_optimization_results(
    optimization_id: String,
    state: State<'_, Arc<Mutex<AntennaEngine>>>,
) -> Result<Vec<Solution>> {
    let engine = state.lock().await;
    engine.get_optimization_results(optimization_id).await
}

#[tauri::command]
pub async fn cancel_optimization(
    optimization_id: String,
    state: State<'_, Arc<Mutex<AntennaEngine>>>,
) -> Result<()> {
    let engine = state.lock().await;
    engine.cancel_optimization(optimization_id).await
}

#[tauri::command]
pub async fn export_results(
    simulation_id: String,
    format: ExportFormat,
    path: String,
    state: State<'_, Arc<Mutex<AntennaEngine>>>,
) -> Result<()> {
    let engine = state.lock().await;
    engine.export_results(simulation_id, format, path).await
}

#[tauri::command]
pub async fn import_antenna(
    path: String,
    format: ImportFormat,
    state: State<'_, Arc<Mutex<AntennaEngine>>>,
) -> Result<AntennaParams> {
    let engine = state.lock().await;
    engine.import_antenna(path, format).await
}

#[tauri::command]
pub async fn get_antenna_mesh(
    antenna_id: String,
    state: State<'_, Arc<Mutex<AntennaEngine>>>,
) -> Result<MeshData> {
    let engine = state.lock().await;
    engine.get_antenna_mesh(antenna_id).await
}

#[tauri::command]
pub async fn evaluate_surrogate_model(
    params: AntennaParams,
    state: State<'_, Arc<Mutex<AntennaEngine>>>,
) -> Result<SimulationResults> {
    let engine = state.lock().await;
    engine.evaluate_surrogate_model(params).await
}

#[tauri::command]
pub async fn train_surrogate_model(
    dataset_path: String,
    model_config: SurrogateModelConfig,
    state: State<'_, Arc<Mutex<AntennaEngine>>>,
) -> Result<String> {
    let engine = state.lock().await;
    engine.train_surrogate_model(dataset_path, model_config).await
}

/// Additional types for bridge commands
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ExportFormat {
    Json,
    Csv,
    Touchstone,
    Matlab,
    Vtu,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ImportFormat {
    Json,
    Stl,
    Step,
    Gerber,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeshData {
    pub vertices: Vec<Vec3>,
    pub triangles: Vec<[u32; 3]>,
    pub normals: Vec<Vec3>,
    pub edges: Vec<[u32; 2]>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SurrogateModelConfig {
    pub model_type: String,
    pub input_features: Vec<String>,
    pub output_features: Vec<String>,
    pub hyperparameters: HashMap<String, f64>,
}

/// Trait that the AntennaEngine must implement
#[async_trait::async_trait]
pub trait AntennaEngineInterface {
    async fn create_antenna(&self, params: AntennaParams) -> Result<String>;
    async fn update_antenna(&self, id: String, params: AntennaParams) -> Result<()>;
    async fn delete_antenna(&self, id: String) -> Result<()>;
    async fn start_simulation(&self, antenna_id: String, params: SimulationParams) -> Result<String>;
    async fn get_simulation_progress(&self, simulation_id: String) -> Result<SimulationProgress>;
    async fn get_simulation_results(&self, simulation_id: String) -> Result<SimulationResults>;
    async fn cancel_simulation(&self, simulation_id: String) -> Result<()>;
    async fn start_optimization(&self, config: OptimizationConfig) -> Result<String>;
    async fn get_optimization_progress(&self, optimization_id: String) -> Result<OptimizationProgress>;
    async fn get_optimization_results(&self, optimization_id: String) -> Result<Vec<Solution>>;
    async fn cancel_optimization(&self, optimization_id: String) -> Result<()>;
    async fn export_results(&self, simulation_id: String, format: ExportFormat, path: String) -> Result<()>;
    async fn import_antenna(&self, path: String, format: ImportFormat) -> Result<AntennaParams>;
    async fn get_antenna_mesh(&self, antenna_id: String) -> Result<MeshData>;
    async fn evaluate_surrogate_model(&self, params: AntennaParams) -> Result<SimulationResults>;
    async fn train_surrogate_model(&self, dataset_path: String, model_config: SurrogateModelConfig) -> Result<String>;
}