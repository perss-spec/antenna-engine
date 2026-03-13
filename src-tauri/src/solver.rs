use serde::{Deserialize, Serialize};
use crate::types::Point3D;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationParams {
    pub frequency: f64,
    pub resolution: usize,
    pub reference_impedance: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationConfig {
    pub start_frequency: f64,
    pub stop_frequency: f64,
    pub num_points: usize,
    pub reference_impedance: f64,
    pub use_gpu: bool,
    pub solver_type: String,
    pub convergence_threshold: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SParameterResult {
    pub frequency: f64,
    pub s11_re: f64,
    pub s11_im: f64,
    pub vswr: f64,
    pub input_impedance_re: f64,
    pub input_impedance_im: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldResult {
    pub points: Vec<Point3D>,
    pub e_field: Vec<Point3D>,
    pub h_field: Vec<Point3D>,
    pub power_density: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RadiationPattern {
    pub theta: Vec<f64>,
    pub phi: Vec<f64>,
    pub gain_db: Vec<Vec<f64>>,
    pub directivity_db: f64,
    pub efficiency: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationResult {
    pub s_params: Vec<SParameterResult>,
    pub field: Option<FieldResult>,
    pub radiation_pattern: Option<RadiationPattern>,
    pub num_unknowns: usize,
    pub solver_type: String,
    pub computation_time_ms: f64,
    pub memory_used_mb: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationProgress {
    pub stage: String,
    pub progress: f64,
    pub eta_seconds: Option<f64>,
    pub current_frequency: Option<f64>,
}