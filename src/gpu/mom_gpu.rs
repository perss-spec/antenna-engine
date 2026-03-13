//! CPU-parallel MoM solver (no GPU dependencies)

use crate::core::{
    geometry::{Mesh, Point3D},
    solver::SimulationParams,
    green::GreenFunction,
    AntennaError, Result,
};
use crate::gpu::device::{MultiGpuManager, CpuDevice};
use crate::gpu::parallel::ParallelImpedanceComputer;
use num_complex::Complex64;
use std::sync::Arc;
use rayon::prelude::*;

/// CPU-parallel MoM solver
pub struct GpuMomSolver {
    cpu_manager: Arc<MultiGpuManager>,
    wire_radius: f64,
    force_cpu: bool,
}

impl GpuMomSolver {
    /// Create new CPU MoM solver
    pub async fn new() -> Result<Self> {
        let cpu_manager = Arc::new(MultiGpuManager::new().await?);
        Ok(Self {
            cpu_manager,
            wire_radius: 0.001,
            force_cpu: false,
        })
    }
    
    /// Create solver with specific CPU device
    pub fn new_with_device(device: &CpuDevice) -> Result<Self> {
        // Create minimal manager with single device
        let manager = MultiGpuManager {
            devices: vec![device.clone()],
        };
        
        Ok(Self {
            cpu_manager: Arc::new(manager),
            wire_radius: 0.001,
            force_cpu: false,
        })
    }
    
    /// Force CPU mode (no-op since we're already CPU-only)
    pub fn force_cpu_mode(&mut self) {
        self.force_cpu = true;
    }
    
    /// Set wire radius
    pub fn set_wire_radius(&mut self, radius: f64) {
        self.wire_radius = radius;
    }
    
    /// Solve impedance matrix using parallel CPU computation
    pub async fn solve_impedance_matrix(
        &self,
        mesh: &Mesh,
        params: &SimulationParams,
    ) -> Result<Vec<Vec<Complex64>>> {
        let n_segments = mesh.segments.len();
        if n_segments == 0 {
            return Ok(vec![]);
        }
        
        eprintln!("Computing {}×{} impedance matrix using CPU parallel", n_segments, n_segments);
        
        // Use parallel impedance computer
        let computer = ParallelImpedanceComputer::new(
            Arc::new(mesh.clone()),
            params.frequency,
            self.wire_radius,
        );
        
        let z_matrix = computer.compute_impedance_matrix();
        
        if z_matrix.is_empty() {
            return Err(AntennaError::SimulationFailed("Empty impedance matrix".to_string()));
        }
        
        eprintln!("Impedance matrix computation completed");
        Ok(z_matrix)
    }
    
    /// Solve with progress reporting
    pub async fn solve_with_progress<F>(
        &self,
        mesh: &Mesh,
        params: &SimulationParams,
        progress_callback: F,
    ) -> Result<Vec<Vec<Complex64>>>
    where
        F: FnMut(usize, usize) + Send + Sync,
    {
        let computer = ParallelImpedanceComputer::new(
            Arc::new(mesh.clone()),
            params.frequency,
            self.wire_radius,
        );
        
        let z_matrix = computer.compute_with_progress(progress_callback);
        
        if z_matrix.is_empty() {
            return Err(AntennaError::SimulationFailed("Empty impedance matrix".to_string()));
        }
        
        Ok(z_matrix)
    }
    
    /// Get device info
    pub fn device_info(&self) -> String {
        if let Some(device) = self.cpu_manager.get_device(0) {
            device.info()
        } else {
            "No CPU device available".to_string()
        }
    }
    
    /// Check if solver is ready
    pub fn is_ready(&self) -> bool {
        self.cpu_manager.has_gpu() // "GPU" means CPU in our case
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::geometry::{Mesh, Segment, Point3D};
    
    #[tokio::test]
    async fn test_cpu_mom_solver_creation() {
        let solver = GpuMomSolver::new().await;
        assert!(solver.is_ok());
        
        let solver = solver.unwrap();
        assert!(solver.is_ready());
    }
    
    #[tokio::test]
    async fn test_empty_mesh() {
        let solver = GpuMomSolver::new().await.unwrap();
        let mesh = Mesh::empty();
        let params = SimulationParams {
            frequency: 1e9,
            resolution: 0.01,
            reference_impedance: 50.0,
        };
        
        let result = solver.solve_impedance_matrix(&mesh, &params).await;
        assert!(result.is_ok());
        assert!(result.unwrap().is_empty());
    }
    
    #[tokio::test]
    async fn test_simple_mesh() {
        let solver = GpuMomSolver::new().await.unwrap();
        
        let mut mesh = Mesh::empty();
        mesh.vertices = vec![
            Point3D::new(0.0, 0.0, -0.075),
            Point3D::new(0.0, 0.0, 0.075),
        ];
        mesh.segments = vec![Segment { start: 0, end: 1 }];
        
        let params = SimulationParams {
            frequency: 1e9,
            resolution: 0.01,
            reference_impedance: 50.0,
        };
        
        let result = solver.solve_impedance_matrix(&mesh, &params).await;
        assert!(result.is_ok());
        
        let z_matrix = result.unwrap();
        assert_eq!(z_matrix.len(), 1);
        assert_eq!(z_matrix[0].len(), 1);
        
        // Check that impedance is reasonable for a dipole
        let z11 = z_matrix[0][0];
        assert!(z11.re > 0.0); // Resistance should be positive
        assert!(z11.norm() > 10.0); // Should have reasonable magnitude
    }
}
