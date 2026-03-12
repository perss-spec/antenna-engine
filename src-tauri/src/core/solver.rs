use ndarray::Array2;
use num_complex::Complex64;
use serde::{Deserialize, Serialize};

use crate::core::element::AntennaElement;
use crate::core::field::FieldResult;
use crate::core::types::{AntennaError, Result};

/// Speed of light (m/s) — will be used by real solver
#[allow(dead_code)]
const C0: f64 = 299_792_458.0;

/// Simulation parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulationParams {
    pub frequency: f64,
    pub resolution: f64,
    pub reference_impedance: f64,
}

impl Default for SimulationParams {
    fn default() -> Self {
        Self {
            frequency: 1e9,
            resolution: 0.01,
            reference_impedance: 50.0,
        }
    }
}

/// S-parameter result for a single frequency
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SParameterResult {
    pub frequency: f64,
    pub s11_re: f64,
    pub s11_im: f64,
    pub vswr: f64,
    pub input_impedance_re: f64,
    pub input_impedance_im: f64,
}

/// Full simulation output
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulationResult {
    pub s_params: SParameterResult,
    pub field: FieldResult,
    pub num_unknowns: usize,
    pub solver_type: String,
}

/// Method of Moments solver (stub)
pub struct MomSolver {
    pub params: SimulationParams,
}

impl MomSolver {
    pub fn new(params: SimulationParams) -> Self {
        Self { params }
    }

    /// Main solve entry point.
    /// Currently returns placeholder results with correctly-sized dummy matrices.
    pub fn solve(&self, element: &AntennaElement) -> Result<SimulationResult> {
        element.validate()?;

        if self.params.frequency <= 0.0 {
            return Err(AntennaError::InvalidParameter("Frequency must be positive".into()));
        }

        let mesh = element.generate_mesh(self.params.resolution)?;
        let n = mesh.num_vertices();
        if n == 0 {
            return Err(AntennaError::SimulationFailed("Empty mesh".into()));
        }

        // Build placeholder impedance matrix (n x n complex)
        let _z_matrix = self.build_placeholder_impedance_matrix(n);

        // Placeholder input impedance (half-wave dipole ~ 73 + j42 ohms)
        let z_in = Complex64::new(73.0, 42.0);
        let z0 = Complex64::new(self.params.reference_impedance, 0.0);
        let s11 = (z_in - z0) / (z_in + z0);
        let vswr = (1.0 + s11.norm()) / (1.0 - s11.norm());

        let s_params = SParameterResult {
            frequency: self.params.frequency,
            s11_re: s11.re,
            s11_im: s11.im,
            vswr,
            input_impedance_re: z_in.re,
            input_impedance_im: z_in.im,
        };

        let field = FieldResult::placeholder(self.params.frequency);

        Ok(SimulationResult {
            s_params,
            field,
            num_unknowns: n,
            solver_type: "MoM-stub".into(),
        })
    }

    /// Build a placeholder impedance matrix.
    /// Real solver would fill this with Green's function integrals.
    fn build_placeholder_impedance_matrix(&self, n: usize) -> Array2<Complex64> {
        let mut z = Array2::from_elem((n, n), Complex64::new(0.0, 0.0));
        // Fill diagonal with characteristic impedance placeholder
        for i in 0..n {
            z[[i, i]] = Complex64::new(73.0, 42.0);
        }
        z
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_solver_creation() {
        let params = SimulationParams::default();
        let solver = MomSolver::new(params);
        assert!((solver.params.frequency - 1e9).abs() < 1.0);
    }

    #[test]
    fn test_solver_dipole() {
        let elem = AntennaElement::new_dipole(0.15, 0.001);
        let params = SimulationParams::default();
        let solver = MomSolver::new(params);
        let result = solver.solve(&elem).unwrap();

        assert_eq!(result.solver_type, "MoM-stub");
        assert!(result.num_unknowns > 0);
        assert!(result.s_params.vswr > 1.0);
    }

    #[test]
    fn test_solver_patch() {
        let elem = AntennaElement::new_patch(0.03, 0.04, 0.0016, 4.4);
        let params = SimulationParams {
            frequency: 2.4e9,
            resolution: 0.005,
            reference_impedance: 50.0,
        };
        let solver = MomSolver::new(params);
        let result = solver.solve(&elem).unwrap();
        assert!(result.num_unknowns > 0);
    }

    #[test]
    fn test_solver_invalid_element() {
        let elem = AntennaElement::new_dipole(-0.1, 0.001);
        let solver = MomSolver::new(SimulationParams::default());
        assert!(solver.solve(&elem).is_err());
    }

    #[test]
    fn test_solver_invalid_frequency() {
        let elem = AntennaElement::new_dipole(0.15, 0.001);
        let solver = MomSolver::new(SimulationParams {
            frequency: -1.0,
            ..Default::default()
        });
        assert!(solver.solve(&elem).is_err());
    }

    #[test]
    fn test_placeholder_matrix() {
        let solver = MomSolver::new(SimulationParams::default());
        let z = solver.build_placeholder_impedance_matrix(5);
        assert_eq!(z.shape(), &[5, 5]);
        assert!((z[[0, 0]].re - 73.0).abs() < 1e-10);
        assert!((z[[0, 1]].re - 0.0).abs() < 1e-10);
    }
}
