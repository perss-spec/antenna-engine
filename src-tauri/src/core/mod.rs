pub mod geometry;
pub mod constants;
pub mod types;
pub mod material;
pub mod field;
pub mod green;
pub mod impedance;
pub mod nf2ff;
pub mod element;
pub mod touchstone;
pub mod inference;
pub mod import;

// Re-export constants at crate::core level for convenience
pub use constants::{C0, MU0, EPS0, ETA0, PI};
// Re-export common types
pub use types::{AntennaError, Result, SimulationParams, SParameterResult};
