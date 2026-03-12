pub mod types;
pub mod geometry;
pub mod element;
pub mod solver;
pub mod field;

pub use types::{AntennaError, Result};
pub use geometry::{Point3D, Segment, Triangle, Mesh, Bounds3D};
pub use element::AntennaElement;
pub use solver::{MomSolver, SimulationParams, SimulationResult, SParameterResult};
pub use field::{FieldResult, ElectricField, FarFieldSample, NearFieldSample};

/// Physical constants
pub mod constants {
    pub const C0: f64 = 299_792_458.0;
    pub const MU0: f64 = 4.0 * std::f64::consts::PI * 1e-7;
    pub const EPS0: f64 = 8.854187817e-12;
    pub const ETA0: f64 = 376.73031366857;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_core_integration() {
        let elem = AntennaElement::new_dipole(0.15, 0.001);
        let params = SimulationParams::default();
        let solver = MomSolver::new(params);
        let result = solver.solve(&elem);
        assert!(result.is_ok());
    }
}
