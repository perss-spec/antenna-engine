//! GPU acceleration module for PROMIN Antenna Studio
//! 
//! Provides GPU-accelerated computation via wgpu for:
//! - Method of Moments (MoM) impedance matrix filling
//! - Matrix-vector operations for iterative solvers
//! - Future: FDTD time-stepping

pub mod device;
pub mod mom_gpu;
pub mod benchmark;

pub use device::{GpuDevice, GpuError};
pub use mom_gpu::GpuMomSolver;
pub use benchmark::{BenchmarkResult, run_gpu_benchmark};

/// GPU computation capabilities
#[derive(Debug, Clone)]
pub struct GpuCapabilities {
    pub device_name: String,
    pub max_compute_workgroups: [u32; 3],
    pub max_workgroup_size: [u32; 3],
    pub max_buffer_size: u64,
    pub supports_f64: bool,
}

/// GPU memory usage statistics
#[derive(Debug, Clone)]
pub struct GpuMemoryInfo {
    pub total_bytes: u64,
    pub used_bytes: u64,
    pub available_bytes: u64,
}

/// Progress callback for GPU operations
pub type ProgressCallback = Box<dyn Fn(f32) + Send + Sync>;

/// Initialize GPU subsystem and return capabilities
pub async fn initialize_gpu() -> Result<Option<GpuCapabilities>, crate::core::AntennaError> {
    match GpuDevice::new().await {
        Ok(device) => {
            let caps = GpuCapabilities {
                device_name: device.adapter_info().name.clone(),
                max_compute_workgroups: [65535, 65535, 65535], // Common limits
                max_workgroup_size: [256, 256, 64],
                max_buffer_size: device.limits().max_buffer_size,
                supports_f64: false, // Most GPUs don't support f64 in compute
            };
            Ok(Some(caps))
        }
        Err(GpuError::NoSuitableAdapter) => Ok(None),
        Err(e) => Err(crate::core::AntennaError::SimulationFailed(format!("GPU initialization failed: {}", e))),
    }
}