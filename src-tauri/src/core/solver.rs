use crate::core::types::{AntennaError, Result};
use crate::core::geometry::{Point3D, Mesh};
use crate::core::field::{FieldResult, FarFieldSample, NearFieldSample, ElectricField};
use crate::core::element::AntennaElement;
use ndarray::{Array1, Array2};
use num_complex::Complex64;
use serde::{Deserialize, Serialize};
use rayon::prelude::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationParams {
    pub frequency: f64,
    pub resolution: f64,
    pub reference_impedance: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SweepParams {
    pub start_freq: f64,
    pub stop_freq: f64,
    pub num_points: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SParameterResult {
    pub frequency: f64,
    pub s11_re: f64,
    pub s11_im: f64,
    pub vswr: f64,
    pub input_impedance_re: f64,
    pub input_impedance_im: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationResult {
    pub s_parameters: Vec<SParameterResult>,
    pub field_result: FieldResult,
}

pub struct MomSolver {
    element: AntennaElement,
    mesh: Mesh,
}

impl MomSolver {
    pub fn new(element: AntennaElement) -> Result<Self> {
        let mesh = element.generate_mesh(0.05)?;
        Ok(Self { element, mesh })
    }

    pub fn solve(&self, params: &SimulationParams) -> Result<SimulationResult> {
        let s_param = self.solve_single_frequency(params.frequency, params.reference_impedance)?;
        let field_result = self.compute_fields(&s_param, params.frequency)?;
        
        Ok(SimulationResult {
            s_parameters: vec![s_param],
            field_result,
        })
    }

    pub fn solve_sweep(&self, sweep: &SweepParams, reference_impedance: f64) -> Result<Vec<SParameterResult>> {
        if sweep.num_points < 2 {
            return Err(AntennaError::InvalidParameter("Sweep must have at least 2 points".to_string()));
        }
        
        if sweep.stop_freq <= sweep.start_freq {
            return Err(AntennaError::InvalidParameter("Stop frequency must be greater than start frequency".to_string()));
        }

        let frequencies: Vec<f64> = (0..sweep.num_points)
            .map(|i| {
                sweep.start_freq + (sweep.stop_freq - sweep.start_freq) * (i as f64) / ((sweep.num_points - 1) as f64)
            })
            .collect();

        frequencies.into_par_iter()
            .map(|freq| self.solve_single_frequency(freq, reference_impedance))
            .collect::<Result<Vec<_>>>()
    }

    fn solve_single_frequency(&self, frequency: f64, reference_impedance: f64) -> Result<SParameterResult> {
        let wavelength = crate::core::C0 / frequency;
        let k = 2.0 * std::f64::consts::PI / wavelength;
        
        let n_segments = self.mesh.segments.len();
        if n_segments == 0 {
            return Err(AntennaError::InvalidGeometry("No segments in mesh".to_string()));
        }

        // Build impedance matrix
        let z_matrix = self.build_impedance_matrix(k)?;
        
        // Build excitation vector (voltage source at first segment)
        let mut v_vector = Array1::<Complex64>::zeros(n_segments);
        v_vector[0] = Complex64::new(1.0, 0.0);
        
        // Solve for currents
        let currents = self.solve_linear_system(&z_matrix, &v_vector)?;
        
        // Calculate input impedance
        let z_in = if currents[0].norm() > 1e-10 {
            v_vector[0] / currents[0]
        } else {
            Complex64::new(reference_impedance, 0.0)
        };
        
        // Calculate S11
        let s11 = (z_in - reference_impedance) / (z_in + reference_impedance);
        
        // Calculate VSWR
        let vswr = (1.0 + s11.norm()) / (1.0 - s11.norm());
        
        Ok(SParameterResult {
            frequency,
            s11_re: s11.re,
            s11_im: s11.im,
            vswr,
            input_impedance_re: z_in.re,
            input_impedance_im: z_in.im,
        })
    }

    fn build_impedance_matrix(&self, k: f64) -> Result<Array2<Complex64>> {
        let n = self.mesh.segments.len();
        let mut z_matrix = Array2::<Complex64>::zeros((n, n));
        
        for i in 0..n {
            for j in 0..n {
                let seg_i = &self.mesh.segments[i];
                let seg_j = &self.mesh.segments[j];
                
                let p1 = &self.mesh.vertices[seg_i.start];
                let p2 = &self.mesh.vertices[seg_i.end];
                let q1 = &self.mesh.vertices[seg_j.start];
                let q2 = &self.mesh.vertices[seg_j.end];
                
                // Calculate segment centers
                let center_i = Point3D::new(
                    (p1.x + p2.x) * 0.5,
                    (p1.y + p2.y) * 0.5,
                    (p1.z + p2.z) * 0.5
                );
                let center_j = Point3D::new(
                    (q1.x + q2.x) * 0.5,
                    (q1.y + q2.y) * 0.5,
                    (q1.z + q2.z) * 0.5
                );
                
                let r_ij = center_i.distance(&center_j);
                
                // Thin-wire approximation
                let radius = 0.001; // Default thin wire radius
                let z_ij = if i == j {
                    // Self-impedance
                    let length = p1.distance(p2);
                    let self_term = Complex64::new(
                        60.0 * (2.0 * length / radius).ln() - 60.0,
                        k * length * 30.0
                    );
                    self_term
                } else {
                    // Mutual impedance
                    let exp_term = Complex64::new(0.0, -k * r_ij).exp();
                    exp_term * Complex64::new(30.0, 0.0) / r_ij
                };
                
                z_matrix[[i, j]] = z_ij;
            }
        }
        
        Ok(z_matrix)
    }

    fn solve_linear_system(&self, a: &Array2<Complex64>, b: &Array1<Complex64>) -> Result<Array1<Complex64>> {
        let n = a.nrows();
        if n != a.ncols() || n != b.len() {
            return Err(AntennaError::NumericalError("Matrix dimensions mismatch".to_string()));
        }
        
        // Clone matrices for Gaussian elimination
        let mut a_work = a.clone();
        let mut b_work = b.clone();
        
        // Forward elimination
        for k in 0..n {
            // Find pivot
            let mut max_idx = k;
            let mut max_val = a_work[[k, k]].norm();
            for i in (k + 1)..n {
                let val = a_work[[i, k]].norm();
                if val > max_val {
                    max_val = val;
                    max_idx = i;
                }
            }
            
            if max_val < 1e-10 {
                return Err(AntennaError::NumericalError("Singular matrix".to_string()));
            }
            
            // Swap rows
            if max_idx != k {
                for j in 0..n {
                    let tmp = a_work[[k, j]];
                    a_work[[k, j]] = a_work[[max_idx, j]];
                    a_work[[max_idx, j]] = tmp;
                }
                let tmp = b_work[k];
                b_work[k] = b_work[max_idx];
                b_work[max_idx] = tmp;
            }
            
            // Eliminate column
            for i in (k + 1)..n {
                let factor = a_work[[i, k]] / a_work[[k, k]];
                for j in (k + 1)..n {
                    a_work[[i, j]] = a_work[[i, j]] - factor * a_work[[k, j]];
                }
                b_work[i] = b_work[i] - factor * b_work[k];
                a_work[[i, k]] = Complex64::new(0.0, 0.0);
            }
        }
        
        // Back substitution
        let mut x = Array1::<Complex64>::zeros(n);
        for i in (0..n).rev() {
            let mut sum = b_work[i];
            for j in (i + 1)..n {
                sum = sum - a_work[[i, j]] * x[j];
            }
            x[i] = sum / a_work[[i, i]];
        }
        
        Ok(x)
    }

    fn compute_fields(&self, s_param: &SParameterResult, frequency: f64) -> Result<FieldResult> {
        // Placeholder field computation
        let near_field = vec![
            NearFieldSample {
                position: Point3D::new(0.0, 0.0, 1.0),
                e_field: ElectricField {
                    x: Complex64::new(1.0, 0.0),
                    y: Complex64::new(0.0, 0.0),
                    z: Complex64::new(0.0, 0.0),
                },
            }
        ];
        
        let far_field = vec![
            FarFieldSample {
                theta: 0.0,
                phi: 0.0,
                e_theta: Complex64::new(0.0, 0.0),
                e_phi: Complex64::new(1.0, 0.0),
                gain_db: 2.15,
            }
        ];
        
        Ok(FieldResult {
            near_field,
            far_field,
            beamwidth_deg: 78.0,
            directivity_dbi: 2.15,
            efficiency: 0.95,
            max_gain_dbi: 2.0,
            front_to_back_ratio_db: 0.0,
            cross_pol_discrimination_db: 30.0,
            impedance_bandwidth_mhz: 100.0,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::element::DipoleParams;

    #[test]
    fn test_mom_solver_creation() {
        let dipole = AntennaElement::new_dipole(0.5, 0.001);
        let solver = MomSolver::new(dipole);
        assert!(solver.is_ok());
    }

    #[test]
    fn test_single_frequency_solve() {
        let dipole = AntennaElement::new_dipole(0.5, 0.001);
        let solver = MomSolver::new(dipole).unwrap();
        let params = SimulationParams {
            frequency: 300e6,
            resolution: 0.05,
            reference_impedance: 50.0,
        };
        let result = solver.solve(&params);
        assert!(result.is_ok());
    }

    #[test]
    fn test_frequency_sweep() {
        let dipole = AntennaElement::new_dipole(0.5, 0.001);
        let solver = MomSolver::new(dipole).unwrap();
        let sweep = SweepParams {
            start_freq: 200e6,
            stop_freq: 400e6,
            num_points: 11,
        };
        let result = solver.solve_sweep(&sweep, 50.0);
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 11);
    }

    #[test]
    fn test_invalid_sweep_params() {
        let dipole = AntennaElement::new_dipole(0.5, 0.001);
        let solver = MomSolver::new(dipole).unwrap();
        
        // Test invalid num_points
        let sweep = SweepParams {
            start_freq: 200e6,
            stop_freq: 400e6,
            num_points: 1,
        };
        assert!(solver.solve_sweep(&sweep, 50.0).is_err());
        
        // Test invalid frequency range
        let sweep = SweepParams {
            start_freq: 400e6,
            stop_freq: 200e6,
            num_points: 10,
        };
        assert!(solver.solve_sweep(&sweep, 50.0).is_err());
    }
}