//! Physical constants for electromagnetic calculations

/// Physical constants used in MoM calculations
pub struct PhysicalConstants;

impl PhysicalConstants {
    /// Speed of light in vacuum (m/s)
    pub const C0: f64 = 2.99792458e8;
    
    /// Permeability of free space (H/m)
    pub const MU0: f64 = 4.0e-7 * std::f64::consts::PI;
    
    /// Permittivity of free space (F/m)
    pub const EPS0: f64 = 1.0 / (Self::MU0 * Self::C0 * Self::C0);
    
    /// Intrinsic impedance of free space (Ω)
    pub const ETA0: f64 = 376.730313668;
    
    /// Calculate wavelength from frequency
    pub fn wavelength(frequency: f64) -> f64 {
        Self::C0 / frequency
    }
    
    /// Calculate wavenumber from frequency
    pub fn wavenumber(frequency: f64) -> f64 {
        2.0 * std::f64::consts::PI * frequency / Self::C0
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_constants() {
        assert!((PhysicalConstants::C0 - 2.99792458e8).abs() < 1e-3);
        assert!((PhysicalConstants::ETA0 - 376.73).abs() < 0.01);
    }
    
    #[test]
    fn test_wavelength() {
        let freq = 300e6; // 300 MHz
        let lambda = PhysicalConstants::wavelength(freq);
        assert!((lambda - 1.0).abs() < 0.001); // Should be 1 meter
    }
}