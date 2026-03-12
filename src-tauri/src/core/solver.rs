use crate::core::types::{Result, AntennaError};
use crate::core::geometry::{Point3D, Mesh, Segment};
use crate::core::element::AntennaElement;
use crate::core::field::{FieldResult, NearFieldSample, FarFieldSample, ElectricField};
use crate::core::constants::{C0, EPS0, MU0, PI};
use ndarray::{Array1, Array2};
use num_complex::Complex64;
use serde::{Serialize, Deserialize};
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
        let mesh = element.generate_mesh(0.1)?;
        Ok(Self { element, mesh })
    }

    pub fn solve(&self, params: &SimulationParams) -> Result<SimulationResult> {
        let s_param = self.solve_single_frequency(params.frequency, params.reference_impedance)?;
        let field_result = self.compute_fields(params.frequency, &s_param)?;
        
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
        
        // Parallel computation of S-parameters
        let results: Result<Vec<_>> = frequencies
            .par_iter()
            .map(|&freq| self.solve_single_frequency(freq, reference_impedance))
            .collect();
        
        results
    }

    fn solve_single_frequency(&self, frequency: f64, reference_impedance: f64) -> Result<SParameterResult> {
        let wavelength = C0 / frequency;
        let _k = 2.0 * PI / wavelength;
        
        // Get segments from mesh
        let segments = &self.mesh.segments;
        let n = segments.len();
        
        if n == 0 {
            return Err(AntennaError::InvalidGeometry("No segments in mesh".to_string()));
        }
        
        // Build impedance matrix
        let z_matrix = self.build_impedance_matrix(frequency)?;
        
        // Build excitation vector (voltage source at center segment)
        let v_vector = self.build_excitation_vector(n);
        
        // Solve Z*I = V for current distribution
        let currents = self.solve_linear_system(&z_matrix, &v_vector)?;
        
        // Extract port current (center segment)
        let port_idx = n / 2;
        let port_current = currents[port_idx];
        let port_voltage = Complex64::new(1.0, 0.0); // Unit excitation
        
        // Calculate input impedance
        let z_in = if port_current.norm() > 1e-10 {
            port_voltage / port_current
        } else {
            return Err(AntennaError::NumericalError("Port current too small".to_string()));
        };
        
        // Calculate S11
        let z0 = Complex64::new(reference_impedance, 0.0);
        let s11 = (z_in - z0) / (z_in + z0);
        
        // Calculate VSWR
        let s11_mag = s11.norm();
        let vswr = if s11_mag < 0.999 {
            (1.0 + s11_mag) / (1.0 - s11_mag)
        } else {
            999.0 // Cap at large value
        };
        
        Ok(SParameterResult {
            frequency,
            s11_re: s11.re,
            s11_im: s11.im,
            vswr,
            input_impedance_re: z_in.re,
            input_impedance_im: z_in.im,
        })
    }

    fn build_impedance_matrix(&self, frequency: f64) -> Result<Array2<Complex64>> {
        let segments = &self.mesh.segments;
        let vertices = &self.mesh.vertices;
        let n = segments.len();
        
        let mut z_matrix = Array2::<Complex64>::zeros((n, n));
        let wavelength = C0 / frequency;
        let k = 2.0 * PI / wavelength;
        let omega = 2.0 * PI * frequency;
        
        // Get wire radius from element
        let radius = match &self.element {
            AntennaElement::Dipole(params) => params.radius,
            _ => 0.001, // Default thin wire
        };
        
        for i in 0..n {
            for j in 0..n {
                let seg_i = &segments[i];
                let seg_j = &segments[j];
                
                let r_i = vertices[seg_i.start].clone();
                let r_j = vertices[seg_j.start].clone();
                let r_i_end = vertices[seg_i.end].clone();
                let r_j_end = vertices[seg_j.end].clone();
                
                // Calculate segment centers
                let center_i = Point3D::new(
                    (r_i.x + r_i_end.x) / 2.0,
                    (r_i.y + r_i_end.y) / 2.0,
                    (r_i.z + r_i_end.z) / 2.0
                );
                let center_j = Point3D::new(
                    (r_j.x + r_j_end.x) / 2.0,
                    (r_j.y + r_j_end.y) / 2.0,
                    (r_j.z + r_j_end.z) / 2.0
                );
                
                let r = center_i.distance(&center_j);
                let r_eff = if i == j { radius } else { r.max(1e-10) };
                
                // Thin wire approximation
                let g = Complex64::new(0.0, -omega * MU0 / (4.0 * PI)) * 
                        Complex64::new((k * r_eff).cos(), -(k * r_eff).sin()) / r_eff;
                
                z_matrix[[i, j]] = g;
            }
        }
        
        Ok(z_matrix)
    }

    fn build_excitation_vector(&self, n: usize) -> Array1<Complex64> {
        let mut v = Array1::<Complex64>::zeros(n);
        // Excite center segment with unit voltage
        let center_idx = n / 2;
        v[center_idx] = Complex64::new(1.0, 0.0);
        v
    }

    fn solve_linear_system(&self, a: &Array2<Complex64>, b: &Array1<Complex64>) -> Result<Array1<Complex64>> {
        let n = a.nrows();
        if n != a.ncols() || n != b.len() {
            return Err(AntennaError::InvalidParameter("Matrix dimensions mismatch".to_string()));
        }
        
        // Clone matrices for Gaussian elimination
        let mut a_work = a.clone();
        let mut b_work = b.clone();
        
        // Gaussian elimination with partial pivoting
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
                    let temp = a_work[[k, j]];
                    a_work[[k, j]] = a_work[[max_idx, j]];
                    a_work[[max_idx, j]] = temp;
                }
                let temp = b_work[k];
                b_work[k] = b_work[max_idx];
                b_work[max_idx] = temp;
            }
            
            // Eliminate column
            for i in (k + 1)..n {
                let factor = a_work[[i, k]] / a_work[[k, k]];
                for j in k..n {
                    a_work[[i, j]] = a_work[[i, j]] - factor * a_work[[k, j]];
                }
                b_work[i] = b_work[i] - factor * b_work[k];
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

    fn compute_fields(&self, frequency: f64, _s_param: &SParameterResult) -> Result<FieldResult> {
        let wavelength = C0 / frequency;
        let _k = 2.0 * PI / wavelength;
        
        // Generate far field samples
        let mut far_field = Vec::new();
        for theta_deg in (0..=180).step_by(5) {
            let theta = theta_deg as f64 * PI / 180.0;
            for phi_deg in (0..360).step_by(10) {
                let _phi = phi_deg as f64 * PI / 180.0;
                
                // Placeholder pattern (dipole-like)
                let gain_db = 2.15 * theta.sin().powi(2) - 30.0;
                
                far_field.push(FarFieldSample {
                    theta: theta_deg as f64,
                    phi: phi_deg as f64,
                    e_theta: Complex64::new(theta.sin(), 0.0),
                    e_phi: Complex64::new(0.0, 0.0),
                    gain_db,
                });
            }
        }
        
        Ok(FieldResult {
            near_field: vec![],
            far_field,
            beamwidth_deg: 78.0,
            directivity_dbi: 2.15,
            efficiency: 0.95,
            max_gain_dbi: 2.0,
            front_to_back_ratio_db: 0.0,
            cross_pol_discrimination_db: 999.0,
            impedance_bandwidth_mhz: 50.0,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::element::DipoleParams;
    
    #[test]
    fn test_mom_solver_creation() {
        let dipole = AntennaElement::Dipole(DipoleParams {
            length: 0.5,
            radius: 0.001,
            center: Point3D::origin(),
            orientation: Point3D::new(0.0, 0.0, 1.0),
        });
        
        let solver = MomSolver::new(dipole);
        assert!(solver.is_ok());
    }
    
    #[test]
    fn test_frequency_sweep() {
        let dipole = AntennaElement::Dipole(DipoleParams {
            length: 0.5,
            radius: 0.001,
            center: Point3D::origin(),
            orientation: Point3D::new(0.0, 0.0, 1.0),
        });
        
        let solver = MomSolver::new(dipole).unwrap();
        let sweep = SweepParams {
            start_freq: 100e6,
            stop_freq: 200e6,
            num_points: 11,
        };
        
        let results = solver.solve_sweep(&sweep, 50.0);
        assert!(results.is_ok());
        let results = results.unwrap();
        assert_eq!(results.len(), 11);
    }
    
    #[test]
    fn test_invalid_sweep_params() {
        let dipole = AntennaElement::Dipole(DipoleParams {
            length: 0.5,
            radius: 0.001,
            center: Point3D::origin(),
            orientation: Point3D::new(0.0, 0.0, 1.0),
        });
        
        let solver = MomSolver::new(dipole).unwrap();
        
        // Test invalid num_points
        let sweep = SweepParams {
            start_freq: 100e6,
            stop_freq: 200e6,
            num_points: 1,
        };
        assert!(solver.solve_sweep(&sweep, 50.0).is_err());
        
        // Test invalid frequency range
        let sweep = SweepParams {
            start_freq: 200e6,
            stop_freq: 100e6,
            num_points: 10,
        };
        assert!(solver.solve_sweep(&sweep, 50.0).is_err());
    }
}
