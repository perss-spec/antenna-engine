use num_complex::Complex64;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PortType {
    VoltageSource { voltage: Complex64 },
    CurrentSource { current: Complex64 },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Port {
    pub segment_index: usize,
    pub port_type: PortType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortExcitation {
    pub voltage: Complex64,
    pub current: Complex64,
}

impl Port {
    pub fn new(segment_index: usize, port_type: PortType) -> Self {
        Self {
            segment_index,
            port_type,
        }
    }

    pub fn get_excitation(&self) -> Complex64 {
        match &self.port_type {
            PortType::VoltageSource { voltage } => *voltage,
            PortType::CurrentSource { current } => *current,
        }
    }

    pub fn calculate_s_parameter(
        &self,
        input_impedance: Complex64,
        reference_impedance: f64,
    ) -> Complex64 {
        let z0 = Complex64::new(reference_impedance, 0.0);
        (input_impedance - z0) / (input_impedance + z0)
    }

    pub fn calculate_vswr(s11: Complex64) -> f64 {
        let mag = s11.norm();
        (1.0 + mag) / (1.0 - mag)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_port_creation() {
        let port = Port::new(0, PortType::VoltageSource { voltage: Complex64::new(1.0, 0.0) });
        assert_eq!(port.segment_index, 0);
        let v = port.get_excitation();
        assert_eq!(v.re, 1.0);
        assert_eq!(v.im, 0.0);
    }

    #[test]
    fn test_s_parameter_calculation() {
        let port = Port::new(0, PortType::VoltageSource { voltage: Complex64::new(1.0, 0.0) });
        let z_in = Complex64::new(73.0, 42.5);
        let s11 = port.calculate_s_parameter(z_in, 50.0);
        assert!(s11.norm() < 1.0);
    }

    #[test]
    fn test_vswr_calculation() {
        let s11 = Complex64::new(0.2, 0.1);
        let vswr = Port::calculate_vswr(s11);
        assert!(vswr > 1.0);
    }
}
