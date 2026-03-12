use serde::{Deserialize, Serialize};
use serde_json;

use crate::core::element::{AntennaElement, DipoleParams, PatchParams, QfhParams};
use crate::core::geometry::Point3D;
use crate::core::solver::{MomSolver, SimulationParams, SParameterResult};
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

    for i in 0..s11_db.len() {
        if s11_db[i] <= threshold {
            if low.is_none() {
                // Interpolate lower edge
                if i > 0 && s11_db[i - 1] > threshold {
                    let frac = (threshold - s11_db[i - 1]) / (s11_db[i] - s11_db[i - 1]);
                    low = Some(frequencies[i - 1] + frac * (frequencies[i] - frequencies[i - 1]));
                } else {
                    low = Some(frequencies[i]);
                }
            }
            // Interpolate upper edge
            high = Some(frequencies[i]);
            if i + 1 < s11_db.len() && s11_db[i + 1] > threshold {
                let frac = (threshold - s11_db[i]) / (s11_db[i + 1] - s11_db[i]);
                high = Some(frequencies[i] + frac * (frequencies[i + 1] - frequencies[i]));
            }
        }
    }

    match (low, high) {
        (Some(l), Some(h)) => h - l,
        _ => 0.0,
    }
}

#[tauri::command]
pub fn simulate_antenna(request: SimulateRequest) -> Result<SimulateResponse, String> {
    let element = build_element(&request.element_type, &request.params)?;
    element.validate().map_err(|e| e.to_string())?;

    let freq_points = request.freq_points.max(2);
    let freq_step = (request.freq_stop - request.freq_start) / (freq_points - 1) as f64;

    let reference_impedance = 50.0;
    let wavelength_center = C0 / ((request.freq_start + request.freq_stop) / 2.0);
    let resolution = wavelength_center / 20.0;

    let mut frequencies = Vec::with_capacity(freq_points);
    let mut s11_db = Vec::with_capacity(freq_points);
    let mut s11_real = Vec::with_capacity(freq_points);
    let mut s11_imag = Vec::with_capacity(freq_points);
    let mut impedance_real = Vec::with_capacity(freq_points);
    let mut impedance_imag = Vec::with_capacity(freq_points);

    for i in 0..freq_points {
        let freq = request.freq_start + i as f64 * freq_step;
        frequencies.push(freq);

        let sim_params = SimulationParams {
            frequency: freq,
            resolution,
            reference_impedance,
        };

        let mut solver = MomSolver::new(&element, &sim_params).map_err(|e| e.to_string())?;
        let result = solver.solve(&sim_params).map_err(|e| e.to_string())?;

        let sp: &SParameterResult = result
            .s_parameters
            .first()
            .ok_or("No S-parameter result")?;

        let s11_mag = (sp.s11_re * sp.s11_re + sp.s11_im * sp.s11_im).sqrt();
        let db = 20.0 * s11_mag.max(1e-15).log10();

        s11_db.push(db);
        s11_real.push(sp.s11_re);
        s11_imag.push(sp.s11_im);
        impedance_real.push(sp.input_impedance_re);
        impedance_imag.push(sp.input_impedance_im);
    }

    // Find resonant frequency (minimum S11)
    let (min_idx, &min_val) = s11_db
        .iter()
        .enumerate()
        .min_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap())
        .unwrap();

    let resonant_freq = frequencies[min_idx];
    let bandwidth = calculate_bandwidth_10db(&frequencies, &s11_db);

    Ok(SimulateResponse {
        frequencies,
        s11_db,
        s11_real,
        s11_imag,
        impedance_real,
        impedance_imag,
        resonant_freq,
        min_s11: min_val,
        bandwidth,
    })
}
