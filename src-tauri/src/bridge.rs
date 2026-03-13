use serde::{Deserialize, Serialize};
use serde_json;

use crate::core::element::{AntennaElement, DipoleParams, PatchParams, QfhParams};
use crate::core::geometry::Point3D;
use crate::core::solver::{MomSolver, SimulationParams};
use crate::core::inference::{SurrogatePredictor, PredictionInput, PredictionResult};
use crate::gpu::sweep::{SweepConfig, SweepPoint, run_cpu_sweep};

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

#[tauri::command]
pub async fn simulate_antenna(request: SimulateRequest) -> Result<SimulateResponse, String> {
    let element = build_element(&request.element_type, &request.params)?;
    
    // Create simulation parameters for center frequency
    let center_freq = (request.freq_start + request.freq_stop) / 2.0;
    let sim_params = SimulationParams {
        frequency: center_freq,
        resolution: 0.01,
        reference_impedance: 50.0,
    };
    
    // Create and run solver
    let mut solver = MomSolver::new(&element, &sim_params).map_err(|e| e.to_string())?;
    let result = solver.solve(&sim_params).map_err(|e| e.to_string())?;
    
    // Extract S-parameters
    let s_params = &result.s_parameters;
    if s_params.is_empty() {
        return Err("No S-parameters computed".to_string());
    }
    
    // Generate frequency sweep (simplified)
    let mut frequencies = Vec::new();
    let mut s11_db = Vec::new();
    let mut s11_real = Vec::new();
    let mut s11_imag = Vec::new();
    let mut impedance_real = Vec::new();
    let mut impedance_imag = Vec::new();
    
    for i in 0..request.freq_points {
        let freq = request.freq_start + (request.freq_stop - request.freq_start) * i as f64 / (request.freq_points - 1) as f64;
        frequencies.push(freq);
        
        // Use first S-parameter result (simplified)
        let s_param = &s_params[0];
        s11_db.push(20.0 * (s_param.s11_re * s_param.s11_re + s_param.s11_im * s_param.s11_im).sqrt().log10());
        s11_real.push(s_param.s11_re);
        s11_imag.push(s_param.s11_im);
        impedance_real.push(s_param.input_impedance_re);
        impedance_imag.push(s_param.input_impedance_im);
    }
    
    // Find minimum S11 and resonant frequency
    let min_s11 = s11_db.iter().fold(f64::INFINITY, |a, &b| a.min(b));
    let resonant_freq = frequencies[s11_db.iter().position(|&x| x == min_s11).unwrap_or(0)];
    
    Ok(SimulateResponse {
        frequencies,
        s11_db,
        s11_real,
        s11_imag,
        impedance_real,
        impedance_imag,
        resonant_freq,
        min_s11,
        bandwidth: 10e6, // Placeholder
    })
}

#[tauri::command]
pub async fn sweep_frequencies(
    start_hz: f64,
    stop_hz: f64,
    num_points: usize,
    length: f64,
    radius: f64,
) -> Result<Vec<SweepPoint>, String> {
    if start_hz <= 0.0 || stop_hz <= start_hz || num_points == 0 {
        return Err("Invalid sweep parameters".to_string());
    }
    
    if length <= 0.0 || radius <= 0.0 {
        return Err("Invalid antenna dimensions".to_string());
    }
    
    let config = SweepConfig::new(start_hz, stop_hz, num_points);
    let results = run_cpu_sweep(&config, length, radius);
    
    Ok(results)
}

#[tauri::command]
pub async fn predict_antenna(request: PredictRequest) -> Result<PredictionResult, String> {
    let mut predictor = SurrogatePredictor::new();
    
    // Load model if path provided
    if let Some(model_path) = &request.model_path {
        predictor.load(model_path).map_err(|e| e.to_string())?;
    }
    
    // Convert request to prediction input
    let mut parameters = std::collections::HashMap::new();
    
    match request.element_type.as_str() {
        "dipole" => {
            let length = request.params["length"].as_f64().ok_or("missing dipole length")?;
            let radius = request.params["radius"].as_f64().ok_or("missing dipole radius")?;
            parameters.insert("length".to_string(), length);
            parameters.insert("radius".to_string(), radius);
        }
        "patch" => {
            let width = request.params["width"].as_f64().ok_or("missing patch width")?;
            let length = request.params["length"].as_f64().ok_or("missing patch length")?;
            parameters.insert("width".to_string(), width);
            parameters.insert("length".to_string(), length);
        }
        _ => return Err(format!("Unsupported element type for prediction: {}", request.element_type)),
    }
    
    let input = PredictionInput {
        element_type: request.element_type,
        parameters,
        frequency_range: (request.freq_start, request.freq_stop),
        num_points: request.freq_points,
    };
    
    predictor.predict(&input).map_err(|e| e.to_string())
}