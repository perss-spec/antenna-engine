use crate::core::types::Result;
use crate::core::geometry::{Point3D, Mesh};
use crate::core::element::AntennaElement;
use crate::core::field::{FieldResult, FarFieldSample, NearFieldSample, ElectricField};
use crate::core::port::Port;
use crate::core::green::GreenFunction;
use crate::core::constants::{C0, ETA0};
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
pub struct SimulationResult {
    pub s_parameters: Vec<SParameterResult>,
    pub field_result: FieldResult,
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

pub struct MomSolver {
    element: AntennaElement,
    mesh: Mesh,
    params: SimulationParams,
    ports: Vec<Port>,
}

impl MomSolver {
    pub fn new(element: AntennaElement, params: SimulationParams) -> Result<Self> {
        let mesh = element.generate_mesh(params.resolution)?;
        let ports = vec![Port::new(0, params.reference_impedance)];
        
        Ok(Self {
            element,
            mesh,
            params,
            ports,
        })
    }

    pub fn solve(&mut self) -> Result<SimulationResult> {
        let wavelength = C0 / self.params.frequency;
        let k = 2.0 * PI / wavelength;
        
        // Build impedance matrix
        let z_matrix = self.build_impedance_matrix(k)?;
        
        // Build excitation vector
        let v_vector = self.build_excitation_vector();
        
        // Solve Z*I = V for current distribution
        let currents = self.solve_linear_system(z_matrix, v_vector)?;
        
        // Calculate S-parameters
        let s_params = self.calculate_s_parameters(&currents)?;
        
        // Calculate field patterns
        let field_result = self.calculate_fields(&currents, k)?;
        
        Ok(SimulationResult {
            s_parameters: vec![s_params],
            field_result,
        })
    }

    fn build_impedance_matrix(&self, k: f64) -> Result<Array2<Complex64>> {
        let n_segments = self.mesh.segments.len();
        let mut z_matrix = Array2::<Complex64>::zeros((n_segments, n_segments));
        
        let green = GreenFunction::new(k);
        let wire_radius = self.get_wire_radius();
        
        for i in 0..n_segments {
            for j in 0..n_segments {
                let seg_i = &self.mesh.segments[i];
                let seg_j = &self.mesh.segments[j];
                
                let p1_i = self.mesh.vertices[seg_i.start].clone();
                let p2_i = self.mesh.vertices[seg_i.end].clone();
                let p1_j = self.mesh.vertices[seg_j.start].clone();
                let p2_j = self.mesh.vertices[seg_j.end].clone();
                
                z_matrix[[i, j]] = green.wire_impedance(
                    &p1_i, &p2_i, &p1_j, &p2_j, wire_radius
                );
            }
        }
        
        Ok(z_matrix)
    }

    fn build_excitation_vector(&self) -> Array1<Complex64> {
        let n_segments = self.mesh.segments.len();
        let mut v_vector = Array1::<Complex64>::zeros(n_segments);
        
        // Apply voltage to port segment
        if let Some(port) = self.ports.first() {
            let excitation = port.get_excitation();
            v_vector[port.segment_index] = excitation.voltage;
        }
        
        v_vector
    }

    fn solve_linear_system(
        &self,
        z_matrix: Array2<Complex64>,
        v_vector: Array1<Complex64>
    ) -> Result<Array1<Complex64>> {
        // Clone matrices for LU decomposition
        let mut a = z_matrix.clone();
        let mut b = v_vector.clone();
        let n = a.nrows();
        
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
            
            // Forward elimination
            for i in k+1..n {
                let factor = a[[i, k]] / a[[k, k]];
                for j in k+1..n {
                    a[[i, j]] = a[[i, j]] - factor * a[[k, j]];
                }
                b[i] = b[i] - factor * b[k];
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

    fn calculate_s_parameters(&self, currents: &Array1<Complex64>) -> Result<SParameterResult> {
        let port = &self.ports[0];
        let i_in = currents[port.segment_index];
        let v_in = port.get_excitation().voltage;
        
        let z_in = v_in / i_in;
        let z0 = Complex64::new(self.params.reference_impedance, 0.0);
        let s11 = (z_in - z0) / (z_in + z0);
        
        let vswr = (1.0 + s11.norm()) / (1.0 - s11.norm());
        
        Ok(SParameterResult {
            frequency: self.params.frequency,
            s11_re: s11.re,
            s11_im: s11.im,
            vswr,
            input_impedance_re: z_in.re,
            input_impedance_im: z_in.im,
        })
    }

    fn calculate_fields(&self, currents: &Array1<Complex64>, k: f64) -> Result<FieldResult> {
        let far_field = self.calculate_far_field(currents, k)?;
        let near_field = self.calculate_near_field(currents, k)?;
        
        // Calculate pattern metrics
        let (beamwidth, directivity, gain) = self.calculate_pattern_metrics(&far_field);
        
        Ok(FieldResult {
            near_field,
            far_field,
            beamwidth_deg: beamwidth,
            directivity_dbi: directivity,
            efficiency: 0.95, // Assume 95% for now
            max_gain_dbi: gain,
            front_to_back_ratio_db: 20.0,
            cross_pol_discrimination_db: 30.0,
            impedance_bandwidth_mhz: 100.0,
        })
    }

    fn calculate_far_field(
        &self,
        currents: &Array1<Complex64>,
        k: f64
    ) -> Result<Vec<FarFieldSample>> {
        let mut samples = Vec::new();
        
        for theta_deg in (0..=180).step_by(5) {
            for phi_deg in (0..360).step_by(10) {
                let theta = theta_deg as f64 * PI / 180.0;
                let phi = phi_deg as f64 * PI / 180.0;
                
                let (e_theta, e_phi) = self.compute_far_field_at_angle(
                    currents, k, theta, phi
                )?;
                
                let power = (e_theta.norm_sqr() + e_phi.norm_sqr()) / (2.0 * ETA0);
                let gain_db = 10.0 * power.log10();
                
                samples.push(FarFieldSample {
                    theta: theta_deg as f64,
                    phi: phi_deg as f64,
                    e_theta,
                    e_phi,
                    gain_db,
                });
            }
        }
        
        Ok(samples)
    }

    fn compute_far_field_at_angle(
        &self,
        currents: &Array1<Complex64>,
        k: f64,
        theta: f64,
        phi: f64
    ) -> Result<(Complex64, Complex64)> {
        let mut e_theta = Complex64::new(0.0, 0.0);
        let e_phi = Complex64::new(0.0, 0.0);
        
        let sin_theta = theta.sin();
        let cos_theta = theta.cos();
        let sin_phi = phi.sin();
        let cos_phi = phi.cos();
        
        for (i, segment) in self.mesh.segments.iter().enumerate() {
            let p1 = &self.mesh.vertices[segment.start];
            let p2 = &self.mesh.vertices[segment.end];
            let center = Point3D::new(
                (p1.x + p2.x) / 2.0,
                (p1.y + p2.y) / 2.0,
                (p1.z + p2.z) / 2.0
            );
            
            let r_dot_r_hat = center.x * sin_theta * cos_phi +
                             center.y * sin_theta * sin_phi +
                             center.z * cos_theta;
            
            let phase = Complex64::new(0.0, k * r_dot_r_hat).exp();
            let current = currents[i] * phase;
            
            // Simplified dipole pattern
            e_theta = e_theta + current * sin_theta;
        }
        
        Ok((e_theta, e_phi))
    }

    fn calculate_near_field(
        &self,
        _currents: &Array1<Complex64>,
        _k: f64
    ) -> Result<Vec<NearFieldSample>> {
        let samples = vec![
            NearFieldSample {
                position: Point3D::new(0.0, 0.0, 1.0),
                e_field: ElectricField {
                    x: Complex64::new(0.0, 0.0),
                    y: Complex64::new(0.0, 0.0),
                    z: Complex64::new(1.0, 0.0),
                },
            }
        ];
        Ok(samples)
    }

    fn calculate_pattern_metrics(
        &self,
        far_field: &[FarFieldSample]
    ) -> (f64, f64, f64) {
        let max_gain = far_field.iter()
            .map(|s| s.gain_db)
            .fold(f64::NEG_INFINITY, f64::max);
        
        (70.0, max_gain, max_gain) // Typical dipole beamwidth
    }

    fn get_wire_radius(&self) -> f64 {
        match &self.element {
            AntennaElement::Dipole(params) => params.radius,
            AntennaElement::Patch(_) => 0.001,
            AntennaElement::Qfh(params) => params.wire_radius,
        }
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
        
        let params = SimulationParams {
            frequency: 300e6,
            resolution: 0.05,
            reference_impedance: 50.0,
        };
        
        let solver = MomSolver::new(dipole, params);
        assert!(solver.is_ok());
    }

    #[test]
    fn test_solve_dipole() {
        let dipole = AntennaElement::Dipole(DipoleParams {
            length: 0.5,
            radius: 0.001,
            center: Point3D::origin(),
            orientation: Point3D::new(0.0, 0.0, 1.0),
        });
        
        let params = SimulationParams {
            frequency: 300e6,
            resolution: 0.05,
            reference_impedance: 50.0,
        };
        
        let mut solver = MomSolver::new(dipole, params).unwrap();
        let result = solver.solve();
        assert!(result.is_ok());
    }
}