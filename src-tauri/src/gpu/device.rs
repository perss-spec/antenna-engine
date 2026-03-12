//! GPU device management and initialization

use std::sync::Arc;
use wgpu::util::DeviceExt;

/// GPU device wrapper with error handling
#[derive(Debug)]
pub struct GpuDevice {
    pub device: wgpu::Device,
    pub queue: wgpu::Queue,
    adapter_info: wgpu::AdapterInfo,
}

/// GPU-specific errors
#[derive(Debug, thiserror::Error)]
pub enum GpuError {
    #[error("No suitable GPU adapter found")]
    NoSuitableAdapter,
    #[error("Failed to request device: {0}")]
    DeviceRequest(#[from] wgpu::RequestDeviceError),
    #[error("Buffer creation failed: {0}")]
    BufferCreation(String),
    #[error("Shader compilation failed: {0}")]
    ShaderCompilation(String),
    #[error("Compute pipeline creation failed: {0}")]
    PipelineCreation(String),
    #[error("Buffer mapping failed: {0}")]
    BufferMapping(String),
    #[error("GPU operation timeout")]
    Timeout,
}

impl GpuDevice {
    /// Initialize GPU device with compute shader support
    pub async fn new() -> Result<Self, GpuError> {
        let instance = wgpu::Instance::new(&wgpu::InstanceDescriptor {
            backends: wgpu::Backends::all(),
            ..Default::default()
        });

        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: None,
                force_fallback_adapter: false,
            })
            .await
            .ok_or(GpuError::NoSuitableAdapter)?;

        let adapter_info = adapter.get_info();
        eprintln!("GPU: {} ({:?})", adapter_info.name, adapter_info.backend);

        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    label: Some("PROMIN GPU Device"),
                    required_features: wgpu::Features::empty(),
                    required_limits: wgpu::Limits::default(),
                    memory_hints: wgpu::MemoryHints::Performance,
                },
                None,
            )
            .await?;

        Ok(Self {
            device,
            queue,
            adapter_info,
        })
    }

    /// Get adapter information
    pub fn adapter_info(&self) -> &wgpu::AdapterInfo {
        &self.adapter_info
    }

    /// Get device limits
    pub fn limits(&self) -> wgpu::Limits {
        self.device.limits()
    }

    /// Create buffer from data
    pub fn create_buffer_init<T: bytemuck::Pod>(
        &self,
        label: &str,
        data: &[T],
        usage: wgpu::BufferUsages,
    ) -> Result<wgpu::Buffer, GpuError> {
        let buffer = self.device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
            label: Some(label),
            contents: bytemuck::cast_slice(data),
            usage,
        });
        Ok(buffer)
    }

    /// Create empty buffer
    pub fn create_buffer(
        &self,
        label: &str,
        size: u64,
        usage: wgpu::BufferUsages,
    ) -> Result<wgpu::Buffer, GpuError> {
        let buffer = self.device.create_buffer(&wgpu::BufferDescriptor {
            label: Some(label),
            size,
            usage,
            mapped_at_creation: false,
        });
        Ok(buffer)
    }

    /// Create compute pipeline from WGSL source
    pub fn create_compute_pipeline(
        &self,
        label: &str,
        shader_source: &str,
        entry_point: &str,
    ) -> Result<wgpu::ComputePipeline, GpuError> {
        let shader = self.device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label: Some(&format!("{} Shader", label)),
            source: wgpu::ShaderSource::Wgsl(shader_source.into()),
        });

        let pipeline = self.device.create_compute_pipeline(&wgpu::ComputePipelineDescriptor {
            label: Some(label),
            layout: None,
            module: &shader,
            entry_point: Some(entry_point),
            compilation_options: Default::default(),
            cache: None,
        });

        Ok(pipeline)
    }

    /// Submit compute work and wait for completion
    pub fn submit_and_wait(&self, encoder: wgpu::CommandEncoder) -> Result<(), GpuError> {
        let submission_index = self.queue.submit(std::iter::once(encoder.finish()));
        
        // Poll device until work is complete
        self.device.poll(wgpu::Maintain::WaitForSubmissionIndex(submission_index));
        
        Ok(())
    }

    /// Read buffer data back to CPU
    pub async fn read_buffer<T: bytemuck::Pod + Clone>(
        &self,
        buffer: &wgpu::Buffer,
        size: u64,
    ) -> Result<Vec<T>, GpuError> {
        let staging_buffer = self.create_buffer(
            "Staging Buffer",
            size,
            wgpu::BufferUsages::MAP_READ | wgpu::BufferUsages::COPY_DST,
        )?;

        let mut encoder = self.device.create_command_encoder(&wgpu::CommandEncoderDescriptor {
            label: Some("Read Buffer Encoder"),
        });

        encoder.copy_buffer_to_buffer(buffer, 0, &staging_buffer, 0, size);
        self.submit_and_wait(encoder)?;

        let buffer_slice = staging_buffer.slice(..);
        let (sender, receiver) = tokio::sync::oneshot::channel();
        
        buffer_slice.map_async(wgpu::MapMode::Read, move |result| {
            let _ = sender.send(result);
        });

        self.device.poll(wgpu::Maintain::Wait);
        
        receiver.await
            .map_err(|_| GpuError::BufferMapping("Channel closed".to_string()))?
            .map_err(|e| GpuError::BufferMapping(format!("Map failed: {:?}", e)))?;

        let data = buffer_slice.get_mapped_range();
        let result: Vec<T> = bytemuck::cast_slice(&data).to_vec();
        drop(data);
        staging_buffer.unmap();

        Ok(result)
    }
}