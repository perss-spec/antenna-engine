//! Method of Moments solver implementation

use nalgebra::{DMatrix, DVector};
use num_complex::Complex64;
use crate::mom::green_function::GreenFunction;
use crate::geometry::wire::Wire;

#[derive(Debug)]
pub struct SolverError(pub String);

impl std::fmt::Display for SolverError {
    fn fmt(&self, f: &mut std::fmt::Formatter) -> std::fmt::Result {
        write!(f, "Solver error: {}", self.0)
    }
}

impl std::error::Error for SolverError {}

/// MoM solver for wire antennas
pub struct MoMSolver {
    /// Operating frequency
    frequency: f64,
    /// Wire structures
    wires: Vec<Wire>,
    /// Feed point information: (wire_index, segment_index, voltage)
    feeds: Vec<(usize, usize, Complex64)>,
    /// Wire radius
    radius: f64,
}

impl MoMSolver {
    pub fn new(frequency: f64, radius: f64) -> Self {
        Self {
            frequency,
            wires: Vec::new(),
            feeds: Vec::new(),
            radius,
        }
    }
    
    pub fn add_wire(&mut self, wire: Wire) {
        self.wires.push(wire);
    }
    
    pub fn add_feed(&mut self, wire_index: usize, segment_index: usize, voltage: Complex64) {
        self.feeds.push((wire_index, segment_index, voltage));
    }
    
    /// Solve the MoM system and return current distribution
    pub fn solve(&self) -> Result<Vec<Complex64>, SolverError> {
        if self.wires.is_empty() {
            return Err(SolverError("No wires defined".to_string()));
        }
        
        // Count total segments
        let total_segments: usize = self.wires.iter().map(|w| w.segments().len()).sum();
        
        if total_segments == 0 {
            return Err(SolverError("No segments found".to_string()));
        }
        
        // Build impedance matrix
        let z_matrix = self.build_impedance_matrix()?;
        
        // Build excitation vector  
        let v_vector = self.build_excitation_vector(total_segments)?;
        
        // Solve Z * I = V
        let i_vector = self.solve_linear_system(&z_matrix, &v_vector)?;
        
        Ok(i_vector.data.as_vec().clone())
    }
    
    fn build_impedance_matrix(&self) -> Result<DMatrix<Complex64>, SolverError> {
        let total_segments: usize = self.wires.iter().map(|w| w.segments().len()).sum();
        let mut z_matrix = DMatrix::<Complex64>::zeros(total_segments, total_segments);
        
        let green_fn = GreenFunction::new(self.frequency, self.radius);
        
        let mut row = 0;
        for wire_i in &self.wires {
            for seg_i in wire_i.segments() {
                let mut col = 0;
                
                for wire_j in &self.wires {
                    for seg_j in wire_j.segments() {
                        let seg_i_array = [
                            seg_i.start[0], seg_i.start[1], seg_i.start[2],
                            seg_i.end[0], seg_i.end[1], seg_i.end[2]
                        ];
                        
                        let seg_j_array = [
                            seg_j.start[0], seg_j.start[1], seg_j.start[2],
                            seg_j.end[0], seg_j.end[1], seg_j.end[2]
                        ];
                        
                        let z_element = green_fn.impedance_element(
                            &seg_i_array,
                            &seg_j_array,
                            seg_i.length(),
                            seg_j.length(),
                        );
                        
                        z_matrix[(row, col)] = z_element;
                        col += 1;
                    }
                }
                row += 1;
            }
        }
        
        Ok(z_matrix)
    }
    
    fn build_excitation_vector(&self, size: usize) -> Result<DVector<Complex64>, SolverError> {
        let mut v_vector = DVector::<Complex64>::zeros(size);
        
        // Apply feed voltages
        for &(wire_idx, seg_idx, voltage) in &self.feeds {
            if wire_idx >= self.wires.len() {
                return Err(SolverError(format!("Invalid wire index: {}", wire_idx)));
            }
            
            // Calculate global segment index
            let mut global_idx = 0;
            for (i, wire) in self.wires.iter().enumerate() {
                if i == wire_idx {
                    if seg_idx >= wire.segments().len() {
                        return Err(SolverError(format!("Invalid segment index: {}", seg_idx)));
                    }
                    global_idx += seg_idx;
                    break;
                } else {
                    global_idx += wire.segments().len();
                }
            }
            
            v_vector[global_idx] = voltage;
        }
        
        Ok(v_vector)
    }
    
    fn solve_linear_system(
        &self,
        z_matrix: &DMatrix<Complex64>,
        v_vector: &DVector<Complex64>,
    ) -> Result<DVector<Complex64>, SolverError> {
        // Use LU decomposition for complex matrix
        let lu = z_matrix.lu();
        
        match lu.solve(v_vector) {
            Some(solution) => Ok(solution),
            None => Err(SolverError("Failed to solve linear system - matrix is singular".to_string())),
        }
    }
    
    /// Calculate input impedance at a feed point
    pub fn input_impedance(&self, feed_index: usize) -> Result<Complex64, SolverError> {
        if feed_index >= self.feeds.len() {
            return Err(SolverError("Invalid feed index".to_string()));
        }
        
        let currents = self.solve()?;
        let (wire_idx, seg_idx, voltage) = self.feeds[feed_index];
        
        // Find global segment index
        let mut global_idx = 0;
        for (i, wire) in self.wires.iter().enumerate() {
            if i == wire_idx {
                global_idx += seg_idx;
                break;
            } else {
                global_idx += wire.segments().len();
            }
        }
        
        if global_idx >= currents.len() {
            return Err(SolverError("Invalid current index".to_string()));
        }
        
        let current = currents[global_idx];
        
        if current.norm() < 1e-15 {
            return Err(SolverError("Current is too small - possible resonance".to_string()));
        }
        
        Ok(voltage / current)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::geometry::wire::Wire;
    use nalgebra::Point3;
    
    #[test]
    fn test_solver_creation() {
        let solver = MoMSolver::new(300e6, 1e-3);
        assert_eq!(solver.frequency, 300e6);
        assert_eq!(solver.radius, 1e-3);
    }
    
    #[test] 
    fn test_empty_solver() {
        let solver = MoMSolver::new(300e6, 1e-3);
        let result = solver.solve();
        assert!(result.is_err());
    }
    
    #[test]
    fn test_single_wire_solver() {
        let mut solver = MoMSolver::new(300e6, 1e-3);
        
        // Create a simple dipole
        let wire = Wire::new(
            Point3::new(0.0, 0.0, -0.25),
            Point3::new(0.0, 0.0, 0.25),
            10, // 10 segments
        );
        
        solver.add_wire(wire);
        solver.add_feed(0, 5, Complex64::new(1.0, 0.0)); // Feed at center
        
        let result = solver.solve();
        assert!(result.is_ok());
        
        let currents = result.unwrap();
        assert_eq!(currents.len(), 10);
        
        // Current should be maximum at feed point (center)
        let feed_current = currents[5].norm();
        assert!(feed_current > 0.0);
    }
    
    #[test]
    fn test_input_impedance() {
        let mut solver = MoMSolver::new(300e6, 1e-3);
        
        // Half-wave dipole (0.5m at 300 MHz)
        let wire = Wire::new(
            Point3::new(0.0, 0.0, -0.25),
            Point3::new(0.0, 0.0, 0.25),
            20,
        );
        
        solver.add_wire(wire);
        solver.add_feed(0, 10, Complex64::new(1.0, 0.0)); // Feed at center
        
        let z_in = solver.input_impedance(0);
        assert!(z_in.is_ok());
        
        let impedance = z_in.unwrap();
        println!("Input impedance: {:.1} + j{:.1} Ω", impedance.re, impedance.im);
        
        // For half-wave dipole, expect roughly 73 + j42 Ω
        assert!(impedance.re > 50.0 && impedance.re < 100.0);
    }
}