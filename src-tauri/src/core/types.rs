use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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