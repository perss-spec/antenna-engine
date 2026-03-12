//! GPU acceleration module

pub mod compute;

/// Re-export compute pipeline
pub use compute::GpuCompute;