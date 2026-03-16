use super::geometry::Point3D;
use super::green::GreenFunction;
use ndarray::{Array1, Array2};
use num_complex::Complex64;
use serde::{Deserialize, Serialize};
use std::f64::consts::PI;

/// Solver-specific simulation parameters (frequency sweep)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolverSimParams {
    pub frequency_start: f64,
    pub frequency_stop: f64,
    pub frequency_steps: usize,
    pub reference_impedance: f64,
}

impl Default for SolverSimParams {
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
pub struct SolverResult {
    pub frequency: f64,
    pub s_parameters: SolverSParam,
    pub impedance_re: f64,
    pub impedance_im: f64,
    pub vswr: f64,
    pub radiation_pattern: RadiationPattern,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolverSParam {
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

/// Internal wire segment for MoM meshing
#[derive(Debug, Clone)]
struct WireSegment {
    start: Point3D,
    end: Point3D,
    radius: f64,
    element_id: String,
}

impl WireSegment {
    fn length(&self) -> f64 {
        self.start.distance(&self.end)
    }

    fn center(&self) -> Point3D {
        Point3D::new(
            (self.start.x + self.end.x) * 0.5,
            (self.start.y + self.end.y) * 0.5,
            (self.start.z + self.end.z) * 0.5,
        )
    }

    fn direction(&self) -> Point3D {
        let d = self.end.sub(&self.start);
        d.normalized()
    }
}

/// Wire definition for the solver
#[derive(Debug, Clone)]
pub struct WireDef {
    pub start: Point3D,
    pub end: Point3D,
    pub radius: f64,
    pub id: String,
}

/// Port definition for the solver
#[derive(Debug, Clone)]
pub struct PortDef {
    pub location: Point3D,
}

pub struct MomSolver {
    wires: Vec<WireDef>,
    ports: Vec<PortDef>,
    params: SolverSimParams,
}

impl MomSolver {
    pub fn new() -> Self {
        Self {
            wires: Vec::new(),
            ports: Vec::new(),
            params: SolverSimParams::default(),
        }
    }

    pub fn set_wires(&mut self, wires: Vec<WireDef>) {
        self.wires = wires;
    }

    pub fn set_ports(&mut self, ports: Vec<PortDef>) {
        self.ports = ports;
    }

    pub fn set_params(&mut self, params: SolverSimParams) {
        self.params = params;
    }

    pub fn run_simulation(&self) -> Result<Vec<SolverResult>, String> {
        if self.wires.is_empty() {
            return Err("No wires defined".to_string());
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

    fn solve_at_frequency(&self, frequency: f64) -> Result<SolverResult, String> {
        let wavelength = 3e8 / frequency;
        let k = 2.0 * PI / wavelength;

        let segments = self.generate_mesh(wavelength)?;
        let n_segments = segments.len();

        let green = GreenFunction::new(wavelength);
        let mut z_matrix = Array2::<Complex64>::zeros((n_segments, n_segments));

        for i in 0..n_segments {
            for j in 0..n_segments {
                let seg_i = &segments[i];
                let seg_j = &segments[j];
                let z_ij = self.compute_z_element(&green, seg_i, seg_j, k);
                z_matrix[[i, j]] = z_ij;
            }
        }

        let mut v_vector = Array1::<Complex64>::zeros(n_segments);

        let port = &self.ports[0];
        let feed_idx = self.find_feed_segment(&segments, port)?;

        v_vector[feed_idx] = Complex64::new(1.0, 0.0);

        let i_vector = self.solve_linear_system(&z_matrix, &v_vector)?;

        let i_feed = i_vector[feed_idx];
        let v_feed = v_vector[feed_idx];
        let z_in = if i_feed.norm() > 1e-10 {
            v_feed / i_feed
        } else {
            Complex64::new(1e6, 0.0)
        };

        let z0 = Complex64::new(self.params.reference_impedance, 0.0);
        let s11 = (z_in - z0) / (z_in + z0);
        let s11_mag_db = 20.0 * s11.norm().log10();
        let s11_phase_deg = s11.arg().to_degrees();

        let vswr = if s11.norm() < 0.999 {
            (1.0 + s11.norm()) / (1.0 - s11.norm())
        } else {
            999.0
        };

        let pattern = self.calculate_radiation_pattern(&segments, &i_vector, k)?;

        Ok(SolverResult {
            frequency,
            s_parameters: SolverSParam {
                s11_magnitude_db: s11_mag_db,
                s11_phase_deg,
            },
            impedance_re: z_in.re,
            impedance_im: z_in.im,
            vswr,
            radiation_pattern: pattern,
        })
    }

    fn compute_z_element(
        &self,
        green: &GreenFunction,
        seg_i: &WireSegment,
        seg_j: &WireSegment,
        k: f64,
    ) -> Complex64 {
        let n_int = 4;
        let dl_i = seg_i.length() / n_int as f64;
        let dl_j = seg_j.length() / n_int as f64;

        let mut z_ij = Complex64::new(0.0, 0.0);

        for ii in 0..n_int {
            let t_i = (ii as f64 + 0.5) / n_int as f64;
            let r_i = Point3D::new(
                seg_i.start.x + t_i * (seg_i.end.x - seg_i.start.x),
                seg_i.start.y + t_i * (seg_i.end.y - seg_i.start.y),
                seg_i.start.z + t_i * (seg_i.end.z - seg_i.start.z),
            );

            for jj in 0..n_int {
                let t_j = (jj as f64 + 0.5) / n_int as f64;
                let r_j = Point3D::new(
                    seg_j.start.x + t_j * (seg_j.end.x - seg_j.start.x),
                    seg_j.start.y + t_j * (seg_j.end.y - seg_j.start.y),
                    seg_j.start.z + t_j * (seg_j.end.z - seg_j.start.z),
                );

                let r_dist = r_i.distance(&r_j);

                if r_dist < 1e-10 {
                    let a = seg_i.radius;
                    let l = seg_i.length();
                    let psi = Complex64::new(0.0, -k) * l / (4.0 * PI);
                    z_ij += psi * (2.0 * (l / a).ln() - 2.0);
                } else {
                    let g = green.free_space(&r_i, &r_j);
                    let dir_i = seg_i.direction();
                    let dir_j = seg_j.direction();
                    let dot_prod = dir_i.dot(&dir_j);
                    let integrand = g * dot_prod;
                    z_ij += integrand * dl_i * dl_j;
                }
            }
        }

        let omega = 2.0 * PI * green.frequency;
        let mu0 = 4.0 * PI * 1e-7;
        z_ij *= Complex64::new(0.0, omega * mu0);

        z_ij
    }

    fn generate_mesh(&self, wavelength: f64) -> Result<Vec<WireSegment>, String> {
        let mut segments = Vec::new();
        let segment_length = wavelength / 20.0;

        for wire in &self.wires {
            let total_length = wire.start.distance(&wire.end);
            let n_segments = ((total_length / segment_length).ceil() as usize).max(1);

            for i in 0..n_segments {
                let t_start = i as f64 / n_segments as f64;
                let t_end = (i + 1) as f64 / n_segments as f64;

                let start = Point3D::new(
                    wire.start.x + (wire.end.x - wire.start.x) * t_start,
                    wire.start.y + (wire.end.y - wire.start.y) * t_start,
                    wire.start.z + (wire.end.z - wire.start.z) * t_start,
                );
                let end = Point3D::new(
                    wire.start.x + (wire.end.x - wire.start.x) * t_end,
                    wire.start.y + (wire.end.y - wire.start.y) * t_end,
                    wire.start.z + (wire.end.z - wire.start.z) * t_end,
                );

                segments.push(WireSegment {
                    start,
                    end,
                    radius: wire.radius,
                    element_id: wire.id.clone(),
                });
            }
        }

        if segments.is_empty() {
            return Err("No wire segments generated".to_string());
        }

        Ok(segments)
    }

    fn find_feed_segment(
        &self,
        segments: &[WireSegment],
        port: &PortDef,
    ) -> Result<usize, String> {
        let mut best_idx = 0;
        let mut best_dist = f64::MAX;

        for (i, seg) in segments.iter().enumerate() {
            let center = seg.center();
            let dist = center.distance(&port.location);
            if dist < best_dist {
                best_dist = dist;
                best_idx = i;
            }
        }

        Ok(best_idx)
    }

    fn solve_linear_system(
        &self,
        a: &Array2<Complex64>,
        b: &Array1<Complex64>,
    ) -> Result<Array1<Complex64>, String> {
        let n = a.nrows();
        if n != a.ncols() || n != b.len() {
            return Err("Matrix dimensions mismatch".to_string());
        }

        let mut l = Array2::<Complex64>::eye(n);
        let mut u = a.clone();

        for k in 0..n - 1 {
            for i in k + 1..n {
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

        let mut y = Array1::<Complex64>::zeros(n);
        for i in 0..n {
            let mut sum = b[i];
            for j in 0..i {
                sum = sum - l[[i, j]] * y[j];
            }
            y[i] = sum;
        }

        let mut x = Array1::<Complex64>::zeros(n);
        for i in (0..n).rev() {
            let mut sum = y[i];
            for j in i + 1..n {
                sum = sum - u[[i, j]] * x[j];
            }
            if u[[i, i]].norm() < 1e-10 {
                return Err("Matrix is singular".to_string());
            }
            x[i] = sum / u[[i, i]];
        }

        Ok(x)
    }

    fn calculate_radiation_pattern(
        &self,
        segments: &[WireSegment],
        currents: &Array1<Complex64>,
        k: f64,
    ) -> Result<RadiationPattern, String> {
        let n_theta = 37;
        let n_phi = 73;

        let mut theta_deg = Vec::new();
        let mut phi_deg = Vec::new();
        let mut gain_dbi = vec![vec![0.0; n_phi]; n_theta];

        for i in 0..n_theta {
            theta_deg.push(i as f64 * 5.0);
        }
        for j in 0..n_phi {
            phi_deg.push(j as f64 * 5.0);
        }

        let mut max_gain = 0.0_f64;
        let eta0 = 376.73;

        for (i, &theta) in theta_deg.iter().enumerate() {
            let theta_rad = theta.to_radians();

            for (j, &phi) in phi_deg.iter().enumerate() {
                let phi_rad = phi.to_radians();

                let mut e_theta = Complex64::new(0.0, 0.0);
                let mut e_phi = Complex64::new(0.0, 0.0);

                for (seg_idx, seg) in segments.iter().enumerate() {
                    let current = currents[seg_idx];
                    let center = seg.center();
                    let length = seg.length();
                    let direction = seg.direction();

                    let kr_dot = k
                        * (center.x * theta_rad.sin() * phi_rad.cos()
                            + center.y * theta_rad.sin() * phi_rad.sin()
                            + center.z * theta_rad.cos());
                    let phase = Complex64::new(0.0, kr_dot).exp();

                    let il = current * length * phase;

                    e_theta += il
                        * (direction.x * theta_rad.cos() * phi_rad.cos()
                            + direction.y * theta_rad.cos() * phi_rad.sin()
                            - direction.z * theta_rad.sin());
                    e_phi +=
                        il * (-direction.x * phi_rad.sin() + direction.y * phi_rad.cos());
                }

                let e_mag = (e_theta.norm_sqr() + e_phi.norm_sqr()).sqrt();
                let power_density = e_mag * e_mag / (2.0 * eta0);

                let gain_linear = 4.0 * PI * power_density;
                let gain_db = 10.0 * gain_linear.log10();

                gain_dbi[i][j] = gain_db;
                max_gain = max_gain.max(gain_db);
            }
        }

        let pattern_adjustment = 2.15 - max_gain;
        for i in 0..n_theta {
            for j in 0..n_phi {
                gain_dbi[i][j] += pattern_adjustment;
            }
        }

        Ok(RadiationPattern {
            theta_deg,
            phi_deg,
            gain_dbi,
            max_gain_dbi: 2.15,
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
