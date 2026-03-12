use wgpu::util::DeviceExt;
use bytemuck::{Pod, Zeroable};

#[repr(C)]
#[derive(Copy, Clone, Debug, Pod, Zeroable)]
pub struct FieldPoint {
    pub position: [f32; 3],
    pub value: f32,
}

#[repr(C)]
#[derive(Copy, Clone, Pod, Zeroable)]
struct GpuFieldPoint {
    x: f32,
    y: f32,
    z: f32,
    value: f32,
}

pub struct FieldCalculator {
    device: wgpu::Device,
    queue: wgpu::Queue,
    pipeline: wgpu::ComputePipeline,
    bind_group_layout: wgpu::BindGroupLayout,
}

impl FieldCalculator {
    pub async fn new() -> Result<Self, String> {
        let instance = wgpu::Instance::default();
        let adapter = instance.request_adapter(&wgpu::RequestAdapterOptions {
            power_preference: wgpu::PowerPreference::HighPerformance,
            ..Default::default()
        }).await.ok_or("Failed to find suitable GPU adapter")?;

        let (device, queue) = adapter.request_device(
            &wgpu::DeviceDescriptor {
                label: None,
                required_features: wgpu::Features::empty(),
                required_limits: wgpu::Limits::downlevel_defaults(),
                memory_hints: Default::default(),
            },
            None,
        ).await.map_err(|e| format!("Failed to create device: {}", e))?;

        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some("Field Compute Shader"),
            source: wgpu::ShaderSource::Wgsl(include_str!("shaders/field.wgsl").into()),
        });

        let bind_group_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("Field Bind Group Layout"),
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
                        ty: wgpu::BufferBindingType::Storage { read_only: false },
                        has_dynamic_offset: false,
                        min_binding_size: None,
                    },
                    count: None,
                },
            ],
        });

        let pipeline_layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("Field Pipeline Layout"),
            bind_group_layouts: &[&bind_group_layout],
            push_constant_ranges: &[],
        });

        let pipeline = device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some("Field Compute Pipeline"),
            layout: Some(&pipeline_layout),
            module: &shader,
            entry_point: Some("main"),
            compilation_options: Default::default(),
            cache: None,
        });

        Ok(Self {
            device,
            queue,
            pipeline,
            bind_group_layout,
        })
    }

    pub fn calculate_fields(&self, sources: &[FieldPoint], targets: &mut [FieldPoint]) -> Result<(), String> {
        let gpu_sources: Vec<GpuFieldPoint> = sources.iter().map(|p| GpuFieldPoint {
            x: p.position[0], y: p.position[1], z: p.position[2], value: p.value,
        }).collect();

        let gpu_targets: Vec<GpuFieldPoint> = targets.iter().map(|p| GpuFieldPoint {
            x: p.position[0], y: p.position[1], z: p.position[2], value: p.value,
        }).collect();

        let source_buffer = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Source Buffer"),
            contents: bytemuck::cast_slice(&gpu_sources),
            usage: wgpu::BufferUsages::STORAGE,
        });

        let target_buffer = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some("Target Buffer"),
            contents: bytemuck::cast_slice(&gpu_targets),
            usage: wgpu::BufferUsages::STORAGE | wgpu::BufferUsages::COPY_SRC,
        });

        let bind_group = self.device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("Field Bind Group"),
            layout: &self.bind_group_layout,
            entries: &[
                wgpu::BindGroupEntry {
                    binding: 0,
                    resource: source_buffer.as_entire_binding(),
                },
                wgpu::BindGroupEntry {
                    binding: 1,
                    resource: target_buffer.as_entire_binding(),
                },
            ],
        });

        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Field Compute Encoder"),
        });

        {
            let mut compute_pass = encoder.begin_compute_pass(&wgpu::ComputePassDescriptor {
                label: Some("Field Compute Pass"),
                timestamp_writes: None,
            });
            compute_pass.set_pipeline(&self.pipeline);
            compute_pass.set_bind_group(0, &bind_group, &[]);
            compute_pass.dispatch_workgroups(targets.len() as u32, 1, 1);
        }

        let staging_buffer = self.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("Staging Buffer"),
            size: (targets.len() * std::mem::size_of::<GpuFieldPoint>()) as u64,
            usage: wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
            mapped_at_creation: false,
        });

        encoder.copy_buffer_to_buffer(
            &target_buffer,
            0,
            &staging_buffer,
            0,
            (targets.len() * std::mem::size_of::<GpuFieldPoint>()) as u64,
        );

        self.queue.submit(std::iter::once(encoder.finish()));

        let buffer_slice = staging_buffer.slice(..);
        buffer_slice.map_async(wgpu::MapMode::Read, |result| {
            result.unwrap();
        });

        self.device.poll(wgpu::Maintain::Wait);

        let data = buffer_slice.get_mapped_range();
        let gpu_results: &[GpuFieldPoint] = bytemuck::cast_slice(&data);
        for (i, target) in targets.iter_mut().enumerate() {
            target.position = [gpu_results[i].x, gpu_results[i].y, gpu_results[i].z];
            target.value = gpu_results[i].value;
        }
        drop(data);
        staging_buffer.unmap();

        Ok(())
    }

    pub fn calculate_fields_cpu(sources: &[FieldPoint], targets: &mut [FieldPoint]) -> Result<(), String> {
        for target in targets.iter_mut() {
            let mut sum: f32 = 0.0;
            for source in sources.iter() {
                let dx = target.position[0] - source.position[0];
                let dy = target.position[1] - source.position[1];
                let dz = target.position[2] - source.position[2];
                let distance = (dx * dx + dy * dy + dz * dz).sqrt();
                sum += source.value / (distance + 1e-6);
            }
            target.value = sum;
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cpu_fallback() {
        let sources = vec![FieldPoint {
            position: [0.0, 0.0, 0.0],
            value: 1.0,
        }];

        let mut targets = vec![FieldPoint {
            position: [1.0, 0.0, 0.0],
            value: 0.0,
        }];

        assert!(FieldCalculator::calculate_fields_cpu(&sources, &mut targets).is_ok());
        assert!(targets[0].value != 0.0);
    }
}
