use crate::core::types::{Result, AntennaError};
use crate::core::geometry::{Point3D, Mesh, Segment};
use crate::core::element::AntennaElement;
use crate::core::field::{ElectricField, FieldResult, NearFieldSample, FarFieldSample};
use crate::core::{C0, MU0, EPS0, ETA0};
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
    pub s_parameters: SParameterResult,
    pub field_result: FieldResult,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SweepParams {
    pub start_freq: f64,
    pub stop_freq: f64,
    pub num_points: usize,
    pub resolution: f64,
    pub reference_impedance: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SweepResult {
    pub frequencies: Vec<f64>,
    pub s_parameters: Vec<SParameterResult>,
    pub field_results: Vec<FieldResult>,
}

pub struct MomSolver;

impl MomSolver {
    pub fn new() -> Self {
        MomSolver
    }

    pub fn solve(
        &self,
        element: &AntennaElement,
        params: &SimulationParams,
    ) -> Result<SimulationResult> {
        // Generate mesh
        let mesh = element.generate_mesh(params.resolution)?;
        
        // Solve at single frequency
        let (s_params, currents) = self.solve_mom(&mesh, element, params)?;
        
        // Compute fields
        let field_result = self.compute_fields(&mesh, &currents, params.frequency)?;
        
        Ok(SimulationResult {
            s_parameters: s_params,
            field_result,
        })
    }

    pub fn frequency_sweep(
        &self,
        element: &AntennaElement,
        sweep_params: &SweepParams,
    ) -> Result<SweepResult> {
        // Generate mesh once
        let mesh = element.generate_mesh(sweep_params.resolution)?;
        
        // Calculate frequency points
        let mut frequencies = Vec::with_capacity(sweep_params.num_points);
        let freq_step = (sweep_params.stop_freq - sweep_params.start_freq) / 
                       (sweep_params.num_points - 1) as f64;
        
        for i in 0..sweep_params.num_points {
            frequencies.push(sweep_params.start_freq + i as f64 * freq_step);
        }
        
        // Solve at each frequency
        let mut s_parameters = Vec::with_capacity(sweep_params.num_points);
        let mut field_results = Vec::with_capacity(sweep_params.num_points);
        
        for &freq in &frequencies {
            let params = SimulationParams {
                frequency: freq,
                resolution: sweep_params.resolution,
                reference_impedance: sweep_params.reference_impedance,
            };
            
            let (s_params, currents) = self.solve_mom(&mesh, element, &params)?;
            let field_result = self.compute_fields(&mesh, &currents, freq)?;
            
            s_parameters.push(s_params);
            field_results.push(field_result);
        }
        
        Ok(SweepResult {
            frequencies,
            s_parameters,
            field_results,
        })
    }

    fn solve_mom(
        &self,
        mesh: &Mesh,
        element: &AntennaElement,
        params: &SimulationParams,
    ) -> Result<(SParameterResult, Array1<Complex64>)> {
        let num_segments = mesh.segments.len();
        if num_segments == 0 {
            return Err(AntennaError::InvalidGeometry("No segments in mesh".to_string()));
        }
        
        // Build impedance matrix
        let z_matrix = self.build_impedance_matrix(mesh, element, params.frequency)?;
        
        // Build excitation vector (delta-gap source at center segment)
        let v_vector = self.build_excitation_vector(mesh, num_segments)?;
        
        // Solve Z*I = V for currents
        let currents = self.solve_linear_system(z_matrix, v_vector)?;
        
        // Calculate S-parameters
        let s_params = self.calculate_s_parameters(
            &currents,
            mesh,
            params.frequency,
            params.reference_impedance
        )?;
        
        Ok((s_params, currents))
    }

    fn build_impedance_matrix(
        &self,
        mesh: &Mesh,
        element: &AntennaElement,
        frequency: f64,
    ) -> Result<Array2<Complex64>> {
        let n = mesh.segments.len();
        let mut z_matrix = Array2::<Complex64>::zeros((n, n));
        
        let k = 2.0 * std::f64::consts::PI * frequency / C0;
        let omega = 2.0 * std::f64::consts::PI * frequency;
        
        // Get wire radius from element
        let radius = match element {
            AntennaElement::Dipole(params) => params.radius,
            _ => 0.001, // Default thin wire
        };
        
        for i in 0..n {
            for j in 0..n {
                let seg_i = &mesh.segments[i];
                let seg_j = &mesh.segments[j];
                
                let r_i = &mesh.vertices[seg_i.start];
                let r_j = &mesh.vertices[seg_j.start];
                let r_i_end = &mesh.vertices[seg_i.end];
                let r_j_end = &mesh.vertices[seg_j.end];
                
                // Segment lengths
                let l_i = r_i.distance(r_i_end);
                let l_j = r_j.distance(r_j_end);
                
                // Segment centers
                let c_i = Point3D::new(
                    (r_i.x + r_i_end.x) / 2.0,
                    (r_i.y + r_i_end.y) / 2.0,
                    (r_i.z + r_i_end.z) / 2.0,
                );
                let c_j = Point3D::new(
                    (r_j.x + r_j_end.x) / 2.0,
                    (r_j.y + r_j_end.y) / 2.0,
                    (r_j.z + r_j_end.z) / 2.0,
                );
                
                let r = if i == j {
                    radius // Self-term
                } else {
                    c_i.distance(&c_j)
                };
                
                // Thin-wire kernel approximation
                let g = Complex64::new(0.0, -k * r).exp() / (4.0 * std::f64::consts::PI * r);
                
                // Impedance element (simplified)
                let z_ij = Complex64::new(0.0, omega * MU0) * g * l_i * l_j / (4.0 * std::f64::consts::PI);
                
                z_matrix[[i, j]] = z_ij;
            }
        }
        
        Ok(z_matrix)
    }

    fn build_excitation_vector(&self, mesh: &Mesh, n: usize) -> Result<Array1<Complex64>> {
        let mut v_vector = Array1::<Complex64>::zeros(n);
        
        // Delta-gap source at center segment
        let center_idx = n / 2;
        v_vector[center_idx] = Complex64::new(1.0, 0.0);
        
        Ok(v_vector)
    }

    fn solve_linear_system(
        &self,
        z_matrix: Array2<Complex64>,
        v_vector: Array1<Complex64>,
    ) -> Result<Array1<Complex64>> {
        let n = v_vector.len();
        
        // Clone for LU decomposition
        let mut a = z_matrix.clone();
        let mut b = v_vector.clone();
        
        // Simple Gaussian elimination
        for k in 0..n {
            // Find pivot
            let mut max_idx = k;
            let mut max_val = a[[k, k]].norm();
            for i in (k + 1)..n {
                if a[[i, k]].norm() > max_val {
                    max_val = a[[i, k]].norm();
                    max_idx = i;
                }
            }
            
            // Swap rows
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
            
            // Forward elimination
            for i in (k + 1)..n {
                let factor = a[[i, k]] / a[[k, k]];
                for j in k..n {
                    a[[i, j]] = a[[i, j]] - factor * a[[k, j]];
                }
                b[i] = b[i] - factor * b[k];
            }
        }
        
        // Back substitution
        let mut x = Array1::<Complex64>::zeros(n);
        for i in (0..n).rev() {
            x[i] = b[i];
            for j in (i + 1)..n {
                x[i] = x[i] - a[[i, j]] * x[j];
            }
            x[i] = x[i] / a[[i, i]];
        }
        
        Ok(x)
    }

    fn calculate_s_parameters(
        &self,
        currents: &Array1<Complex64>,
        mesh: &Mesh,
        frequency: f64,
        z0: f64,
    ) -> Result<SParameterResult> {
        // Get feed point current (center segment)
        let center_idx = currents.len() / 2;
        let i_in = currents[center_idx];
        
        // Input impedance Z_in = V_in / I_in (V_in = 1.0)
        let z_in = Complex64::new(1.0, 0.0) / i_in;
        
        // S11 = (Z_in - Z0) / (Z_in + Z0)
        let s11 = (z_in - Complex64::new(z0, 0.0)) / (z_in + Complex64::new(z0, 0.0));
        
        // VSWR = (1 + |S11|) / (1 - |S11|)
        let s11_mag = s11.norm();
        let vswr = (1.0 + s11_mag) / (1.0 - s11_mag);
        
        Ok(SParameterResult {
            frequency,
            s11_re: s11.re,
            s11_im: s11.im,
            vswr,
            input_impedance_re: z_in.re,
            input_impedance_im: z_in.im,
        })
    }

    fn compute_fields(
        &self,
        mesh: &Mesh,
        currents: &Array1<Complex64>,
        frequency: f64,
    ) -> Result<FieldResult> {
        // Far field samples
        let mut far_field = Vec::new();
        let mut max_gain_linear: f64 = 0.0;
        
        // Sample far field pattern
        for theta_deg in (0..=180).step_by(5) {
            let theta: f64 = theta_deg as f64 * std::f64::consts::PI / 180.0;
            let phi: f64 = 0.0; // E-plane cut
            
            // Compute far field from current distribution
            let (e_theta, e_phi) = self.compute_far_field_point(
                mesh,
                currents,
                theta,
                phi,
                frequency
            )?;
            
            // Calculate gain
            let k = 2.0 * std::f64::consts::PI * frequency / C0;
            let r = 1.0; // Unit sphere
            let e_mag_sq = e_theta.norm_sqr() + e_phi.norm_sqr();
            let power_density = e_mag_sq / (2.0 * ETA0);
            let u_rad = power_density * r * r;
            
            // Assume unit input power for gain calculation
            let gain_linear = 4.0 * std::f64::consts::PI * u_rad;
            let gain_db = 10.0 * gain_linear.max(1e-10).log10();
            
            max_gain_linear = max_gain_linear.max(gain_linear);
            
            far_field.push(FarFieldSample {
                theta,
                phi,
                e_theta,
                e_phi,
                gain_db,
            });
        }
        
        // Calculate pattern metrics
        let directivity_dbi = 10.0 * max_gain_linear.log10();
        let max_gain_db: f64 = 10.0 * max_gain_linear.max(1e-10).log10();
        
        // Simple beamwidth calculation (3dB points)
        let beamwidth_deg = self.calculate_beamwidth(&far_field)?;
        
        Ok(FieldResult {
            near_field: vec![], // Not implemented yet
            far_field,
            beamwidth_deg,
            directivity_dbi,
            efficiency: 0.95, // Assumed
            max_gain_dbi: max_gain_db,
            front_to_back_ratio_db: 0.0, // Not calculated
            cross_pol_discrimination_db: 30.0, // Assumed
            impedance_bandwidth_mhz: 100.0, // Placeholder
        })
    }

    fn compute_far_field_point(
        &self,
        mesh: &Mesh,
        currents: &Array1<Complex64>,
        theta: f64,
        phi: f64,
        frequency: f64,
    ) -> Result<(Complex64, Complex64)> {
        let k = 2.0 * std::f64::consts::PI * frequency / C0;
        let mut a_theta = Complex64::new(0.0, 0.0);
        let mut a_phi = Complex64::new(0.0, 0.0);
        
        // Sum contributions from all segments
        for (i, segment) in mesh.segments.iter().enumerate() {
            let r1 = &mesh.vertices[segment.start];
            let r2 = &mesh.vertices[segment.end];
            let center = Point3D::new(
                (r1.x + r2.x) / 2.0,
                (r1.y + r2.y) / 2.0,
                (r1.z + r2.z) / 2.0,
            );
            
            // Phase factor
            let kr_dot_r = k * (center.x * theta.sin() * phi.cos() + 
                                center.y * theta.sin() * phi.sin() + 
                                center.z * theta.cos());
            let phase = Complex64::new(0.0, kr_dot_r).exp();
            
            // Current element contribution (simplified)
            let i_n = currents[i];
            let dl = r1.distance(r2);
            
            // Vector potential components (simplified for z-directed dipole)
            a_theta = a_theta + i_n * phase * dl * theta.cos();
            a_phi = a_phi + Complex64::new(0.0, 0.0); // No phi component for z-dipole
        }
        
        // Convert to E-field
        let const_factor = Complex64::new(0.0, -k * ETA0 / (4.0 * std::f64::consts::PI));
        let e_theta = const_factor * a_theta;
        let e_phi = const_factor * a_phi;
        
        Ok((e_theta, e_phi))
    }

    fn calculate_beamwidth(&self, far_field: &[FarFieldSample]) -> Result<f64> {
        // Find max gain
        let max_gain = far_field.iter()
            .map(|s| s.gain_db)
            .fold(f64::NEG_INFINITY, f64::max);
        
        let threshold = max_gain - 3.0; // 3dB beamwidth
        
        // Find angles where gain crosses threshold
        let mut first_angle = None;
        let mut last_angle = None;
        
        for sample in far_field {
            if sample.gain_db >= threshold {
                if first_angle.is_none() {
                    first_angle = Some(sample.theta);
                }
                last_angle = Some(sample.theta);
            }
        }
        
        match (first_angle, last_angle) {
            (Some(a1), Some(a2)) => Ok((a2 - a1) * 180.0 / std::f64::consts::PI),
            _ => Ok(180.0), // Default if pattern is too broad
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::element::DipoleParams;

    #[test]
    fn test_mom_solver_creation() {
        let solver = MomSolver::new();
        // Just verify it compiles
        assert!(true);
    }

    #[test]
    fn test_solve_dipole() {
        let solver = MomSolver::new();
        let dipole = AntennaElement::new_dipole(0.5, 0.001);
        let params = SimulationParams {
            frequency: 300e6,
            resolution: 0.05,
            reference_impedance: 50.0,
        };
        
        let result = solver.solve(&dipole, &params);
        assert!(result.is_ok());
    }

    #[test]
    fn test_frequency_sweep() {
        let solver = MomSolver::new();
        let dipole = AntennaElement::new_dipole(0.5, 0.001);
        let sweep_params = SweepParams {
            start_freq: 200e6,
            stop_freq: 400e6,
            num_points: 11,
            resolution: 0.05,
            reference_impedance: 50.0,
        };
        
        let result = solver.frequency_sweep(&dipole, &sweep_params);
        assert!(result.is_ok());
        
        if let Ok(sweep_result) = result {
            assert_eq!(sweep_result.frequencies.len(), 11);
            assert_eq!(sweep_result.s_parameters.len(), 11);
            assert_eq!(sweep_result.field_results.len(), 11);
        }
    }
}
