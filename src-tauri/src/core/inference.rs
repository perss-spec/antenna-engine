//! Surrogate model inference for fast antenna parameter prediction

use crate::core::types::{AntennaError, Result};
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

        // For now, use analytical approximation instead of ONNX model
        let (s11_db, impedance_re, impedance_im) = match input.element_type.as_str() {
            "dipole" => self.predict_dipole(input, &frequencies)?,
            "patch" => self.predict_patch(input, &frequencies)?,
            "qfh" => self.predict_qfh(input, &frequencies)?,
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
            model_version: "analytical_v1.0".to_string(),
        })
    }

    /// Generate frequency points for prediction
    fn generate_frequency_points(&self, start: f64, stop: f64, num_points: usize) -> Vec<f64> {
        if num_points <= 1 {
            return vec![start];
        }
        
        let mut frequencies = Vec::with_capacity(num_points);
        let step = (stop - start) / (num_points - 1) as f64;
        
        for i in 0..num_points {
            frequencies.push(start + i as f64 * step);
        }
        
        frequencies
    }

    /// Predict dipole response using analytical model
    fn predict_dipole(
        &self,
        input: &PredictionInput,
        frequencies: &[f64],
    ) -> Result<(Vec<f64>, Vec<f64>, Vec<f64>)> {
        let length = input.parameters.get("length")
            .ok_or_else(|| AntennaError::InvalidParameter("Missing dipole length".to_string()))?;
        let _radius = input.parameters.get("radius")
            .ok_or_else(|| AntennaError::InvalidParameter("Missing dipole radius".to_string()))?;

        let mut s11_db = Vec::new();
        let mut impedance_re = Vec::new();
        let mut impedance_im = Vec::new();

        for &freq in frequencies {
            // Analytical dipole impedance
            let wavelength = crate::core::C0 / freq;
            let electrical_length = 2.0 * length / wavelength;
            
            let z_re = 73.1;
            let z_im = 42.5 * (electrical_length - 1.0);
            
            impedance_re.push(z_re);
            impedance_im.push(z_im);
            
            // Calculate S11
            let z_in = num_complex::Complex64::new(z_re, z_im);
            let z0 = num_complex::Complex64::new(50.0, 0.0);
            let s11 = (z_in - z0) / (z_in + z0);
            
            s11_db.push(20.0 * s11.norm().log10());
        }

        Ok((s11_db, impedance_re, impedance_im))
    }

    /// Predict patch antenna response (simplified)
    fn predict_patch(
        &self,
        input: &PredictionInput,
        frequencies: &[f64],
    ) -> Result<(Vec<f64>, Vec<f64>, Vec<f64>)> {
        let width = input.parameters.get("width")
            .ok_or_else(|| AntennaError::InvalidParameter("Missing patch width".to_string()))?;
        let length = input.parameters.get("length")
            .ok_or_else(|| AntennaError::InvalidParameter("Missing patch length".to_string()))?;

        let mut s11_db = Vec::new();
        let mut impedance_re = Vec::new();
        let mut impedance_im = Vec::new();

        for &freq in frequencies {
            // Simplified patch model - resonant at c/(2*length)
            let resonant_freq = crate::core::C0 / (2.0 * length);
            let freq_ratio = freq / resonant_freq;
            
            // Simple impedance model
            let z_re = 50.0 + 200.0 * (freq_ratio - 1.0).powi(2);
            let z_im = 100.0 * (freq_ratio - 1.0);
            
            impedance_re.push(z_re);
            impedance_im.push(z_im);
            
            // Calculate S11
            let z_in = num_complex::Complex64::new(z_re, z_im);
            let z0 = num_complex::Complex64::new(50.0, 0.0);
            let s11 = (z_in - z0) / (z_in + z0);
            
            s11_db.push(20.0 * s11.norm().log10());
        }

        Ok((s11_db, impedance_re, impedance_im))
    }

    /// Predict QFH antenna response (simplified)
    fn predict_qfh(
        &self,
        input: &PredictionInput,
        frequencies: &[f64],
    ) -> Result<(Vec<f64>, Vec<f64>, Vec<f64>)> {
        let design_freq = input.parameters.get("frequency")
            .ok_or_else(|| AntennaError::InvalidParameter("Missing QFH frequency".to_string()))?;
        let turns = input.parameters.get("turns")
            .ok_or_else(|| AntennaError::InvalidParameter("Missing QFH turns".to_string()))?;
        let _diameter = input.parameters.get("diameter")
            .ok_or_else(|| AntennaError::InvalidParameter("Missing QFH diameter".to_string()))?;

        let mut s11_db = Vec::new();
        let mut impedance_re = Vec::new();
        let mut impedance_im = Vec::new();

        for &freq in frequencies {
            // Simplified QFH model
            let freq_ratio = freq / design_freq;
            
            // Helical antenna impedance approximation
            let z_re = 140.0 * turns.sqrt();
            let z_im = 50.0 * (freq_ratio - 1.0);
            
            impedance_re.push(z_re);
            impedance_im.push(z_im);
            
            // Calculate S11
            let z_in = num_complex::Complex64::new(z_re, z_im);
            let z0 = num_complex::Complex64::new(50.0, 0.0);
            let s11 = (z_in - z0) / (z_in + z0);
            
            s11_db.push(20.0 * s11.norm().log10());
        }

        Ok((s11_db, impedance_re, impedance_im))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_predictor_creation() {
        let predictor = SurrogatePredictor::new();
        assert!(!predictor.model_loaded);
        assert_eq!(predictor.element_type, "");
    }

    #[test]
    fn test_frequency_generation() {
        let predictor = SurrogatePredictor::new();
        let freqs = predictor.generate_frequency_points(100e6, 200e6, 11);
        
        assert_eq!(freqs.len(), 11);
        assert_eq!(freqs[0], 100e6);
        assert_eq!(freqs[10], 200e6);
    }

    #[test]
    fn test_dipole_prediction() {
        let predictor = SurrogatePredictor {
            model_loaded: true,
            model_path: Some("test".to_string()),
            element_type: "dipole".to_string(),
        };

        let mut params = HashMap::new();
        params.insert("length".to_string(), 0.15);
        params.insert("radius".to_string(), 0.001);

        let input = PredictionInput {
            element_type: "dipole".to_string(),
            parameters: params,
            frequency_range: (100e6, 200e6),
            num_points: 5,
        };

        let result = predictor.predict(&input).unwrap();
        assert_eq!(result.frequencies.len(), 5);
        assert_eq!(result.s11_db.len(), 5);
        assert_eq!(result.impedance_re.len(), 5);
        assert_eq!(result.impedance_im.len(), 5);
    }
}