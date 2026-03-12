//! CPU frequency sweep runner with analytical dipole approximation

use crate::core::C0;
use std::f64::consts::PI;
use num_complex::Complex64;
use serde::{Serialize, Deserialize};
use rayon::prelude::*;

/// Frequency sweep configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SweepConfig {
    pub start_hz: f64,
    pub stop_hz: f64,
    pub num_points: usize,
}

/// Single frequency point result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SweepPoint {
    pub freq_hz: f64,
    pub s11_db: f64,
}

impl SweepConfig {
    /// Create new sweep configuration
    pub fn new(start_hz: f64, stop_hz: f64, num_points: usize) -> Self {
        Self {
            start_hz,
            stop_hz,
            num_points,
        }
    }
    
    /// Generate frequency points (linear spacing)
    pub fn frequency_points(&self) -> Vec<f64> {
        if self.num_points <= 1 {
            return vec![self.start_hz];
        }
        
        let mut frequencies = Vec::with_capacity(self.num_points);
        let step = (self.stop_hz - self.start_hz) / (self.num_points - 1) as f64;
        
        for i in 0..self.num_points {
            let freq = self.start_hz + i as f64 * step;
            frequencies.push(freq);
        }
        
        frequencies
    }
}

/// Run CPU-based frequency sweep using analytical dipole approximation
/// 
/// This uses a simplified half-wave dipole model:
/// Z_in = 73.1 + j*42.5*(2*length*freq/c - 1)
/// 
/// This is a placeholder until full GPU MoM acceleration is implemented.
pub fn run_cpu_sweep(config: &SweepConfig, length: f64, radius: f64) -> Vec<SweepPoint> {
    let frequencies = config.frequency_points();
    let mut results = Vec::with_capacity(frequencies.len());
    
    for freq in frequencies {
        let s11_db = calculate_dipole_s11(freq, length, radius);
        results.push(SweepPoint {
            freq_hz: freq,
            s11_db,
        });
    }
    
    results
}

/// Run parallel CPU sweep using rayon
pub fn run_parallel_cpu_sweep(config: &SweepConfig, length: f64, radius: f64) -> Vec<SweepPoint> {
    let frequencies = config.frequency_points();
    
    frequencies
        .par_iter()
        .map(|&freq| {
            let s11_db = calculate_dipole_s11(freq, length, radius);
            SweepPoint {
                freq_hz: freq,
                s11_db,
            }
        })
        .collect()
}

/// Calculate S11 for dipole using analytical approximation
fn calculate_dipole_s11(frequency: f64, length: f64, _radius: f64) -> f64 {
    // Avoid division by zero
    if frequency <= 0.0 || length <= 0.0 {
        return -100.0; // Very low reflection (good match)
    }
    
    // Wave number
    let _k = 2.0 * PI * frequency / C0;
    
    // Electrical length in wavelengths
    let electrical_length = 2.0 * length * frequency / C0;
    
    // Half-wave dipole analytical impedance
    // Z_in = 73.1 + j*42.5*(2*length*freq/c - 1)
    let z_real = 73.1;
    let z_imag = 42.5 * (electrical_length - 1.0);
    
    // Input impedance
    let z_in = Complex64::new(z_real, z_imag);
    
    // Reference impedance (50 ohms)
    let z0 = Complex64::new(50.0, 0.0);
    
    // Reflection coefficient
    let gamma = (z_in - z0) / (z_in + z0);
    
    // S11 in dB
    let s11_magnitude = gamma.norm();
    
    // Clamp to reasonable range
    if s11_magnitude < 1e-10 {
        -100.0 // Very good match
    } else {
        20.0 * s11_magnitude.log10()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_sweep_config_creation() {
        let config = SweepConfig::new(100e6, 200e6, 10);
        assert_eq!(config.start_hz, 100e6);
        assert_eq!(config.stop_hz, 200e6);
        assert_eq!(config.num_points, 10);
    }
    
    #[test]
    fn test_frequency_points_generation() {
        let config = SweepConfig::new(100e6, 200e6, 3);
        let points = config.frequency_points();
        
        assert_eq!(points.len(), 3);
        assert_eq!(points[0], 100e6);
        assert_eq!(points[1], 150e6);
        assert_eq!(points[2], 200e6);
    }
    
    #[test]
    fn test_cpu_sweep_results_finite() {
        let config = SweepConfig::new(100e6, 200e6, 10);
        let results = run_cpu_sweep(&config, 0.15, 0.001); // 15cm dipole, 1mm radius
        
        assert_eq!(results.len(), 10);
        
        // All results should be finite
        for point in &results {
            assert!(point.freq_hz.is_finite(), "Frequency should be finite");
            assert!(point.s11_db.is_finite(), "S11 should be finite");
            assert!(point.freq_hz > 0.0, "Frequency should be positive");
            assert!(point.s11_db <= 0.0, "S11 in dB should be <= 0");
        }
    }
    
    #[test]
    fn test_parallel_sweep_matches_sequential() {
        let config = SweepConfig::new(100e6, 200e6, 5);
        let length = 0.15;
        let radius = 0.001;
        
        let sequential = run_cpu_sweep(&config, length, radius);
        let parallel = run_parallel_cpu_sweep(&config, length, radius);
        
        assert_eq!(sequential.len(), parallel.len());
        
        for (seq, par) in sequential.iter().zip(parallel.iter()) {
            assert!((seq.freq_hz - par.freq_hz).abs() < 1e-6);
            assert!((seq.s11_db - par.s11_db).abs() < 1e-6);
        }
    }
    
    #[test]
    fn test_dipole_s11_calculation() {
        // Test at resonant frequency (half-wave)
        let freq = C0 / (2.0 * 0.15); // Resonant frequency for 15cm dipole
        let s11 = calculate_dipole_s11(freq, 0.15, 0.001);
        
        // Should be reasonably well matched at resonance
        assert!(s11.is_finite());
        assert!(s11 < -5.0, "Should have decent match at resonance");
    }
    
    #[test]
    fn test_edge_cases() {
        // Zero frequency
        let s11 = calculate_dipole_s11(0.0, 0.15, 0.001);
        assert_eq!(s11, -100.0);
        
        // Zero length
        let s11 = calculate_dipole_s11(100e6, 0.0, 0.001);
        assert_eq!(s11, -100.0);
    }
}