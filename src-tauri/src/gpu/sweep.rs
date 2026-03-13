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
    
    let z_in = Complex64::new(z_real, z_imag);
    let z0 = Complex64::new(50.0, 0.0); // Reference impedance
    
    // Calculate reflection coefficient S11
    let s11 = (z_in - z0) / (z_in + z0);
    
    // Convert to dB
    let s11_mag = s11.norm();
    if s11_mag > 0.0 {
        20.0 * s11_mag.log10()
    } else {
        -100.0 // Very good match
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::Instant;
    
    #[test]
    fn test_sweep_config() {
        let config = SweepConfig::new(100e6, 200e6, 11);
        let freqs = config.frequency_points();
        
        assert_eq!(freqs.len(), 11);
        assert_eq!(freqs[0], 100e6);
        assert_eq!(freqs[10], 200e6);
        
        // Check linear spacing
        let expected_step = 10e6;
        for i in 1..freqs.len() {
            let actual_step = freqs[i] - freqs[i-1];
            assert!((actual_step - expected_step).abs() < 1e3); // 1 kHz tolerance
        }
    }
    
    #[test]
    fn test_dipole_s11_calculation() {
        // Test half-wave dipole at resonance
        let freq = 300e6; // 300 MHz
        let length = C0 / (2.0 * freq); // Half wavelength
        let radius = 0.001;
        
        let s11_db = calculate_dipole_s11(freq, length, radius);
        
        // Should be reasonably well matched (negative dB)
        assert!(s11_db < 0.0);
        assert!(s11_db > -50.0); // Not unrealistically good
    }
    
    #[test]
    fn test_cpu_sweep() {
        let config = SweepConfig::new(100e6, 200e6, 10);
        let results = run_cpu_sweep(&config, 0.15, 0.001);
        
        assert_eq!(results.len(), 10);
        
        // All results should be finite
        for point in &results {
            assert!(point.freq_hz.is_finite());
            assert!(point.s11_db.is_finite());
            assert!(point.freq_hz >= 100e6);
            assert!(point.freq_hz <= 200e6);
        }
    }
    
    #[test]
    fn test_parallel_sweep() {
        let config = SweepConfig::new(100e6, 200e6, 100);
        let serial_results = run_cpu_sweep(&config, 0.15, 0.001);
        let parallel_results = run_parallel_cpu_sweep(&config, 0.15, 0.001);
        
        assert_eq!(serial_results.len(), parallel_results.len());
        
        // Results should be identical (order may differ, so sort first)
        let mut serial_sorted = serial_results;
        let mut parallel_sorted = parallel_results;
        
        serial_sorted.sort_by(|a, b| a.freq_hz.partial_cmp(&b.freq_hz).unwrap());
        parallel_sorted.sort_by(|a, b| a.freq_hz.partial_cmp(&b.freq_hz).unwrap());
        
        for (s, p) in serial_sorted.iter().zip(parallel_sorted.iter()) {
            assert!((s.freq_hz - p.freq_hz).abs() < 1e-6);
            assert!((s.s11_db - p.s11_db).abs() < 1e-6);
        }
    }
    
    #[test]
    fn benchmark_1000_point_sweep() {
        let config = SweepConfig::new(100e6, 1100e6, 1000);
        let length = 0.15; // 15 cm dipole
        let radius = 0.001; // 1 mm radius
        
        // Benchmark serial version
        let start = Instant::now();
        let serial_results = run_cpu_sweep(&config, length, radius);
        let serial_time = start.elapsed();
        
        // Benchmark parallel version
        let start = Instant::now();
        let parallel_results = run_parallel_cpu_sweep(&config, length, radius);
        let parallel_time = start.elapsed();
        
        assert_eq!(serial_results.len(), 1000);
        assert_eq!(parallel_results.len(), 1000);
        
        eprintln!("1000-point sweep benchmark:");
        eprintln!("  Serial:   {:?}", serial_time);
        eprintln!("  Parallel: {:?}", parallel_time);
        
        if parallel_time < serial_time {
            let speedup = serial_time.as_secs_f64() / parallel_time.as_secs_f64();
            eprintln!("  Speedup:  {:.2}x", speedup);
        }
        
        // Both should complete in reasonable time (< 1 second)
        assert!(serial_time.as_secs() < 1);
        assert!(parallel_time.as_secs() < 1);
    }
}