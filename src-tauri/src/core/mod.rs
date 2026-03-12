pub mod types;
pub mod geometry;
pub mod element;
pub mod solver;
pub mod field;
pub mod port;
pub mod green;
pub mod constants;

// Re-export commonly used types
pub use types::{AntennaError, Result};
pub use geometry::{Point3D, Segment, Triangle, Mesh, Bounds3D};
pub use element::{AntennaElement, DipoleParams, PatchParams, QfhParams};
pub use solver::{MomSolver, SimulationParams, SimulationResult, SParameterResult};
pub use field::{ElectricField, FieldResult, NearFieldSample, FarFieldSample};
pub use port::{Port, PortExcitation};
pub use green::GreenFunction;
pub use constants::{C0, MU0, EPS0, ETA0};