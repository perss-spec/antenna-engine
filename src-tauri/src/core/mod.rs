//! Core antenna simulation module
//!
//! This module provides the fundamental antenna simulation capabilities including:
//! - Antenna element definitions and validation
//! - Method of Moments (MoM) electromagnetic solver
//! - Near-field and far-field calculations
//! - S-parameter analysis
//! - Batch simulation and parameter sweeps
//! - Dataset export functionality
//! - Parameter space coverage analysis
//! - Surrogate model inference for fast predictions

pub mod types;
pub mod geometry;
pub mod element;
pub mod solver;
pub mod field;
pub mod green;
pub mod impedance;
pub mod port;
pub mod nf2ff;
pub mod material;
pub mod touchstone;
pub mod batch;
pub mod export;
pub mod coverage;
pub mod inference;

// Re-export commonly used types
pub use types::{Result, AntennaError};
pub use geometry::{Point3D, Segment, Triangle, Mesh, Bounds3D};
pub use element::{AntennaElement, DipoleParams, PatchParams, QfhParams};
pub use solver::{MomSolver, SimulationParams, SimulationResult, SParameterResult};
pub use field::{ElectricField, FieldResult, NearFieldSample, FarFieldSample};
pub use batch::{BatchSimulator, BatchConfig, BatchResult, ParameterSweep, ScaleType};
pub use export::{DatasetExporter, ExportConfig, ExportFormat};
pub use coverage::{CoverageAnalyzer, CoverageConfig, CoverageResult};
pub use inference::{SurrogatePredictor, PredictionInput, PredictionResult};

// Physical constants
pub const C0: f64 = 299_792_458.0; // Speed of light in vacuum (m/s)
pub const MU0: f64 = 4.0e-7 * std::f64::consts::PI; // Permeability of free space (H/m)
pub const EPS0: f64 = 1.0 / (MU0 * C0 * C0); // Permittivity of free space (F/m)
pub const ETA0: f64 = 376.730313668; // Impedance of free space (Ω)

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_physical_constants() {
        // Test that physical constants are reasonable
        assert!(C0 > 2.99e8 && C0 < 3.0e8);
        assert!(MU0 > 1.25e-6 && MU0 < 1.26e-6);
        assert!(EPS0 > 8.85e-12 && EPS0 < 8.86e-12);
        assert!(ETA0 > 376.0 && ETA0 < 377.0);
    }

    #[test]
    fn test_module_imports() {
        // Test that all modules can be imported without errors
        let _point = Point3D::origin();
        let _element = AntennaElement::new_dipole(0.15, 0.001);
        let _simulator = BatchSimulator::new();
        let _config = ExportConfig::default();
        let _predictor = SurrogatePredictor::new();
        
        // Test passes if no panics occur
        assert!(true);
    }
}