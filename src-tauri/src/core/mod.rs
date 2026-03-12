pub mod types;
pub mod geometry;
pub mod element;
pub mod solver;
pub mod field;
pub mod port;

// Re-export commonly used types
pub use types::{AntennaError, Result};
pub use geometry::{Point3D, Segment, Triangle, Mesh, Bounds3D};
pub use element::{AntennaElement, DipoleParams, PatchParams, QfhParams};
pub use solver::{MomSolver, SimulationParams, SimulationResult, SParameterResult};
pub use field::{ElectricField, FieldResult, NearFieldSample, FarFieldSample};
pub use port::{Port, extract_s_parameters};

// Physical constants
pub const C0: f64 = 299_792_458.0; // Speed of light in vacuum (m/s)
pub const MU0: f64 = 1.256637062e-6; // Permeability of free space (H/m)
pub const EPS0: f64 = 8.854187817e-12; // Permittivity of free space (F/m)
pub const ETA0: f64 = 376.73031346177; // Impedance of free space (Ohms)