//! CPU-parallel computation module for PROMIN Antenna Studio
//!
//! This module provides CPU-based parallel acceleration for computationally intensive tasks:
//! - Method of Moments (MoM) impedance matrix computation using rayon
//! - Parallel frequency sweep analysis
//! - Batch processing with progress reporting
//! - No GPU dependencies - pure CPU implementation

pub mod parallel;
pub mod cpu_solver;
pub mod sweep;
pub mod device;
pub mod mom_gpu;
pub mod batch_runner;
pub mod benchmark;

pub use parallel::{
    ParallelImpedanceComputer,
    ParallelFrequencySweep,
    ParallelBatchProcessor,
    SweepResult,
};
pub use cpu_solver::CpuMomSolver;
pub use sweep::{
    SweepConfig,
    SweepPoint,
    run_cpu_sweep,
    run_parallel_cpu_sweep,
    run_mesh_based_sweep,
};
pub use device::{MultiGpuManager, CpuDevice};
pub use mom_gpu::GpuMomSolver;
pub use batch_runner::{BatchRunner, BatchJob, BatchResult, BatchProgress};
pub use benchmark::{run_gpu_benchmark, BenchmarkResult};

use crate::core::{
    geometry::Mesh,
    solver::SimulationParams,
};
use std::sync::Arc;

/// Initialize CPU parallel computation system
pub fn initialize_cpu_parallel() -> CpuParallelManager {
    CpuParallelManager::new()
}

/// CPU parallel computation manager
#[derive(Debug, Clone)]
pub struct CpuParallelManager {
    thread_count: usize,
}

impl CpuParallelManager {
    /// Create new CPU parallel manager
    pub fn new() -> Self {
        let thread_count = rayon::current_num_threads();
        eprintln!("CPU parallel manager initialized with {} threads", thread_count);
        
        Self { thread_count }
    }
    
    /// Get number of parallel threads
    pub fn thread_count(&self) -> usize {
        self.thread_count
    }
    
    /// Create CPU MoM solver for given mesh
    pub fn create_solver(&self, mesh: Mesh, wire_radius: f64) -> CpuMomSolver {
        CpuMomSolver::new(mesh, wire_radius)
    }
    
    /// Run parallel impedance matrix computation
    pub fn compute_impedance_matrix(
        &self,
        mesh: &Mesh,
        params: &SimulationParams,
        wire_radius: f64,
    ) -> Vec<Vec<num_complex::Complex64>> {
        let computer = ParallelImpedanceComputer::new(
            Arc::new(mesh.clone()),
            params.frequency,
            wire_radius,
        );
        
        computer.compute_impedance_matrix()
    }
    
    /// Run parallel frequency sweep
    pub fn frequency_sweep(
        &self,
        mesh: &Mesh,
        frequencies: &[f64],
        wire_radius: f64,
    ) -> Vec<SweepResult> {
        let sweep = ParallelFrequencySweep::new(
            Arc::new(mesh.clone()),
            wire_radius,
        );
        
        sweep.run_sweep(frequencies)
    }
}

/// Global CPU parallel manager instance
static mut CPU_MANAGER: Option<CpuParallelManager> = None;
static CPU_MANAGER_INIT: std::sync::Once = std::sync::Once::new();

/// Get or create global CPU parallel manager
pub fn get_cpu_manager() -> &'static CpuParallelManager {
    unsafe {
        CPU_MANAGER_INIT.call_once(|| {
            CPU_MANAGER = Some(CpuParallelManager::new());
        });
        CPU_MANAGER.as_ref().unwrap()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::geometry::{Mesh, Segment, Point3D};
    
    #[test]
    fn test_cpu_manager_creation() {
        let manager = CpuParallelManager::new();
        assert!(manager.thread_count() > 0);
    }
    
    #[test]
    fn test_global_cpu_manager() {
        let manager1 = get_cpu_manager();
        let manager2 = get_cpu_manager();
        
        // Should be the same instance
        assert_eq!(manager1.thread_count(), manager2.thread_count());
    }
    
    #[test]
    fn test_cpu_solver_creation() {
        let manager = CpuParallelManager::new();
        let mesh = Mesh::empty();
        let solver = manager.create_solver(mesh, 0.001);
        
        // Test passes if no panic occurs
        assert!(true);
    }
    
    #[test]
    fn test_impedance_matrix_computation() {
        let manager = CpuParallelManager::new();
        
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
        
        let z_matrix = manager.compute_impedance_matrix(&mesh, &params, 0.001);
        assert_eq!(z_matrix.len(), 1);
        assert_eq!(z_matrix[0].len(), 1);
        assert!(z_matrix[0][0].norm() > 0.0);
    }
    
    #[test]
    fn test_frequency_sweep() {
        let manager = CpuParallelManager::new();
        
        let mut mesh = Mesh::empty();
        mesh.vertices = vec![
            Point3D::new(0.0, 0.0, -0.075),
            Point3D::new(0.0, 0.0, 0.075),
        ];
        mesh.segments = vec![Segment { start: 0, end: 1 }];
        
        let frequencies = vec![1e9, 2e9, 3e9];
        let results = manager.frequency_sweep(&mesh, &frequencies, 0.001);
        
        assert_eq!(results.len(), 3);
        for (i, result) in results.iter().enumerate() {
            assert_eq!(result.frequency, frequencies[i]);
        }
    }
}
