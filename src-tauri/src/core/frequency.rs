use serde::{Deserialize, Serialize};
use crate::core::types::{Result, AntennaError};

/// Frequency sweep configuration for antenna simulations
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct FrequencySweep {
    /// Start frequency in Hz
    pub start_freq: f64,
    /// Stop frequency in Hz
    pub stop_freq: f64,
    /// Number of frequency points
    pub num_points: usize,
}

impl FrequencySweep {
    /// Create a new frequency sweep configuration
    pub fn new(start_freq: f64, stop_freq: f64, num_points: usize) -> Result<Self> {
        if start_freq <= 0.0 {
            return Err(AntennaError::InvalidGeometry(
                "Start frequency must be positive".to_string()
            ));
        }
        if stop_freq <= 0.0 {
            return Err(AntennaError::InvalidGeometry(
                "Stop frequency must be positive".to_string()
            ));
        }
        if stop_freq <= start_freq {
            return Err(AntennaError::InvalidGeometry(
                "Stop frequency must be greater than start frequency".to_string()
            ));
        }
        if num_points < 2 {
            return Err(AntennaError::InvalidGeometry(
                "Number of points must be at least 2".to_string()
            ));
        }
        
        Ok(Self {
            start_freq,
            stop_freq,
            num_points,
        })
    }
    
    /// Generate linearly spaced frequency points
    pub fn sweep(&self) -> Vec<f64> {
        let mut frequencies = Vec::with_capacity(self.num_points);
        
        if self.num_points == 1 {
            frequencies.push(self.start_freq);
            return frequencies;
        }
        
        let step = (self.stop_freq - self.start_freq) / (self.num_points - 1) as f64;
        
        for i in 0..self.num_points {
            let freq = self.start_freq + (i as f64) * step;
            frequencies.push(freq);
        }
        
        frequencies
    }
    
    /// Get the frequency step size
    pub fn step_size(&self) -> f64 {
        if self.num_points <= 1 {
            0.0
        } else {
            (self.stop_freq - self.start_freq) / (self.num_points - 1) as f64
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_frequency_sweep_new_valid() {
        let sweep = FrequencySweep::new(1e9, 2e9, 11).unwrap();
        assert_eq!(sweep.start_freq, 1e9);
        assert_eq!(sweep.stop_freq, 2e9);
        assert_eq!(sweep.num_points, 11);
    }
    
    #[test]
    fn test_frequency_sweep_new_invalid_start() {
        let result = FrequencySweep::new(-1e9, 2e9, 11);
        assert!(result.is_err());
        match result.unwrap_err() {
            AntennaError::InvalidGeometry(msg) => {
                assert!(msg.contains("Start frequency must be positive"));
            }
            _ => panic!("Wrong error type"),
        }
    }
    
    #[test]
    fn test_frequency_sweep_new_invalid_stop() {
        let result = FrequencySweep::new(1e9, -2e9, 11);
        assert!(result.is_err());
        match result.unwrap_err() {
            AntennaError::InvalidGeometry(msg) => {
                assert!(msg.contains("Stop frequency must be positive"));
            }
            _ => panic!("Wrong error type"),
        }
    }
    
    #[test]
    fn test_frequency_sweep_new_invalid_order() {
        let result = FrequencySweep::new(2e9, 1e9, 11);
        assert!(result.is_err());
        match result.unwrap_err() {
            AntennaError::InvalidGeometry(msg) => {
                assert!(msg.contains("Stop frequency must be greater than start frequency"));
            }
            _ => panic!("Wrong error type"),
        }
    }
    
    #[test]
    fn test_frequency_sweep_new_invalid_points() {
        let result = FrequencySweep::new(1e9, 2e9, 1);
        assert!(result.is_err());
        match result.unwrap_err() {
            AntennaError::InvalidGeometry(msg) => {
                assert!(msg.contains("Number of points must be at least 2"));
            }
            _ => panic!("Wrong error type"),
        }
    }
    
    #[test]
    fn test_sweep_basic() {
        let sweep = FrequencySweep::new(1e9, 2e9, 11).unwrap();
        let frequencies = sweep.sweep();
        
        assert_eq!(frequencies.len(), 11);
        assert_eq!(frequencies[0], 1e9);
        assert_eq!(frequencies[10], 2e9);
        
        // Check linear spacing
        for i in 1..frequencies.len() {
            let diff = frequencies[i] - frequencies[i-1];
            assert!((diff - 1e8).abs() < 1e-10);
        }
    }
    
    #[test]
    fn test_sweep_two_points() {
        let sweep = FrequencySweep::new(1e9, 3e9, 2).unwrap();
        let frequencies = sweep.sweep();
        
        assert_eq!(frequencies.len(), 2);
        assert_eq!(frequencies[0], 1e9);
        assert_eq!(frequencies[1], 3e9);
    }
    
    #[test]
    fn test_sweep_precision() {
        let sweep = FrequencySweep::new(1.0, 2.0, 101).unwrap();
        let frequencies = sweep.sweep();
        
        assert_eq!(frequencies.len(), 101);
        assert_eq!(frequencies[0], 1.0);
        assert_eq!(frequencies[100], 2.0);
        
        // Check that intermediate values are correct
        assert!((frequencies[50] - 1.5).abs() < 1e-15);
    }
    
    #[test]
    fn test_step_size() {
        let sweep = FrequencySweep::new(1e9, 2e9, 11).unwrap();
        assert_eq!(sweep.step_size(), 1e8);
        
        let sweep2 = FrequencySweep::new(1e9, 3e9, 21).unwrap();
        assert_eq!(sweep2.step_size(), 1e8);
        
        let sweep3 = FrequencySweep::new(1e9, 1.1e9, 2).unwrap();
        assert!((sweep3.step_size() - 1e8).abs() < 1e-10);
    }
}