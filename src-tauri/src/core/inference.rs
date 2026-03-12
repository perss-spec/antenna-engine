//! Surrogate model inference for fast antenna parameter prediction

use crate::core::types::{AntennaError, Result};
use crate::core::element::{AntennaElement, DipoleParams, PatchParams, QfhParams};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::Path;

/// Prediction result from surrogate model
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PredictionResult {
    pub frequencies: Vec<f64>,
    pub s11_db: Vec<f64>,
    pub impedance_re: Vec<f64>,
    pub impedance_im: Vec<f64>,
    pub confidence: f64,
    pub model_version: String,
}

/// Input parameters for surrogate model prediction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PredictionInput {
    pub element_type: String,
    pub parameters: HashMap<String, f64>,
    pub frequency_range: (f64, f64),
    pub num_points: usize,
}

/// Surrogate model predictor using ONNX runtime
pub struct SurrogatePredictor {
    model_path: Option<String>,
    model_loaded: bool,
    element_type: String,
}

impl SurrogatePredictor {
    /// Create new surrogate predictor
    pub fn new() -> Self {
        Self {
            model_path: None,
            model_loaded: false,
            element_type: String::new(),
        }
    }

    /// Load ONNX model from file
    pub fn load<P: AsRef<Path>>(&mut self, model_path: P) -> Result<()> {
        let path_str = model_path.as_ref().to_string_lossy().to_string();
        
        // For now, just validate the file exists
        if !model_path.as_ref().exists() {
            return Err(AntennaError::SimulationFailed(
                format!("Model file not found: {}", path_str)
            ));
        }

        // TODO: Load actual ONNX model when ort crate is available
        // For now, just store the path and mark as loaded
        self.model_path = Some(path_str);
        self.model_loaded = true;
        
        // Extract element type from filename (simple heuristic)
        let filename = model_path.as_ref().file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown");
        
        if filename.contains("dipole") {
            self.element_type = "dipole".to_string();
        } else if filename.contains("patch") {
            self.element_type = "patch".to_string();
        } else if filename.contains("qfh") {
            self.element_type = "qfh".to_string();
        } else {
            self.element_type = "unknown".to_string();
        }
        
        Ok(())
    }

    /// Run prediction on antenna parameters
    pub fn predict(&self, input: &PredictionInput) -> Result<PredictionResult> {
        if !self.model_loaded {
            return Err(AntennaError::SimulationFailed(
                "No model loaded. Call load() first.".to_string()
            ));
        }

        // Generate frequency points
        let frequencies = self.generate_frequency_points(
            input.frequency_range.0,
            input.frequency_range.1,
            input.num_points,
        );

        // For now, use polynomial approximation as fallback
        // TODO: Replace with actual ONNX inference when ort crate is available
        let (s11_db, impedance_re, impedance_im) = match input.element_type.as_str() {
            "dipole" => self.predict_dipole_polynomial(input, &frequencies),
            "patch" => self.predict_patch_polynomial(input, &frequencies),
            "qfh" => self.predict_qfh_polynomial(input, &frequencies),
            _ => {
                return Err(AntennaError::InvalidParameter(
                    format!("Unsupported element type: {}", input.element_type)
                ));
            }
        };

        Ok(PredictionResult {
            frequencies,
            s11_db,
            impedance_re,
            impedance_im,
            confidence: 0.85, // Placeholder confidence
            model_version: "polynomial_fallback_v1.0".to_string(),
        })
    }

    /// Generate frequency points in the specified range
    fn generate_frequency_points(&self, start: f64, stop: f64, num_points: usize) -> Vec<f64> {
        if num_points <= 1 {
            return vec![start];
        }
        
        (0..num_points)
            .map(|i| start + (stop - start) * (i as f64) / ((num_points - 1) as f64))
            .collect()
    }

    /// Polynomial approximation for dipole antennas
    fn predict_dipole_polynomial(
        &self,
        input: &PredictionInput,
        frequencies: &[f64],
    ) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
        use crate::core::C0;
        
        let length = input.parameters.get("length")
            .copied()
            .unwrap_or(0.15); // Default half-wave at 1 GHz
        
        let _radius = input.parameters.get("radius")
            .copied()
            .unwrap_or(0.001);
        
        let mut s11_db = Vec::new();
        let mut impedance_re = Vec::new();
        let mut impedance_im = Vec::new();
        
        for &freq in frequencies {
            let wavelength = C0 / freq;
            let electrical_length = length / wavelength;
            
            // Simple polynomial model for dipole impedance
            // Based on typical dipole behavior near resonance
            let delta = electrical_length - 0.5; // Deviation from half-wave
            
            // Resistance varies around 73 ohms for half-wave dipole
            let resistance = 73.0 + 200.0 * delta * delta;
            
            // Reactance is approximately linear with frequency deviation
            let reactance = 42.5 * delta * 4.0;
            
            // Calculate S11 from impedance
            let z_real = resistance;
            let z_imag = reactance;
            let z0 = 50.0;
            
            let gamma_re = (z_real - z0) / (z_real + z0);
            let gamma_im = z_imag / (z_real + z0);
            let gamma_mag = (gamma_re * gamma_re + gamma_im * gamma_im).sqrt();
            let s11_db_val = 20.0 * gamma_mag.log10();
            
            s11_db.push(s11_db_val);
            impedance_re.push(z_real);
            impedance_im.push(z_imag);
        }
        
        (s11_db, impedance_re, impedance_im)
    }

    /// Polynomial approximation for patch antennas
    fn predict_patch_polynomial(
        &self,
        input: &PredictionInput,
        frequencies: &[f64],
    ) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
        use crate::core::C0;
        
        let _width = input.parameters.get("width")
            .copied()
            .unwrap_or(0.038); // Default for 2.4 GHz patch
        
        let length = input.parameters.get("length")
            .copied()
            .unwrap_or(0.029);
        
        let substrate_er = input.parameters.get("substrate_er")
            .copied()
            .unwrap_or(4.4);
        
        let mut s11_db = Vec::new();
        let mut impedance_re = Vec::new();
        let mut impedance_im = Vec::new();
        
        for &freq in frequencies {
            let wavelength = C0 / freq;
            let effective_wavelength = wavelength / substrate_er.sqrt();
            let electrical_length = length / effective_wavelength;
            
            // Simple model for patch resonance
            let delta = electrical_length - 0.5;
            
            // Patch typically has higher impedance than dipole
            let resistance = 100.0 + 300.0 * delta * delta;
            let reactance = 80.0 * delta * 3.0;
            
            // Calculate S11
            let z_real = resistance;
            let z_imag = reactance;
            let z0 = 50.0;
            
            let gamma_re = (z_real - z0) / (z_real + z0);
            let gamma_im = z_imag / (z_real + z0);
            let gamma_mag = (gamma_re * gamma_re + gamma_im * gamma_im).sqrt();
            let s11_db_val = 20.0 * gamma_mag.log10();
            
            s11_db.push(s11_db_val);
            impedance_re.push(z_real);
            impedance_im.push(z_imag);
        }
        
        (s11_db, impedance_re, impedance_im)
    }

    /// Polynomial approximation for QFH antennas
    fn predict_qfh_polynomial(
        &self,
        input: &PredictionInput,
        frequencies: &[f64],
    ) -> (Vec<f64>, Vec<f64>, Vec<f64>) {
        use crate::core::C0;
        
        let design_freq = input.parameters.get("frequency")
            .copied()
            .unwrap_or(1.0e9);
        
        let diameter = input.parameters.get("diameter")
            .copied()
            .unwrap_or(0.05);
        
        let mut s11_db = Vec::new();
        let mut impedance_re = Vec::new();
        let mut impedance_im = Vec::new();
        
        for &freq in frequencies {
            let freq_ratio = freq / design_freq;
            let delta = freq_ratio - 1.0;
            
            // QFH typically has moderate impedance with good bandwidth
            let resistance = 50.0 + 100.0 * delta * delta;
            let reactance = 25.0 * delta * 2.0;
            
            // Calculate S11
            let z_real = resistance;
            let z_imag = reactance;
            let z0 = 50.0;
            
            let gamma_re = (z_real - z0) / (z_real + z0);
            let gamma_im = z_imag / (z_real + z0);
            let gamma_mag = (gamma_re * gamma_re + gamma_im * gamma_im).sqrt();
            let s11_db_val = 20.0 * gamma_mag.log10();
            
            s11_db.push(s11_db_val);
            impedance_re.push(z_real);
            impedance_im.push(z_imag);
        }
        
        (s11_db, impedance_re, impedance_im)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    #[test]
    fn test_surrogate_predictor_creation() {
        let predictor = SurrogatePredictor::new();
        assert!(!predictor.model_loaded);
    }

    #[test]
    fn test_dipole_polynomial_prediction() {
        let predictor = SurrogatePredictor {
            model_path: Some("test".to_string()),
            model_loaded: true,
            element_type: "dipole".to_string(),
        };
        
        let mut params = HashMap::new();
        params.insert("length".to_string(), 0.15);
        params.insert("radius".to_string(), 0.001);
        
        let input = PredictionInput {
            element_type: "dipole".to_string(),
            parameters: params,
            frequency_range: (900e6, 1100e6),
            num_points: 11,
        };
        
        let result = predictor.predict(&input);
        assert!(result.is_ok());
        
        let prediction = result.unwrap();
        assert_eq!(prediction.frequencies.len(), 11);
        assert_eq!(prediction.s11_db.len(), 11);
        assert_eq!(prediction.impedance_re.len(), 11);
        assert_eq!(prediction.impedance_im.len(), 11);
    }

    #[test]
    fn test_frequency_generation() {
        let predictor = SurrogatePredictor::new();
        let freqs = predictor.generate_frequency_points(1e9, 2e9, 5);
        
        assert_eq!(freqs.len(), 5);
        assert_eq!(freqs[0], 1e9);
        assert_eq!(freqs[4], 2e9);
    }

    #[test]
    fn test_prediction_without_model() {
        let predictor = SurrogatePredictor::new();
        
        let input = PredictionInput {
            element_type: "dipole".to_string(),
            parameters: HashMap::new(),
            frequency_range: (1e9, 2e9),
            num_points: 10,
        };
        
        let result = predictor.predict(&input);
        assert!(result.is_err());
    }
}