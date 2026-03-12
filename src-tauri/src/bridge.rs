use serde::{Deserialize, Serialize};
use serde_json;

use crate::core::element::{AntennaElement, DipoleParams, PatchParams, QfhParams};
use crate::core::geometry::Point3D;
use crate::core::solver::{MomSolver, SimulationParams, SParameterResult};
use crate::core::inference::{SurrogatePredictor, PredictionInput, PredictionResult};
use crate::core::C0;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulateRequest {
    pub element_type: String,
    pub params: serde_json::Value,
    pub freq_start: f64,
    pub freq_stop: f64,
    pub freq_points: usize,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulateResponse {
    pub frequencies: Vec<f64>,
    pub s11_db: Vec<f64>,
    pub s11_real: Vec<f64>,
    pub s11_imag: Vec<f64>,
    pub impedance_real: Vec<f64>,
    pub impedance_imag: Vec<f64>,
    pub resonant_freq: f64,
    pub min_s11: f64,
    pub bandwidth: f64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PredictRequest {
    pub element_type: String,
    pub params: serde_json::Value,
    pub freq_start: f64,
    pub freq_stop: f64,
    pub freq_points: usize,
    pub model_path: Option<String>,
}

fn build_element(element_type: &str, params: &serde_json::Value) -> Result<AntennaElement, String> {
    match element_type {
        "dipole" => {
            let length = params["length"].as_f64().ok_or("missing dipole length")?;
            let radius = params["radius"].as_f64().ok_or("missing dipole radius")?;
            Ok(AntennaElement::Dipole(DipoleParams {
                length,
                radius,
                center: Point3D::origin(),
                orientation: Point3D::new(0.0, 0.0, 1.0),
            }))
        }
        "patch" => {
            let width = params["width"].as_f64().ok_or("missing patch width")?;
            let length = params["length"].as_f64().ok_or("missing patch length")?;
            let substrate_height = params["substrateHeight"].as_f64().ok_or("missing substrateHeight")?;
            let substrate_er = params["substrateEr"].as_f64().ok_or("missing substrateEr")?;
            Ok(AntennaElement::Patch(PatchParams {
                width,
                length,
                substrate_height,
                substrate_er,
                center: Point3D::origin(),
            }))
        }
        "qfh" => {
            let frequency = params["frequency"].as_f64().ok_or("missing qfh frequency")?;
            let turns = params["turns"].as_f64().ok_or("missing qfh turns")?;
            let diameter = params["diameter"].as_f64().ok_or("missing qfh diameter")?;
            let height = params["height"].as_f64().ok_or("missing qfh height")?;
            let wire_radius = params["wireRadius"].as_f64().ok_or("missing qfh wireRadius")?;
            Ok(AntennaElement::Qfh(QfhParams {
                frequency,
                turns,
                diameter,
                height,
                wire_radius,
                center: Point3D::origin(),
            }))
        }
        _ => Err(format!("Unknown element type: {}", element_type)),
    }
}

fn calculate_bandwidth_10db(frequencies: &[f64], s11_db: &[f64]) -> f64 {
    let threshold = -10.0;
    let mut low: Option<f64> = None;
    let mut high: Option<f64> = None;
    
    for (i, &s11) in s11_db.iter().enumerate() {
        if s11 < threshold {
            if low.is_none() {
                low = Some(frequencies[i]);
            }
            high = Some(frequencies[i]);
        }
    }
    
    match (low, high) {
        (Some(l), Some(h)) => h - l,
        _ => 0.0,
    }
}

fn find_resonant_frequency(frequencies: &[f64], s11_db: &[f64]) -> f64 {
    let mut min_s11 = f64::INFINITY;
    let mut resonant_freq = frequencies[0];
    
    for (i, &s11) in s11_db.iter().enumerate() {
        if s11 < min_s11 {
            min_s11 = s11;
            resonant_freq = frequencies[i];
        }
    }
    
    resonant_freq
}

#[tauri::command]
pub async fn simulate_antenna(request: SimulateRequest) -> Result<SimulateResponse, String> {
    // Build antenna element
    let element = build_element(&request.element_type, &request.params)?;
    
    // Validate element
    element.validate().map_err(|e| e.to_string())?;
    
    // Generate frequency points
    let mut frequencies = Vec::new();
    for i in 0..request.freq_points {
        let f = request.freq_start + (request.freq_stop - request.freq_start) * (i as f64) / ((request.freq_points - 1) as f64);
        frequencies.push(f);
    }
    
    // Run simulation for each frequency
    let mut s11_db = Vec::new();
    let mut s11_real = Vec::new();
    let mut s11_imag = Vec::new();
    let mut impedance_real = Vec::new();
    let mut impedance_imag = Vec::new();
    
    for &freq in &frequencies {
        let params = SimulationParams {
            frequency: freq,
            resolution: 0.01,
            reference_impedance: 50.0,
        };
        
        // Create solver for this frequency
        match MomSolver::new(&element, &params) {
            Ok(mut solver) => {
                match solver.solve(&params) {
                    Ok(result) => {
                        if let Some(s_param) = result.s_parameters.first() {
                            let s11_complex = num_complex::Complex64::new(s_param.s11_re, s_param.s11_im);
                            let s11_mag_db = 20.0 * s11_complex.norm().log10();
                            
                            s11_db.push(s11_mag_db);
                            s11_real.push(s_param.s11_re);
                            s11_imag.push(s_param.s11_im);
                            impedance_real.push(s_param.input_impedance_re);
                            impedance_imag.push(s_param.input_impedance_im);
                        } else {
                            return Err("No S-parameters in simulation result".to_string());
                        }
                    }
                    Err(e) => return Err(format!("Simulation failed: {}", e)),
                }
            }
            Err(e) => return Err(format!("Failed to create solver: {}", e)),
        }
    }
    
    // Calculate derived metrics
    let resonant_freq = find_resonant_frequency(&frequencies, &s11_db);
    let min_s11 = s11_db.iter().fold(f64::INFINITY, |a, &b| a.min(b));
    let bandwidth = calculate_bandwidth_10db(&frequencies, &s11_db);
    
    Ok(SimulateResponse {
        frequencies,
        s11_db,
        s11_real,
        s11_imag,
        impedance_real,
        impedance_imag,
        resonant_freq,
        min_s11,
        bandwidth,
    })
}

#[tauri::command]
pub async fn predict_antenna(request: PredictRequest) -> Result<PredictionResult, String> {
    let mut predictor = SurrogatePredictor::new();
    
    // Load model if path provided
    if let Some(model_path) = &request.model_path {
        predictor.load(model_path).map_err(|e| e.to_string())?;
    }
    
    // Convert request params to HashMap
    let mut parameters = std::collections::HashMap::new();
    if let serde_json::Value::Object(obj) = &request.params {
        for (key, value) in obj {
            if let Some(num) = value.as_f64() {
                parameters.insert(key.clone(), num);
            }
        }
    }
    
    let input = PredictionInput {
        element_type: request.element_type,
        parameters,
        frequency_range: (request.freq_start, request.freq_stop),
        num_points: request.freq_points,
    };
    
    predictor.predict(&input).map_err(|e| e.to_string())
}