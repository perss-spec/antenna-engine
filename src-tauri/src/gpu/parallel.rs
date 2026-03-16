//! CPU parallel computation using rayon for antenna simulations

use crate::core::{
    geometry::{Mesh, Point3D},
    green::GreenFunction,
    C0,
};
use num_complex::Complex64;
use rayon::prelude::*;
use std::sync::Arc;
use std::f64::consts::PI;

/// Parallel impedance matrix computation using rayon
pub struct ParallelImpedanceComputer {
    mesh: Arc<Mesh>,
    green_function: GreenFunction,
    wire_radius: f64,
}

impl ParallelImpedanceComputer {
    /// Create new parallel impedance computer
    pub fn new(mesh: Arc<Mesh>, frequency: f64, wire_radius: f64) -> Self {
        let green_function = GreenFunction::from_frequency(frequency);
        Self {
            mesh,
            green_function,
            wire_radius,
        }
    }
    
    /// Compute impedance matrix using parallel row computation
    pub fn compute_impedance_matrix(&self) -> Vec<Vec<Complex64>> {
        let n_segments = self.mesh.segments.len();
        if n_segments == 0 {
            return vec![];
        }
        
        eprintln!("Computing {}x{} impedance matrix using {} threads", 
                 n_segments, n_segments, rayon::current_num_threads());
        
        // Parallel computation of matrix rows
        (0..n_segments)
            .into_par_iter()
            .map(|i| self.compute_matrix_row(i))
            .collect()
    }
    
    /// Compute single row of impedance matrix
    fn compute_matrix_row(&self, row_idx: usize) -> Vec<Complex64> {
        let n_segments = self.mesh.segments.len();
        let mut row = Vec::with_capacity(n_segments);
        
        let seg_i = &self.mesh.segments[row_idx];
        let p1_i = &self.mesh.vertices[seg_i.start];
        let p2_i = &self.mesh.vertices[seg_i.end];
        
        for col_idx in 0..n_segments {
            let seg_j = &self.mesh.segments[col_idx];
            let p1_j = &self.mesh.vertices[seg_j.start];
            let p2_j = &self.mesh.vertices[seg_j.end];
            
            let z_element = self.green_function.wire_impedance(
                p1_i, p2_i, p1_j, p2_j, self.wire_radius
            );
            
            row.push(z_element);
        }
        
        row
    }
    
    /// Compute with progress callback
    pub fn compute_with_progress<F>(&self, progress_callback: F) -> Vec<Vec<Complex64>>
    where
        F: Fn(usize, usize) + Send + Sync,
    {
        let n_segments = self.mesh.segments.len();
        if n_segments == 0 {
            return vec![];
        }

        let progress_counter = std::sync::atomic::AtomicUsize::new(0);

        let result: Vec<Vec<Complex64>> = (0..n_segments)
            .into_par_iter()
            .map(|i| {
                let row = self.compute_matrix_row(i);

                // Update progress
                let completed = progress_counter.fetch_add(1, std::sync::atomic::Ordering::Relaxed) + 1;
                progress_callback(completed, n_segments);

                row
            })
            .collect();

        result
    }
}

/// Result from frequency sweep computation
#[derive(Debug, Clone)]
pub struct SweepResult {
    pub frequency: f64,
    pub s11_db: f64,
    pub s11_real: f64,
    pub s11_imag: f64,
    pub impedance_real: f64,
    pub impedance_imag: f64,
    pub vswr: f64,
}

/// Parallel frequency sweep computation
pub struct ParallelFrequencySweep {
    mesh: Arc<Mesh>,
    wire_radius: f64,
}

impl ParallelFrequencySweep {
    /// Create new parallel frequency sweep
    pub fn new(mesh: Arc<Mesh>, wire_radius: f64) -> Self {
        Self { mesh, wire_radius }
    }
    
    /// Run frequency sweep in parallel
    pub fn run_sweep(&self, frequencies: &[f64]) -> Vec<SweepResult> {
        eprintln!("Running frequency sweep: {} points using {} threads", 
                 frequencies.len(), rayon::current_num_threads());
        
        frequencies
            .par_iter()
            .map(|&freq| self.compute_frequency_point(freq))
            .collect()
    }
    
    /// Compute single frequency point
    fn compute_frequency_point(&self, frequency: f64) -> SweepResult {
        // Use simplified dipole model for fast computation
        let wavelength = C0 / frequency;
        
        // Estimate dipole length from mesh
        let dipole_length = self.estimate_dipole_length();
        
        // Calculate input impedance using King's formula
        let k = 2.0 * PI / wavelength;
        let beta_l = k * dipole_length / 2.0;
        
        // Simplified dipole impedance (King's approximation)
        let r_rad = 73.1; // Radiation resistance for half-wave dipole
        let x_reactance = 42.5 * (1.0 / (beta_l.sin().powi(2)) - 1.0);
        
        let z_input = Complex64::new(r_rad, x_reactance);
        let z0 = 50.0; // Reference impedance
        
        // Calculate S11
        let s11 = (z_input - z0) / (z_input + z0);
        let s11_db = 20.0 * s11.norm().log10();
        
        // Calculate VSWR
        let vswr = (1.0 + s11.norm()) / (1.0 - s11.norm()).max(1e-10);
        
        SweepResult {
            frequency,
            s11_db,
            s11_real: s11.re,
            s11_imag: s11.im,
            impedance_real: z_input.re,
            impedance_imag: z_input.im,
            vswr,
        }
    }
    
    /// Estimate dipole length from mesh geometry
    fn estimate_dipole_length(&self) -> f64 {
        if self.mesh.segments.is_empty() {
            return 0.15; // Default half-wave at 1 GHz
        }
        
        // Find maximum extent along any axis
        let mut min_pos = self.mesh.vertices[0];
        let mut max_pos = self.mesh.vertices[0];
        
        for vertex in &self.mesh.vertices {
            if vertex.x < min_pos.x { min_pos.x = vertex.x; }
            if vertex.y < min_pos.y { min_pos.y = vertex.y; }
            if vertex.z < min_pos.z { min_pos.z = vertex.z; }
            if vertex.x > max_pos.x { max_pos.x = vertex.x; }
            if vertex.y > max_pos.y { max_pos.y = vertex.y; }
            if vertex.z > max_pos.z { max_pos.z = vertex.z; }
        }
        
        let dx = max_pos.x - min_pos.x;
        let dy = max_pos.y - min_pos.y;
        let dz = max_pos.z - min_pos.z;
        
        // Return maximum dimension as dipole length estimate
        dx.max(dy).max(dz)
    }
}

/// Parallel batch processor for multiple antenna configurations
pub struct ParallelBatchProcessor {
    thread_pool: rayon::ThreadPool,
}

impl ParallelBatchProcessor {
    /// Create new batch processor with custom thread count
    pub fn new(num_threads: Option<usize>) -> Result<Self, rayon::ThreadPoolBuildError> {
        let pool = match num_threads {
            Some(n) => rayon::ThreadPoolBuilder::new().num_threads(n).build()?,
            None => rayon::ThreadPoolBuilder::new().build()?,
        };
        
        Ok(Self { thread_pool: pool })
    }
    
    /// Process batch of meshes in parallel
    pub fn process_batch<F, R>(&self, meshes: Vec<Arc<Mesh>>, processor: F) -> Vec<R>
    where
        F: Fn(&Mesh) -> R + Send + Sync,
        R: Send,
    {
        self.thread_pool.install(|| {
            meshes
                .par_iter()
                .map(|mesh| processor(mesh))
                .collect()
        })
    }
    
    /// Get thread count
    pub fn thread_count(&self) -> usize {
        self.thread_pool.current_num_threads()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::geometry::{Segment, Point3D};
    
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
    fn test_parallel_impedance_computation() {
        let mesh = Arc::new(create_test_mesh());
        let computer = ParallelImpedanceComputer::new(mesh, 1e9, 0.001);
        
        let z_matrix = computer.compute_impedance_matrix();
        
        assert_eq!(z_matrix.len(), 2); // 2 segments
        assert_eq!(z_matrix[0].len(), 2);
        assert_eq!(z_matrix[1].len(), 2);
        
        // Matrix should be symmetric
        assert!((z_matrix[0][1] - z_matrix[1][0]).norm() < 1e-10);
    }
    
    #[test]
    fn test_parallel_frequency_sweep() {
        let mesh = Arc::new(create_test_mesh());
        let sweep = ParallelFrequencySweep::new(mesh, 0.001);
        
        let frequencies = vec![0.9e9, 1.0e9, 1.1e9];
        let results = sweep.run_sweep(&frequencies);
        
        assert_eq!(results.len(), 3);
        
        for (i, result) in results.iter().enumerate() {
            assert_eq!(result.frequency, frequencies[i]);
            assert!(result.s11_db < 0.0); // Should be negative dB
            assert!(result.vswr >= 1.0); // VSWR >= 1
        }
    }
    
    #[test]
    fn test_batch_processor() {
        let processor = ParallelBatchProcessor::new(Some(2)).unwrap();
        assert_eq!(processor.thread_count(), 2);
        
        let meshes = vec![
            Arc::new(create_test_mesh()),
            Arc::new(create_test_mesh()),
        ];
        
        let results = processor.process_batch(meshes, |mesh| {
            mesh.segments.len()
        });
        
        assert_eq!(results, vec![2, 2]);
    }
}
