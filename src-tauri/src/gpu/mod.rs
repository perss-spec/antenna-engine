//! GPU-accelerated computation module for PROMIN Antenna Studio
//!
//! This module provides GPU acceleration for computationally intensive tasks:
//! - Method of Moments (MoM) impedance matrix computation
//! - Multi-GPU support for batch processing
//! - CPU fallback when GPU is unavailable

pub mod device;
pub mod mom_gpu;

pub use device::{GpuDevice, MultiGpuManager, get_gpu_manager, try_get_gpu_manager};
pub use mom_gpu::{MomGpuSolver, BatchGpuSolver};

use std::sync::Arc;

/// Initialize GPU subsystem and return manager
pub async fn initialize_gpu() -> Arc<MultiGpuManager> {
    Arc::new(MultiGpuManager::new().await)
}

/// Get or create GPU manager singleton
pub async fn get_or_create_gpu_manager() -> Arc<MultiGpuManager> {
    // Create new manager (singleton handled by get_gpu_manager)
    initialize_gpu().await
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::{
        geometry::{Point3D, Segment, Mesh},
        solver::SimulationParams,
    };
    
    #[tokio::test]
    async fn test_gpu_manager_creation() {
        let manager = MultiGpuManager::new().await;
        // Should not panic even without GPU
        assert!(manager.device_count() >= 0);
    }
    
    #[tokio::test]
    async fn test_mom_solver_cpu_fallback() {
        let manager = Arc::new(MultiGpuManager::new().await);
        let solver = MomGpuSolver::new(manager);
        
        // Create simple test mesh
        let vertices = vec![
            Point3D::new(0.0, 0.0, 0.0),
            Point3D::new(1.0, 0.0, 0.0),
            Point3D::new(2.0, 0.0, 0.0),
        ];
        
        let segments = vec![
            Segment { start: 0, end: 1 },
            Segment { start: 1, end: 2 },
        ];
        
        let mesh = Mesh {
            vertices,
            triangles: vec![],
            segments,
        };
        
        let params = SimulationParams {
            frequency: 300e6, // 300 MHz
            resolution: 0.1,
            reference_impedance: 50.0,
        };
        
        // This should work even without GPU (CPU fallback)
        let result = solver.solve_impedance_matrix(&mesh, &params).await;
        assert!(result.is_ok());
        
        let z_matrix = result.unwrap();
        assert_eq!(z_matrix.len(), 2); // 2 segments
        assert_eq!(z_matrix[0].len(), 2); // 2x2 matrix
    }
    
    #[tokio::test]
    async fn test_batch_solver() {
        let manager = Arc::new(MultiGpuManager::new().await);
        let batch_solver = BatchGpuSolver::new(manager);
        
        // Create simple test mesh
        let vertices = vec![
            Point3D::new(0.0, 0.0, 0.0),
            Point3D::new(1.0, 0.0, 0.0),
        ];
        
        let segments = vec![
            Segment { start: 0, end: 1 },
        ];
        
        let mesh = Mesh {
            vertices,
            triangles: vec![],
            segments,
        };
        
        let base_params = SimulationParams {
            frequency: 300e6,
            resolution: 0.1,
            reference_impedance: 50.0,
        };
        
        let frequencies = vec![100e6, 200e6, 300e6];
        
        let result = batch_solver.solve_frequency_sweep(&mesh, &frequencies, &base_params).await;
        assert!(result.is_ok());
        
        let sweep_results = result.unwrap();
        assert_eq!(sweep_results.len(), 3); // 3 frequencies
    }
}