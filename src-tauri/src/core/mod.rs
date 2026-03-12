pub mod types;
pub mod geometry;
pub mod element;
pub mod solver;
pub mod field;

// Physical constants
pub const C0: f64 = 299792458.0; // Speed of light in vacuum (m/s)
pub const MU0: f64 = 1.2566370614359172e-6; // Permeability of free space (H/m)
pub const EPS0: f64 = 8.854187817620389e-12; // Permittivity of free space (F/m)
pub const ETA0: f64 = 376.73031366857; // Impedance of free space (Ω)

// Re-export commonly used types
pub use types::{AntennaError, Result};
pub use geometry::{Point3D, Segment, Triangle, Mesh, Bounds3D};
pub use element::{AntennaElement, DipoleParams, PatchParams, QfhParams};
pub use solver::{MomSolver, SimulationParams, SimulationResult, SParameterResult, SweepParams};
pub use field::{ElectricField, FieldResult, NearFieldSample, FarFieldSample};