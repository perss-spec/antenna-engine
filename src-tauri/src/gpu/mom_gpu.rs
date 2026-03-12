//! GPU-accelerated Method of Moments solver

use crate::core::{
    geometry::{Point3D, Segment, Mesh},
    solver::{SimulationParams, SParameterResult},
    C0, MU0, EPS0,
    AntennaError, Result,
};
use crate::gpu::{GpuDevice, GpuError};
use num_complex::Complex64;
use std::sync::Arc;
use rayon::prelude::*;

/// GPU-accelerated MoM solver
pub struct GpuMomSolver {
    gpu_device: Option<Arc<GpuDevice>>,
    use_gpu: bool,
}

/// Segment data for GPU (f32 for shader compatibility)
#[repr(C)]
#[derive(Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
struct GpuSegment {
    start_pos: [f32; 3],
    end_pos: [f32; 3],
    length: f32,
    _padding: f32, // Align to 32 bytes
}

/// Complex number for GPU (f32 precision)
#[repr(C)]
#[derive(Clone, Copy, bytemuck::Pod, bytemuck::Zeroable)]
struct GpuComplex {
    real: f32,
    imag: f32,
}

impl From<Complex64> for GpuComplex {
    fn from(c: Complex64) -> Self {
        Self {
            real: c.re as f32,
            imag: c.im as f32,
        }
    }
}

impl Into<Complex64> for GpuComplex {
    fn into(self) -> Complex64 {
        Complex64::new(self.real as f64, self.imag as f64)
    }
}

impl GpuMomSolver {
    /// Create new GPU MoM solver
    pub async fn new() -> Result<Self> {
        let gpu_device = match GpuDevice::new().await {
            Ok(device) => {
                eprintln!("GPU MoM solver initialized: {}", device.adapter_info().name);
                Some(Arc::new(device))
            }
            Err(GpuError::NoSuitableAdapter) => {
                eprintln!("No GPU available, using CPU fallback");
                None
            }
            Err(e) => {
                eprintln!("GPU initialization failed: {}, using CPU fallback", e);
                None
            }
        };

        let use_gpu = gpu_device.is_some();
        Ok(Self {
            gpu_device,
            use_gpu,
        })
    }

    /// Force CPU-only mode (for testing)
    pub fn force_cpu_mode(&mut self) {
        self.use_gpu = false;
    }

    /// Solve MoM system for given mesh and frequency
    pub async fn solve(
        &self,
        mesh: &Mesh,
        frequency: f64,
        progress_callback: Option<Box<dyn Fn(f32) + Send + Sync>>,
    ) -> Result<SParameterResult> {
        let num_segments = mesh.segments.len();
        if num_segments == 0 {
            return Err(AntennaError::InvalidGeometry("No segments in mesh".to_string()));
        }

        eprintln!("Solving MoM system: {} segments at {:.2} MHz", num_segments, frequency / 1e6);

        // Fill impedance matrix
        let cb_ref: Option<&dyn Fn(f32)> = progress_callback.as_ref().map(|b| b.as_ref() as &dyn Fn(f32));
        let z_matrix = if self.use_gpu && self.gpu_device.is_some() {
            self.fill_impedance_matrix_gpu(mesh, frequency, cb_ref).await?
        } else {
            self.fill_impedance_matrix_cpu(mesh, frequency, cb_ref)
        };

        // Create excitation vector (voltage source at first segment)
        let mut excitation = vec![Complex64::new(0.0, 0.0); num_segments];
        if num_segments > 0 {
            excitation[0] = Complex64::new(1.0, 0.0); // 1V source
        }

        // Solve linear system Z * I = V
        let currents = self.solve_linear_system(&z_matrix, &excitation)?;

        // Calculate S-parameters
        let input_current = if num_segments > 0 { currents[0] } else { Complex64::new(1.0, 0.0) };
        let input_impedance = Complex64::new(1.0, 0.0) / input_current; // Z = V/I
        let reference_impedance = 50.0; // Standard 50Ω
        
        let s11 = (input_impedance - reference_impedance) / (input_impedance + reference_impedance);
        let vswr = (1.0 + s11.norm()) / (1.0 - s11.norm()).max(1e-10);

        Ok(SParameterResult {
            frequency,
            s11_re: s11.re,
            s11_im: s11.im,
            vswr,
            input_impedance_re: input_impedance.re,
            input_impedance_im: input_impedance.im,
        })
    }

    /// Fill impedance matrix using GPU
    async fn fill_impedance_matrix_gpu(
        &self,
        mesh: &Mesh,
        frequency: f64,
        progress_callback: Option<&dyn Fn(f32)>,
    ) -> Result<Vec<Vec<Complex64>>> {
        let device = self.gpu_device.as_ref().unwrap();
        let num_segments = mesh.segments.len();
        
        // Convert segments to GPU format
        let gpu_segments: Vec<GpuSegment> = mesh.segments.iter().map(|seg| {
            let start_pos = &mesh.vertices[seg.start];
            let end_pos = &mesh.vertices[seg.end];
            let length = start_pos.distance(end_pos);
            
            GpuSegment {
                start_pos: [start_pos.x as f32, start_pos.y as f32, start_pos.z as f32],
                end_pos: [end_pos.x as f32, end_pos.y as f32, end_pos.z as f32],
                length: length as f32,
                _padding: 0.0,
            }
        }).collect();

        // Create GPU buffers
        let segment_buffer = device.create_buffer_init(
            "Segment Buffer",
            &gpu_segments,
            wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
        ).map_err(|e| AntennaError::SimulationFailed(format!("Failed to create segment buffer: {}", e)))?;

        let z_matrix_size = (num_segments * num_segments * std::mem::size_of::<GpuComplex>()) as u64;
        let z_matrix_buffer = device.create_buffer(
            "Z Matrix Buffer",
            z_matrix_size,
            wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC,
        ).map_err(|e| AntennaError::SimulationFailed(format!("Failed to create Z matrix buffer: {}", e)))?;

        // Create compute pipeline
        let shader_source = include_str!("shaders/impedance_fill.wgsl");
        let pipeline = device.create_compute_pipeline(
            "Impedance Fill Pipeline",
            shader_source,
            "fill_impedance",
        ).map_err(|e| AntennaError::SimulationFailed(format!("Failed to create compute pipeline: {}", e)))?;

        // Create bind group
        let bind_group_layout = pipeline.get_bind_group_layout(0);
        let bind_group = device.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Impedance Fill Bind Group"),
            layout: &bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: segment_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: z_matrix_buffer.as_entire_binding(),
                },
            ],
        });

        // Dispatch compute shader
        let mut encoder = device.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Impedance Fill Encoder"),
        });

        {
            let mut compute_pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("Impedance Fill Pass"),
                timestamp_writes: None,
            });
            
            compute_pass.set_pipeline(&pipeline);
            compute_pass.set_bind_group(0, &bind_group, &[]);
            
            // Dispatch with 8x8 workgroups for 2D matrix
            let workgroup_size = 8;
            let dispatch_x = (num_segments + workgroup_size - 1) / workgroup_size;
            let dispatch_y = (num_segments + workgroup_size - 1) / workgroup_size;
            compute_pass.dispatch_workgroups(dispatch_x as u32, dispatch_y as u32, 1);
        }

        device.submit_and_wait(encoder)
            .map_err(|e| AntennaError::SimulationFailed(format!("GPU compute failed: {}", e)))?;

        if let Some(callback) = progress_callback {
            callback(0.8); // GPU work done
        }

        // Read back results
        let gpu_results: Vec<GpuComplex> = device.read_buffer(&z_matrix_buffer, z_matrix_size).await
            .map_err(|e| AntennaError::SimulationFailed(format!("Failed to read GPU results: {}", e)))?;

        // Convert to CPU format
        let mut z_matrix = vec![vec![Complex64::new(0.0, 0.0); num_segments]; num_segments];
        for i in 0..num_segments {
            for j in 0..num_segments {
                let idx = i * num_segments + j;
                if idx < gpu_results.len() {
                    z_matrix[i][j] = gpu_results[idx].into();
                }
            }
        }

        if let Some(callback) = progress_callback {
            callback(1.0); // Complete
        }

        Ok(z_matrix)
    }

    /// Fill impedance matrix using CPU (fallback)
    fn fill_impedance_matrix_cpu(
        &self,
        mesh: &Mesh,
        frequency: f64,
        progress_callback: Option<&dyn Fn(f32)>,
    ) -> Vec<Vec<Complex64>> {
        let num_segments = mesh.segments.len();
        let mut z_matrix = vec![vec![Complex64::new(0.0, 0.0); num_segments]; num_segments];

        let k = 2.0 * std::f64::consts::PI * frequency / C0;
        let eta = (MU0 / EPS0).sqrt();

        // Sequential computation (progress_callback is not Send+Sync)
        for i in 0..num_segments {
            for j in 0..num_segments {
                z_matrix[i][j] = self.compute_mutual_impedance(mesh, i, j, k, eta);
            }

            if let Some(callback) = &progress_callback {
                if i % 10 == 0 {
                    let progress = (i as f32) / (num_segments as f32);
                    callback(progress);
                }
            }
        }

        if let Some(callback) = progress_callback {
            callback(1.0);
        }

        z_matrix
    }

    /// Compute mutual impedance between two segments
    fn compute_mutual_impedance(
        &self,
        mesh: &Mesh,
        i: usize,
        j: usize,
        k: f64,
        eta: f64,
    ) -> Complex64 {
        let seg_i = &mesh.segments[i];
        let seg_j = &mesh.segments[j];
        
        let pos_i_start = &mesh.vertices[seg_i.start];
        let pos_i_end = &mesh.vertices[seg_i.end];
        let pos_j_start = &mesh.vertices[seg_j.start];
        let pos_j_end = &mesh.vertices[seg_j.end];
        
        let center_i = Point3D::new(
            (pos_i_start.x + pos_i_end.x) / 2.0,
            (pos_i_start.y + pos_i_end.y) / 2.0,
            (pos_i_start.z + pos_i_end.z) / 2.0,
        );
        let center_j = Point3D::new(
            (pos_j_start.x + pos_j_end.x) / 2.0,
            (pos_j_start.y + pos_j_end.y) / 2.0,
            (pos_j_start.z + pos_j_end.z) / 2.0,
        );
        
        let distance = center_i.distance(&center_j);
        let length_i = pos_i_start.distance(pos_i_end);
        let length_j = pos_j_start.distance(pos_j_end);
        
        if i == j {
            // Self-impedance (simplified)
            let self_impedance = eta * k * length_i / (4.0 * std::f64::consts::PI);
            Complex64::new(self_impedance, 0.0)
        } else {
            // Mutual impedance using Green's function
            let kr = k * distance;
            let green = Complex64::new(0.0, -kr).exp() / (4.0 * std::f64::consts::PI * distance);
            eta * k * k * length_i * length_j * green
        }
    }

    /// Solve linear system using LU decomposition
    fn solve_linear_system(
        &self,
        z_matrix: &[Vec<Complex64>],
        excitation: &[Complex64],
    ) -> Result<Vec<Complex64>> {
        let n = z_matrix.len();
        if n == 0 || excitation.len() != n {
            return Err(AntennaError::SimulationFailed("Invalid matrix dimensions".to_string()));
        }

        // Simple Gaussian elimination (for production, use proper linear algebra library)
        let mut a = z_matrix.to_vec();
        let mut b = excitation.to_vec();

        // Forward elimination
        for i in 0..n {
            // Find pivot
            let mut max_row = i;
            for k in (i + 1)..n {
                if a[k][i].norm() > a[max_row][i].norm() {
                    max_row = k;
                }
            }
            a.swap(i, max_row);
            b.swap(i, max_row);

            // Make all rows below this one 0 in current column
            for k in (i + 1)..n {
                if a[i][i].norm() < 1e-10 {
                    return Err(AntennaError::SimulationFailed("Singular matrix".to_string()));
                }
                let factor = a[k][i] / a[i][i];
                for j in i..n {
                    let val = a[i][j];
                    a[k][j] -= factor * val;
                }
                let bval = b[i];
                b[k] -= factor * bval;
            }
        }

        // Back substitution
        let mut x = vec![Complex64::new(0.0, 0.0); n];
        for i in (0..n).rev() {
            x[i] = b[i];
            for j in (i + 1)..n {
                let xj = x[j];
                x[i] -= a[i][j] * xj;
            }
            if a[i][i].norm() < 1e-10 {
                return Err(AntennaError::SimulationFailed("Singular matrix".to_string()));
            }
            x[i] /= a[i][i];
        }

        Ok(x)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::geometry::{Point3D, Segment, Mesh};

    #[tokio::test]
    async fn test_cpu_mom_solver() {
        let mut solver = GpuMomSolver::new().await.unwrap();
        solver.force_cpu_mode(); // Test CPU path only

        // Create simple dipole mesh
        let vertices = vec![
            Point3D::new(-0.25, 0.0, 0.0),
            Point3D::new(0.0, 0.0, 0.0),
            Point3D::new(0.25, 0.0, 0.0),
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

        let result = solver.solve(&mesh, 300e6, None).await.unwrap();
        
        // Basic sanity checks
        assert!(result.frequency > 0.0);
        assert!(result.vswr > 1.0);
        assert!(result.input_impedance_re.abs() > 0.0);
    }

    #[test]
    fn test_mutual_impedance_computation() {
        let solver = GpuMomSolver {
            gpu_device: None,
            use_gpu: false,
        };

        let vertices = vec![
            Point3D::new(0.0, 0.0, 0.0),
            Point3D::new(1.0, 0.0, 0.0),
            Point3D::new(0.0, 1.0, 0.0),
            Point3D::new(1.0, 1.0, 0.0),
        ];
        let segments = vec![
            Segment { start: 0, end: 1 },
            Segment { start: 2, end: 3 },
        ];
        let mesh = Mesh {
            vertices,
            triangles: vec![],
            segments,
        };

        let k = 2.0 * std::f64::consts::PI * 300e6 / C0;
        let eta = (MU0 / EPS0).sqrt();
        
        let z_self = solver.compute_mutual_impedance(&mesh, 0, 0, k, eta);
        let z_mutual = solver.compute_mutual_impedance(&mesh, 0, 1, k, eta);
        
        // Self-impedance should be real and positive
        assert!(z_self.re > 0.0);
        assert!(z_self.im.abs() < z_self.re); // Mostly resistive
        
        // Mutual impedance should be smaller than self-impedance
        assert!(z_mutual.norm() < z_self.norm());
    }
}