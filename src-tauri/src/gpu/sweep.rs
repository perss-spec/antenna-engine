//! CPU frequency sweep runner with parallel processing

use crate::core::constants::C0;
use crate::gpu::parallel::{ParallelFrequencySweep, SweepResult};
use std::f64::consts::PI;
use num_complex::Complex64;
use serde::{Serialize, Deserialize};
use rayon::prelude::*;
use std::sync::Arc;
use crate::core::geometry::Mesh;

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
/// This uses a simplified half-wave dipole model for fast computation.
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

/// Run mesh-based parallel frequency sweep
pub fn run_mesh_based_sweep(config: &SweepConfig, mesh: &Mesh, wire_radius: f64) -> Vec<SweepPoint> {
    let mesh_arc = Arc::new(mesh.clone());
    let sweep = ParallelFrequencySweep::new(mesh_arc, wire_radius);
    
    let frequencies = config.frequency_points();
    let results = sweep.run_sweep(&frequencies);
    
    results
        .into_iter()
        .map(|result| SweepPoint {
            freq_hz: result.frequency,
            s11_db: result.s11_db,
        })
        .collect()
}

/// Calculate S11 for dipole using analytical approximation
fn calculate_dipole_s11(frequency: f64, length: f64, _radius: f64) -> f64 {
    // Avoid division by zero
    if frequency <= 0.0 || length <= 0.0 {
        return -100.0; // Very low reflection (good match)
    }
    
    // Electrical length in wavelengths
    let electrical_length = 2.0 * length * frequency / C0;
    
    // Half-wave dipole analytical impedance
    // Z_in = 73.1 + j*42.5*(2*length*freq/c - 1)
    let z_real = 73.1;
    let z_imag = 42.5 * (electrical_length - 1.0);
    
    // Calculate S11
    let z_in = Complex64::new(z_real, z_imag);
    let z0 = Complex64::new(50.0, 0.0); // 50 ohm reference
    let s11 = (z_in - z0) / (z_in + z0);
    
    // Convert to dB
    20.0 * s11.norm().log10()
}

/// Advanced sweep with custom impedance model
pub fn run_advanced_sweep<F>(config: &SweepConfig, impedance_model: F) -> Vec<SweepPoint>
where
    F: Fn(f64) -> Complex64 + Sync,
{
    let frequencies = config.frequency_points();
    
    frequencies
        .par_iter()
        .map(|&freq| {
            let z_in = impedance_model(freq);
            let z0 = Complex64::new(50.0, 0.0);
            let s11 = (z_in - z0) / (z_in + z0);
            let s11_db = 20.0 * s11.norm().log10();
            
            SweepPoint {
                freq_hz: freq,
                s11_db,
            }
        })
        .collect()
}

/// Batch frequency sweep for multiple configurations
pub fn run_batch_sweep(
    configs: &[(SweepConfig, f64, f64)], // (config, length, radius)
) -> Vec<Vec<SweepPoint>> {
    configs
        .par_iter()
        .map(|(config, length, radius)| {
            run_parallel_cpu_sweep(config, *length, *radius)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::geometry::{Point3D, Segment};
    
    #[test]
    fn test_sweep_config_frequency_points() {
        let config = SweepConfig::new(100e6, 200e6, 5);
        let frequencies = config.frequency_points();
        
        assert_eq!(frequencies.len(), 5);
        assert_eq!(frequencies[0], 100e6);
        assert_eq!(frequencies[4], 200e6);
        
        // Check linear spacing
        let expected_step = (200e6 - 100e6) / 4.0;
        for i in 1..5 {
            let expected = 100e6 + i as f64 * expected_step;
            assert!((frequencies[i] - expected).abs() < 1e-6);
        }
    }
    
    #[test]
    fn test_run_cpu_sweep() {
        let config = SweepConfig::new(100e6, 200e6, 3);
        let results = run_cpu_sweep(&config, 0.15, 0.001);
        
        assert_eq!(results.len(), 3);
        
        for (i, result) in results.iter().enumerate() {
            assert!(result.freq_hz > 0.0);
            assert!(result.s11_db.is_finite());
            assert!(result.s11_db < 10.0); // Should be reasonable dB value
        }
    }
    
    #[test]
    fn test_parallel_cpu_sweep() {
        let config = SweepConfig::new(100e6, 300e6, 10);
        let results = run_parallel_cpu_sweep(&config, 0.15, 0.001);
        
        assert_eq!(results.len(), 10);
        
        // Results should be in frequency order
        for i in 1..results.len() {
            assert!(results[i].freq_hz > results[i-1].freq_hz);
        }
    }
    
    #[test]
    fn test_mesh_based_sweep() {
        let vertices = vec![
            Point3D::new(0.0, 0.0, -0.075),
            Point3D::new(0.0, 0.0, 0.075),
        ];
        
        let segments = vec![
            Segment { start: 0, end: 1 },
        ];
        
        let mesh = Mesh {
            vertices,
            triangles: vec![],
            segments,
        };
        
        let config = SweepConfig::new(200e6, 400e6, 5);
        let results = run_mesh_based_sweep(&config, &mesh, 0.001);
        
        assert_eq!(results.len(), 5);
        
        for result in &results {
            assert!(result.freq_hz >= 200e6);
            assert!(result.freq_hz <= 400e6);
            assert!(result.s11_db.is_finite());
        }
    }
    
    #[test]
    fn test_advanced_sweep_with_custom_model() {
        let config = SweepConfig::new(100e6, 200e6, 3);
        
        // Custom impedance model: constant 75 ohm resistive
        let impedance_model = |_freq: f64| Complex64::new(75.0, 0.0);
        
        let results = run_advanced_sweep(&config, impedance_model);
        
        assert_eq!(results.len(), 3);
        
        // All results should have same S11 for constant impedance
        let expected_s11_db = results[0].s11_db;
        for result in &results {
            assert!((result.s11_db - expected_s11_db).abs() < 1e-10);
        }
    }
    
    #[test]
    fn test_batch_sweep() {
        let configs = vec![
            (SweepConfig::new(100e6, 200e6, 3), 0.10, 0.001),
            (SweepConfig::new(150e6, 250e6, 3), 0.15, 0.001),
        ];
        
        let batch_results = run_batch_sweep(&configs);
        
        assert_eq!(batch_results.len(), 2);
        assert_eq!(batch_results[0].len(), 3);
        assert_eq!(batch_results[1].len(), 3);
    }
}