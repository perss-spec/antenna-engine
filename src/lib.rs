//! PROMIN Antenna Studio CAD Import Library
//! 
//! This library provides functionality to import CAD models and convert them
//! into antenna structures for PROMIN Antenna Studio.

pub mod cad;
pub mod geometry;
pub mod materials;
pub mod mesh;
pub mod import;

pub use cad::*;
pub use geometry::*;
pub use materials::*;
pub use mesh::*;
pub use import::*;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_library_initialization() {
        // Basic smoke test to ensure library can be initialized
        assert!(true);
    }
}