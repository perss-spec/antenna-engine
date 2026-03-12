use crate::core::{
    geometry::{Mesh, Point3D, Segment},
    solver::SimulationParams,
    C0, MU0, EPS0,
};
use crate::gpu::device::{GpuDevice, MultiGpuManager};
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
        
        // Convert segments to GPU format
        let gpu_segments: Vec<GpuSegment> = mesh.segments.iter().map(|seg| {
            let start_pos = &mesh.vertices[seg.start];
            let end_pos = &mesh.vertices[seg.end];
            let length = start_pos.distance(end_pos) as f32;
            
            GpuSegment {
                start_pos: [start_pos.x as f32, start_pos.y as f32, start_pos.z as f32],
                end_pos: [end_pos.x as f32, end_pos.y as f32, end_pos.z as f32],
                length,
                _padding: 0.0,
            }
        }).collect();
        
        let gpu_params = GpuParams {
            frequency: params.frequency as f32,
            k0: (2.0 * std::f64::consts::PI * params.frequency / C0) as f32,
            eta0: (MU0 / EPS0).sqrt() as f32,
            num_segments: n_segments as u32,
        };
        
        // Create buffers
        let segments_buffer = device.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Segments Buffer"),
            contents: bytemuck::cast_slice(&gpu_segments),
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_DST,
        });
        
        let params_buffer = device.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Params Buffer"),
            contents: bytemuck::cast_slice(&[gpu_params]),
            usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
        });
        
        let z_matrix_size = n_rows * n_segments * 2 * std::mem::size_of::<f32>(); // Complex as 2 f32s
        let z_matrix_buffer = device.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Z Matrix Buffer"),
            size: z_matrix_size as u64,
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC,
            mapped_at_creation: false,
        });
        
        let staging_buffer = device.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Staging Buffer"),
            size: z_matrix_size as u64,
            usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });
        
        // Load shader
        let shader_source = include_str!("shaders/impedance_fill.wgsl");
        let shader = device.device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Impedance Fill Shader"),
            source: wgpu::ShaderSource::Wgsl(shader_source.into()),
        });
        
        // Create compute pipeline
        let bind_group_layout = device.device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Impedance Fill Bind Group Layout"),
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
            label: Some("Impedance Fill Pipeline Layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });
        
        let compute_pipeline = device.device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("Impedance Fill Pipeline"),
            layout: Some(&pipeline_layout),
            module: &shader,
            entry_point: Some("fill_impedance"),
            compilation_options: Default::default(),
            cache: None,
        });
        
        let bind_group = device.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Impedance Fill Bind Group"),
            layout: &bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: segments_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: params_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 2,
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
            
            compute_pass.set_pipeline(&compute_pipeline);
            compute_pass.set_bind_group(0, &bind_group, &[]);
            
            let workgroup_x = (n_segments + 7) / 8;
            let workgroup_y = (n_rows + 7) / 8;
            compute_pass.dispatch_workgroups(workgroup_x as u32, workgroup_y as u32, 1);
        }
        
        encoder.copy_buffer_to_buffer(&z_matrix_buffer, 0, &staging_buffer, 0, z_matrix_size as u64);
        device.queue.submit(std::iter::once(encoder.finish()));
        
        // Read back results
        let buffer_slice = staging_buffer.slice(..);
        buffer_slice.map_async(wgpu::MapMode::Read, |_| {});
        device.device.poll(wgpu::Maintain::Wait);
        
        let data = buffer_slice.get_mapped_range();
        let float_data: &[f32] = bytemuck::cast_slice(&data);
        
        let mut result = Vec::with_capacity(n_rows);
        for i in 0..n_rows {
            let mut row = Vec::with_capacity(n_segments);
            for j in 0..n_segments {
                let idx = (i * n_segments + j) * 2;
                let real = float_data[idx] as f64;
                let imag = float_data[idx + 1] as f64;
                row.push(Complex64::new(real, imag));
            }
            result.push(row);
        }
        
        drop(data);
        staging_buffer.unmap();
        
        Ok(result)
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
        let k0 = 2.0 * std::f64::consts::PI * params.frequency / C0;
        let eta0 = (MU0 / EPS0).sqrt();
        
        eprintln!("Using CPU fallback for MoM matrix fill ({} segments)", n_segments);
        
        let z_matrix: Vec<Vec<Complex64>> = (0..n_segments)
            .into_par_iter()
            .map(|i| {
                (0..n_segments)
                    .map(|j| {
                        self.compute_impedance_element(mesh, i, j, k0, eta0)
                    })
                    .collect()
            })
            .collect();
        
        Ok(z_matrix)
    }
    
    fn compute_impedance_element(
        &self,
        mesh: &Mesh,
        i: usize,
        j: usize,
        k0: f64,
        eta0: f64,
    ) -> Complex64 {
        let seg_i = &mesh.segments[i];
        let seg_j = &mesh.segments[j];
        
        let pos_i_start = &mesh.vertices[seg_i.start];
        let pos_i_end = &mesh.vertices[seg_i.end];
        let pos_j_start = &mesh.vertices[seg_j.start];
        let pos_j_end = &mesh.vertices[seg_j.end];
        
        let center_i = Point3D::new(
            (pos_i_start.x + pos_i_end.x) * 0.5,
            (pos_i_start.y + pos_i_end.y) * 0.5,
            (pos_i_start.z + pos_i_end.z) * 0.5,
        );
        
        let center_j = Point3D::new(
            (pos_j_start.x + pos_j_end.x) * 0.5,
            (pos_j_start.y + pos_j_end.y) * 0.5,
            (pos_j_start.z + pos_j_end.z) * 0.5,
        );
        
        let r = center_i.distance(&center_j);
        let length_j = pos_j_start.distance(pos_j_end);
        
        if i == j {
            // Self-impedance (thin wire approximation)
            let a = length_j / 100.0; // Wire radius approximation
            let z_self = eta0 / (2.0 * std::f64::consts::PI) * 
                (2.0 * length_j / a).ln() * Complex64::new(0.0, 1.0);
            z_self
        } else if r < 1e-10 {
            Complex64::new(0.0, 0.0)
        } else {
            // Mutual impedance using Green's function
            let kr = k0 * r;
            let green = Complex64::new(0.0, -k0) * (-Complex64::new(0.0, kr)).exp() / (4.0 * std::f64::consts::PI * r);
            eta0 * length_j * green
        }
    }
}

// Batch processing for multiple frequencies/configurations
pub struct BatchGpuSolver {
    gpu_manager: Arc<MultiGpuManager>,
}

impl BatchGpuSolver {
    pub fn new(gpu_manager: Arc<MultiGpuManager>) -> Self {
        Self { gpu_manager }
    }
    
    pub async fn solve_frequency_sweep(
        &self,
        mesh: &Mesh,
        frequencies: &[f64],
        base_params: &SimulationParams,
    ) -> Result<Vec<(f64, Vec<Vec<Complex64>>)>, Box<dyn std::error::Error + Send + Sync>> {
        let num_gpus = self.gpu_manager.device_count().max(1);
        let chunk_size = (frequencies.len() + num_gpus - 1) / num_gpus;
        
        eprintln!("Running frequency sweep: {} frequencies across {} GPUs", 
                 frequencies.len(), num_gpus);
        
        let solver = MomGpuSolver::new(Arc::clone(&self.gpu_manager));
        let mut all_results = Vec::new();

        for &frequency in frequencies {
            let mut params = base_params.clone();
            params.frequency = frequency;

            match solver.solve_impedance_matrix(mesh, &params).await {
                Ok(z_matrix) => all_results.push((frequency, z_matrix)),
                Err(e) => {
                    eprintln!("Failed to solve for frequency {}: {}", frequency, e);
                    return Err(e);
                }
            }
        }
        
        // Sort by frequency
        all_results.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
        
        Ok(all_results)
    }
}