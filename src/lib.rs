//! PROMIN Antenna Studio - Method of Moments electromagnetic solver

pub mod geometry;
pub mod mom;

// Re-export main types
pub use geometry::{Wire, Segment};
pub use mom::{MoMSolver, SolverError, PhysicalConstants};