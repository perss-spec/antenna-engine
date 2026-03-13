use crate::core::{
    geometry::{Mesh, Point3D},
    solver::SimulationParams,
    C0, MU0, EPS0,
};
use crate::gpu::device::MultiGpuManager;
use num_complex::Complex64;
use wgpu::util::DeviceExt;
use std::sync::Arc;
use rayon::prelude::*;
use bytemuck::{Pod, Zeroable};

#[repr(C)]
#[derive(Copy, Clone, Debug, Pod, Zeroable)]
struct GpuSegment {
    start_pos: [f32; 3],
    end_pos: [f32; 3],
    length: f32,
    _padding: f32,
}

#[repr(C)]
#[derive(Copy, Clone, Debug, Pod, Zeroable)]
struct GpuParams {
    frequency: f32,
    k0: f32,
    eta0: f32,
    num_segments: u32,
}

pub struct MomGpuSolver {
    gpu_manager: Arc<MultiGpuManager>,
}

impl MomGpuSolver {
    pub fn new(gpu_manager: Arc<MultiGpuManager>) -> Self {
        Self { gpu_manager }
    }
    
    pub async fn solve_impedance_matrix(
        &self,
        mesh: &Mesh,
        params: &SimulationParams,
    ) -> Result<Vec<Vec<Complex64>>, Box<dyn std::error::Error + Send + Sync>> {
        let n_segments = mesh.segments.len();
        if n_segments == 0 {
            return Ok(vec![]);
        }
        
        // If no GPU available, use CPU fallback
        if !self.gpu_manager.has_gpu() {
            return self.solve_cpu_fallback(mesh, params).await;
        }
        
        // For multi-GPU batch processing, distribute work across available GPUs
        let num_gpus = self.gpu_manager.device_count();
        if num_gpus > 1 && n_segments > 64 {
            return self.solve_multi_gpu(mesh, params).await;
        }
        
        // Single GPU path
        self.solve_single_gpu(mesh, params, 0).await
    }
    
    async fn solve_multi_gpu(
        &self,
        mesh: &Mesh,
        params: &SimulationParams,
    ) -> Result<Vec<Vec<Complex64>>, Box<dyn std::error::Error + Send + Sync>> {
        let n_segments = mesh.segments.len();
        let num_gpus = self.gpu_manager.device_count();

        eprintln!("Using {} GPUs for MoM matrix fill ({} segments)", num_gpus, n_segments);

        // Split matrix rows across GPUs — process sequentially to avoid Send issues
        let rows_per_gpu = (n_segments + num_gpus - 1) / num_gpus;
        let mut z_matrix = vec![vec![Complex64::new(0.0, 0.0); n_segments]; n_segments];

        for gpu_id in 0..num_gpus {
            let start_row = gpu_id * rows_per_gpu;
            let end_row = ((gpu_id + 1) * rows_per_gpu).min(n_segments);

            if start_row >= n_segments {
                break;
            }

            match Self::solve_gpu_rows(&self.gpu_manager, gpu_id, mesh, params, start_row, end_row).await {
                Ok(rows) => {
                    for (i, row) in rows.into_iter().enumerate() {
                        if start_row + i < n_segments {
                            z_matrix[start_row + i] = row;
                        }
                    }
                }
                Err(e) => {
                    eprintln!("GPU task failed: {}, falling back to CPU", e);
                    return self.solve_cpu_fallback(mesh, params).await;
                }
            }
        }

        Ok(z_matrix)
    }
    
    async fn solve_gpu_rows(
        gpu_manager: &MultiGpuManager,
        gpu_id: usize,
        mesh: &Mesh,
        params: &SimulationParams,
        start_row: usize,
        end_row: usize,
    ) -> Result<Vec<Vec<Complex64>>, Box<dyn std::error::Error + Send + Sync>> {
        let device = gpu_manager.get_device(gpu_id)
            .ok_or("GPU device not available")?;
        
        let n_segments = mesh.segments.len();
        let n_rows = end_row - start_row;
        
        // Convert mesh to GPU format
        let gpu_segments = mesh.segments.iter().map(|seg| {
            let start_pos = &mesh.vertices[seg.start];
            let end_pos = &mesh.vertices[seg.end];
            let length = start_pos.distance(end_pos) as f32;
            
            GpuSegment {
                start_pos: [start_pos.x as f32, start_pos.y as f32, start_pos.z as f32],
                end_pos: [end_pos.x as f32, end_pos.y as f32, end_pos.z as f32],
                length,
                _padding: 0.0,
            }
        }).collect::<Vec<_>>();
        
        let gpu_params = GpuParams {
            frequency: params.frequency as f32,
            k0: (2.0 * std::f64::consts::PI * params.frequency / C0) as f32,
            eta0: (MU0 / EPS0).sqrt() as f32,
            num_segments: n_segments as u32,
        };
        
        // Create GPU buffers
        let segment_buffer = device.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Segment Buffer"),
            contents: bytemuck::cast_slice(&gpu_segments),
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
        });
        
        let params_buffer = device.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Params Buffer"),
            contents: bytemuck::bytes_of(&gpu_params),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });
        
        // Output buffer for impedance matrix rows
        let output_size = n_rows * n_segments * 2 * std::mem::size_of::<f32>(); // Complex64 = 2 f32s
        let output_buffer = device.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Output Buffer"),
            size: output_size as u64,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC,
            mapped_at_creation: false,
        });
        
        // Staging buffer for readback
        let staging_buffer = device.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Staging Buffer"),
            size: output_size as u64,
            usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
            mapped_at_creation: false,
        });
        
        // Load compute shader
        let shader = device.device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Impedance Fill Shader"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shaders/impedance_fill.wgsl").into()),
        });
        
        // Create compute pipeline
        let bind_group_layout = device.device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Impedance Bind Group Layout"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: true },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Uniform,
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 2,
                    visibility: wgpu::ShaderStages::COMPUTE,
                    ty: wgpu::BindingType::Buffer {
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });
        
        let pipeline_layout = device.device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Impedance Pipeline Layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });
        
        let compute_pipeline = device.device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("Impedance Compute Pipeline"),
            layout: Some(&pipeline_layout),
            module: &shader,
            entry_point: Some("fill_impedance"),
            compilation_options: Default::default(),
            cache: None,
        });
        
        // Create bind group
        let bind_group = device.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Impedance Bind Group"),
            layout: &bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: segment_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: params_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
                    resource: output_buffer.as_entire_binding(),
                },
            ],
        });
        
        // Dispatch compute shader
        let mut encoder = device.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Impedance Compute Encoder"),
        });
        
        {
            let mut compute_pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("Impedance Compute Pass"),
                timestamp_writes: None,
            });
            
            compute_pass.set_pipeline(&compute_pipeline);
            compute_pass.set_bind_group(0, &bind_group, &[]);
            
            // Dispatch with workgroup size 8x8
            let workgroup_x = (n_segments + 7) / 8;
            let workgroup_y = (n_rows + 7) / 8;
            compute_pass.dispatch_workgroups(workgroup_x as u32, workgroup_y as u32, 1);
        }
        
        // Copy to staging buffer
        encoder.copy_buffer_to_buffer(&output_buffer, 0, &staging_buffer, 0, output_size as u64);
        
        // Submit and wait
        device.queue.submit(std::iter::once(encoder.finish()));
        device.device.poll(wgpu::Maintain::Wait);
        
        // Map and read results
        let buffer_slice = staging_buffer.slice(..);
        let (tx, rx) = tokio::sync::oneshot::channel();
        
        buffer_slice.map_async(wgpu::MapMode::Read, move |result| {
            let _ = tx.send(result);
        });
        
        device.device.poll(wgpu::Maintain::Wait);
        rx.await.map_err(|_| "Failed to receive map result")??;
        
        let data = buffer_slice.get_mapped_range();
        let float_data: &[f32] = bytemuck::cast_slice(&data);
        
        // Convert back to Complex64 matrix
        let mut result_rows = Vec::with_capacity(n_rows);
        for row in 0..n_rows {
            let mut row_data = Vec::with_capacity(n_segments);
            for col in 0..n_segments {
                let idx = (row * n_segments + col) * 2;
                let real = float_data[idx];
                let imag = float_data[idx + 1];
                row_data.push(Complex64::new(real as f64, imag as f64));
            }
            result_rows.push(row_data);
        }
        
        drop(data);
        staging_buffer.unmap();
        
        Ok(result_rows)
    }
    
    async fn solve_single_gpu(
        &self,
        mesh: &Mesh,
        params: &SimulationParams,
        gpu_id: usize,
    ) -> Result<Vec<Vec<Complex64>>, Box<dyn std::error::Error + Send + Sync>> {
        let n_segments = mesh.segments.len();
        Self::solve_gpu_rows(&self.gpu_manager, gpu_id, mesh, params, 0, n_segments).await
    }
    
    async fn solve_cpu_fallback(
        &self,
        mesh: &Mesh,
        params: &SimulationParams,
    ) -> Result<Vec<Vec<Complex64>>, Box<dyn std::error::Error + Send + Sync>> {
        let n_segments = mesh.segments.len();
        eprintln!("Using CPU fallback for MoM matrix ({} segments)", n_segments);
        
        let k0 = 2.0 * std::f64::consts::PI * params.frequency / C0;
        let eta0 = (MU0 / EPS0).sqrt();
        
        // Parallel computation using rayon
        let z_matrix: Vec<Vec<Complex64>> = (0..n_segments)
            .into_par_iter()
            .map(|i| {
                let seg_i = &mesh.segments[i];
                let p1_i = &mesh.vertices[seg_i.start];
                let p2_i = &mesh.vertices[seg_i.end];
                
                let mut row = Vec::with_capacity(n_segments);
                
                for j in 0..n_segments {
                    let seg_j = &mesh.segments[j];
                    let p1_j = &mesh.vertices[seg_j.start];
                    let p2_j = &mesh.vertices[seg_j.end];
                    
                    // Simplified impedance calculation
                    let z_ij = if i == j {
                        // Self-impedance (simplified)
                        let length = p1_i.distance(p2_i);
                        let self_z = eta0 * (2.0 * std::f64::consts::PI * length / (C0 / params.frequency)).sin() / (4.0 * std::f64::consts::PI);
                        Complex64::new(self_z, 0.0)
                    } else {
                        // Mutual impedance (simplified)
                        let center_i = Point3D::new(
                            (p1_i.x + p2_i.x) / 2.0,
                            (p1_i.y + p2_i.y) / 2.0,
                            (p1_i.z + p2_i.z) / 2.0,
                        );
                        let center_j = Point3D::new(
                            (p1_j.x + p2_j.x) / 2.0,
                            (p1_j.y + p2_j.y) / 2.0,
                            (p1_j.z + p2_j.z) / 2.0,
                        );
                        
                        let r = center_i.distance(&center_j);
                        if r < 1e-12 {
                            Complex64::new(0.0, 0.0)
                        } else {
                            let green = Complex64::new(0.0, -k0 * r).exp() / (4.0 * std::f64::consts::PI * r);
                            green * eta0
                        }
                    };
                    
                    row.push(z_ij);
                }
                
                row
            })
            .collect();
        
        Ok(z_matrix)
    }
}

// Multi-GPU frequency sweep (placeholder for future implementation)
pub async fn run_multi_gpu_sweep(
    gpu_manager: &MultiGpuManager,
    frequencies: &[f64],
    mesh: &Mesh,
    reference_impedance: f64,
) -> Result<Vec<(f64, f64)>, Box<dyn std::error::Error + Send + Sync>> {
    let num_gpus = gpu_manager.device_count();
    if num_gpus == 0 {
        return Err("No GPU devices available".into());
    }
    
    eprintln!("Running multi-GPU frequency sweep: {} frequencies across {} GPUs", 
             frequencies.len(), num_gpus);
    
    let _chunk_size = (frequencies.len() + num_gpus - 1) / num_gpus;
    
    // For now, just return placeholder results
    let results = frequencies.iter().map(|&freq| {
        // Placeholder S11 calculation
        let s11_db = -10.0 - 5.0 * (freq / 300e6 - 1.0).powi(2);
        (freq, s11_db)
    }).collect();
    
    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::geometry::{Segment, Mesh};
    
    #[tokio::test]
    async fn test_mom_solver_creation() {
        let gpu_manager = Arc::new(MultiGpuManager::new().await);
        let _solver = MomGpuSolver::new(gpu_manager);
        // Should not panic
    }
    
    #[tokio::test]
    async fn test_cpu_fallback() {
        let gpu_manager = Arc::new(MultiGpuManager::new().await);
        let solver = MomGpuSolver::new(gpu_manager);
        
        // Create simple test mesh
        let vertices = vec![
            Point3D::new(0.0, 0.0, 0.0),
            Point3D::new(0.1, 0.0, 0.0),
        ];
        
        let segments = vec![
            Segment { start: 0, end: 1 },
        ];
        
        let mesh = Mesh {
            vertices,
            triangles: vec![],
            segments,
        };
        
        let params = SimulationParams {
            frequency: 300e6,
            resolution: 0.1,
            reference_impedance: 50.0,
        };
        
        let result = solver.solve_cpu_fallback(&mesh, &params).await;
        assert!(result.is_ok());
        
        let z_matrix = result.unwrap();
        assert_eq!(z_matrix.len(), 1);
        assert_eq!(z_matrix[0].len(), 1);
    }
}