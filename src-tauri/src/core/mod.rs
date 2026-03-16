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
pub mod solver;
pub mod linalg;
pub mod port;
pub mod rwg;
pub mod mesher;
pub mod mesh_refine;
pub mod import_stl;
pub mod import_nastran;
pub mod fdtd_bridge;
pub mod benchmark_antennas;
pub mod batch;
pub mod coverage;
pub mod export;
pub mod array;

// Re-export constants at crate::core level for convenience
pub use constants::{C0, MU0, EPS0, ETA0, PI};
// Re-export common types
pub use types::{AntennaError, Result, SimulationParams, SParameterResult};
