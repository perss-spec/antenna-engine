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
    run_advanced_sweep,
    run_batch_sweep,
};

use crate::core::{
    geometry::Mesh,
    SimulationParams,
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
    fn test_cpu_manager_initialization() {
        let manager = initialize_cpu_parallel();
        assert!(manager.thread_count() > 0);
    }
    
    #[test]
    fn test_global_cpu_manager() {
        let manager = get_cpu_manager();
        assert!(manager.thread_count() > 0);
    }
    
    #[test]
    fn test_solver_creation() {
        let manager = initialize_cpu_parallel();
        let mesh = create_test_mesh();
        let solver = manager.create_solver(mesh, 0.001);
        
        assert_eq!(solver.mesh().segments.len(), 2);
        assert_eq!(solver.wire_radius(), 0.001);
    }
    
    #[test]
    fn test_impedance_matrix_computation() {
        let manager = initialize_cpu_parallel();
        let mesh = create_test_mesh();
        
        let params = SimulationParams {
            frequency: 1e9,
            resolution: 0.01,
            reference_impedance: 50.0,
        };
        
        let z_matrix = manager.compute_impedance_matrix(&mesh, &params, 0.001);
        
        assert_eq!(z_matrix.len(), 2); // 2 segments
        assert_eq!(z_matrix[0].len(), 2);
        assert_eq!(z_matrix[1].len(), 2);
    }
    
    #[test]
    fn test_frequency_sweep() {
        let manager = initialize_cpu_parallel();
        let mesh = create_test_mesh();
        
        let frequencies = vec![0.9e9, 1.0e9, 1.1e9];
        let results = manager.frequency_sweep(&mesh, &frequencies, 0.001);
        
        assert_eq!(results.len(), 3);
        
        for (i, result) in results.iter().enumerate() {
            assert_eq!(result.frequency, frequencies[i]);
            assert!(result.vswr >= 1.0);
        }
    }
}
