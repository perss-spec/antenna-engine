use ndarray::{Array1, Array2};
use num_complex::Complex64;
use serde::{Deserialize, Serialize};
use rayon::prelude::*;

use crate::core::types::{AntennaError, Result};
use crate::core::element::AntennaElement;
use crate::core::field::{FieldResult, FarFieldSample, NearFieldSample, ElectricField};
use crate::core::geometry::{Point3D, Mesh};
use crate::core::green::GreenFunction;
use crate::core::impedance::ImpedanceMatrix;
use crate::core::port::{Port, PortType};
use crate::core::nf2ff::NearToFarField;
use crate::core::{C0, ETA0};

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
    pub s_parameters: Vec<SParameterResult>,
    pub field_results: FieldResult,
    pub current_distribution: Vec<Complex64>,
}

pub struct MomSolver {
    mesh: Mesh,
    ports: Vec<Port>,
    green_function: GreenFunction,
}

impl MomSolver {
    pub fn new(element: &AntennaElement, params: &SimulationParams) -> Result<Self> {
        let mesh = element.generate_mesh(params.resolution)?;
        let ports = Self::create_ports(element, &mesh)?;
        let wavelength = C0 / params.frequency;
        let green_function = GreenFunction::new(wavelength);

        Ok(Self {
            mesh,
            ports,
            green_function,
        })
    }

    fn create_ports(element: &AntennaElement, mesh: &Mesh) -> Result<Vec<Port>> {
        match element {
            AntennaElement::Dipole(params) => {
                // Find center segment for dipole feed
                let center = params.center;
                let mut min_dist = f64::INFINITY;
                let mut feed_segment = 0;

                for (i, seg) in mesh.segments.iter().enumerate() {
                    let v1 = &mesh.vertices[seg.start];
                    let v2 = &mesh.vertices[seg.end];
                    let seg_center = Point3D::new(
                        (v1.x + v2.x) / 2.0,
                        (v1.y + v2.y) / 2.0,
                        (v1.z + v2.z) / 2.0,
                    );
                    let dist = center.distance(&seg_center);
                    if dist < min_dist {
                        min_dist = dist;
                        feed_segment = i;
                    }
                }

                Ok(vec![Port::new(
                    feed_segment,
                    PortType::VoltageSource { voltage: Complex64::new(1.0, 0.0) },
                )])
            }
            AntennaElement::Patch(params) => {
                // Edge feed for patch antenna
                let feed_x = params.center.x - params.width / 2.0;
                let feed_y = params.center.y;
                let feed_z = params.center.z + params.substrate_height;
                let feed_point = Point3D::new(feed_x, feed_y, feed_z);

                // Find nearest edge segment
                let mut min_dist = f64::INFINITY;
                let mut feed_segment = 0;

                for (i, seg) in mesh.segments.iter().enumerate() {
                    let v1 = &mesh.vertices[seg.start];
                    let dist = v1.distance(&feed_point);
                    if dist < min_dist {
                        min_dist = dist;
                        feed_segment = i;
                    }
                }

                Ok(vec![Port::new(
                    feed_segment,
                    PortType::VoltageSource { voltage: Complex64::new(1.0, 0.0) },
                )])
            }
            AntennaElement::Qfh(_) => {
                // QFH has 4 ports with phase quadrature
                let mut ports = Vec::new();
                for i in 0..4 {
                    let phase = i as f64 * std::f64::consts::PI / 2.0;
                    let voltage = Complex64::from_polar(1.0, phase);
                    ports.push(Port::new(
                        i,
                        PortType::VoltageSource { voltage },
                    ));
                }
                Ok(ports)
            }
        }
    }

    pub fn solve(&self, params: &SimulationParams) -> Result<SimulationResult> {
        let n_segments = self.mesh.segments.len();
        if n_segments == 0 {
            return Err(AntennaError::InvalidGeometry("No segments in mesh".to_string()));
        }

        // Build impedance matrix
        let mut z_matrix = ImpedanceMatrix::new(&self.mesh, &self.green_function)?;
        let z = z_matrix.build()?;

        // Build excitation vector
        let mut v = Array1::<Complex64>::zeros(n_segments);
        for port in &self.ports {
            let excitation: Complex64 = port.get_excitation();
            v[port.segment_index] = excitation;
        }

        // Solve Z*I = V for current distribution
        let current = self.solve_linear_system(z, v)?;

        // Calculate S-parameters
        let s_params = self.calculate_s_parameters(&current, params)?;

        // Calculate radiation pattern
        let nf2ff = NearToFarField::new(&self.mesh, &current, params.frequency);
        let field_results = nf2ff.calculate_pattern()?;

        Ok(SimulationResult {
            s_parameters: vec![s_params],
            field_results,
            current_distribution: current.to_vec(),
        })
    }

    fn solve_linear_system(
        &self,
        z: Array2<Complex64>,
        v: Array1<Complex64>,
    ) -> Result<Array1<Complex64>> {
        // LU decomposition with partial pivoting
        let n = z.nrows();
        let mut a = z.clone();
        let mut b = v.clone();
        let mut pivot = vec![0; n];

        // Initialize pivot array
        for i in 0..n {
            pivot[i] = i;
        }

        // LU decomposition
        for k in 0..n-1 {
            // Find pivot
            let mut max_val = 0.0;
            let mut max_idx = k;
            for i in k..n {
                let val = a[[pivot[i], k]].norm();
                if val > max_val {
                    max_val = val;
                    max_idx = i;
                }
            }

            if max_val < 1e-14 {
                return Err(AntennaError::NumericalError("Singular matrix".to_string()));
            }

            // Swap pivot
            pivot.swap(k, max_idx);

            // Forward elimination
            for i in k+1..n {
                let factor = a[[pivot[i], k]] / a[[pivot[k], k]];
                for j in k+1..n {
                    let val = a[[pivot[i], j]] - factor * a[[pivot[k], j]];
                    a[[pivot[i], j]] = val;
                }
                let bval = b[pivot[i]] - factor * b[pivot[k]];
                b[pivot[i]] = bval;
            }
        }

        // Back substitution
        let mut x = Array1::<Complex64>::zeros(n);
        for i in (0..n).rev() {
            let mut sum = b[pivot[i]];
            for j in i+1..n {
                sum = sum - a[[pivot[i], j]] * x[j];
            }
            x[i] = sum / a[[pivot[i], i]];
        }

        Ok(x)
    }

    fn calculate_s_parameters(
        &self,
        current: &Array1<Complex64>,
        params: &SimulationParams,
    ) -> Result<SParameterResult> {
        if self.ports.is_empty() {
            return Err(AntennaError::InvalidParameter("No ports defined".to_string()));
        }

        let port = &self.ports[0];
        let i_in = current[port.segment_index];
        let v_in = port.get_excitation();

        if i_in.norm() < 1e-14 {
            return Err(AntennaError::NumericalError("Zero input current".to_string()));
        }

        let z_in = v_in / i_in;
        let z0 = Complex64::new(params.reference_impedance, 0.0);
        let s11 = (z_in - z0) / (z_in + z0);
        let vswr = (1.0 + s11.norm()) / (1.0 - s11.norm());

        Ok(SParameterResult {
            frequency: params.frequency,
            s11_re: s11.re,
            s11_im: s11.im,
            vswr,
            input_impedance_re: z_in.re,
            input_impedance_im: z_in.im,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::element::{AntennaElement, DipoleParams};

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

        let solver = MomSolver::new(&dipole, &params);
        assert!(solver.is_ok());
    }
}