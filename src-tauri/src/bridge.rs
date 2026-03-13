use serde::{Deserialize, Serialize};
use serde_json;

use crate::core::element::{AntennaElement, DipoleParams, PatchParams, QfhParams};
use crate::core::geometry::Point3D;
use crate::core::solver::{MomSolver, SimulationParams};
use crate::core::C0;
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
    
    // Use CPU-based frequency sweep for fast results
    let config = SweepConfig::new(request.freq_start, request.freq_stop, request.freq_points);
    
    // Extract antenna dimensions for analytical model
    let (length, radius) = match &element {
        AntennaElement::Dipole(params) => (params.length, params.radius),
        AntennaElement::Patch(params) => (params.length, 0.001), // Approximate
        AntennaElement::Qfh(params) => (params.height, params.wire_radius),
    };
    
    let sweep_results = run_cpu_sweep(&config, length, radius);
    
    // Convert to response format
    let frequencies: Vec<f64> = sweep_results.iter().map(|r| r.freq_hz).collect();
    let s11_db: Vec<f64> = sweep_results.iter().map(|r| r.s11_db).collect();
    
    // Generate placeholder impedance data (would come from full MoM solver)
    let s11_real: Vec<f64> = frequencies.iter().map(|_| 0.1).collect();
    let s11_imag: Vec<f64> = frequencies.iter().map(|_| 0.05).collect();
    let impedance_real: Vec<f64> = frequencies.iter().map(|_| 73.1).collect();
    let impedance_imag: Vec<f64> = frequencies.iter().map(|_| 0.0).collect();
    
    // Find resonant frequency (minimum S11)
    let min_s11_idx = s11_db.iter()
        .enumerate()
        .min_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap())
        .map(|(idx, _)| idx)
        .unwrap_or(0);
    
    let resonant_freq = frequencies[min_s11_idx];
    let min_s11 = s11_db[min_s11_idx];
    
    // Calculate -10dB bandwidth
    let bandwidth = calculate_bandwidth(&frequencies, &s11_db, -10.0);
    
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
pub async fn sweep_frequencies(request: SimulateRequest) -> Result<Vec<SweepPoint>, String> {
    let element = build_element(&request.element_type, &request.params)?;
    let config = SweepConfig::new(request.freq_start, request.freq_stop, request.freq_points);
    
    let (length, radius) = match &element {
        AntennaElement::Dipole(params) => (params.length, params.radius),
        AntennaElement::Patch(params) => (params.length, 0.001),
        AntennaElement::Qfh(params) => (params.height, params.wire_radius),
    };
    
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
    
    let input = PredictionInput {
        element_type: request.element_type,
        parameters: serde_json::from_value(request.params).map_err(|e| e.to_string())?,
        frequency_range: (request.freq_start, request.freq_stop),
        num_points: request.freq_points,
    };
    
    let result = predictor.predict(&input).map_err(|e| e.to_string())?;
    Ok(result)
}

/// Calculate bandwidth at given S11 threshold
fn calculate_bandwidth(frequencies: &[f64], s11_db: &[f64], threshold_db: f64) -> f64 {
    let mut below_threshold = Vec::new();
    
    for (i, &s11) in s11_db.iter().enumerate() {
        if s11 < threshold_db {
            below_threshold.push(frequencies[i]);
        }
    }
    
    if below_threshold.len() < 2 {
        return 0.0; // No bandwidth
    }
    
    let min_freq = below_threshold.iter().fold(f64::INFINITY, |a, &b| a.min(b));
    let max_freq = below_threshold.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b));
    
    max_freq - min_freq
}