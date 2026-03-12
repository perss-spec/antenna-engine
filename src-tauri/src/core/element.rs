use num_complex::Complex64;
use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

use crate::core::types::Result;

/// Trait for antenna elements that can compute impedance and radiation patterns
pub trait AntennaElement: Send + Sync {
    /// Calculate the input impedance at a given frequency
    /// 
    /// # Arguments
    /// * `freq` - Frequency in Hz
    /// 
    /// # Returns
    /// Complex impedance in Ohms
    fn impedance(&self, freq: f64) -> Result<Complex64>;
    
    /// Calculate the radiation pattern at given angles
    /// 
    /// # Arguments
    /// * `theta` - Elevation angle in radians (0 to π)
    /// * `phi` - Azimuth angle in radians (0 to 2π)
    /// 
    /// # Returns
    /// Normalized radiation intensity (0.0 to 1.0)
    fn radiation_pattern(&self, theta: f64, phi: f64) -> Result<f64>;
}

/// Half-wave dipole antenna element
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DipoleAntenna {
    /// Length of the dipole in meters
    pub length: f64,
    /// Radius of the dipole conductor in meters
    pub radius: f64,
}

impl DipoleAntenna {
    /// Create a new dipole antenna
    pub fn new(length: f64, radius: f64) -> Result<Self> {
        if length <= 0.0 {
            return Err("Dipole length must be positive".into());
        }
        if radius <= 0.0 {
            return Err("Dipole radius must be positive".into());
        }
        if radius >= length / 2.0 {
            return Err("Dipole radius must be less than half the length".into());
        }
        
        Ok(Self { length, radius })
    }
    
    /// Calculate the wavelength at a given frequency
    fn wavelength(&self, freq: f64) -> f64 {
        const C: f64 = 299_792_458.0; // Speed of light in m/s
        C / freq
    }
    
    /// Calculate beta (propagation constant)
    fn beta(&self, freq: f64) -> f64 {
        2.0 * PI / self.wavelength(freq)
    }
}

impl AntennaElement for DipoleAntenna {
    fn impedance(&self, freq: f64) -> Result<Complex64> {
        if freq <= 0.0 {
            return Err("Frequency must be positive".into());
        }
        
        let beta = self.beta(freq);
        let k_l = beta * self.length;
        
        // Characteristic impedance of free space
        const Z0: f64 = 376.730313668; // Ohms
        
        // Simplified dipole impedance formula
        // For thin dipoles, we use the sinusoidal current distribution approximation
        let sin_kl = k_l.sin();
        let cos_kl = k_l.cos();
        
        // Radiation resistance (approximate for thin dipoles)
        let r_rad = if (sin_kl).abs() < 1e-10 {
            // Near resonance
            73.13
        } else {
            // General case using induced EMF method
            let factor = Z0 / (2.0 * PI);
            factor * (1.0 - cos_kl) / sin_kl.powi(2)
        };
        
        // Reactance calculation using induced EMF method
        let ln_term = (self.length / self.radius).ln();
        let x_a = (Z0 / (2.0 * PI)) * 
                  (sin_kl * (ln_term - 1.0) + 
                   cos_kl * (0.5772 + ln_term * (1.0 - cos_kl) / sin_kl));
        
        Ok(Complex64::new(r_rad, x_a))
    }
    
    fn radiation_pattern(&self, theta: f64, phi: f64) -> Result<f64> {
        if theta < 0.0 || theta > PI {
            return Err("Theta must be between 0 and π".into());
        }
        if phi < 0.0 || phi > 2.0 * PI {
            return Err("Phi must be between 0 and 2π".into());
        }
        
        // Dipole radiation pattern (normalized)
        // For a dipole aligned along z-axis, pattern is independent of phi
        let sin_theta = theta.sin();
        
        if sin_theta.abs() < 1e-10 {
            Ok(0.0) // No radiation along the dipole axis
        } else {
            // Classic dipole pattern: sin²(θ)
            Ok(sin_theta.powi(2))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use approx::assert_relative_eq;
    
    #[test]
    fn test_dipole_creation() {
        // Valid dipole
        let dipole = DipoleAntenna::new(0.5, 0.001).unwrap();
        assert_eq!(dipole.length, 0.5);
        assert_eq!(dipole.radius, 0.001);
        
        // Invalid length
        assert!(DipoleAntenna::new(-0.5, 0.001).is_err());
        assert!(DipoleAntenna::new(0.0, 0.001).is_err());
        
        // Invalid radius
        assert!(DipoleAntenna::new(0.5, -0.001).is_err());
        assert!(DipoleAntenna::new(0.5, 0.0).is_err());
        
        // Radius too large
        assert!(DipoleAntenna::new(0.5, 0.3).is_err());
    }
    
    #[test]
    fn test_dipole_impedance() {
        // Half-wave dipole at 300 MHz
        let freq = 300e6; // 300 MHz
        let wavelength = 299_792_458.0 / freq; // ~1 meter
        let dipole = DipoleAntenna::new(wavelength / 2.0, 0.001).unwrap();
        
        let z = dipole.impedance(freq).unwrap();
        
        // At resonance (half-wave), impedance should be approximately 73 + j0 ohms
        assert_relative_eq!(z.re, 73.13, epsilon = 5.0);
        assert!(z.im.abs() < 50.0); // Reactance should be small near resonance
        
        // Test invalid frequency
        assert!(dipole.impedance(-100e6).is_err());
        assert!(dipole.impedance(0.0).is_err());
    }
    
    #[test]
    fn test_dipole_radiation_pattern() {
        let dipole = DipoleAntenna::new(0.5, 0.001).unwrap();
        
        // Test at various angles
        // At theta=0 (along dipole axis), should be 0
        assert_relative_eq!(dipole.radiation_pattern(0.0, 0.0).unwrap(), 0.0, epsilon = 1e-10);
        assert_relative_eq!(dipole.radiation_pattern(PI, 0.0).unwrap(), 0.0, epsilon = 1e-10);
        
        // At theta=π/2 (perpendicular to dipole), should be maximum (1.0)
        assert_relative_eq!(dipole.radiation_pattern(PI/2.0, 0.0).unwrap(), 1.0, epsilon = 1e-10);
        assert_relative_eq!(dipole.radiation_pattern(PI/2.0, PI).unwrap(), 1.0, epsilon = 1e-10);
        
        // At theta=π/4, should be sin²(π/4) = 0.5
        assert_relative_eq!(dipole.radiation_pattern(PI/4.0, 0.0).unwrap(), 0.5, epsilon = 1e-10);
        
        // Pattern should be independent of phi
        let theta = PI / 3.0;
        let pattern1 = dipole.radiation_pattern(theta, 0.0).unwrap();
        let pattern2 = dipole.radiation_pattern(theta, PI).unwrap();
        let pattern3 = dipole.radiation_pattern(theta, PI/2.0).unwrap();
        assert_relative_eq!(pattern1, pattern2, epsilon = 1e-10);
        assert_relative_eq!(pattern1, pattern3, epsilon = 1e-10);
        
        // Test invalid angles
        assert!(dipole.radiation_pattern(-0.1, 0.0).is_err());
        assert!(dipole.radiation_pattern(PI + 0.1, 0.0).is_err());
        assert!(dipole.radiation_pattern(PI/2.0, -0.1).is_err());
        assert!(dipole.radiation_pattern(PI/2.0, 2.0*PI + 0.1).is_err());
    }
    
    #[test]
    fn test_wavelength_calculation() {
        let dipole = DipoleAntenna::new(0.5, 0.001).unwrap();
        
        // Test at 300 MHz
        let wavelength = dipole.wavelength(300e6);
        assert_relative_eq!(wavelength, 0.999308, epsilon = 1e-6);
        
        // Test at 1 GHz
        let wavelength = dipole.wavelength(1e9);
        assert_relative_eq!(wavelength, 0.299792458, epsilon = 1e-9);
    }
}