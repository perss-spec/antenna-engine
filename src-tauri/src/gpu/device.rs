use wgpu::{Adapter, Device, Queue, Instance, RequestAdapterOptions, DeviceDescriptor, Features, Limits};
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct GpuDevice {
    pub device: Arc<Device>,
    pub queue: Arc<Queue>,
    pub adapter: Arc<Adapter>,
    pub device_id: usize,
}

impl GpuDevice {
    pub async fn new(device_id: usize) -> Option<Self> {
        let instance = Instance::new(&wgpu::InstanceDescriptor {
            backends: wgpu::Backends::all(),
            ..Default::default()
        });

        let adapter = instance
            .request_adapter(&RequestAdapterOptions {
                power_preference: wgpu::PowerPreference::HighPerformance,
                compatible_surface: None,
                force_fallback_adapter: false,
            })
            .await?;

        let (device, queue) = adapter
            .request_device(
                &DeviceDescriptor {
                    label: Some(&format!("GPU Device {}", device_id)),
                    required_features: Features::empty(),
                    required_limits: Limits::default(),
                    memory_hints: wgpu::MemoryHints::Performance,
                },
                None,
            )
            .await
            .ok()?;

        Some(Self {
            device: Arc::new(device),
            queue: Arc::new(queue),
            adapter: Arc::new(adapter),
            device_id,
        })
    }

    pub fn info(&self) -> wgpu::AdapterInfo {
        self.adapter.get_info()
    }
}

#[derive(Debug)]
pub struct MultiGpuManager {
    devices: Vec<GpuDevice>,
}

impl MultiGpuManager {
    pub async fn new() -> Self {
        let mut devices = Vec::new();
        
        // Try to initialize multiple GPU devices
        for device_id in 0..4 { // Try up to 4 GPUs
            if let Some(device) = GpuDevice::new(device_id).await {
                eprintln!("Initialized GPU {}: {:?}", device_id, device.info().name);
                devices.push(device);
            } else {
                break; // No more GPUs available
            }
        }
        
        if devices.is_empty() {
            eprintln!("Warning: No GPU devices available, falling back to CPU");
        } else {
            eprintln!("Found {} GPU device(s)", devices.len());
        }
        
        Self { devices }
    }
    
    pub fn device_count(&self) -> usize {
        self.devices.len()
    }
    
    pub fn get_device(&self, index: usize) -> Option<&GpuDevice> {
        self.devices.get(index)
    }
    
    pub fn has_gpu(&self) -> bool {
        !self.devices.is_empty()
    }
    
    pub fn devices(&self) -> &[GpuDevice] {
        &self.devices
    }
}

// Singleton for global GPU manager
static mut GPU_MANAGER: Option<MultiGpuManager> = None;
static mut GPU_MANAGER_INIT: std::sync::Once = std::sync::Once::new();

pub async fn get_gpu_manager() -> &'static MultiGpuManager {
    unsafe {
        GPU_MANAGER_INIT.call_once(|| {
            // This is a bit hacky but necessary for static initialization
            let rt = tokio::runtime::Runtime::new().unwrap();
            let manager = rt.block_on(MultiGpuManager::new());
            GPU_MANAGER = Some(manager);
        });
        GPU_MANAGER.as_ref().unwrap()
    }
}

pub fn try_get_gpu_manager() -> Option<&'static MultiGpuManager> {
    unsafe { GPU_MANAGER.as_ref() }
}