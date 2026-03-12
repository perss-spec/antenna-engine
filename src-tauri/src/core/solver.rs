use crate::core::types::{Result, AntennaError};
use crate::core::geometry::{Point3D, Mesh, Segment};
use crate::core::element::AntennaElement;
use crate::core::{C0, MU0, EPS0};
use num_complex::Complex64;
use ndarray::{Array1, Array2};
use serde::{Deserialize, Serialize};
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
    pub field_result: Option<crate::core::field::FieldResult>,
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

#[derive(Debug, Clone)]
pub struct MomSolver {
    params: SimulationParams,
}

impl MomSolver {
    pub fn new(params: SimulationParams) -> Self {
        Self { params }
    }

    pub fn solve(&self, element: &AntennaElement) -> Result<SimulationResult> {
        // Validate element
        element.validate()?;
        
        // Generate mesh
        let mesh = element.generate_mesh(self.params.resolution)?;
        
        // Segment wires
        let segments = self.segment_wire(&mesh)?;
        
        // Fill impedance matrix
        let z_matrix = self.fill_impedance_matrix(&mesh, &segments)?;
        
        // Create excitation vector (voltage source at first segment)
        let v_vector = self.create_excitation_vector(segments.len());
        
        // Solve Z*I = V for currents
        let currents = self.solve_linear_system(z_matrix, v_vector)?;
        
        // Extract S-parameters
        let s_params = self.extract_s_parameters(&currents)?;
        
        Ok(SimulationResult {
            s_parameters: vec![s_params],
            field_result: None,
        })
    }
    
    fn segment_wire(&self, mesh: &Mesh) -> Result<Vec<Segment>> {
        if mesh.segments.is_empty() {
            return Err(AntennaError::InvalidGeometry(
                "No wire segments in mesh".to_string()
            ));
        }
        Ok(mesh.segments.clone())
    }
    
    fn fill_impedance_matrix(&self, mesh: &Mesh, segments: &[Segment]) -> Result<Array2<Complex64>> {
        let n = segments.len();
        let mut z_matrix = Array2::<Complex64>::zeros((n, n));
        
        let k = 2.0 * PI * self.params.frequency / C0; // Wave number
        let omega = 2.0 * PI * self.params.frequency;
        
        for i in 0..n {
            for j in 0..n {
                let seg_i = &segments[i];
                let seg_j = &segments[j];
                
                // Get segment centers
                let p1 = mesh.vertices[seg_i.start].clone();
                let p2 = mesh.vertices[seg_i.end].clone();
                let center_i = Point3D::new(
                    (p1.x + p2.x) / 2.0,
                    (p1.y + p2.y) / 2.0,
                    (p1.z + p2.z) / 2.0
                );
                
                let p3 = mesh.vertices[seg_j.start].clone();
                let p4 = mesh.vertices[seg_j.end].clone();
                let center_j = Point3D::new(
                    (p3.x + p4.x) / 2.0,
                    (p3.y + p4.y) / 2.0,
                    (p3.z + p4.z) / 2.0
                );
                
                // Calculate distance
                let dx = center_i.x - center_j.x;
                let dy = center_i.y - center_j.y;
                let dz = center_i.z - center_j.z;
                let r = (dx*dx + dy*dy + dz*dz).sqrt();
                
                // Avoid singularity for self-terms
                let r_eff = if i == j { 0.001 } else { r };
                
                // Green's function: exp(-jkR)/(4πR)
                let green = Complex64::new(0.0, -k * r_eff).exp() / (4.0 * PI * r_eff);
                
                // Impedance element (simplified thin-wire approximation)
                z_matrix[[i, j]] = Complex64::new(0.0, omega * MU0) * green;
            }
        }
        
        Ok(z_matrix)
    }
    
    fn create_excitation_vector(&self, n: usize) -> Array1<Complex64> {
        let mut v = Array1::<Complex64>::zeros(n);
        // Voltage source at first segment
        if n > 0 {
            v[0] = Complex64::new(1.0, 0.0);
        }
        v
    }
    
    fn solve_linear_system(&self, z: Array2<Complex64>, v: Array1<Complex64>) -> Result<Array1<Complex64>> {
        let n = z.nrows();
        if n == 0 || n != z.ncols() || n != v.len() {
            return Err(AntennaError::InvalidGeometry(
                "Invalid matrix dimensions".to_string()
            ));
        }
        
        // Clone matrices for Gaussian elimination
        let mut a = z.clone();
        let mut b = v.clone();
        
        // Forward elimination
        for k in 0..n {
            // Find pivot
            let mut max_idx = k;
            let mut max_val = a[[k, k]].norm();
            for i in (k+1)..n {
                let val = a[[i, k]].norm();
                if val > max_val {
                    max_val = val;
                    max_idx = i;
                }
            }
            
            // Check for singular matrix
            if max_val < 1e-10 {
                return Err(AntennaError::NumericalError(
                    "Singular impedance matrix".to_string()
                ));
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
            
            // Eliminate column
            for i in (k+1)..n {
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
            let mut sum = b[i];
            for j in (i+1)..n {
                sum = sum - a[[i, j]] * x[j];
            }
            x[i] = sum / a[[i, i]];
        }
        
        Ok(x)
    }
    
    fn extract_s_parameters(&self, currents: &Array1<Complex64>) -> Result<SParameterResult> {
        if currents.is_empty() {
            return Err(AntennaError::InvalidParameter(
                "No currents to extract S-parameters from".to_string()
            ));
        }
        
        // Port voltage and current
        let v_port = Complex64::new(1.0, 0.0); // Unit voltage source
        let i_port = currents[0]; // Current at feed point
        
        // Input impedance Z_in = V/I
        let z_in = if i_port.norm() > 1e-10 {
            v_port / i_port
        } else {
            return Err(AntennaError::NumericalError(
                "Zero current at port".to_string()
            ));
        };
        
        // Reference impedance
        let z0 = Complex64::new(self.params.reference_impedance, 0.0);
        
        // S11 = (Z_in - Z0) / (Z_in + Z0)
        let s11 = (z_in - z0) / (z_in + z0);
        
        // VSWR = (1 + |S11|) / (1 - |S11|)
        let s11_mag = s11.norm();
        let vswr = if s11_mag < 0.999 {
            (1.0 + s11_mag) / (1.0 - s11_mag)
        } else {
            999.9 // Cap at reasonable value
        };
        
        Ok(SParameterResult {
            frequency: self.params.frequency,
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
    use crate::core::element::AntennaElement;
    
    #[test]
    fn test_mom_solver_creation() {
        let params = SimulationParams {
            frequency: 300e6,
            resolution: 0.01,
            reference_impedance: 50.0,
        };
        let solver = MomSolver::new(params);
        assert_eq!(solver.params.frequency, 300e6);
    }
    
    #[test]
    fn test_solve_dipole() {
        let params = SimulationParams {
            frequency: 300e6,
            resolution: 0.05,
            reference_impedance: 50.0,
        };
        let solver = MomSolver::new(params);
        
        // Half-wave dipole
        let dipole = AntennaElement::new_dipole(0.5, 0.001);
        let result = solver.solve(&dipole);
        assert!(result.is_ok());
    }
    
    #[test]
    fn test_impedance_matrix_dimensions() {
        let params = SimulationParams {
            frequency: 300e6,
            resolution: 0.1,
            reference_impedance: 50.0,
        };
        let solver = MomSolver::new(params);
        
        let mesh = Mesh {
            vertices: vec![
                Point3D::new(0.0, 0.0, -0.25),
                Point3D::new(0.0, 0.0, 0.0),
                Point3D::new(0.0, 0.0, 0.25),
            ],
            triangles: vec![],
            segments: vec![
                Segment { start: 0, end: 1 },
                Segment { start: 1, end: 2 },
            ],
        };
        
        let segments = solver.segment_wire(&mesh);
        assert!(segments.is_ok());
        let segments = segments.unwrap();
        
        let z_matrix = solver.fill_impedance_matrix(&mesh, &segments);
        assert!(z_matrix.is_ok());
        let z_matrix = z_matrix.unwrap();
        assert_eq!(z_matrix.nrows(), 2);
        assert_eq!(z_matrix.ncols(), 2);
    }
}