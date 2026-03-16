use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationParams {
    pub frequency_start: f64,
    pub frequency_end: f64,
    pub frequency_points: usize,
    pub segments_per_wavelength: usize,
    pub ground_plane: bool,
    pub reference_impedance: f64,
}

impl Default for SimulationParams {
    fn default() -> Self {
        Self {
            frequency_start: 1e9,  // 1 GHz
            frequency_end: 2e9,    // 2 GHz
            frequency_points: 101,
            segments_per_wavelength: 10,
            ground_plane: false,
            reference_impedance: 50.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationResult {
    pub frequencies: Vec<f64>,
    pub s_parameters: Vec<Vec<f64>>,  // S11 magnitude in dB
    pub vswr: Vec<f64>,
    pub input_impedance_real: Vec<f64>,
    pub input_impedance_imag: Vec<f64>,
    pub far_field_patterns: Vec<FarFieldPattern>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FarFieldPattern {
    pub frequency: f64,
    pub theta_angles: Vec<f64>,
    pub phi_angles: Vec<f64>,
    pub pattern_db: Vec<Vec<f64>>,
    pub max_gain: f64,
    pub beamwidth_h: f64,
    pub beamwidth_v: f64,
}