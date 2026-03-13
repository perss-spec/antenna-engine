//! CPU parallel computation using rayon for antenna simulations

use crate::core::{
    geometry::{Mesh, Point3D},
    solver::{SimulationParams, SParameterResult},
    green::GreenFunction,
    C0, MU0, EPS0,
};
use num_complex::Complex64;
use rayon::prelude::*;
use std::sync::Arc;
use std::f64::consts::PI;
use std::sync::atomic::{AtomicUsize, Ordering};

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
        
        eprintln!("Computing impedance matrix: {}×{} elements using {} threads", 
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
        
        let progress_counter = AtomicUsize::new(0);
        
        let result: Vec<Vec<Complex64>> = (0..n_segments)
            .into_par_iter()
            .map(|i| {
                let row = self.compute_matrix_row(i);
                
                // Update progress
                let completed = progress_counter.fetch_add(1, Ordering::Relaxed) + 1;
                progress_callback(completed, n_segments);
                
                row
            })
            .collect();
        
        result
    }
}

/// Sweep result for single frequency
#[derive(Debug, Clone)]
pub struct SweepResult {
    pub frequency: f64,
    pub s11_db: f64,
    pub s11_complex: Complex64,
    pub input_impedance: Complex64,
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
        Self {
            mesh,
            wire_radius,
        }
    }
    
    /// Run frequency sweep in parallel
    pub fn run_sweep(&self, frequencies: &[f64]) -> Vec<SweepResult> {
        if frequencies.is_empty() {
            return vec![];
        }
        
        eprintln!("Running parallel frequency sweep: {} points", frequencies.len());
        
        frequencies
            .par_iter()
            .map(|&freq| self.compute_frequency_point(freq))
            .collect()
    }
    
    /// Compute single frequency point
    fn compute_frequency_point(&self, frequency: f64) -> SweepResult {
        // For now, use simplified dipole approximation
        // In full implementation, this would solve the MoM system
        let s11_complex = self.calculate_s11_approximation(frequency);
        let s11_db = 20.0 * s11_complex.norm().log10();
        
        // Calculate input impedance (simplified)
        let z0 = 50.0;
        let input_impedance = z0 * (1.0 + s11_complex) / (1.0 - s11_complex);
        
        // Calculate VSWR
        let s11_mag = s11_complex.norm();
        let vswr = if s11_mag < 0.999 {
            (1.0 + s11_mag) / (1.0 - s11_mag)
        } else {
            999.0 // Very high VSWR
        };
        
        SweepResult {
            frequency,
            s11_db,
            s11_complex,
            input_impedance,
            vswr,
        }
    }
    
    /// Calculate S11 using simplified dipole model
    fn calculate_s11_approximation(&self, frequency: f64) -> Complex64 {
        if self.mesh.segments.is_empty() {
            return Complex64::new(-20.0, 0.0); // -20 dB default
        }
        
        // Estimate total length from mesh
        let mut total_length = 0.0;
        for segment in &self.mesh.segments {
            let p1 = &self.mesh.vertices[segment.start];
            let p2 = &self.mesh.vertices[segment.end];
            total_length += p1.distance(p2);
        }
        
        let wavelength = C0 / frequency;
        let electrical_length = total_length / wavelength;
        
        // Simple dipole resonance model
        let resonance_factor = (electrical_length - 0.5).abs();
        let s11_magnitude = 0.1 + 0.8 * (-5.0 * resonance_factor).exp();
        
        // Add some phase variation
        let phase = PI * electrical_length;
        
        Complex64::new(
            s11_magnitude * phase.cos(),
            s11_magnitude * phase.sin(),
        )
    }
}

/// Parallel batch processor for multiple antennas
pub struct ParallelBatchProcessor {
    thread_pool_size: usize,
}

impl ParallelBatchProcessor {
    /// Create new batch processor
    pub fn new() -> Self {
        Self {
            thread_pool_size: rayon::current_num_threads(),
        }
    }
    
    /// Process multiple antenna configurations in parallel
    pub fn process_batch<T, F>(&self, items: Vec<T>, processor: F) -> Vec<Result<SweepResult, String>>
    where
        T: Send + Sync,
        F: Fn(&T) -> Result<SweepResult, String> + Send + Sync,
    {
        items
            .par_iter()
            .map(|item| processor(item))
            .collect()
    }
    
    /// Get thread pool size
    pub fn thread_count(&self) -> usize {
        self.thread_pool_size
    }
}

/// Convert SweepResult to SParameterResult
impl From<SweepResult> for SParameterResult {
    fn from(sweep: SweepResult) -> Self {
        Self {
            frequency: sweep.frequency,
            s11_re: sweep.s11_complex.re,
            s11_im: sweep.s11_complex.im,
            vswr: sweep.vswr,
            input_impedance_re: sweep.input_impedance.re,
            input_impedance_im: sweep.input_impedance.im,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::geometry::{Mesh, Segment, Point3D};
    
    #[test]
    fn test_parallel_impedance_computer() {
        let mut mesh = Mesh::empty();
        mesh.vertices = vec![
            Point3D::new(0.0, 0.0, -0.075),
            Point3D::new(0.0, 0.0, 0.075),
        ];
        mesh.segments = vec![Segment { start: 0, end: 1 }];
        
        let computer = ParallelImpedanceComputer::new(
            Arc::new(mesh),
            1e9,
            0.001,
        );
        
        let z_matrix = computer.compute_impedance_matrix();
        assert_eq!(z_matrix.len(), 1);
        assert_eq!(z_matrix[0].len(), 1);
        assert!(z_matrix[0][0].norm() > 0.0);
    }
    
    #[test]
    fn test_parallel_frequency_sweep() {
        let mut mesh = Mesh::empty();
        mesh.vertices = vec![
            Point3D::new(0.0, 0.0, -0.075),
            Point3D::new(0.0, 0.0, 0.075),
        ];
        mesh.segments = vec![Segment { start: 0, end: 1 }];
        
        let sweep = ParallelFrequencySweep::new(Arc::new(mesh), 0.001);
        let frequencies = vec![1e9, 2e9, 3e9];
        
        let results = sweep.run_sweep(&frequencies);
        assert_eq!(results.len(), 3);
        
        for (i, result) in results.iter().enumerate() {
            assert_eq!(result.frequency, frequencies[i]);
            assert!(result.s11_db < 0.0); // Should be negative dB
            assert!(result.vswr >= 1.0); // VSWR should be >= 1
        }
    }
    
    #[test]
    fn test_batch_processor() {
        let processor = ParallelBatchProcessor::new();
        assert!(processor.thread_count() > 0);
        
        let items = vec![1.0, 2.0, 3.0];
        let results = processor.process_batch(items, |&x| {
            Ok(SweepResult {
                frequency: x * 1e9,
                s11_db: -10.0,
                s11_complex: Complex64::new(0.1, 0.0),
                input_impedance: Complex64::new(50.0, 0.0),
                vswr: 1.2,
            })
        });
        
        assert_eq!(results.len(), 3);
        assert!(results.iter().all(|r| r.is_ok()));
    }
}
