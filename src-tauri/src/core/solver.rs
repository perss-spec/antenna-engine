use crate::core::types::{Result, AntennaError};
use crate::core::geometry::{Point3D, Mesh};
use crate::core::element::AntennaElement;
use crate::core::field::{ElectricField, FieldResult, NearFieldSample, FarFieldSample};
use crate::core::{C0, MU0, EPS0, ETA0};
use num_complex::Complex64;
use ndarray::{Array1, Array2};
use serde::{Serialize, Deserialize};
use std::f64::consts::PI;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationParams {
    pub frequency: f64,
    pub resolution: f64,
    pub reference_impedance: f64,
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
    pub s_params: SParameterResult,
    pub field: FieldResult,
    pub num_unknowns: usize,
    pub solver_type: String,
}

#[derive(Debug, Clone)]
pub struct MomSolver {
    pub params: SimulationParams,
}

impl MomSolver {
    pub fn new(params: SimulationParams) -> Self {
        Self { params }
    }

    pub fn solve(&self, element: &AntennaElement) -> Result<SimulationResult> {
        // Generate mesh
        let mesh = element.generate_mesh(self.params.resolution)?;
        
        // Build impedance matrix
        let z_matrix = self.build_impedance_matrix(&mesh)?;
        
        // Build excitation vector
        let v_vector = self.build_excitation_vector(&mesh, element)?;
        
        // Solve for currents
        let currents = self.solve_linear_system(&z_matrix, &v_vector)?;
        
        // Compute S-parameters
        let s_params = self.compute_s_parameters(&mesh, &currents, element)?;
        
        // Compute fields
        let field = self.compute_fields(&mesh, &currents)?;
        
        Ok(SimulationResult {
            s_params,
            field,
            num_unknowns: mesh.segments.len(),
            solver_type: "MoM".to_string(),
        })
    }

    fn build_impedance_matrix(&self, mesh: &Mesh) -> Result<Array2<Complex64>> {
        let n = mesh.segments.len();
        let mut z_matrix = Array2::<Complex64>::zeros((n, n));
        
        let k = 2.0 * PI * self.params.frequency / C0;
        
        for i in 0..n {
            for j in 0..n {
                let z_ij = self.compute_z_element(mesh, i, j, k)?;
                z_matrix[[i, j]] = z_ij;
            }
        }
        
        Ok(z_matrix)
    }

    fn compute_z_element(&self, mesh: &Mesh, i: usize, j: usize, k: f64) -> Result<Complex64> {
        let seg_i = &mesh.segments[i];
        let seg_j = &mesh.segments[j];
        
        let ri = &mesh.vertices[seg_i.start];
        let rj = &mesh.vertices[seg_j.start];
        
        let r = ((ri.x - rj.x).powi(2) + (ri.y - rj.y).powi(2) + (ri.z - rj.z).powi(2)).sqrt();
        
        if r < 1e-10 {
            // Self term
            let length = self.segment_length(mesh, seg_i)?;
            let a = length / 100.0; // Wire radius approximation
            let psi = Complex64::new(0.0, -k * a);
            Ok(Complex64::new(0.0, ETA0 / (4.0 * PI)) * (2.0 * PI / k) * psi)
        } else {
            // Mutual term
            let phase = Complex64::new(0.0, -k * r);
            let g = phase.exp() / (4.0 * PI * r);
            Ok(Complex64::new(0.0, ETA0) * g)
        }
    }

    fn segment_length(&self, mesh: &Mesh, seg: &crate::core::geometry::Segment) -> Result<f64> {
        let p1 = &mesh.vertices[seg.start];
        let p2 = &mesh.vertices[seg.end];
        let dx = p2.x - p1.x;
        let dy = p2.y - p1.y;
        let dz = p2.z - p1.z;
        Ok((dx*dx + dy*dy + dz*dz).sqrt())
    }

    fn build_excitation_vector(&self, mesh: &Mesh, _element: &AntennaElement) -> Result<Array1<Complex64>> {
        let n = mesh.segments.len();
        let mut v = Array1::<Complex64>::zeros(n);
        
        // Simple delta-gap excitation at center segment
        if n > 0 {
            let center_idx = n / 2;
            v[center_idx] = Complex64::new(1.0, 0.0);
        }
        
        Ok(v)
    }

    fn solve_linear_system(&self, z: &Array2<Complex64>, v: &Array1<Complex64>) -> Result<Array1<Complex64>> {
        let n = v.len();
        if n == 0 {
            return Err(AntennaError::SimulationFailed("Empty system".to_string()));
        }
        
        // Clone matrices for Gaussian elimination
        let mut a = z.clone();
        let mut b = v.clone();
        
        // Gaussian elimination with partial pivoting
        for k in 0..n-1 {
            // Find pivot
            let mut max_idx = k;
            let mut max_val = a[[k, k]].norm();
            
            for i in k+1..n {
                let val = a[[i, k]].norm();
                if val > max_val {
                    max_val = val;
                    max_idx = i;
                }
            }
            
            // Swap rows if needed
            if max_idx != k {
                for j in 0..n {
                    let temp = a[[k, j]];
                    a[[k, j]] = a[[max_idx, j]];
                    a[[max_idx, j]] = temp;
                }
                let temp = b[k];
                b[k] = b[max_idx];
                b[max_idx] = temp;
            }
            
            // Check for singularity
            if a[[k, k]].norm() < 1e-10 {
                return Err(AntennaError::NumericalError("Singular matrix".to_string()));
            }
            
            // Eliminate column
            for i in k+1..n {
                let factor = a[[i, k]] / a[[k, k]];
                for j in k+1..n {
                    a[[i, j]] = a[[i, j]] - factor * a[[k, j]];
                }
                b[i] = b[i] - factor * b[k];
                a[[i, k]] = Complex64::new(0.0, 0.0);
            }
        }
        
        // Back substitution
        let mut x = Array1::<Complex64>::zeros(n);
        for i in (0..n).rev() {
            let mut sum = b[i];
            for j in i+1..n {
                sum = sum - a[[i, j]] * x[j];
            }
            x[i] = sum / a[[i, i]];
        }
        
        Ok(x)
    }

    fn compute_s_parameters(&self, _mesh: &Mesh, currents: &Array1<Complex64>, _element: &AntennaElement) -> Result<SParameterResult> {
        // Simplified S-parameter calculation
        let i_in = if currents.len() > 0 {
            currents[currents.len() / 2]
        } else {
            Complex64::new(1.0, 0.0)
        };
        
        let v_in = Complex64::new(1.0, 0.0); // Normalized
        let z_in = v_in / i_in;
        let z0 = Complex64::new(self.params.reference_impedance, 0.0);
        
        let gamma = (z_in - z0) / (z_in + z0);
        let vswr = (1.0 + gamma.norm()) / (1.0 - gamma.norm());
        
        Ok(SParameterResult {
            frequency: self.params.frequency,
            s11_re: gamma.re,
            s11_im: gamma.im,
            vswr,
            input_impedance_re: z_in.re,
            input_impedance_im: z_in.im,
        })
    }

    fn compute_fields(&self, mesh: &Mesh, currents: &Array1<Complex64>) -> Result<FieldResult> {
        let mut near_field = Vec::new();
        let mut far_field = Vec::new();
        
        // Sample near field on a grid
        let grid_size = 5;
        let spacing = 0.1; // meters
        
        for i in 0..grid_size {
            for j in 0..grid_size {
                let x = (i as f64 - grid_size as f64 / 2.0) * spacing;
                let y = (j as f64 - grid_size as f64 / 2.0) * spacing;
                let z = 0.5; // 0.5m above antenna
                
                let position = Point3D { x, y, z };
                let field = self.compute_field_at_point(&position, mesh, currents)?;
                
                near_field.push(NearFieldSample {
                    position,
                    e_field: field,
                });
            }
        }
        
        // Sample far field pattern
        let theta_samples = 37; // 0 to 180 degrees, 5 degree steps
        let phi_samples = 72;   // 0 to 360 degrees, 5 degree steps
        
        for i in 0..theta_samples {
            for j in 0..phi_samples {
                let theta = (i as f64) * PI / (theta_samples as f64 - 1.0);
                let phi = (j as f64) * 2.0 * PI / (phi_samples as f64);
                
                let (e_theta, e_phi) = self.compute_far_field_components(theta, phi, mesh, currents)?;
                let power = (e_theta.norm_sqr() + e_phi.norm_sqr()) / (2.0 * ETA0);
                let gain_db = 10.0 * power.log10();
                
                far_field.push(FarFieldSample {
                    theta,
                    phi,
                    e_theta,
                    e_phi,
                    gain_db,
                });
            }
        }
        
        // Find peak gain and beamwidth
        let max_gain = far_field.iter().map(|s| s.gain_db).fold(f64::NEG_INFINITY, f64::max);
        let directivity_dbi = max_gain; // Simplified, assumes lossless
        
        // Find 3dB beamwidth (simplified)
        let half_power = max_gain - 3.0;
        let mut beamwidth_deg = 90.0; // Default
        
        for sample in &far_field {
            if (sample.gain_db - half_power).abs() < 0.5 {
                beamwidth_deg = sample.theta.to_degrees();
                break;
            }
        }
        
        Ok(FieldResult {
            near_field,
            far_field,
            beamwidth_deg,
            directivity_dbi,
            efficiency: 0.95, // Assumed for now
            max_gain_dbi: max_gain,
            front_to_back_ratio_db: 20.0, // Placeholder
            cross_pol_discrimination_db: 30.0, // Placeholder
            impedance_bandwidth_mhz: 100.0, // Placeholder
        })
    }

    fn compute_field_at_point(&self, point: &Point3D, mesh: &Mesh, currents: &Array1<Complex64>) -> Result<ElectricField> {
        let mut e_total = Complex64::new(0.0, 0.0);
        let k = 2.0 * PI * self.params.frequency / C0;
        
        for (i, seg) in mesh.segments.iter().enumerate() {
            if i >= currents.len() {
                break;
            }
            
            let source = &mesh.vertices[seg.start];
            let r = ((point.x - source.x).powi(2) + 
                     (point.y - source.y).powi(2) + 
                     (point.z - source.z).powi(2)).sqrt();
            
            if r > 1e-6 {
                let phase = Complex64::new(0.0, -k * r);
                let g = phase.exp() / (4.0 * PI * r);
                e_total = e_total + currents[i] * g;
            }
        }
        
        // Simplified: assume z-directed field
        Ok(ElectricField {
            x: Complex64::new(0.0, 0.0),
            y: Complex64::new(0.0, 0.0),
            z: e_total * Complex64::new(0.0, -ETA0),
        })
    }

    fn compute_far_field_components(&self, theta: f64, phi: f64, mesh: &Mesh, currents: &Array1<Complex64>) -> Result<(Complex64, Complex64)> {
        let k = 2.0 * PI * self.params.frequency / C0;
        let mut a_theta = Complex64::new(0.0, 0.0);
        let mut a_phi = Complex64::new(0.0, 0.0);
        
        for (i, seg) in mesh.segments.iter().enumerate() {
            if i >= currents.len() {
                break;
            }
            
            let source = &mesh.vertices[seg.start];
            let kr_dot_r = k * (source.x * theta.sin() * phi.cos() + 
                                source.y * theta.sin() * phi.sin() + 
                                source.z * theta.cos());
            
            let phase = Complex64::new(0.0, kr_dot_r);
            let factor = currents[i] * phase.exp();
            
            // Simplified: assume z-directed current
            a_theta = a_theta + factor * theta.cos();
            a_phi = a_phi + factor * Complex64::new(0.0, 0.0);
        }
        
        let const_factor = Complex64::new(0.0, -k * ETA0 / (4.0 * PI));
        Ok((a_theta * const_factor, a_phi * const_factor))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::element::AntennaElement;

    #[test]
    fn test_mom_solver_creation() {
        let params = SimulationParams {
            frequency: 1e9,
            resolution: 0.01,
            reference_impedance: 50.0,
        };
        let solver = MomSolver::new(params);
        assert_eq!(solver.params.frequency, 1e9);
    }

    #[test]
    fn test_solve_dipole() {
        let params = SimulationParams {
            frequency: 300e6,
            resolution: 0.05,
            reference_impedance: 50.0,
        };
        let solver = MomSolver::new(params);
        
        let dipole = AntennaElement::new_dipole(0.5, 0.001);
        let result = solver.solve(&dipole);
        
        assert!(result.is_ok());
        let res = result.unwrap();
        assert!(res.num_unknowns > 0);
        assert_eq!(res.solver_type, "MoM");
    }
}