use crate::core::types::{Result, AntennaError};
use crate::core::solver::SParameterResult;
use num_complex::Complex64;
use ndarray::Array1;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Port {
    pub segment_index: usize,
    pub voltage: Complex64,
    pub impedance: f64,
}

impl Port {
    pub fn new(segment_index: usize, impedance: f64) -> Self {
        Self {
            segment_index,
            voltage: Complex64::new(1.0, 0.0),
            impedance,
        }
    }
}

pub fn extract_s_parameters(
    currents: &Array1<Complex64>,
    port: &Port,
    frequency: f64,
) -> Result<SParameterResult> {
    // Validate inputs
    if currents.is_empty() {
        return Err(AntennaError::InvalidParameter(
            "Empty current array".to_string()
        ));
    }
    
    if port.segment_index >= currents.len() {
        return Err(AntennaError::InvalidParameter(
            format!("Port segment index {} out of bounds", port.segment_index)
        ));
    }
    
    // Get port current
    let i_port = currents[port.segment_index];
    
    // Check for zero current
    if i_port.norm() < 1e-10 {
        return Err(AntennaError::NumericalError(
            "Zero current at port".to_string()
        ));
    }
    
    // Calculate input impedance Z_in = V/I
    let z_in = port.voltage / i_port;
    
    // Reference impedance
    let z0 = Complex64::new(port.impedance, 0.0);
    
    // Calculate S11 = (Z_in - Z0) / (Z_in + Z0)
    let s11 = (z_in - z0) / (z_in + z0);
    
    // Calculate VSWR = (1 + |S11|) / (1 - |S11|)
    let s11_mag = s11.norm();
    let vswr = if s11_mag < 0.999 {
        (1.0 + s11_mag) / (1.0 - s11_mag)
    } else {
        999.9 // Cap at reasonable value
    };
    
    Ok(SParameterResult {
        frequency,
        s11_re: s11.re,
        s11_im: s11.im,
        vswr,
        input_impedance_re: z_in.re,
        input_impedance_im: z_in.im,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_port_creation() {
        let port = Port::new(0, 50.0);
        assert_eq!(port.segment_index, 0);
        assert_eq!(port.impedance, 50.0);
        assert_eq!(port.voltage.re, 1.0);
        assert_eq!(port.voltage.im, 0.0);
    }
    
    #[test]
    fn test_extract_s_parameters_valid() {
        let mut currents = Array1::<Complex64>::zeros(3);
        currents[0] = Complex64::new(0.01, -0.005);
        currents[1] = Complex64::new(0.008, -0.004);
        currents[2] = Complex64::new(0.006, -0.003);
        
        let port = Port::new(0, 50.0);
        let result = extract_s_parameters(&currents, &port, 300e6);
        
        assert!(result.is_ok());
        let s_params = result.unwrap();
        assert_eq!(s_params.frequency, 300e6);
    }
    
    #[test]
    fn test_extract_s_parameters_empty_currents() {
        let currents = Array1::<Complex64>::zeros(0);
        let port = Port::new(0, 50.0);
        let result = extract_s_parameters(&currents, &port, 300e6);
        
        assert!(result.is_err());
    }
    
    #[test]
    fn test_extract_s_parameters_invalid_port_index() {
        let currents = Array1::<Complex64>::zeros(2);
        let port = Port::new(5, 50.0);
        let result = extract_s_parameters(&currents, &port, 300e6);
        
        assert!(result.is_err());
    }
    
    #[test]
    fn test_extract_s_parameters_zero_current() {
        let currents = Array1::<Complex64>::zeros(3);
        let port = Port::new(0, 50.0);
        let result = extract_s_parameters(&currents, &port, 300e6);
        
        assert!(result.is_err());
    }
}