use crate::core::linear_algebra::{ComplexMatrix, ComplexVector};
use crate::core::mom_solver::{MoMSolver, MoMSolution};
use nalgebra::{Complex, DMatrix, DVector};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
    pub impedance: Complex<f64>,
    pub wire_index: Option<usize>,
    pub segment_index: Option<usize>,
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SParameters {
    pub frequencies: Vec<f64>,
    pub s_matrix: Vec<ComplexMatrix>,
    pub z_matrix: Vec<ComplexMatrix>,
    pub port_impedances: Vec<Vec<Complex<f64>>>,
    pub num_ports: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortExcitation {
    pub port_id: usize,
    pub voltage: Complex<f64>,
    pub current: Complex<f64>,
    pub power: f64,
}

pub struct PortManager {
    ports: Vec<Port>,
    reference_impedance: f64,
}

impl Default for Port {
    fn default() -> Self {
        Self {
            id: 0,
            name: "Port1".to_string(),
            port_type: PortType::Voltage,
            position: [0.0, 0.0, 0.0],
            direction: [1.0, 0.0, 0.0],
            impedance: Complex::new(50.0, 0.0),
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
            impedance: Complex::new(impedance, 0.0),
            ..Default::default()
        }
    }

    pub fn current_port(id: usize, name: String, position: [f64; 3], impedance: f64) -> Self {
        Self {
            id,
            name,
            port_type: PortType::Current,
            position,
            impedance: Complex::new(impedance, 0.0),
            ..Default::default()
        }
    }

    pub fn balanced_port(id: usize, name: String, position: [f64; 3], impedance: f64) -> Self {
        Self {
            id,
            name,
            port_type: PortType::Balanced,
            position,
            impedance: Complex::new(impedance, 0.0),
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

    pub fn calculate_s_parameters(
        &self,
        frequencies: &[f64],
        mom_solver: &mut MoMSolver,
    ) -> Result<SParameters, String> {
        let active_ports = self.get_active_ports();
        let num_ports = active_ports.len();

        if num_ports == 0 {
            return Err("No active ports found".to_string());
        }

        let mut s_matrices = Vec::new();
        let mut z_matrices = Vec::new();
        let mut port_impedances = Vec::new();

        for &freq in frequencies {
            mom_solver.set_frequency(freq);
            
            let (z_matrix, port_z) = self.calculate_z_matrix(mom_solver, &active_ports)?;
            let s_matrix = self.z_to_s_matrix(&z_matrix, &port_z)?;

            z_matrices.push(z_matrix);
            s_matrices.push(s_matrix);
            port_impedances.push(port_z);
        }

        Ok(SParameters {
            frequencies: frequencies.to_vec(),
            s_matrix: s_matrices,
            z_matrix: z_matrices,
            port_impedances,
            num_ports,
        })
    }

    fn calculate_z_matrix(
        &self,
        mom_solver: &mut MoMSolver,
        active_ports: &[&Port],
    ) -> Result<(ComplexMatrix, Vec<Complex<f64>>), String> {
        let num_ports = active_ports.len();
        let mut z_matrix = ComplexMatrix::zeros(num_ports, num_ports);
        let mut port_impedances = vec![Complex::new(self.reference_impedance, 0.0); num_ports];

        // Calculate Z-matrix by exciting each port individually
        for (i, &port_i) in active_ports.iter().enumerate() {
            // Set up excitation for port i
            let excitation = self.create_port_excitation(port_i)?;
            
            // Solve MoM system with this excitation
            let solution = mom_solver.solve_with_excitation(&excitation)?;
            
            // Extract voltages and currents at all ports
            for (j, &port_j) in active_ports.iter().enumerate() {
                let (voltage, current) = self.extract_port_vi(port_j, &solution)?;
                
                if i == j {
                    // Diagonal term: input impedance Z_ii = V_i / I_i
                    if current.norm() > 1e-12 {
                        z_matrix[(j, i)] = voltage / current;
                        port_impedances[j] = voltage / current;
                    } else {
                        return Err(format!("Zero current at port {}", port_j.id));
                    }
                } else {
                    // Off-diagonal term: transfer impedance Z_ji = V_j / I_i
                    let excitation_current = self.get_excitation_current(port_i, &solution)?;
                    if excitation_current.norm() > 1e-12 {
                        z_matrix[(j, i)] = voltage / excitation_current;
                    }
                }
            }
        }

        Ok((z_matrix, port_impedances))
    }

    fn create_port_excitation(&self, port: &Port) -> Result<ComplexVector, String> {
        if let (Some(wire_idx), Some(seg_idx)) = (port.wire_index, port.segment_index) {
            // Create excitation vector based on port type
            let mut excitation = ComplexVector::zeros(1); // This should match MoM matrix size
            
            match port.port_type {
                PortType::Voltage => {
                    // Voltage excitation: apply 1V at the port segment
                    excitation[0] = Complex::new(1.0, 0.0);
                }
                PortType::Current => {
                    // Current excitation: apply 1A at the port segment
                    excitation[0] = Complex::new(1.0, 0.0);
                }
                PortType::Balanced => {
                    // Balanced excitation: differential mode
                    excitation[0] = Complex::new(0.5, 0.0);
                }
                PortType::Unbalanced => {
                    // Unbalanced excitation: single-ended
                    excitation[0] = Complex::new(1.0, 0.0);
                }
            }
            
            Ok(excitation)
        } else {
            Err(format!("Port {} is not attached to a wire segment", port.id))
        }
    }

    fn extract_port_vi(&self, port: &Port, solution: &MoMSolution) -> Result<(Complex<f64>, Complex<f64>), String> {
        if let (Some(wire_idx), Some(seg_idx)) = (port.wire_index, port.segment_index) {
            // Extract voltage and current from MoM solution
            let current = solution.get_current_at_segment(wire_idx, seg_idx)
                .ok_or_else(|| format!("Cannot extract current for port {}", port.id))?;
            
            let voltage = solution.get_voltage_at_segment(wire_idx, seg_idx)
                .ok_or_else(|| format!("Cannot extract voltage for port {}", port.id))?;

            Ok((voltage, current))
        } else {
            Err(format!("Port {} is not attached to a wire segment", port.id))
        }
    }

    fn get_excitation_current(&self, port: &Port, solution: &MoMSolution) -> Result<Complex<f64>, String> {
        // Get the current at the excitation port
        self.extract_port_vi(port, solution).map(|(_, current)| current)
    }

    fn z_to_s_matrix(
        &self,
        z_matrix: &ComplexMatrix,
        port_impedances: &[Complex<f64>],
    ) -> Result<ComplexMatrix, String> {
        let n = z_matrix.nrows();
        if n != port_impedances.len() {
            return Err("Z-matrix size doesn't match number of port impedances".to_string());
        }

        // Create reference impedance matrix
        let mut z0_matrix = ComplexMatrix::zeros(n, n);
        for i in 0..n {
            z0_matrix[(i, i)] = Complex::new(self.reference_impedance, 0.0);
        }

        // S = (Z - Z0) * (Z + Z0)^-1
        let z_minus_z0 = z_matrix - &z0_matrix;
        let z_plus_z0 = z_matrix + &z0_matrix;

        // Invert (Z + Z0)
        let z_plus_z0_inv = z_plus_z0.try_inverse()
            .ok_or("Cannot invert (Z + Z0) matrix")?;

        let s_matrix = z_minus_z0 * z_plus_z0_inv;
        Ok(s_matrix)
    }

    // Legacy compatibility methods
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

    pub fn calculate_vswr(&self, s_parameters: &SParameters, port_index: usize) -> Result<Vec<f64>, String> {
        if port_index >= s_parameters.num_ports {
            return Err("Port index out of range".to_string());
        }

        let mut vswr = Vec::new();
        for s_matrix in &s_parameters.s_matrix {
            let s11 = s_matrix[(port_index, port_index)];
            let gamma = s11.norm();
            let vswr_val = if gamma < 1.0 {
                (1.0 + gamma) / (1.0 - gamma)
            } else {
                f64::INFINITY
            };
            vswr.push(vswr_val);
        }

        Ok(vswr)
    }

    pub fn calculate_return_loss(&self, s_parameters: &SParameters, port_index: usize) -> Result<Vec<f64>, String> {
        if port_index >= s_parameters.num_ports {
            return Err("Port index out of range".to_string());
        }

        let mut return_loss = Vec::new();
        for s_matrix in &s_parameters.s_matrix {
            let s11 = s_matrix[(port_index, port_index)];
            let rl = -20.0 * s11.norm().log10();
            return_loss.push(rl);
        }

        Ok(return_loss)
    }

    pub fn calculate_insertion_loss(
        &self,
        s_parameters: &SParameters,
        port1_index: usize,
        port2_index: usize,
    ) -> Result<Vec<f64>, String> {
        if port1_index >= s_parameters.num_ports || port2_index >= s_parameters.num_ports {
            return Err("Port index out of range".to_string());
        }

        let mut insertion_loss = Vec::new();
        for s_matrix in &s_parameters.s_matrix {
            let s21 = s_matrix[(port2_index, port1_index)];
            let il = -20.0 * s21.norm().log10();
            insertion_loss.push(il);
        }

        Ok(insertion_loss)
    }
}

// Helper functions for S-parameter analysis
impl SParameters {
    pub fn get_s11(&self, freq_index: usize, port_index: usize) -> Option<Complex<f64>> {
        if freq_index < self.s_matrix.len() && port_index < self.num_ports {
            Some(self.s_matrix[freq_index][(port_index, port_index)])
        } else {
            None
        }
    }

    pub fn get_s21(&self, freq_index: usize, port1_index: usize, port2_index: usize) -> Option<Complex<f64>> {
        if freq_index < self.s_matrix.len() && port1_index < self.num_ports && port2_index < self.num_ports {
            Some(self.s_matrix[freq_index][(port2_index, port1_index)])
        } else {
            None
        }
    }

    pub fn get_frequency_range(&self) -> (f64, f64) {
        if self.frequencies.is_empty() {
            (0.0, 0.0)
        } else {
            (*self.frequencies.first().unwrap(), *self.frequencies.last().unwrap())
        }
    }

    pub fn interpolate_at_frequency(&self, target_freq: f64) -> Option<ComplexMatrix> {
        // Linear interpolation of S-parameters at arbitrary frequency
        if self.frequencies.len() < 2 {
            return None;
        }

        // Find interpolation indices
        let mut lower_idx = 0;
        let mut upper_idx = self.frequencies.len() - 1;

        for (i, &freq) in self.frequencies.iter().enumerate() {
            if freq <= target_freq {
                lower_idx = i;
            }
            if freq >= target_freq {
                upper_idx = i;
                break;
            }
        }

        if lower_idx == upper_idx {
            return Some(self.s_matrix[lower_idx].clone());
        }

        let f1 = self.frequencies[lower_idx];
        let f2 = self.frequencies[upper_idx];
        let t = (target_freq - f1) / (f2 - f1);

        let s1 = &self.s_matrix[lower_idx];
        let s2 = &self.s_matrix[upper_idx];

        // Linear interpolation of complex values
        let mut result = ComplexMatrix::zeros(self.num_ports, self.num_ports);
        for i in 0..self.num_ports {
            for j in 0..self.num_ports {
                result[(i, j)] = s1[(i, j)] * (1.0 - t) + s2[(i, j)] * t;
            }
        }

        Some(result)
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
    fn test_z_to_s_conversion() {
        let manager = PortManager::new();
        let mut z_matrix = ComplexMatrix::zeros(2, 2);
        z_matrix[(0, 0)] = Complex::new(60.0, 10.0);
        z_matrix[(0, 1)] = Complex::new(5.0, 2.0);
        z_matrix[(1, 0)] = Complex::new(5.0, 2.0);
        z_matrix[(1, 1)] = Complex::new(40.0, -5.0);

        let port_impedances = vec![
            Complex::new(50.0, 0.0),
            Complex::new(50.0, 0.0)
        ];

        let result = manager.z_to_s_matrix(&z_matrix, &port_impedances);
        assert!(result.is_ok());
    }
}