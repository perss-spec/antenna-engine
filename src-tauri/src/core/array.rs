//! Antenna array analysis and array factor computation

use crate::core::element::AntennaElement;
use crate::core::types::{AntennaError, Result};
use crate::core::C0;
use num_complex::Complex64;
use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

/// Antenna array configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArrayConfig {
    pub num_elements: usize,
    pub spacing: f64,        // Element spacing in meters
    pub phase_shift: f64,    // Progressive phase shift in radians
    pub element_type: AntennaElement,
}

impl ArrayConfig {
    /// Create new array configuration
    pub fn new(
        num_elements: usize,
        spacing: f64,
        phase_shift: f64,
        element_type: AntennaElement,
    ) -> Result<Self> {
        if num_elements == 0 {
            return Err(AntennaError::InvalidParameter(
                "Number of elements must be greater than zero".to_string(),
            ));
        }
        if spacing <= 0.0 {
            return Err(AntennaError::InvalidParameter(
                "Element spacing must be positive".to_string(),
            ));
        }
        
        Ok(Self {
            num_elements,
            spacing,
            phase_shift,
            element_type,
        })
    }
    
    /// Create broadside array (maximum radiation perpendicular to array axis)
    pub fn broadside(
        num_elements: usize,
        spacing: f64,
        element_type: AntennaElement,
    ) -> Result<Self> {
        Self::new(num_elements, spacing, 0.0, element_type)
    }
    
    /// Create endfire array (maximum radiation along array axis)
    pub fn endfire(
        num_elements: usize,
        spacing: f64,
        frequency: f64,
        element_type: AntennaElement,
    ) -> Result<Self> {
        let k = 2.0 * PI * frequency / C0;
        let phase_shift = -k * spacing;
        Self::new(num_elements, spacing, phase_shift, element_type)
    }
}

/// Compute array factor for given angles and frequency
///
/// The array factor is computed using:
/// AF(θ) = Σ_{n=0}^{N-1} exp(j*n*(k*d*cos(θ) + β))
///
/// where:
/// - k = 2π*f/c (wave number)
/// - d = element spacing
/// - β = progressive phase shift
/// - θ = observation angle
///
/// Returns array factor magnitude in dB
pub fn compute_array_factor(
    config: &ArrayConfig,
    theta: &[f64],
    frequency: f64,
) -> Vec<f64> {
    if frequency <= 0.0 {
        return vec![-100.0; theta.len()];
    }
    
    let k = 2.0 * PI * frequency / C0;
    let mut array_factors = Vec::with_capacity(theta.len());
    
    for &angle in theta {
        let psi = k * config.spacing * angle.cos() + config.phase_shift;
        
        // Compute array factor sum
        let mut af_sum = Complex64::new(0.0, 0.0);
        for n in 0..config.num_elements {
            let phase = (n as f64) * psi;
            af_sum += Complex64::new(0.0, phase).exp();
        }
        
        // Convert to magnitude in dB
        let magnitude = af_sum.norm();
        let af_db = if magnitude > 1e-30 {
            20.0 * magnitude.log10()
        } else {
            -100.0 // Very low level floor
        };
        
        array_factors.push(af_db);
    }
    
    // Normalize to maximum value
    if let Some(&max_af) = array_factors.iter().max_by(|a, b| a.partial_cmp(b).unwrap()) {
        for af in &mut array_factors {
            *af -= max_af;
        }
    }
    
    array_factors
}

/// Compute array factor pattern over full hemisphere
pub fn compute_array_pattern(
    config: &ArrayConfig,
    frequency: f64,
    theta_points: usize,
) -> Result<Vec<(f64, f64)>> {
    if theta_points == 0 {
        return Err(AntennaError::InvalidParameter(
            "Number of theta points must be greater than zero".to_string(),
        ));
    }
    
    // Generate theta angles from 0 to π
    let mut theta_angles = Vec::with_capacity(theta_points);
    for i in 0..theta_points {
        let theta = (i as f64 / (theta_points - 1) as f64) * PI;
        theta_angles.push(theta);
    }
    
    let array_factors = compute_array_factor(config, &theta_angles, frequency);
    
    Ok(theta_angles.into_iter().zip(array_factors).collect())
}

/// Find beam direction (angle of maximum radiation)
pub fn find_beam_direction(
    config: &ArrayConfig,
    frequency: f64,
    theta_resolution: usize,
) -> Result<f64> {
    let pattern = compute_array_pattern(config, frequency, theta_resolution)?;
    
    let max_point = pattern
        .iter()
        .max_by(|(_, af1), (_, af2)| af1.partial_cmp(af2).unwrap())
        .ok_or_else(|| AntennaError::NumericalError(
            "Failed to find maximum in array pattern".to_string(),
        ))?;
    
    Ok(max_point.0)
}

/// Calculate array beamwidth (3dB width)
pub fn calculate_beamwidth(
    config: &ArrayConfig,
    frequency: f64,
    theta_resolution: usize,
) -> Result<f64> {
    let pattern = compute_array_pattern(config, frequency, theta_resolution)?;
    
    // Find maximum
    let max_af = pattern
        .iter()
        .map(|(_, af)| *af)
        .max_by(|a, b| a.partial_cmp(b).unwrap())
        .unwrap_or(-100.0);
    
    let threshold = max_af - 3.0; // 3dB down from peak
    
    // Find angles where pattern crosses 3dB threshold
    let mut crossings = Vec::new();
    for i in 1..pattern.len() {
        let (theta_prev, af_prev) = pattern[i - 1];
        let (theta_curr, af_curr) = pattern[i];
        
        // Check for crossing
        if (af_prev <= threshold && af_curr > threshold) ||
           (af_prev > threshold && af_curr <= threshold) {
            // Linear interpolation to find exact crossing point
            let t = (threshold - af_prev) / (af_curr - af_prev);
            let theta_cross = theta_prev + t * (theta_curr - theta_prev);
            crossings.push(theta_cross);
        }
    }
    
    // Calculate beamwidth from first and last crossings
    if crossings.len() >= 2 {
        let beamwidth = crossings.last().unwrap() - crossings.first().unwrap();
        Ok(beamwidth * 180.0 / PI) // Convert to degrees
    } else {
        Err(AntennaError::NumericalError(
            "Could not determine beamwidth from pattern".to_string(),
        ))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::element::AntennaElement;
    
    #[test]
    fn test_array_config_creation() {
        let element = AntennaElement::new_dipole(0.15, 0.001);
        let config = ArrayConfig::new(4, 0.5, 0.0, element);
        assert!(config.is_ok());
        
        let config = config.unwrap();
        assert_eq!(config.num_elements, 4);
        assert_eq!(config.spacing, 0.5);
        assert_eq!(config.phase_shift, 0.0);
    }
    
    #[test]
    fn test_invalid_array_config() {
        let element = AntennaElement::new_dipole(0.15, 0.001);
        
        // Zero elements should fail
        let config = ArrayConfig::new(0, 0.5, 0.0, element.clone());
        assert!(config.is_err());
        
        // Negative spacing should fail
        let config = ArrayConfig::new(4, -0.5, 0.0, element);
        assert!(config.is_err());
    }
    
    #[test]
    fn test_broadside_array() {
        let element = AntennaElement::new_dipole(0.15, 0.001);
        let config = ArrayConfig::broadside(4, 0.5, element).unwrap();
        
        let frequency = 300e6; // 300 MHz
        let theta_angles = vec![0.0, PI/4.0, PI/2.0, 3.0*PI/4.0, PI];
        let af = compute_array_factor(&config, &theta_angles, frequency);
        
        // For broadside array, maximum should be at θ = π/2 (90 degrees)
        let max_index = af.iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap())
            .map(|(i, _)| i)
            .unwrap();
        
        assert_eq!(max_index, 2); // Index 2 corresponds to θ = π/2
        assert!(af[max_index] >= af[0]); // Maximum at broadside
        assert!(af[max_index] >= af[4]); // Maximum at broadside
    }
    
    #[test]
    fn test_endfire_array() {
        let element = AntennaElement::new_dipole(0.15, 0.001);
        let frequency = 300e6; // 300 MHz
        let config = ArrayConfig::endfire(4, 0.5, frequency, element).unwrap();
        
        let theta_angles = vec![0.0, PI/4.0, PI/2.0, 3.0*PI/4.0, PI];
        let af = compute_array_factor(&config, &theta_angles, frequency);
        
        // For endfire array, maximum should be at θ = 0 (0 degrees)
        let max_index = af.iter()
            .enumerate()
            .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap())
            .map(|(i, _)| i)
            .unwrap();
        
        assert_eq!(max_index, 0); // Index 0 corresponds to θ = 0
        assert!(af[0] >= af[2]); // Maximum at endfire
        assert!(af[0] >= af[4]); // Maximum at endfire
    }
    
    #[test]
    fn test_array_factor_computation() {
        let element = AntennaElement::new_dipole(0.15, 0.001);
        let config = ArrayConfig::new(2, 0.5, 0.0, element).unwrap();
        
        let frequency = 300e6;
        let theta_angles = vec![PI/2.0]; // Broadside direction
        let af = compute_array_factor(&config, &theta_angles, frequency);
        
        assert_eq!(af.len(), 1);
        assert!(af[0].is_finite());
        assert_eq!(af[0], 0.0); // Normalized to 0 dB at maximum
    }
    
    #[test]
    fn test_array_pattern_computation() {
        let element = AntennaElement::new_dipole(0.15, 0.001);
        let config = ArrayConfig::broadside(3, 0.5, element).unwrap();
        
        let frequency = 300e6;
        let pattern = compute_array_pattern(&config, frequency, 181);
        
        assert!(pattern.is_ok());
        let pattern = pattern.unwrap();
        assert_eq!(pattern.len(), 181);
        
        // Check that angles range from 0 to π
        assert!((pattern[0].0 - 0.0).abs() < 1e-10);
        assert!((pattern[180].0 - PI).abs() < 1e-10);
    }
    
    #[test]
    fn test_beam_direction_finding() {
        let element = AntennaElement::new_dipole(0.15, 0.001);
        let config = ArrayConfig::broadside(4, 0.5, element).unwrap();
        
        let frequency = 300e6;
        let beam_dir = find_beam_direction(&config, frequency, 181);
        
        assert!(beam_dir.is_ok());
        let beam_dir = beam_dir.unwrap();
        
        // For broadside array, beam should point at π/2 (90 degrees)
        assert!((beam_dir - PI/2.0).abs() < 0.1); // Within 0.1 radians
    }
    
    #[test]
    fn test_zero_frequency() {
        let element = AntennaElement::new_dipole(0.15, 0.001);
        let config = ArrayConfig::broadside(2, 0.5, element).unwrap();
        
        let theta_angles = vec![PI/2.0];
        let af = compute_array_factor(&config, &theta_angles, 0.0);
        
        assert_eq!(af.len(), 1);
        assert_eq!(af[0], -100.0); // Should return floor value
    }
}