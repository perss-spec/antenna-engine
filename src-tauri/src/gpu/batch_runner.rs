use crate::core::{
    geometry::{Mesh, Point3D, Segment},
    solver::{SimulationParams, SParameterResult},
    AntennaError, Result,
};
use crate::gpu::{
    device::{MultiGpuManager, GpuDevice},
    mom_gpu::GpuMomSolver,
};
use std::sync::Arc;
use tokio::sync::{mpsc, oneshot};
use rayon::prelude::*;

/// Batch simulation job
#[derive(Debug, Clone)]
pub struct BatchJob {
    pub id: usize,
    pub mesh: Arc<Mesh>,
    pub params: SimulationParams,
}

/// Batch simulation result
#[derive(Debug, Clone)]
pub struct BatchResult {
    pub job_id: usize,
    pub result: Result<SParameterResult>,
    pub device_id: usize,
    pub computation_time_ms: u64,
}

/// Progress update for batch processing
#[derive(Debug, Clone)]
pub struct BatchProgress {
    pub completed: usize,
    pub total: usize,
    pub current_jobs: Vec<(usize, usize)>, // (job_id, device_id)
}

/// Multi-GPU batch runner for antenna simulations
pub struct BatchRunner {
    gpu_manager: Arc<MultiGpuManager>,
    solvers: Vec<GpuMomSolver>,
}

impl BatchRunner {
    /// Create new batch runner with all available GPUs
    pub async fn new() -> Result<Self> {
        let gpu_manager = Arc::new(MultiGpuManager::new().await?);
        let mut solvers = Vec::new();

        // Create one solver per GPU device
        for &device_id in gpu_manager.device_ids().iter() {
            let solver = GpuMomSolver::new_with_device(
                gpu_manager.get_device(device_id).unwrap()
            )?;
            solvers.push(solver);
        }

        eprintln!("Batch runner initialized with {} GPU devices", solvers.len());
        
        Ok(Self {
            gpu_manager,
            solvers,
        })
    }

    /// Create fallback batch runner with single GPU
    pub async fn single_gpu() -> Result<Self> {
        let gpu_manager = Arc::new(MultiGpuManager::single_gpu().await?);
        let device = gpu_manager.get_device(0).unwrap();
        let solver = GpuMomSolver::new_with_device(device)?;
        
        Ok(Self {
            gpu_manager,
            solvers: vec![solver],
        })
    }

    /// Create CPU-only batch runner as fallback
    pub fn cpu_fallback() -> Self {
        // Create dummy GPU manager and empty solvers for CPU-only mode
        // This will force all computations to use CPU fallback path
        Self {
            gpu_manager: Arc::new(unsafe { std::mem::zeroed() }), // Will never be used
            solvers: Vec::new(),
        }
    }

    /// Run batch of simulations across multiple GPUs
    pub async fn run_batch(
        &self,
        jobs: Vec<BatchJob>,
        progress_tx: Option<mpsc::UnboundedSender<BatchProgress>>,
    ) -> Result<Vec<BatchResult>> {
        if jobs.is_empty() {
            return Ok(Vec::new());
        }

        let total_jobs = jobs.len();
        eprintln!("Starting batch run: {} jobs across {} devices", 
                 total_jobs, self.solvers.len());

        if self.solvers.is_empty() {
            // CPU fallback mode
            return self.run_batch_cpu(jobs, progress_tx).await;
        }

        // Multi-GPU mode
        let (result_tx, mut result_rx) = mpsc::unbounded_channel();
        let mut handles = Vec::new();
        let mut results = Vec::new();
        let mut completed = 0;

        // Distribute jobs across available GPUs
        let jobs_per_gpu = (total_jobs + self.solvers.len() - 1) / self.solvers.len();
        
        for (gpu_idx, solver) in self.solvers.iter().enumerate() {
            let start_idx = gpu_idx * jobs_per_gpu;
            let end_idx = std::cmp::min(start_idx + jobs_per_gpu, total_jobs);
            
            if start_idx >= total_jobs {
                break;
            }

            let gpu_jobs: Vec<_> = jobs[start_idx..end_idx].to_vec();
            let device_id = self.gpu_manager.device_ids()[gpu_idx];
            let solver_clone = solver.clone();
            let result_tx_clone = result_tx.clone();

            let handle = tokio::spawn(async move {
                Self::run_gpu_worker(device_id, solver_clone, gpu_jobs, result_tx_clone).await
            });
            
            handles.push(handle);
        }

        // Drop the original sender so the receiver will close when all workers finish
        drop(result_tx);

        // Collect results and send progress updates
        while let Some(batch_result) = result_rx.recv().await {
            completed += 1;
            results.push(batch_result);

            if let Some(ref tx) = progress_tx {
                let current_jobs: Vec<_> = handles.iter().enumerate()
                    .filter(|(_, h)| !h.is_finished())
                    .map(|(i, _)| (i, self.gpu_manager.device_ids()[i]))
                    .collect();

                let _ = tx.send(BatchProgress {
                    completed,
                    total: total_jobs,
                    current_jobs,
                });
            }
        }

        // Wait for all workers to complete
        for handle in handles {
            if let Err(e) = handle.await {
                eprintln!("GPU worker failed: {}", e);
            }
        }

        // Sort results by job ID
        results.sort_by_key(|r| r.job_id);
        
        eprintln!("Batch run completed: {}/{} jobs successful", 
                 results.iter().filter(|r| r.result.is_ok()).count(),
                 total_jobs);

        Ok(results)
    }

    async fn run_gpu_worker(
        device_id: usize,
        solver: GpuMomSolver,
        jobs: Vec<BatchJob>,
        result_tx: mpsc::UnboundedSender<BatchResult>,
    ) {
        for job in jobs {
            let start_time = std::time::Instant::now();
            
            let result = solver.solve_s_parameters(&job.mesh, job.params.frequency).await;
            
            let computation_time_ms = start_time.elapsed().as_millis() as u64;
            
            let batch_result = BatchResult {
                job_id: job.id,
                result,
                device_id,
                computation_time_ms,
            };

            if let Err(_) = result_tx.send(batch_result) {
                eprintln!("Failed to send result for job {}", job.id);
                break;
            }
        }
    }

    async fn run_batch_cpu(
        &self,
        jobs: Vec<BatchJob>,
        progress_tx: Option<mpsc::UnboundedSender<BatchProgress>>,
    ) -> Result<Vec<BatchResult>> {
        eprintln!("Running batch in CPU fallback mode");
        
        let total_jobs = jobs.len();
        let results: Vec<_> = jobs.into_par_iter().enumerate().map(|(idx, job)| {
            let start_time = std::time::Instant::now();
            
            // Use CPU MoM solver fallback
            let result = self.solve_cpu_fallback(&job.mesh, job.params.frequency);
            
            let computation_time_ms = start_time.elapsed().as_millis() as u64;
            
            // Send progress update
            if let Some(ref tx) = progress_tx {
                let _ = tx.send(BatchProgress {
                    completed: idx + 1,
                    total: total_jobs,
                    current_jobs: vec![], // No GPU jobs in CPU mode
                });
            }
            
            BatchResult {
                job_id: job.id,
                result,
                device_id: usize::MAX, // CPU mode marker
                computation_time_ms,
            }
        }).collect();

        Ok(results)
    }

    fn solve_cpu_fallback(&self, mesh: &Mesh, frequency: f64) -> Result<SParameterResult> {
        // Simple CPU MoM implementation for fallback
        use crate::core::constants::{C0, ETA0, PI};
        use num_complex::Complex64;
        
        let segments = &mesh.segments;
        let vertices = &mesh.vertices;
        let n = segments.len();
        
        if n == 0 {
            return Err(AntennaError::ComputationError("No segments in mesh".to_string()));
        }

        let k = 2.0 * PI * frequency / C0;
        
        // Build Z-matrix (simplified)
        let mut z_matrix = vec![vec![Complex64::new(0.0, 0.0); n]; n];
        
        for i in 0..n {
            for j in 0..n {
                let seg_i = &segments[i];
                let seg_j = &segments[j];
                
                let p1 = &vertices[seg_i.start];
                let p2 = &vertices[seg_i.end];
                let p3 = &vertices[seg_j.start];
                let p4 = &vertices[seg_j.end];
                
                let center_i = Point3D::new(
                    (p1.x + p2.x) / 2.0,
                    (p1.y + p2.y) / 2.0,
                    (p1.z + p2.z) / 2.0,
                );
                let center_j = Point3D::new(
                    (p3.x + p4.x) / 2.0,
                    (p3.y + p4.y) / 2.0,
                    (p3.z + p4.z) / 2.0,
                );
                
                let r = center_i.distance(&center_j);
                let length_j = p3.distance(p4);
                
                if i == j {
                    // Self-impedance (simplified)
                    z_matrix[i][j] = Complex64::new(ETA0 / (4.0 * PI), 0.0);
                } else {
                    // Mutual impedance using Green's function
                    let g = Complex64::new(0.0, -k * r).exp() / (4.0 * PI * r);
                    z_matrix[i][j] = Complex64::new(0.0, ETA0 * k) * g * length_j;
                }
            }
        }
        
        // Simple excitation (delta-gap at first segment)
        let mut v_vector = vec![Complex64::new(0.0, 0.0); n];
        v_vector[0] = Complex64::new(1.0, 0.0);
        
        // Solve Z*I = V (simplified - just use first diagonal element)
        let z11 = z_matrix[0][0];
        let current = v_vector[0] / z11;
        
        // Calculate S-parameters
        let z_in = z11;
        let z0 = 50.0; // Reference impedance
        let gamma = (z_in - Complex64::new(z0, 0.0)) / (z_in + Complex64::new(z0, 0.0));
        let vswr = (1.0 + gamma.norm()) / (1.0 - gamma.norm()).max(1e-10);
        
        Ok(SParameterResult {
            frequency,
            s11_re: gamma.re,
            s11_im: gamma.im,
            vswr,
            input_impedance_re: z_in.re,
            input_impedance_im: z_in.im,
        })
    }

    /// Get GPU device information
    pub fn device_info(&self) -> Vec<crate::gpu::device::GpuInfo> {
        if self.solvers.is_empty() {
            return Vec::new();
        }
        self.gpu_manager.device_infos().to_vec()
    }

    /// Get number of available compute devices
    pub fn device_count(&self) -> usize {
        if self.solvers.is_empty() {
            1 // CPU fallback counts as one device
        } else {
            self.solvers.len()
        }
    }
}