use serde::{Deserialize, Serialize};
use std::collections::HashMap;

pub type Result<T> = std::result::Result<T, AntennaError>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Point3D {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, thiserror::Error)]
pub enum AntennaError {
    #[error("Invalid geometry: {0}")]
    InvalidGeometry(String),
    #[error("Simulation failed: {0}")]
    SimulationFailed(String),
    #[error("Invalid parameter: {0}")]
    InvalidParameter(String),
    #[error("Numerical error: {0}")]
    NumericalError(String),
    #[error("Import error: {0}")]
    ImportError(String),
    #[error("IO error: {0}")]
    IoError(String),
}

impl From<std::io::Error> for AntennaError {
    fn from(e: std::io::Error) -> Self {
        AntennaError::IoError(e.to_string())
    }
}

/// Simple simulation parameters used by MoM/GPU solvers
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationParams {
    pub frequency: f64,
    pub resolution: f64,
    pub reference_impedance: f64,
}

/// S-parameter result from a single frequency point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SParameterResult {
    pub frequency: f64,
    pub s11_re: f64,
    pub s11_im: f64,
    pub vswr: f64,
    pub input_impedance_re: f64,
    pub input_impedance_im: f64,
}

/// Full simulation result containing field data and S-parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationResult {
    pub s_params: Vec<SParameterResult>,
    pub field: FieldResultSummary,
}

/// Summary of field results for coverage/optimization analysis
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldResultSummary {
    pub max_gain_dbi: f64,
    pub efficiency: f64,
    pub beamwidth_deg: f64,
    pub front_to_back_ratio_db: f64,
    pub cross_pol_discrimination_db: f64,
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
pub struct FieldResult {
    pub points: Vec<Point3D>,
    pub e_field: Vec<Point3D>,
    pub h_field: Vec<Point3D>,
    pub power_density: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AntennaTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub antenna_type: String,
    pub default_params: serde_json::Value,
    pub frequency_range: (f64, f64),
    pub typical_applications: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectMetadata {
    pub name: String,
    pub version: String,
    pub created_at: String,
    pub modified_at: String,
    pub author: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectFile {
    pub metadata: ProjectMetadata,
    pub antenna_config: serde_json::Value,
    pub simulation_params: serde_json::Value,
    pub results: Option<serde_json::Value>,
    pub materials: Vec<Material>,
    pub unit_system: UnitSystem,
}