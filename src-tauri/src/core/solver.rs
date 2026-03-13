use serde::{Deserialize, Serialize};
use crate::core::types::FieldResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationParams {
    pub frequency: f64,
    pub resolution: usize,
    pub reference_impedance: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FrequencySweepParams {
    pub start_frequency: f64,
    pub stop_frequency: f64,
    pub num_points: usize,
    pub reference_impedance: f64,
    pub resolution: usize,
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
pub struct SimulationResult {
    pub s_params: Vec<SParameterResult>,
    pub field: FieldResult,
    pub num_unknowns: usize,
    pub solver_type: String,
    pub computation_time: f64,
    pub convergence_info: ConvergenceInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConvergenceInfo {
    pub iterations: usize,
    pub residual: f64,
    pub converged: bool,
    pub condition_number: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationProgress {
    pub stage: String,
    pub progress: f64,
    pub message: String,
    pub eta_seconds: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchSimulationParams {
    pub parameter_ranges: std::collections::HashMap<String, (f64, f64)>,
    pub num_samples: usize,
    pub frequency_sweep: FrequencySweepParams,
    pub sampling_method: SamplingMethod,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SamplingMethod {
    Random,
    LatinHypercube,
    Grid,
    Sobol,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatasetEntry {
    pub parameters: std::collections::HashMap<String, f64>,
    pub results: SimulationResult,
    pub metadata: DatasetMetadata,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatasetMetadata {
    pub antenna_type: String,
    pub timestamp: String,
    pub solver_version: String,
    pub convergence_quality: f64,
}