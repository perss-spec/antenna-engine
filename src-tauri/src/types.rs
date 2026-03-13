use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Point3D {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AntennaError {
    InvalidGeometry,
    SimulationFailed,
    InvalidParameter,
    NumericalError,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Material {
    pub name: String,
    pub epsilon_r: f64,
    pub mu_r: f64,
    pub sigma: f64,
    pub tan_delta: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum UnitSystem {
    Metric,
    Imperial,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LengthUnit {
    Meters,
    Centimeters,
    Millimeters,
    Inches,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FrequencyUnit {
    Hz,
    KHz,
    MHz,
    GHz,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GPUCapabilities {
    pub available: bool,
    pub device_name: String,
    pub memory_mb: u64,
    pub compute_units: u32,
    pub supports_compute: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BenchmarkResult {
    pub matrix_size: usize,
    pub cpu_time_ms: f64,
    pub gpu_time_ms: f64,
    pub speedup_ratio: f64,
    pub memory_used_mb: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelPrediction {
    pub s_parameters: Vec<SParameterResult>,
    pub confidence: f64,
    pub uncertainty: Option<f64>,
    pub inference_time_ms: f64,
    pub model_version: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OptimizationResult {
    pub optimal_parameters: HashMap<String, f64>,
    pub achieved_s11_db: f64,
    pub target_frequency: f64,
    pub generations: u32,
    pub convergence_history: Vec<f64>,
    pub optimization_time_ms: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectData {
    pub name: String,
    pub version: String,
    pub created_at: String,
    pub modified_at: String,
    pub antenna_type: String,
    pub parameters: HashMap<String, f64>,
    pub simulation_results: Option<SimulationResult>,
    pub optimization_results: Option<OptimizationResult>,
    pub materials: Vec<Material>,
    pub unit_system: UnitSystem,
}

// Forward declarations for types defined in other modules
use crate::solver::SParameterResult;
use crate::solver::SimulationResult;