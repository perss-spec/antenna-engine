//! Method of Moments electromagnetic solver

pub mod physical_constants;
pub mod green_function; 
pub mod solver;

pub use physical_constants::PhysicalConstants;
pub use green_function::GreenFunction;
pub use solver::{MoMSolver, SolverError};