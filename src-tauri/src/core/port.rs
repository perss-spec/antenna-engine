use num_complex::Complex64;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PortType {
    Voltage,
    Current,
    Balanced,
    Unbalanced,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Port {
    pub id: usize,
    pub name: String,
    pub port_type: PortType,
    pub position: [f64; 3],
    pub direction: [f64; 3],
    pub impedance_re: f64,
    pub impedance_im: f64,
    pub wire_index: Option<usize>,
    pub segment_index: Option<usize>,
    pub enabled: bool,
}

impl Default for Port {
    fn default() -> Self {
        Self {
            id: 0,
            name: "Port1".to_string(),
            port_type: PortType::Voltage,
            position: [0.0, 0.0, 0.0],
            direction: [1.0, 0.0, 0.0],
            impedance_re: 50.0,
            impedance_im: 0.0,
            wire_index: None,
            segment_index: None,
            enabled: true,
        }
    }
}

impl Port {
    pub fn new(id: usize, name: String) -> Self {
        Self {
            id,
            name,
            ..Default::default()
        }
    }

    pub fn voltage_port(id: usize, name: String, position: [f64; 3], impedance: f64) -> Self {
        Self {
            id,
            name,
            port_type: PortType::Voltage,
            position,
            impedance_re: impedance,
            impedance_im: 0.0,
            ..Default::default()
        }
    }

    pub fn current_port(id: usize, name: String, position: [f64; 3], impedance: f64) -> Self {
        Self {
            id,
            name,
            port_type: PortType::Current,
            position,
            impedance_re: impedance,
            impedance_im: 0.0,
            ..Default::default()
        }
    }

    pub fn balanced_port(id: usize, name: String, position: [f64; 3], impedance: f64) -> Self {
        Self {
            id,
            name,
            port_type: PortType::Balanced,
            position,
            impedance_re: impedance,
            impedance_im: 0.0,
            ..Default::default()
        }
    }

    pub fn set_wire_segment(&mut self, wire_index: usize, segment_index: usize) {
        self.wire_index = Some(wire_index);
        self.segment_index = Some(segment_index);
    }

    pub fn is_attached(&self) -> bool {
        self.wire_index.is_some() && self.segment_index.is_some()
    }

    pub fn impedance(&self) -> Complex64 {
        Complex64::new(self.impedance_re, self.impedance_im)
    }
}

pub struct PortManager {
    ports: Vec<Port>,
    reference_impedance: f64,
}

impl Default for PortManager {
    fn default() -> Self {
        Self {
            ports: Vec::new(),
            reference_impedance: 50.0,
        }
    }
}

impl PortManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn with_reference_impedance(mut self, z0: f64) -> Self {
        self.reference_impedance = z0;
        self
    }

    pub fn add_port(&mut self, port: Port) -> Result<(), String> {
        if self.ports.iter().any(|p| p.id == port.id) {
            return Err(format!("Port with ID {} already exists", port.id));
        }
        self.ports.push(port);
        Ok(())
    }

    pub fn remove_port(&mut self, port_id: usize) -> Result<(), String> {
        let initial_len = self.ports.len();
        self.ports.retain(|p| p.id != port_id);
        if self.ports.len() == initial_len {
            return Err(format!("Port with ID {} not found", port_id));
        }
        Ok(())
    }

    pub fn get_port(&self, port_id: usize) -> Option<&Port> {
        self.ports.iter().find(|p| p.id == port_id)
    }

    pub fn get_port_mut(&mut self, port_id: usize) -> Option<&mut Port> {
        self.ports.iter_mut().find(|p| p.id == port_id)
    }

    pub fn get_active_ports(&self) -> Vec<&Port> {
        self.ports.iter().filter(|p| p.enabled).collect()
    }

    pub fn get_num_ports(&self) -> usize {
        self.ports.len()
    }

    pub fn set_reference_impedance(&mut self, z0: f64) {
        self.reference_impedance = z0;
    }

    pub fn get_reference_impedance(&self) -> f64 {
        self.reference_impedance
    }

    pub fn clear_ports(&mut self) {
        self.ports.clear();
    }

    pub fn get_ports(&self) -> &[Port] {
        &self.ports
    }

    pub fn enable_port(&mut self, port_id: usize, enabled: bool) -> Result<(), String> {
        if let Some(port) = self.get_port_mut(port_id) {
            port.enabled = enabled;
            Ok(())
        } else {
            Err(format!("Port {} not found", port_id))
        }
    }

    /// Calculate VSWR from S11 reflection coefficient magnitude
    pub fn calculate_vswr_from_s11(&self, s11_magnitude: f64) -> f64 {
        let gamma = s11_magnitude.abs();
        if gamma < 1.0 {
            (1.0 + gamma) / (1.0 - gamma)
        } else {
            f64::INFINITY
        }
    }

    /// Calculate return loss from S11 magnitude
    pub fn calculate_return_loss_from_s11(&self, s11_magnitude: f64) -> f64 {
        -20.0 * s11_magnitude.abs().log10()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_port_creation() {
        let port = Port::voltage_port(1, "Test".to_string(), [0.0, 0.0, 0.0], 50.0);
        assert_eq!(port.id, 1);
        assert_eq!(port.name, "Test");
        assert!(matches!(port.port_type, PortType::Voltage));
    }

    #[test]
    fn test_port_manager() {
        let mut manager = PortManager::new();
        let port = Port::new(1, "Port1".to_string());

        assert!(manager.add_port(port).is_ok());
        assert_eq!(manager.get_num_ports(), 1);

        assert!(manager.remove_port(1).is_ok());
        assert_eq!(manager.get_num_ports(), 0);
    }

    #[test]
    fn test_vswr_calculation() {
        let manager = PortManager::new();
        // Perfect match: S11 = 0 => VSWR = 1
        let vswr = manager.calculate_vswr_from_s11(0.0);
        assert!((vswr - 1.0).abs() < 1e-10);

        // S11 = 0.5 => VSWR = 3
        let vswr = manager.calculate_vswr_from_s11(0.5);
        assert!((vswr - 3.0).abs() < 1e-10);
    }
}
