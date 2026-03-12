use num_complex::Complex64;
use serde::{Deserialize, Serialize};

use crate::core::types::{Result, AntennaError};
use crate::core::geometry::{Point3D, Segment, Mesh};
use crate::core::solver::SParameterResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Port {
    pub port_number: usize,
    pub segment_index: usize,
    pub impedance: f64,
    pub voltage: Complex64,
}

impl Default for Port {
    fn default() -> Self {
        Self {
            port_number: 1,
            segment_index: 0,
            impedance: 50.0,
            voltage: Complex64::new(1.0, 0.0),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortDefinition {
    pub ports: Vec<Port>,
}

impl PortDefinition {
    pub fn single_port() -> Self {
        Self {
            ports: vec![Port::default()],
        }
    }
    
    pub fn two_port(seg1: usize, seg2: usize) -> Self {
        Self {
            ports: vec![
                Port {
                    port_number: 1,
                    segment_index: seg1,
                    impedance: 50.0,
                    voltage: Complex64::new(1.0, 0.0),
                },
                Port {
                    port_number: 2,
                    segment_index: seg2,
                    impedance: 50.0,
                    voltage: Complex64::new(0.0, 0.0),
                },
            ],
        }
    }
}

pub fn extract_s_parameters(
    currents: &[Complex64],
    port_def: &PortDefinition,
    segments: &[Segment],
    mesh: &Mesh,
) -> Result<SParameterResult> {
    if port_def.ports.is_empty() {
        return Err(AntennaError::InvalidParameter("No ports defined".to_string()));
    }
    
    // For single port, extract S11
    let port = &port_def.ports[0];
    
    if port.segment_index >= currents.len() {
        return Err(AntennaError::InvalidParameter(
            format!("Port segment index {} out of bounds", port.segment_index)
        ));
    }
    
    // Get current at feed point
    let i_in = currents[port.segment_index];
    let v_in = port.voltage;
    
    // Avoid division by zero
    if i_in.norm() < 1e-10 {
        return Err(AntennaError::NumericalError("Zero current at feed point".to_string()));
    }
    
    // Input impedance Z_in = V_in / I_in
    let z_in = v_in / i_in;
    let z0 = port.impedance;
    
    // S11 = (Z_in - Z0) / (Z_in + Z0)
    let s11 = (z_in - z0) / (z_in + z0);
    
    // Convert to dB and degrees
    let s11_mag = s11.norm();
    let s11_mag_db = 20.0 * s11_mag.log10();
    let s11_phase_deg = s11.arg() * 180.0 / std::f64::consts::PI;
    
    // VSWR = (1 + |S11|) / (1 - |S11|)
    let vswr = if s11_mag < 0.999 {
        (1.0 + s11_mag) / (1.0 - s11_mag)
    } else {
        999.9 // Cap at reasonable value
    };
    
    Ok(SParameterResult {
        frequency: 0.0, // caller must set
        s11_re: s11.re,
        s11_im: s11.im,
        vswr,
        input_impedance_re: z_in.re,
        input_impedance_im: z_in.im,
    })
}

pub fn compute_input_impedance(
    current: Complex64,
    voltage: Complex64,
) -> Result<Complex64> {
    if current.norm() < 1e-10 {
        return Err(AntennaError::NumericalError("Zero current".to_string()));
    }
    Ok(voltage / current)
}

pub fn s11_from_impedance(z_in: Complex64, z0: f64) -> Complex64 {
    (z_in - z0) / (z_in + z0)
}

pub fn vswr_from_s11(s11: Complex64) -> f64 {
    let mag = s11.norm();
    if mag < 0.999 {
        (1.0 + mag) / (1.0 - mag)
    } else {
        999.9
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_s11_matched() {
        // Matched load: Z_in = Z0 = 50
        let z_in = Complex64::new(50.0, 0.0);
        let s11 = s11_from_impedance(z_in, 50.0);
        assert!(s11.norm() < 1e-10);
    }
    
    #[test]
    fn test_s11_open() {
        // Open circuit: Z_in = infinity (approximated)
        let z_in = Complex64::new(1e6, 0.0);
        let s11 = s11_from_impedance(z_in, 50.0);
        assert!((s11.norm() - 1.0).abs() < 0.01);
    }
    
    #[test]
    fn test_vswr() {
        // Perfect match
        let s11 = Complex64::new(0.0, 0.0);
        assert_eq!(vswr_from_s11(s11), 1.0);
        
        // 3:1 VSWR corresponds to |S11| = 0.5
        let s11 = Complex64::new(0.5, 0.0);
        let vswr = vswr_from_s11(s11);
        assert!((vswr - 3.0).abs() < 0.01);
    }
}