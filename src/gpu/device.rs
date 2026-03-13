//! CPU parallel device manager (no GPU dependencies)

use std::sync::Arc;
use crate::core::{AntennaError, Result};

/// CPU parallel "device" for consistent API
#[derive(Debug, Clone)]
pub struct CpuDevice {
    pub device_id: usize,
    pub thread_count: usize,
}

impl CpuDevice {
    /// Create new CPU device
    pub fn new(device_id: usize) -> Self {
        let thread_count = rayon::current_num_threads();
        Self {
            device_id,
            thread_count,
        }
    }
    
    /// Get device info string
    pub fn info(&self) -> String {
        format!("CPU Device {} ({} threads)", self.device_id, self.thread_count)
    }
}

/// Multi-CPU manager (replaces GPU manager)
#[derive(Debug)]
pub struct MultiGpuManager {
    devices: Vec<CpuDevice>,
}

impl MultiGpuManager {
    /// Create new CPU manager
    pub async fn new() -> Result<Self> {
        // Create single CPU "device"
        let device = CpuDevice::new(0);
        eprintln!("Initialized CPU parallel device: {}", device.info());
        
        Ok(Self {
            devices: vec![device],
        })
    }
    
    /// Create single CPU device
    pub async fn single_gpu() -> Result<Self> {
        Self::new().await
    }
    
    /// Get device count
    pub fn device_count(&self) -> usize {
        self.devices.len()
    }
    
    /// Get device by index
    pub fn get_device(&self, index: usize) -> Option<&CpuDevice> {
        self.devices.get(index)
    }
    
    /// Check if "GPU" (CPU) available
    pub fn has_gpu(&self) -> bool {
        !self.devices.is_empty()
    }
    
    /// Get all devices
    pub fn devices(&self) -> &[CpuDevice] {
        &self.devices
    }
    
    /// Get device IDs
    pub fn device_ids(&self) -> Vec<usize> {
        self.devices.iter().map(|d| d.device_id).collect()
    }
}

/// Global CPU manager instance
static mut CPU_MANAGER: Option<MultiGpuManager> = None;
static CPU_MANAGER_INIT: std::sync::Once = std::sync::Once::new();

/// Get or create global CPU manager
pub async fn get_gpu_manager() -> Result<&'static MultiGpuManager> {
    unsafe {
        if CPU_MANAGER.is_none() {
            let manager = MultiGpuManager::new().await?;
            CPU_MANAGER = Some(manager);
        }
        Ok(CPU_MANAGER.as_ref().unwrap())
    }
}
