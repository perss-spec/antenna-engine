use nalgebra::{Complex, DMatrix, DVector};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use crate::core::linear_algebra::LinearAlgebra;
use crate::core::mom_solver::MoMSolver;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PortType {
    Voltage,
    Current,
    Impedance,
    Balanced,
    Unbalanced,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortConfig {
    pub port_type: PortType,
    pub impedance: f64,
    pub position: [f64; 3],
    pub direction: [f64; 3],
    pub width: f64,
    pub active: bool,
}

impl Default for PortConfig {
    fn default() -> Self {
        Self {
            port_type: PortType::Voltage,
            impedance: 50.0,
            position: [0.0, 0.0, 0.0],
            direction: [1.0, 0.0, 0.0],
            width: 1e-3,
            active: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Port {
    pub id: String,
    pub config: PortConfig,
    pub segments: Vec<usize>, // Wire segments associated with this port
}

impl Port {
    pub fn new(id: String, config: PortConfig) -> Self {
        Self {
            id,
            config,
            segments: Vec::new(),
        }
    }

    pub fn add_segment(&mut self, segment_id: usize) {
        if !self.segments.contains(&segment_id) {
            self.segments.push(segment_id);
        }
    }

    pub fn is_balanced(&self) -> bool {
        matches!(self.config.port_type, PortType::Balanced)
    }

    pub fn reference_impedance(&self) -> f64 {
        self.config.impedance
    }
}

#[derive(Debug, Clone)]
pub struct SParameter {
    pub s11: Complex<f64>,
    pub s12: Complex<f64>,
    pub s21: Complex<f64>,
    pub s22: Complex<f64>,
    pub frequency: f64,
}

#[derive(Debug, Clone)]
pub struct MultiPortSParameters {
    pub matrix: DMatrix<Complex<f64>>,
    pub frequencies: Vec<f64>,
    pub port_impedances: Vec<f64>,
    pub num_ports: usize,
}

impl MultiPortSParameters {
    pub fn new(num_ports: usize) -> Self {
        Self {
            matrix: DMatrix::zeros(num_ports, num_ports),
            frequencies: Vec::new(),
            port_impedances: vec![50.0; num_ports],
            num_ports,
        }
    }

    pub fn get_s_parameter(&self, i: usize, j: usize) -> Option<Complex<f64>> {
        if i < self.num_ports && j < self.num_ports {
            Some(self.matrix[(i, j)])
        } else {
            None
        }
    }

    pub fn set_s_parameter(&mut self, i: usize, j: usize, value: Complex<f64>) {
        if i < self.num_ports && j < self.num_ports {
            self.matrix[(i, j)] = value;
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortManager {
    pub ports: HashMap<String, Port>,
    pub active_ports: Vec<String>,
    pub s_parameters: Option<MultiPortSParameters>,
    pub z_matrix: Option<DMatrix<Complex<f64>>>,
}

impl Default for PortManager {
    fn default() -> Self {
        Self {
            ports: HashMap::new(),
            active_ports: Vec::new(),
            s_parameters: None,
            z_matrix: None,
        }
    }
}

impl PortManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn add_port(&mut self, port: Port) -> Result<(), String> {
        let id = port.id.clone();
        
        if self.ports.contains_key(&id) {
            return Err(format!("Port {} already exists", id));
        }

        if port.config.active {
            self.active_ports.push(id.clone());
        }

        self.ports.insert(id, port);
        Ok(())
    }

    pub fn remove_port(&mut self, id: &str) -> Option<Port> {
        if let Some(port) = self.ports.remove(id) {
            self.active_ports.retain(|p| p != id);
            Some(port)
        } else {
            None
        }
    }

    pub fn get_port(&self, id: &str) -> Option<&Port> {
        self.ports.get(id)
    }

    pub fn get_port_mut(&mut self, id: &str) -> Option<&mut Port> {
        self.ports.get_mut(id)
    }

    pub fn get_active_ports(&self) -> Vec<&Port> {
        self.active_ports.iter()
            .filter_map(|id| self.ports.get(id))
            .collect()
    }

    pub fn num_active_ports(&self) -> usize {
        self.active_ports.len()
    }

    pub fn calculate_s_parameters(
        &mut self, 
        solver: &MoMSolver,
        linear_algebra: &LinearAlgebra,
        frequency: f64
    ) -> Result<(), String> {
        let active_ports = self.get_active_ports();
        let num_ports = active_ports.len();
        
        if num_ports == 0 {
            return Err("No active ports found".to_string());
        }

        // Calculate Z-matrix first
        self.calculate_z_matrix(solver, linear_algebra, frequency)?;
        
        // Convert Z-matrix to S-parameters
        if let Some(ref z_matrix) = self.z_matrix {
            let s_matrix = self.z_to_s_matrix(z_matrix, &active_ports)?;
            
            let mut s_params = MultiPortSParameters::new(num_ports);
            s_params.matrix = s_matrix;
            s_params.frequencies = vec![frequency];
            s_params.port_impedances = active_ports.iter()
                .map(|p| p.reference_impedance())
                .collect();
            
            self.s_parameters = Some(s_params);
        }

        Ok(())
    }

    pub fn calculate_z_matrix(
        &mut self,
        solver: &MoMSolver,
        linear_algebra: &LinearAlgebra,
        frequency: f64
    ) -> Result<(), String> {
        let active_ports = self.get_active_ports();
        let num_ports = active_ports.len();
        
        if num_ports == 0 {
            return Err("No active ports found".to_string());
        }

        let mut z_matrix = DMatrix::zeros(num_ports, num_ports);

        // For each port excitation
        for (i, port_i) in active_ports.iter().enumerate() {
            // Create excitation vector - only port i is excited
            let mut excitation = self.create_port_excitation(port_i, &active_ports)?;
            
            // Solve for currents
            let currents = solver.solve_system(&excitation, linear_algebra)?;
            
            // Calculate port voltages and extract Z-parameters
            for (j, port_j) in active_ports.iter().enumerate() {
                let voltage = self.calculate_port_voltage(port_j, &currents)?;
                let current = if i == j { 
                    Complex::new(1.0, 0.0) // Unit excitation current
                } else { 
                    self.calculate_port_current(port_j, &currents)? 
                };
                
                // Z_ij = V_j / I_i when port i is excited
                z_matrix[(j, i)] = voltage / current;
            }
        }

        self.z_matrix = Some(z_matrix);
        Ok(())
    }

    fn create_port_excitation(
        &self, 
        excited_port: &Port, 
        all_ports: &[&Port]
    ) -> Result<DVector<Complex<f64>>, String> {
        // Create excitation vector based on port type
        let size = self.estimate_system_size(all_ports);
        let mut excitation = DVector::zeros(size);

        match excited_port.config.port_type {
            PortType::Voltage => {
                // Voltage excitation: apply unit voltage across port
                for &segment_id in &excited_port.segments {
                    if segment_id < size {
                        excitation[segment_id] = Complex::new(1.0, 0.0);
                    }
                }
            },
            PortType::Current => {
                // Current excitation: apply unit current through port
                for &segment_id in &excited_port.segments {
                    if segment_id < size {
                        excitation[segment_id] = Complex::new(1.0, 0.0);
                    }
                }
            },
            PortType::Balanced => {
                // Balanced excitation: differential voltage
                let mid = excited_port.segments.len() / 2;
                for (idx, &segment_id) in excited_port.segments.iter().enumerate() {
                    if segment_id < size {
                        excitation[segment_id] = if idx < mid {
                            Complex::new(0.5, 0.0)
                        } else {
                            Complex::new(-0.5, 0.0)
                        };
                    }
                }
            },
            _ => {
                // Default to voltage excitation
                for &segment_id in &excited_port.segments {
                    if segment_id < size {
                        excitation[segment_id] = Complex::new(1.0, 0.0);
                    }
                }
            }
        }

        Ok(excitation)
    }

    fn calculate_port_voltage(
        &self, 
        port: &Port, 
        currents: &DVector<Complex<f64>>
    ) -> Result<Complex<f64>, String> {
        let mut voltage = Complex::new(0.0, 0.0);
        let mut count = 0;

        for &segment_id in &port.segments {
            if segment_id < currents.len() {
                voltage += currents[segment_id];
                count += 1;
            }
        }

        if count > 0 {
            Ok(voltage / count as f64)
        } else {
            Err("No valid segments for port voltage calculation".to_string())
        }
    }

    fn calculate_port_current(
        &self, 
        port: &Port, 
        currents: &DVector<Complex<f64>>
    ) -> Result<Complex<f64>, String> {
        let mut current = Complex::new(0.0, 0.0);

        for &segment_id in &port.segments {
            if segment_id < currents.len() {
                current += currents[segment_id];
            }
        }

        Ok(current)
    }

    fn z_to_s_matrix(
        &self,
        z_matrix: &DMatrix<Complex<f64>>,
        ports: &[&Port]
    ) -> Result<DMatrix<Complex<f64>>, String> {
        let n = z_matrix.nrows();
        
        // Create reference impedance matrix
        let mut z0_matrix = DMatrix::zeros(n, n);
        for (i, port) in ports.iter().enumerate() {
            z0_matrix[(i, i)] = Complex::new(port.reference_impedance(), 0.0);
        }

        // S = (Z - Z0) * (Z + Z0)^(-1)
        let z_plus_z0 = z_matrix + &z0_matrix;
        let z_minus_z0 = z_matrix - &z0_matrix;
        
        match z_plus_z0.try_inverse() {
            Some(inv) => Ok(z_minus_z0 * inv),
            None => Err("Failed to invert (Z + Z0) matrix".to_string())
        }
    }

    fn estimate_system_size(&self, ports: &[&Port]) -> usize {
        // Estimate system size based on maximum segment ID
        ports.iter()
            .flat_map(|p| &p.segments)
            .max()
            .unwrap_or(&0) + 1
    }

    pub fn get_input_impedance(&self, port_id: &str) -> Option<Complex<f64>> {
        if let (Some(z_matrix), Some(port_index)) = 
            (&self.z_matrix, self.get_port_index(port_id)) {
            Some(z_matrix[(port_index, port_index)])
        } else {
            None
        }
    }

    fn get_port_index(&self, port_id: &str) -> Option<usize> {
        self.active_ports.iter().position(|id| id == port_id)
    }

    pub fn get_s11(&self, port_id: &str) -> Option<Complex<f64>> {
        if let (Some(s_params), Some(idx)) = 
            (&self.s_parameters, self.get_port_index(port_id)) {
            s_params.get_s_parameter(idx, idx)
        } else {
            None
        }
    }

    pub fn get_s21(&self, port1_id: &str, port2_id: &str) -> Option<Complex<f64>> {
        if let (Some(s_params), Some(idx1), Some(idx2)) = 
            (&self.s_parameters, self.get_port_index(port1_id), self.get_port_index(port2_id)) {
            s_params.get_s_parameter(idx2, idx1) // S21 = output/input
        } else {
            None
        }
    }

    // Backward compatibility methods
    pub fn calculate_vswr(&self, port_id: &str) -> Option<f64> {
        self.get_s11(port_id).map(|s11| {
            let magnitude = s11.norm();
            if magnitude < 1.0 {
                (1.0 + magnitude) / (1.0 - magnitude)
            } else {
                f64::INFINITY
            }
        })
    }

    pub fn calculate_return_loss_db(&self, port_id: &str) -> Option<f64> {
        self.get_s11(port_id).map(|s11| -20.0 * s11.norm().log10())
    }

    pub fn calculate_insertion_loss_db(&self, port1_id: &str, port2_id: &str) -> Option<f64> {
        self.get_s21(port1_id, port2_id).map(|s21| -20.0 * s21.norm().log10())
    }
}

// Utility functions for S-parameter analysis
impl PortManager {
    pub fn is_passive(&self) -> bool {
        if let Some(ref s_params) = self.s_parameters {
            // Check if sum of |S_ij|^2 <= 1 for each port (passivity condition)
            for i in 0..s_params.num_ports {
                let mut sum = 0.0;
                for j in 0..s_params.num_ports {
                    sum += s_params.matrix[(i, j)].norm_sqr();
                }
                if sum > 1.001 { // Small tolerance for numerical errors
                    return false;
                }
            }
            true
        } else {
            false
        }
    }

    pub fn is_reciprocal(&self, tolerance: f64) -> bool {
        if let Some(ref s_params) = self.s_parameters {
            for i in 0..s_params.num_ports {
                for j in 0..s_params.num_ports {
                    let sij = s_params.matrix[(i, j)];
                    let sji = s_params.matrix[(j, i)];
                    if (sij - sji).norm() > tolerance {
                        return false;
                    }
                }
            }
            true
        } else {
            false
        }
    }

    pub fn export_touchstone(&self, filename: &str) -> Result<(), std::io::Error> {
        use std::fs::File;
        use std::io::Write;

        if let Some(ref s_params) = self.s_parameters {
            let mut file = File::create(filename)?;
            
            // Touchstone header
            writeln!(file, "# Hz S RI R {}", s_params.port_impedances[0])?;
            
            for (freq_idx, &freq) in s_params.frequencies.iter().enumerate() {
                write!(file, "{:.6e}", freq)?;
                
                for i in 0..s_params.num_ports {
                    for j in 0..s_params.num_ports {
                        let s = s_params.matrix[(i, j)];
                        write!(file, " {:.6e} {:.6e}", s.re, s.im)?;
                    }
                }
                writeln!(file)?;
            }
        }
        
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_port_creation() {
        let config = PortConfig::default();
        let port = Port::new("port1".to_string(), config);
        assert_eq!(port.id, "port1");
        assert_eq!(port.reference_impedance(), 50.0);
    }

    #[test]
    fn test_port_manager() {
        let mut manager = PortManager::new();
        let port = Port::new("port1".to_string(), PortConfig::default());
        
        assert!(manager.add_port(port).is_ok());
        assert_eq!(manager.num_active_ports(), 1);
        assert!(manager.get_port("port1").is_some());
    }

    #[test]
    fn test_s_parameter_matrix() {
        let mut s_params = MultiPortSParameters::new(2);
        let s11 = Complex::new(0.1, 0.2);
        s_params.set_s_parameter(0, 0, s11);
        
        assert_eq!(s_params.get_s_parameter(0, 0), Some(s11));
    }
}