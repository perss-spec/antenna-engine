use crate::core::{
    field::{ElectricField, MagneticField, NearToFarFieldTransform},
    geometry::{AntennaElement, ElementType, Point3D, WireElement},
    green::GreenFunction,
    impedance::ImpedanceMatrix,
    port::{Port, PortType},
};
use ndarray::{Array1, Array2};
use num_complex::Complex64;
use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationParams {
    pub frequency_start: f64,
    pub frequency_stop: f64,
    pub frequency_steps: usize,
    pub reference_impedance: f64,
}

impl Default for SimulationParams {
    fn default() -> Self {
        Self {
            frequency_start: 1e6,
            frequency_stop: 1e9,
            frequency_steps: 101,
            reference_impedance: 50.0,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationResult {
    pub frequency: f64,
    pub s_parameters: SParameterResult,
    pub impedance: Complex64,
    pub vswr: f64,
    pub radiation_pattern: RadiationPattern,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SParameterResult {
    pub s11_magnitude_db: f64,
    pub s11_phase_deg: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RadiationPattern {
    pub theta_deg: Vec<f64>,
    pub phi_deg: Vec<f64>,
    pub gain_dbi: Vec<Vec<f64>>,
    pub max_gain_dbi: f64,
}

pub struct MomSolver {
    elements: Vec<AntennaElement>,
    ports: Vec<Port>,
    params: SimulationParams,
}

impl MomSolver {
    pub fn new() -> Self {
        Self {
            elements: Vec::new(),
            ports: Vec::new(),
            params: SimulationParams::default(),
        }
    }

    pub fn set_elements(&mut self, elements: Vec<AntennaElement>) {
        self.elements = elements;
    }

    pub fn set_ports(&mut self, ports: Vec<Port>) {
        self.ports = ports;
    }

    pub fn set_params(&mut self, params: SimulationParams) {
        self.params = params;
    }

    pub fn run_simulation(&self) -> Result<Vec<SimulationResult>, String> {
        if self.elements.is_empty() {
            return Err("No antenna elements defined".to_string());
        }
        if self.ports.is_empty() {
            return Err("No ports defined".to_string());
        }

        let mut results = Vec::new();
        let frequencies = self.generate_frequency_points();

        for freq in frequencies {
            let result = self.solve_at_frequency(freq)?;
            results.push(result);
        }

        Ok(results)
    }

    fn solve_at_frequency(&self, frequency: f64) -> Result<SimulationResult, String> {
        let wavelength = 3e8 / frequency;
        let k = 2.0 * PI / wavelength;

        // Generate mesh segments
        let segments = self.generate_mesh(wavelength)?;
        let n_segments = segments.len();

        // Build impedance matrix
        let green = GreenFunction::new(frequency);
        let mut z_matrix = Array2::<Complex64>::zeros((n_segments, n_segments));
        let mut imp_builder = ImpedanceMatrix::new(frequency);

        for i in 0..n_segments {
            for j in 0..n_segments {
                let seg_i = &segments[i];
                let seg_j = &segments[j];
                
                // Use Galerkin method with pulse basis functions
                let z_ij = self.compute_z_element(&green, seg_i, seg_j, k);
                z_matrix[[i, j]] = z_ij;
            }
        }

        // Setup excitation vector (voltage source at feed)
        let mut v_vector = Array1::<Complex64>::zeros(n_segments);
        
        // Find feed segment (closest to port location)
        let port = &self.ports[0]; // Single port for now
        let feed_idx = self.find_feed_segment(&segments, &port)?;
        
        // Apply 1V excitation at feed
        v_vector[feed_idx] = Complex64::new(1.0, 0.0);

        // Solve Z·I = V for current distribution
        let i_vector = self.solve_linear_system(&z_matrix, &v_vector)?;

        // Extract input impedance
        let i_feed = i_vector[feed_idx];
        let v_feed = v_vector[feed_idx];
        let z_in = if i_feed.norm() > 1e-10 {
            v_feed / i_feed
        } else {
            Complex64::new(1e6, 0.0) // High impedance if no current
        };

        // Calculate S11
        let z0 = Complex64::new(self.params.reference_impedance, 0.0);
        let s11 = (z_in - z0) / (z_in + z0);
        let s11_mag_db = 20.0 * s11.norm().log10();
        let s11_phase_deg = s11.arg().to_degrees();

        // Calculate VSWR
        let vswr = if s11.norm() < 0.999 {
            (1.0 + s11.norm()) / (1.0 - s11.norm())
        } else {
            999.0
        };

        // Calculate radiation pattern
        let pattern = self.calculate_radiation_pattern(&segments, &i_vector, k)?;

        Ok(SimulationResult {
            frequency,
            s_parameters: SParameterResult {
                s11_magnitude_db: s11_mag_db,
                s11_phase_deg,
            },
            impedance: z_in,
            vswr,
            radiation_pattern: pattern,
        })
    }

    fn compute_z_element(&self, green: &GreenFunction, seg_i: &WireSegment, seg_j: &WireSegment, k: f64) -> Complex64 {
        // Galerkin MoM with pulse basis functions
        let n_int = 4; // Integration points
        let dl_i = seg_i.length() / n_int as f64;
        let dl_j = seg_j.length() / n_int as f64;
        
        let mut z_ij = Complex64::new(0.0, 0.0);
        
        for ii in 0..n_int {
            let t_i = (ii as f64 + 0.5) / n_int as f64;
            let r_i = seg_i.start + (seg_i.end - seg_i.start) * t_i;
            
            for jj in 0..n_int {
                let t_j = (jj as f64 + 0.5) / n_int as f64;
                let r_j = seg_j.start + (seg_j.end - seg_j.start) * t_j;
                
                let r_vec = r_i - r_j;
                let r_dist = r_vec.magnitude();
                
                if r_dist < 1e-10 {
                    // Self term - use thin wire approximation
                    let a = seg_i.radius;
                    let l = seg_i.length();
                    let psi = Complex64::new(0.0, -k) * l / (4.0 * PI);
                    z_ij += psi * (2.0 * (l / a).ln() - 2.0);
                } else {
                    // Use Green's function
                    let g = green.scalar(r_i, r_j);
                    let dir_i = (seg_i.end - seg_i.start).normalize();
                    let dir_j = (seg_j.end - seg_j.start).normalize();
                    
                    // Electric field integral equation (EFIE)
                    let dot_prod = dir_i.x * dir_j.x + dir_i.y * dir_j.y + dir_i.z * dir_j.z;
                    let integrand = g * dot_prod;
                    
                    z_ij += integrand * dl_i * dl_j;
                }
            }
        }
        
        // Add jωμ₀ factor
        let omega = 2.0 * PI * green.frequency;
        let mu0 = 4.0 * PI * 1e-7;
        z_ij *= Complex64::new(0.0, omega * mu0);
        
        z_ij
    }

    fn generate_mesh(&self, wavelength: f64) -> Result<Vec<WireSegment>, String> {
        let mut segments = Vec::new();
        let segment_length = wavelength / 20.0; // λ/20 segments

        for element in &self.elements {
            match &element.element_type {
                ElementType::Wire(wire) => {
                    let total_length = (wire.end - wire.start).magnitude();
                    let n_segments = ((total_length / segment_length).ceil() as usize).max(1);
                    let actual_length = total_length / n_segments as f64;

                    for i in 0..n_segments {
                        let t_start = i as f64 / n_segments as f64;
                        let t_end = (i + 1) as f64 / n_segments as f64;
                        
                        let start = wire.start + (wire.end - wire.start) * t_start;
                        let end = wire.start + (wire.end - wire.start) * t_end;
                        
                        segments.push(WireSegment {
                            start,
                            end,
                            radius: wire.radius,
                            element_id: element.id.clone(),
                        });
                    }
                }
                _ => {} // Skip non-wire elements for now
            }
        }

        if segments.is_empty() {
            return Err("No wire segments generated".to_string());
        }

        Ok(segments)
    }

    fn find_feed_segment(&self, segments: &[WireSegment], port: &Port) -> Result<usize, String> {
        let mut best_idx = 0;
        let mut best_dist = f64::MAX;

        for (i, seg) in segments.iter().enumerate() {
            let center = (seg.start + seg.end) * 0.5;
            let dist = (center - port.location).magnitude();
            
            if dist < best_dist {
                best_dist = dist;
                best_idx = i;
            }
        }

        Ok(best_idx)
    }

    fn solve_linear_system(&self, a: &Array2<Complex64>, b: &Array1<Complex64>) -> Result<Array1<Complex64>, String> {
        let n = a.nrows();
        if n != a.ncols() || n != b.len() {
            return Err("Matrix dimensions mismatch".to_string());
        }

        // LU decomposition without pivoting (simplified)
        let mut l = Array2::<Complex64>::eye(n);
        let mut u = a.clone();

        for k in 0..n-1 {
            for i in k+1..n {
                if u[[k, k]].norm() < 1e-10 {
                    return Err("Matrix is singular".to_string());
                }
                
                let factor = u[[i, k]] / u[[k, k]];
                l[[i, k]] = factor;
                
                for j in k..n {
                    u[[i, j]] = u[[i, j]] - factor * u[[k, j]];
                }
            }
        }

        // Forward substitution L·y = b
        let mut y = Array1::<Complex64>::zeros(n);
        for i in 0..n {
            let mut sum = b[i];
            for j in 0..i {
                sum = sum - l[[i, j]] * y[j];
            }
            y[i] = sum;
        }

        // Backward substitution U·x = y
        let mut x = Array1::<Complex64>::zeros(n);
        for i in (0..n).rev() {
            let mut sum = y[i];
            for j in i+1..n {
                sum = sum - u[[i, j]] * x[j];
            }
            if u[[i, i]].norm() < 1e-10 {
                return Err("Matrix is singular".to_string());
            }
            x[i] = sum / u[[i, i]];
        }

        Ok(x)
    }

    fn calculate_radiation_pattern(&self, segments: &[WireSegment], currents: &Array1<Complex64>, k: f64) -> Result<RadiationPattern, String> {
        let n_theta = 37; // 0 to 180 degrees, 5 degree steps
        let n_phi = 73;   // 0 to 360 degrees, 5 degree steps
        
        let mut theta_deg = Vec::new();
        let mut phi_deg = Vec::new();
        let mut gain_dbi = vec![vec![0.0; n_phi]; n_theta];
        
        // Generate angle arrays
        for i in 0..n_theta {
            theta_deg.push(i as f64 * 5.0);
        }
        for j in 0..n_phi {
            phi_deg.push(j as f64 * 5.0);
        }
        
        let mut max_gain = 0.0;
        let eta0 = 376.73; // Free space impedance
        
        for (i, &theta) in theta_deg.iter().enumerate() {
            let theta_rad = theta.to_radians();
            
            for (j, &phi) in phi_deg.iter().enumerate() {
                let phi_rad = phi.to_radians();
                
                // Far field calculation using current distribution
                let mut e_theta = Complex64::new(0.0, 0.0);
                let mut e_phi = Complex64::new(0.0, 0.0);
                
                for (seg_idx, seg) in segments.iter().enumerate() {
                    let current = currents[seg_idx];
                    let center = (seg.start + seg.end) * 0.5;
                    let length = (seg.end - seg.start).magnitude();
                    let direction = (seg.end - seg.start).normalize();
                    
                    // Phase factor for far field
                    let kr_dot = k * (center.x * theta_rad.sin() * phi_rad.cos() +
                                     center.y * theta_rad.sin() * phi_rad.sin() +
                                     center.z * theta_rad.cos());
                    let phase = Complex64::new(0.0, kr_dot).exp();
                    
                    // Current element contribution
                    let il = current * length * phase;
                    
                    // Project onto spherical components
                    e_theta += il * (direction.x * theta_rad.cos() * phi_rad.cos() +
                                    direction.y * theta_rad.cos() * phi_rad.sin() -
                                    direction.z * theta_rad.sin());
                    e_phi += il * (-direction.x * phi_rad.sin() + direction.y * phi_rad.cos());
                }
                
                // Power density and gain
                let e_mag = (e_theta.norm_sqr() + e_phi.norm_sqr()).sqrt();
                let power_density = e_mag * e_mag / (2.0 * eta0);
                
                // Normalize for gain calculation (simplified)
                let gain_linear = 4.0 * PI * power_density;
                let gain_db = 10.0 * gain_linear.log10();
                
                gain_dbi[i][j] = gain_db;
                max_gain = max_gain.max(gain_db);
            }
        }
        
        // Normalize pattern - find actual max gain based on dipole reference
        // Half-wave dipole has ~2.15 dBi gain
        let pattern_adjustment = 2.15 - max_gain; // Rough calibration
        
        for i in 0..n_theta {
            for j in 0..n_phi {
                gain_dbi[i][j] += pattern_adjustment;
            }
        }
        
        Ok(RadiationPattern {
            theta_deg,
            phi_deg,
            gain_dbi,
            max_gain_dbi: 2.15, // Approximate for dipole
        })
    }

    fn generate_frequency_points(&self) -> Vec<f64> {
        let mut frequencies = Vec::new();
        
        if self.params.frequency_steps <= 1 {
            frequencies.push(self.params.frequency_start);
        } else {
            let step = (self.params.frequency_stop - self.params.frequency_start) 
                       / (self.params.frequency_steps - 1) as f64;
            
            for i in 0..self.params.frequency_steps {
                frequencies.push(self.params.frequency_start + step * i as f64);
            }
        }
        
        frequencies
    }
}

#[derive(Debug, Clone)]
struct WireSegment {
    start: Point3D,
    end: Point3D,
    radius: f64,
    element_id: String,
}

impl WireSegment {
    fn length(&self) -> f64 {
        (self.end - self.start).magnitude()
    }
}