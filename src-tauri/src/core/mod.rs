//! Core functionality for PROMIN Antenna Studio
//! 
//! This module contains the core data structures and algorithms for antenna simulation,
//! geometry processing, and electromagnetic field calculations.

pub mod geometry;
pub mod field;
pub mod antenna;
pub mod simulation;
pub mod parsers;
pub mod import;

pub use geometry::*;
pub use field::*;
pub use antenna::*;
pub use simulation::*;
pub use import::*;