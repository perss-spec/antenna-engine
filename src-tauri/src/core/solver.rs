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
                let feed_point = Point3D::new(feed_x, feed_y, params.center.z);
                
                // Find closest segment to feed point
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
                    let dist = feed_point.distance(&seg_center);
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
            AntennaElement::Qfh(params) => {
                // QFH has two orthogonal feeds
                let feed1 = Point3D::new(
                    params.center.x + params.diameter / 4.0,
                    params.center.y,
                    params.center.z,
                );
                let feed2 = Point3D::new(
                    params.center.x,
                    params.center.y + params.diameter / 4.0,
                    params.center.z,
                );
                
                let mut ports = Vec::new();
                
                // Find segments closest to feed points
                for (feed_idx, feed_point) in [feed1, feed2].iter().enumerate() {
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
                        let dist = feed_point.distance(&seg_center);
                        if dist < min_dist {
                            min_dist = dist;
                            feed_segment = i;
                        }
                    }
                    
                    let voltage = if feed_idx == 0 {
                        Complex64::new(1.0, 0.0) // 0° phase
                    } else {
                        Complex64::new(0.0, 1.0) // 90° phase for circular polarization
                    };
                    
                    ports.push(Port::new(
                        feed_segment,
                        PortType::VoltageSource { voltage },
                    ));
                }
                
                Ok(ports)
            }
        }
    }

    pub fn solve(&mut self, params: &SimulationParams) -> Result<SimulationResult> {
        let n = self.mesh.segments.len();
        if n == 0 {
            return Err(AntennaError::InvalidGeometry("Empty mesh".to_string()));
        }

        // Build impedance matrix
        let mut impedance_builder = ImpedanceMatrix::new(&self.mesh, &self.green_function)?;
        let z_matrix = impedance_builder.build()?;

        // Build excitation vector
        let mut v_vector = Array1::<Complex64>::zeros(n);
        for port in &self.ports {
            if port.segment_index < n {
                v_vector[port.segment_index] = port.get_excitation();
            }
        }

        // Solve Z * I = V using LU decomposition
        let current_distribution = self.solve_lu_decomposition(&z_matrix, &v_vector)?;

        // Calculate S-parameters
        let s_parameters = self.calculate_s_parameters(&z_matrix, &current_distribution, params)?;

        // Calculate field results
        let field_results = self.calculate_field_results(&current_distribution, params)?;

        Ok(SimulationResult {
            s_parameters,
            field_results,
            current_distribution: current_distribution.to_vec(),
        })
    }

    /// Solve linear system Z*I = V using LU decomposition
    fn solve_lu_decomposition(
        &self,
        z_matrix: &Array2<Complex64>,
        v_vector: &Array1<Complex64>,
    ) -> Result<Array1<Complex64>> {
        let n = z_matrix.nrows();
        if n != z_matrix.ncols() {
            return Err(AntennaError::NumericalError("Matrix must be square".to_string()));
        }
        if n != v_vector.len() {
            return Err(AntennaError::NumericalError("Matrix and vector dimensions mismatch".to_string()));
        }
        if n == 0 {
            return Ok(Array1::zeros(0));
        }

        // Clone matrix for in-place LU decomposition
        let mut lu_matrix = z_matrix.clone();
        let mut pivot_indices = vec![0; n];
        
        // Initialize pivot indices
        for i in 0..n {
            pivot_indices[i] = i;
        }

        // Perform LU decomposition with partial pivoting
        for k in 0..n {
            // Find pivot
            let mut max_row = k;
            let mut max_val = lu_matrix[[k, k]].norm();
            
            for i in (k + 1)..n {
                let val = lu_matrix[[i, k]].norm();
                if val > max_val {
                    max_val = val;
                    max_row = i;
                }
            }
            
            // Check for singular matrix
            if max_val < 1e-14 {
                return Err(AntennaError::NumericalError("Singular matrix detected".to_string()));
            }
            
            // Swap rows if needed
            if max_row != k {
                pivot_indices.swap(k, max_row);
                for j in 0..n {
                    let temp = lu_matrix[[k, j]];
                    lu_matrix[[k, j]] = lu_matrix[[max_row, j]];
                    lu_matrix[[max_row, j]] = temp;
                }
            }
            
            // Eliminate column
            for i in (k + 1)..n {
                let factor = lu_matrix[[i, k]] / lu_matrix[[k, k]];
                lu_matrix[[i, k]] = factor; // Store L factor
                
                for j in (k + 1)..n {
                    lu_matrix[[i, j]] = lu_matrix[[i, j]] - factor * lu_matrix[[k, j]];
                }
            }
        }

        // Apply row permutations to RHS vector
        let mut b_vector = v_vector.clone();
        let mut temp_vector = Array1::<Complex64>::zeros(n);
        for i in 0..n {
            temp_vector[i] = b_vector[pivot_indices[i]];
        }
        b_vector = temp_vector;

        // Forward substitution (solve Ly = b)
        let mut y_vector = Array1::<Complex64>::zeros(n);
        for i in 0..n {
            let mut sum = Complex64::new(0.0, 0.0);
            for j in 0..i {
                sum = sum + lu_matrix[[i, j]] * y_vector[j];
            }
            y_vector[i] = b_vector[i] - sum;
        }

        // Back substitution (solve Ux = y)
        let mut x_vector = Array1::<Complex64>::zeros(n);
        for i in (0..n).rev() {
            let mut sum = Complex64::new(0.0, 0.0);
            for j in (i + 1)..n {
                sum = sum + lu_matrix[[i, j]] * x_vector[j];
            }
            x_vector[i] = (y_vector[i] - sum) / lu_matrix[[i, i]];
        }

        Ok(x_vector)
    }

    fn calculate_s_parameters(
        &self,
        z_matrix: &Array2<Complex64>,
        current_distribution: &Array1<Complex64>,
        params: &SimulationParams,
    ) -> Result<Vec<SParameterResult>> {
        let mut s_params = Vec::new();
        
        for port in &self.ports {
            if port.segment_index >= current_distribution.len() {
                continue;
            }
            
            // Calculate input impedance at port
            let port_voltage = port.get_excitation();
            let port_current = current_distribution[port.segment_index];
            
            let input_impedance = if port_current.norm() > 1e-15 {
                port_voltage / port_current
            } else {
                Complex64::new(1e6, 0.0) // Very high impedance for open circuit
            };
            
            // Calculate S11
            let s11 = port.calculate_s_parameter(input_impedance, params.reference_impedance);
            let vswr = Port::calculate_vswr(s11);
            
            s_params.push(SParameterResult {
                frequency: params.frequency,
                s11_re: s11.re,
                s11_im: s11.im,
                vswr,
                input_impedance_re: input_impedance.re,
                input_impedance_im: input_impedance.im,
            });
        }
        
        Ok(s_params)
    }

    fn calculate_field_results(
        &self,
        current_distribution: &Array1<Complex64>,
        params: &SimulationParams,
    ) -> Result<FieldResult> {
        // Use near-to-far-field transform
        let nf2ff = NearToFarField::new(&self.mesh, current_distribution, params.frequency);
        nf2ff.calculate_pattern()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::element::AntennaElement;
    
    #[test]
    fn test_mom_solver_creation() {
        let element = AntennaElement::new_dipole(0.15, 0.001);
        let params = SimulationParams {
            frequency: 1e9,
            resolution: 0.01,
            reference_impedance: 50.0,
        };
        
        let result = MomSolver::new(&element, &params);
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_lu_decomposition_simple() {
        let element = AntennaElement::new_dipole(0.15, 0.001);
        let params = SimulationParams {
            frequency: 1e9,
            resolution: 0.05, // Coarser mesh for testing
            reference_impedance: 50.0,
        };
        
        let mut solver = MomSolver::new(&element, &params).unwrap();
        
        // Test with simple 2x2 matrix
        let z = Array2::from_shape_vec((2, 2), vec![
            Complex64::new(2.0, 1.0), Complex64::new(1.0, 0.0),
            Complex64::new(1.0, 0.0), Complex64::new(3.0, 2.0),
        ]).unwrap();
        
        let v = Array1::from_vec(vec![
            Complex64::new(1.0, 0.0),
            Complex64::new(2.0, 0.0),
        ]);
        
        let result = solver.solve_lu_decomposition(&z, &v);
        assert!(result.is_ok());
        
        let current = result.unwrap();
        assert_eq!(current.len(), 2);
        
        // Verify solution by substituting back
        let residual = &z.dot(&current) - &v;
        assert!(residual[0].norm() < 1e-10);
        assert!(residual[1].norm() < 1e-10);
    }
    
    #[test]
    fn test_solver_run() {
        let element = AntennaElement::new_dipole(0.15, 0.001);
        let params = SimulationParams {
            frequency: 1e9,
            resolution: 0.05,
            reference_impedance: 50.0,
        };
        
        let mut solver = MomSolver::new(&element, &params).unwrap();
        let result = solver.solve(&params);
        assert!(result.is_ok());
        
        let sim_result = result.unwrap();
        assert!(!sim_result.s_parameters.is_empty());
        assert!(!sim_result.current_distribution.is_empty());
    }
}