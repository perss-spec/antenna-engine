//! CPU-only MoM solver with parallel acceleration

use crate::core::{
    geometry::Mesh,
    solver::{SimulationParams, SParameterResult},
    green::GreenFunction,
    impedance::ImpedanceMatrix,
    AntennaError, Result,
};
use crate::gpu::parallel::{ParallelImpedanceComputer, ParallelFrequencySweep, SweepResult};
use num_complex::Complex64;
use ndarray::{Array1, Array2};
use std::sync::Arc;

/// CPU-only MoM solver with parallel acceleration
pub struct CpuMomSolver {
    mesh: Arc<Mesh>,
    wire_radius: f64,
}

impl CpuMomSolver {
    /// Create new CPU MoM solver
    pub fn new(mesh: Mesh, wire_radius: f64) -> Self {
        Self {
            mesh: Arc::new(mesh),
            wire_radius,
        }
    }
    
    /// Solve impedance matrix at single frequency
    pub fn solve_impedance_matrix(&self, params: &SimulationParams) -> Result<Array2<Complex64>> {
        let computer = ParallelImpedanceComputer::new(
            Arc::clone(&self.mesh),
            params.frequency,
            self.wire_radius,
        );
        
        let z_matrix_vec = computer.compute_impedance_matrix();
        
        if z_matrix_vec.is_empty() {
            return Err(AntennaError::SimulationFailed("Empty impedance matrix".to_string()));
        }
        
        let n = z_matrix_vec.len();
        let mut z_matrix = Array2::<Complex64>::zeros((n, n));
        
        for (i, row) in z_matrix_vec.into_iter().enumerate() {
            for (j, element) in row.into_iter().enumerate() {
                z_matrix[[i, j]] = element;
            }
        }
        
        Ok(z_matrix)
    }
    
    /// Solve impedance matrix with progress reporting
    pub fn solve_impedance_matrix_with_progress<F>(
        &self,
        params: &SimulationParams,
        progress_callback: F,
    ) -> Result<Array2<Complex64>>
    where
        F: Fn(usize, usize) + Send + Sync,
    {
        let computer = ParallelImpedanceComputer::new(
            Arc::clone(&self.mesh),
            params.frequency,
            self.wire_radius,
        );
        
        let z_matrix_vec = computer.compute_with_progress(progress_callback);
        
        if z_matrix_vec.is_empty() {
            return Err(AntennaError::SimulationFailed("Empty impedance matrix".to_string()));
        }
        
        let n = z_matrix_vec.len();
        let mut z_matrix = Array2::<Complex64>::zeros((n, n));
        
        for (i, row) in z_matrix_vec.into_iter().enumerate() {
            for (j, element) in row.into_iter().enumerate() {
                z_matrix[[i, j]] = element;
            }
        }
        
        Ok(z_matrix)
    }
    
    /// Run frequency sweep
    pub fn frequency_sweep(&self, frequencies: &[f64]) -> Vec<SParameterResult> {
        let sweep = ParallelFrequencySweep::new(
            Arc::clone(&self.mesh),
            self.wire_radius,
        );
        
        let sweep_results = sweep.run_sweep(frequencies);
        
        sweep_results
            .into_iter()
            .map(|result| SParameterResult {
                frequency: result.frequency,
                s11_re: result.s11_real,
                s11_im: result.s11_imag,
                vswr: result.vswr,
                input_impedance_re: result.impedance_real,
                input_impedance_im: result.impedance_imag,
            })
            .collect()
    }
    
    /// Solve current distribution using LU decomposition
    pub fn solve_current_distribution(
        &self,
        z_matrix: &Array2<Complex64>,
        excitation: &Array1<Complex64>,
    ) -> Result<Array1<Complex64>> {
        if z_matrix.nrows() != z_matrix.ncols() {
            return Err(AntennaError::NumericalError(
                "Impedance matrix must be square".to_string()
            ));
        }
        
        if z_matrix.nrows() != excitation.len() {
            return Err(AntennaError::NumericalError(
                "Matrix and excitation vector size mismatch".to_string()
            ));
        }
        
        // Simple LU decomposition solver
        // For production, would use more robust solver like LAPACK
        let n = z_matrix.nrows();
        let mut a = z_matrix.clone();
        let mut b = excitation.clone();
        
        // Forward elimination
        for k in 0..n-1 {
            for i in k+1..n {
                if a[[k, k]].norm() < 1e-15 {
                    return Err(AntennaError::NumericalError(
                        "Singular matrix in LU decomposition".to_string()
                    ));
                }
                
                let factor = a[[i, k]] / a[[k, k]];
                
                for j in k..n {
                    a[[i, j]] = a[[i, j]] - factor * a[[k, j]];
                }
                
                b[i] = b[i] - factor * b[k];
            }
        }
        
        // Back substitution
        let mut x = Array1::<Complex64>::zeros(n);
        for i in (0..n).rev() {
            let mut sum = Complex64::new(0.0, 0.0);
            for j in i+1..n {
                sum = sum + a[[i, j]] * x[j];
            }
            
            if a[[i, i]].norm() < 1e-15 {
                return Err(AntennaError::NumericalError(
                    "Singular matrix in back substitution".to_string()
                ));
            }
            
            x[i] = (b[i] - sum) / a[[i, i]];
        }
        
        Ok(x)
    }
    
    /// Get mesh reference
    pub fn mesh(&self) -> &Mesh {
        &self.mesh
    }
    
    /// Get wire radius
    pub fn wire_radius(&self) -> f64 {
        self.wire_radius
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::geometry::{Point3D, Segment};
    
    fn create_test_mesh() -> Mesh {
        let mut mesh = Mesh::new();
        
        // Simple dipole: 3 vertices, 2 segments
        mesh.vertices.push(Point3D::new(0.0, 0.0, -0.075));
        mesh.vertices.push(Point3D::new(0.0, 0.0, 0.0));
        mesh.vertices.push(Point3D::new(0.0, 0.0, 0.075));
        
        mesh.segments.push(Segment { start: 0, end: 1 });
        mesh.segments.push(Segment { start: 1, end: 2 });
        
        mesh
    }
    
    #[test]
    fn test_cpu_solver_creation() {
        let mesh = create_test_mesh();
        let solver = CpuMomSolver::new(mesh, 0.001);
        
        assert_eq!(solver.mesh().segments.len(), 2);
        assert_eq!(solver.wire_radius(), 0.001);
    }
    
    #[test]
    fn test_impedance_matrix_solve() {
        let mesh = create_test_mesh();
        let solver = CpuMomSolver::new(mesh, 0.001);
        
        let params = SimulationParams {
            frequency: 1e9,
            resolution: 0.01,
            reference_impedance: 50.0,
        };
        
        let z_matrix = solver.solve_impedance_matrix(&params).unwrap();
        
        assert_eq!(z_matrix.nrows(), 2);
        assert_eq!(z_matrix.ncols(), 2);
        
        // Matrix should be symmetric
        let diff = (z_matrix[[0, 1]] - z_matrix[[1, 0]]).norm();
        assert!(diff < 1e-10);
    }
    
    #[test]
    fn test_frequency_sweep() {
        let mesh = create_test_mesh();
        let solver = CpuMomSolver::new(mesh, 0.001);
        
        let frequencies = vec![0.9e9, 1.0e9, 1.1e9];
        let results = solver.frequency_sweep(&frequencies);
        
        assert_eq!(results.len(), 3);
        
        for (i, result) in results.iter().enumerate() {
            assert_eq!(result.frequency, frequencies[i]);
            assert!(result.vswr >= 1.0);
        }
    }
    
    #[test]
    fn test_current_distribution_solve() {
        let mesh = create_test_mesh();
        let solver = CpuMomSolver::new(mesh, 0.001);
        
        // Create simple 2x2 test matrix
        let mut z_matrix = Array2::<Complex64>::zeros((2, 2));
        z_matrix[[0, 0]] = Complex64::new(73.0, 42.5);
        z_matrix[[0, 1]] = Complex64::new(10.0, 5.0);
        z_matrix[[1, 0]] = Complex64::new(10.0, 5.0);
        z_matrix[[1, 1]] = Complex64::new(73.0, 42.5);
        
        let excitation = Array1::from(vec![
            Complex64::new(1.0, 0.0),
            Complex64::new(0.0, 0.0),
        ]);
        
        let current = solver.solve_current_distribution(&z_matrix, &excitation).unwrap();
        
        assert_eq!(current.len(), 2);
        assert!(current[0].norm() > 0.0); // Should have non-zero current
    }
}
