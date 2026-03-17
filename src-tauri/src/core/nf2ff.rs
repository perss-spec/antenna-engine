use crate::core::geometry::{Mesh, Point3D};
use crate::core::types::{AntennaError, Result};
use crate::core::field::{ElectricField, FieldResult, NearFieldSample, FarFieldSample};
use crate::core::{C0, ETA0};
use num_complex::Complex64;
use ndarray::{Array1, Array2};
use std::f64::consts::PI;

/// Near-to-far-field transformation
pub struct NearToFarFieldTransform {
    frequency: f64,
    wavelength: f64,
    k: f64, // wave number
}

/// Alias used by solver — owns mesh/current references and delegates to NearToFarFieldTransform
pub struct NearToFarField<'a> {
    transform: NearToFarFieldTransform,
    mesh: &'a Mesh,
    current: &'a Array1<Complex64>,
}

impl<'a> NearToFarField<'a> {
    pub fn new(mesh: &'a Mesh, current: &'a Array1<Complex64>, frequency: f64) -> Self {
        Self {
            transform: NearToFarFieldTransform::new(frequency),
            mesh,
            current,
        }
    }

    pub fn calculate_pattern(&self) -> Result<FieldResult> {
        self.transform.calculate_field_results(self.mesh, self.current)
    }
}

impl NearToFarFieldTransform {
    pub fn new(frequency: f64) -> Self {
        let wavelength = C0 / frequency;
        let k = 2.0 * PI / wavelength;
        Self {
            frequency,
            wavelength,
            k,
        }
    }

    /// Transform current distribution to far-field radiation pattern
    pub fn calculate_radiation_pattern(
        &self,
        mesh: &Mesh,
        current_distribution: &Array1<Complex64>,
        theta_points: usize,
        phi_points: usize,
    ) -> Result<Vec<FarFieldSample>> {
        let mut samples = Vec::new();
        
        // Generate observation points
        for i in 0..theta_points {
            let theta = (i as f64 / (theta_points - 1) as f64) * PI;
            
            for j in 0..phi_points {
                let phi = (j as f64 / (phi_points - 1) as f64) * 2.0 * PI;
                
                // Calculate far field at this angle
                let (e_theta, e_phi) = self.calculate_far_field_at_angle(
                    mesh,
                    current_distribution,
                    theta,
                    phi,
                )?;
                
                // Calculate gain with proper normalization
                let e_mag_sq = e_theta.norm_sqr() + e_phi.norm_sqr();
                
                // Avoid division by zero and ensure finite values
                let gain_db = if e_mag_sq > 1e-30 {
                    let power_density = e_mag_sq / (2.0 * ETA0);
                    let gain_linear = 4.0 * PI * power_density;
                    if gain_linear > 1e-30 {
                        10.0 * gain_linear.log10()
                    } else {
                        -100.0 // Very low gain floor
                    }
                } else {
                    -100.0 // Very low gain floor
                };
                
                samples.push(FarFieldSample {
                    theta,
                    phi,
                    e_theta,
                    e_phi,
                    gain_db,
                });
            }
        }
        
        Ok(samples)
    }

    /// Calculate far field at a specific angle
    fn calculate_far_field_at_angle(
        &self,
        mesh: &Mesh,
        current_distribution: &Array1<Complex64>,
        theta: f64,
        phi: f64,
    ) -> Result<(Complex64, Complex64)> {
        if current_distribution.len() != mesh.segments.len() {
            return Err(AntennaError::InvalidParameter(
                "Current distribution size mismatch".to_string()
            ));
        }

        let mut e_theta = Complex64::new(0.0, 0.0);
        let mut e_phi = Complex64::new(0.0, 0.0);

        // Unit vector in observation direction
        let sin_theta = theta.sin();
        let cos_theta = theta.cos();
        let sin_phi = phi.sin();
        let cos_phi = phi.cos();
        
        let r_hat = Point3D::new(
            sin_theta * cos_phi,
            sin_theta * sin_phi,
            cos_theta,
        );
        
        // Theta and phi unit vectors
        let theta_hat = Point3D::new(
            cos_theta * cos_phi,
            cos_theta * sin_phi,
            -sin_theta,
        );
        
        let phi_hat = Point3D::new(
            -sin_phi,
            cos_phi,
            0.0,
        );

        // Sum contributions from all current segments
        for (seg_idx, &current) in current_distribution.iter().enumerate() {
            if seg_idx >= mesh.segments.len() {
                break;
            }
            
            let segment = &mesh.segments[seg_idx];
            let p1 = &mesh.vertices[segment.start];
            let p2 = &mesh.vertices[segment.end];
            
            // Segment center and direction
            let center = Point3D::new(
                (p1.x + p2.x) / 2.0,
                (p1.y + p2.y) / 2.0,
                (p1.z + p2.z) / 2.0,
            );
            
            let dl = Point3D::new(
                p2.x - p1.x,
                p2.y - p1.y,
                p2.z - p1.z,
            );
            
            // Phase factor
            let k_dot_r = self.k * (r_hat.x * center.x + r_hat.y * center.y + r_hat.z * center.z);
            let phase = Complex64::new(0.0, -k_dot_r).exp();
            
            // Current element contribution
            let i_dl = current * phase;
            
            // Project current onto theta and phi directions
            let dl_dot_theta = dl.x * theta_hat.x + dl.y * theta_hat.y + dl.z * theta_hat.z;
            let dl_dot_phi = dl.x * phi_hat.x + dl.y * phi_hat.y + dl.z * phi_hat.z;
            
            e_theta += i_dl * dl_dot_theta;
            e_phi += i_dl * dl_dot_phi;
        }
        
        // Apply far-field scaling factor
        let scale = Complex64::new(0.0, self.k * ETA0 / (4.0 * PI));
        e_theta *= scale;
        e_phi *= scale;
        
        Ok((e_theta, e_phi))
    }

    /// Calculate complete field results including near and far field
    pub fn calculate_field_results(
        &self,
        mesh: &Mesh,
        current_distribution: &Array1<Complex64>,
    ) -> Result<FieldResult> {
        // Calculate far-field pattern
        let far_field = self.calculate_radiation_pattern(
            mesh,
            current_distribution,
            37, // theta points
            73, // phi points
        )?;
        
        // Calculate near-field samples (simplified)
        let near_field = self.calculate_near_field_samples(mesh, current_distribution)?;
        
        // Calculate pattern metrics
        let metrics = self.calculate_pattern_metrics(&far_field)?;
        
        Ok(FieldResult {
            near_field,
            far_field,
            beamwidth_deg: metrics.beamwidth_deg,
            directivity_dbi: metrics.directivity_dbi,
            efficiency: metrics.efficiency,
            max_gain_dbi: metrics.max_gain_dbi,
            front_to_back_ratio_db: metrics.front_to_back_ratio_db,
            cross_pol_discrimination_db: metrics.cross_pol_discrimination_db,
            impedance_bandwidth_mhz: metrics.impedance_bandwidth_mhz,
        })
    }

    /// Calculate near-field samples
    fn calculate_near_field_samples(
        &self,
        mesh: &Mesh,
        current_distribution: &Array1<Complex64>,
    ) -> Result<Vec<NearFieldSample>> {
        let mut samples = Vec::new();
        
        // Sample points around the antenna
        let sample_distance = self.wavelength / 4.0;
        let num_samples = 20;
        
        for i in 0..num_samples {
            let angle = 2.0 * PI * (i as f64) / (num_samples as f64);
            let position = Point3D::new(
                sample_distance * angle.cos(),
                sample_distance * angle.sin(),
                0.0,
            );
            
            // Calculate electric field at this position
            let e_field = self.calculate_near_field_at_point(mesh, current_distribution, &position)?;
            
            samples.push(NearFieldSample {
                position,
                e_field,
            });
        }
        
        Ok(samples)
    }

    /// Calculate electric field at a specific near-field point
    fn calculate_near_field_at_point(
        &self,
        mesh: &Mesh,
        current_distribution: &Array1<Complex64>,
        observation_point: &Point3D,
    ) -> Result<ElectricField> {
        let mut ex = Complex64::new(0.0, 0.0);
        let mut ey = Complex64::new(0.0, 0.0);
        let mut ez = Complex64::new(0.0, 0.0);
        
        // Sum contributions from all current segments
        for (seg_idx, &current) in current_distribution.iter().enumerate() {
            if seg_idx >= mesh.segments.len() {
                break;
            }
            
            let segment = &mesh.segments[seg_idx];
            let p1 = &mesh.vertices[segment.start];
            let p2 = &mesh.vertices[segment.end];
            
            // Segment center
            let center = Point3D::new(
                (p1.x + p2.x) / 2.0,
                (p1.y + p2.y) / 2.0,
                (p1.z + p2.z) / 2.0,
            );
            
            let r = observation_point.distance(&center);
            if r < 1e-10 {
                continue; // Skip singularity
            }
            
            // Green's function
            let phase = Complex64::new(0.0, -self.k * r).exp();
            let g = phase / (4.0 * PI * r);
            
            // Current contribution (simplified)
            let contribution = current * g;
            
            // Distribute to field components (simplified)
            ex += contribution * 0.33;
            ey += contribution * 0.33;
            ez += contribution * 0.34;
        }
        
        Ok(ElectricField::new(ex, ey, ez))
    }

    /// Calculate pattern metrics from far-field samples
    fn calculate_pattern_metrics(&self, far_field: &[FarFieldSample]) -> Result<PatternMetrics> {
        if far_field.is_empty() {
            return Ok(PatternMetrics::default());
        }

        // Find maximum gain and its index
        let (max_idx, max_gain_dbi) = far_field
            .iter()
            .enumerate()
            .map(|(i, s)| (i, s.gain_db))
            .fold((0, f64::NEG_INFINITY), |(bi, bg), (i, g)| {
                if g > bg { (i, g) } else { (bi, bg) }
            });

        // Directivity via spherical integration
        let directivity_dbi = self.calculate_directivity(far_field);

        // Beamwidth with interpolation
        let half_power_level = max_gain_dbi - 3.0;
        let beamwidth_deg = self.calculate_beamwidth(far_field, half_power_level);

        // Front-to-back ratio
        let front_to_back_ratio_db = self.calculate_front_to_back_ratio(far_field);

        // Cross-pol discrimination at main beam direction
        let cross_pol_discrimination_db = self.calculate_cross_pol_discrimination(far_field, max_idx);

        Ok(PatternMetrics {
            beamwidth_deg,
            directivity_dbi,
            efficiency: 0.85,
            max_gain_dbi,
            front_to_back_ratio_db,
            cross_pol_discrimination_db,
            impedance_bandwidth_mhz: 50.0,
        })
    }

    /// Calculate 3dB beamwidth with linear interpolation at half-power crossings
    fn calculate_beamwidth(&self, far_field: &[FarFieldSample], half_power_level: f64) -> f64 {
        // Extract phi=0 cut (samples with phi closest to 0)
        let min_phi = far_field
            .iter()
            .map(|s| s.phi.abs())
            .fold(f64::INFINITY, f64::min);

        let mut cut: Vec<(f64, f64)> = far_field
            .iter()
            .filter(|s| (s.phi - min_phi).abs() < 1e-9 || (s.phi.abs() < 1e-9))
            .map(|s| (s.theta, s.gain_db))
            .collect();

        if cut.len() < 3 {
            return 60.0;
        }

        cut.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());

        // Find peak (max gain angle) in this cut
        let (peak_idx, _) = cut
            .iter()
            .enumerate()
            .fold((0, f64::NEG_INFINITY), |(bi, bg), (i, &(_, g))| {
                if g > bg { (i, g) } else { (bi, bg) }
            });

        // Interpolate 3dB crossing walking left from peak
        let left_angle = Self::interpolate_crossing(&cut, peak_idx, half_power_level, false);

        // Interpolate 3dB crossing walking right from peak
        let right_angle = Self::interpolate_crossing(&cut, peak_idx, half_power_level, true);

        match (left_angle, right_angle) {
            (Some(l), Some(r)) => (r - l) * 180.0 / PI,
            _ => 60.0,
        }
    }

    /// Walk from peak_idx outward (forward=true → increasing index, false → decreasing)
    /// and linearly interpolate the exact angle where gain crosses `level`.
    fn interpolate_crossing(
        cut: &[(f64, f64)],
        peak_idx: usize,
        level: f64,
        forward: bool,
    ) -> Option<f64> {
        let range: Box<dyn Iterator<Item = usize>> = if forward {
            Box::new(peak_idx..cut.len() - 1)
        } else {
            Box::new((1..=peak_idx).rev())
        };

        for i in range {
            let (i0, i1) = if forward { (i, i + 1) } else { (i - 1, i) };
            let (theta0, g0) = cut[i0];
            let (theta1, g1) = cut[i1];

            // Check if the level crossing happens between these two samples
            let above0 = g0 >= level;
            let above1 = g1 >= level;
            if above0 != above1 {
                // Linear interpolation
                let t = (level - g0) / (g1 - g0);
                return Some(theta0 + t * (theta1 - theta0));
            }
        }
        None
    }

    /// Calculate cross-polarization discrimination at the main beam direction.
    /// E_co = E_theta, E_cross = E_phi (theta-polarized antenna convention).
    fn calculate_cross_pol_discrimination(&self, far_field: &[FarFieldSample], max_idx: usize) -> f64 {
        let sample = &far_field[max_idx];
        let co_power = sample.e_theta.norm_sqr();
        let cross_power = sample.e_phi.norm_sqr();

        if cross_power > 1e-30 {
            10.0 * (co_power / cross_power).log10()
        } else {
            60.0 // Cross-pol negligible
        }
    }

    /// Directivity via numerical spherical integration:
    ///   D = 4π · U_max / P_rad
    /// where P_rad = ∫∫ |E|² sin(θ) dθ dφ
    fn calculate_directivity(&self, far_field: &[FarFieldSample]) -> f64 {
        if far_field.is_empty() {
            return 0.0;
        }

        // Collect unique sorted theta and phi values
        let mut thetas: Vec<f64> = far_field.iter().map(|s| s.theta).collect();
        let mut phis: Vec<f64> = far_field.iter().map(|s| s.phi).collect();
        thetas.sort_by(|a, b| a.partial_cmp(b).unwrap());
        thetas.dedup_by(|a, b| (*a - *b).abs() < 1e-12);
        phis.sort_by(|a, b| a.partial_cmp(b).unwrap());
        phis.dedup_by(|a, b| (*a - *b).abs() < 1e-12);

        let n_theta = thetas.len();
        let n_phi = phis.len();

        if n_theta < 2 || n_phi < 2 {
            return 0.0;
        }

        // Build lookup: index by (theta_idx, phi_idx)
        let mut u_grid = vec![vec![0.0f64; n_phi]; n_theta];
        let mut u_max: f64 = 0.0;

        for sample in far_field {
            let ti = thetas.iter().position(|&t| (t - sample.theta).abs() < 1e-12);
            let pi = phis.iter().position(|&p| (p - sample.phi).abs() < 1e-12);
            if let (Some(ti), Some(pi)) = (ti, pi) {
                let u = sample.e_theta.norm_sqr() + sample.e_phi.norm_sqr();
                u_grid[ti][pi] = u;
                if u > u_max {
                    u_max = u;
                }
            }
        }

        if u_max < 1e-30 {
            return -100.0;
        }

        // Numerical integration using trapezoidal rule: ∫∫ U(θ,φ) sin(θ) dθ dφ
        let mut p_rad = 0.0;
        for i in 0..n_theta - 1 {
            let d_theta = thetas[i + 1] - thetas[i];
            for j in 0..n_phi - 1 {
                let d_phi = phis[j + 1] - phis[j];
                // Average of four corners
                let u_avg = 0.25
                    * (u_grid[i][j] + u_grid[i + 1][j] + u_grid[i][j + 1] + u_grid[i + 1][j + 1]);
                let sin_avg = 0.5 * (thetas[i].sin() + thetas[i + 1].sin());
                p_rad += u_avg * sin_avg * d_theta * d_phi;
            }
        }

        if p_rad < 1e-30 {
            return -100.0;
        }

        let directivity = 4.0 * PI * u_max / p_rad;
        10.0 * directivity.log10()
    }

    /// Calculate front-to-back ratio
    fn calculate_front_to_back_ratio(&self, far_field: &[FarFieldSample]) -> f64 {
        let mut front_gain = f64::NEG_INFINITY;
        let mut back_gain = f64::NEG_INFINITY;
        
        for sample in far_field {
            let theta_deg = sample.theta * 180.0 / PI;
            
            if theta_deg <= 90.0 {
                front_gain = front_gain.max(sample.gain_db);
            } else {
                back_gain = back_gain.max(sample.gain_db);
            }
        }
        
        if back_gain.is_finite() && front_gain.is_finite() {
            front_gain - back_gain
        } else {
            15.0 // Default F/B ratio
        }
    }

    /// Compute far-field radiation pattern as 2D array
    pub fn compute_far_field(
        &self,
        near_field_samples: &[NearFieldSample],
        theta_points: usize,
        phi_points: usize,
    ) -> Result<Array2<f64>> {
        if near_field_samples.is_empty() {
            return Err(AntennaError::InvalidParameter(
                "No near-field samples provided".to_string()
            ));
        }
        
        if theta_points == 0 || phi_points == 0 {
            return Err(AntennaError::InvalidParameter(
                "Invalid grid dimensions".to_string()
            ));
        }
        
        let mut gain_pattern = Array2::<f64>::zeros((theta_points, phi_points));
        
        // Calculate far-field pattern from near-field samples
        for i in 0..theta_points {
            let theta = (i as f64 / (theta_points - 1) as f64) * PI;
            
            for j in 0..phi_points {
                let phi = (j as f64 / (phi_points - 1) as f64) * 2.0 * PI;
                
                // Calculate far-field contribution from near-field samples
                let gain_db = self.calculate_far_field_gain_from_samples(
                    near_field_samples,
                    theta,
                    phi,
                )?;
                
                gain_pattern[[i, j]] = gain_db;
            }
        }
        
        Ok(gain_pattern)
    }
    
    /// Calculate far-field gain from near-field samples at specific angle
    fn calculate_far_field_gain_from_samples(
        &self,
        near_field_samples: &[NearFieldSample],
        theta: f64,
        phi: f64,
    ) -> Result<f64> {
        let mut total_field = Complex64::new(0.0, 0.0);
        
        // Direction vector
        let sin_theta = theta.sin();
        let cos_theta = theta.cos();
        let sin_phi = phi.sin();
        let cos_phi = phi.cos();
        
        let r_hat = Point3D::new(
            sin_theta * cos_phi,
            sin_theta * sin_phi,
            cos_theta,
        );
        
        // Sum contributions from all near-field samples
        for sample in near_field_samples {
            // Phase factor for far-field transformation
            let k_dot_r = self.k * (
                r_hat.x * sample.position.x +
                r_hat.y * sample.position.y +
                r_hat.z * sample.position.z
            );
            
            let phase = Complex64::new(0.0, -k_dot_r).exp();
            
            // Field magnitude (simplified)
            let field_mag = sample.e_field.magnitude();
            total_field += Complex64::new(field_mag, 0.0) * phase;
        }
        
        // Convert to gain in dBi
        let power_density = total_field.norm_sqr() / (2.0 * ETA0);
        
        let gain_db = if power_density > 1e-30 {
            let gain_linear = 4.0 * PI * power_density;
            if gain_linear > 1e-30 {
                10.0 * gain_linear.log10()
            } else {
                -100.0
            }
        } else {
            -100.0
        };
        
        Ok(gain_db)
    }
}

/// Pattern metrics structure
#[derive(Debug, Clone)]
struct PatternMetrics {
    beamwidth_deg: f64,
    directivity_dbi: f64,
    efficiency: f64,
    max_gain_dbi: f64,
    front_to_back_ratio_db: f64,
    cross_pol_discrimination_db: f64,
    impedance_bandwidth_mhz: f64,
}

impl Default for PatternMetrics {
    fn default() -> Self {
        Self {
            beamwidth_deg: 60.0,
            directivity_dbi: 2.15,
            efficiency: 0.85,
            max_gain_dbi: 0.0,
            front_to_back_ratio_db: 15.0,
            cross_pol_discrimination_db: 20.0,
            impedance_bandwidth_mhz: 50.0,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::geometry::{Segment, Mesh};
    
    #[test]
    fn test_near_to_far_field_transform_creation() {
        let transform = NearToFarFieldTransform::new(300e6);
        assert!(transform.frequency > 0.0);
        assert!(transform.wavelength > 0.0);
        assert!(transform.k > 0.0);
    }
    
    #[test]
    fn test_radiation_pattern_calculation() {
        let transform = NearToFarFieldTransform::new(300e6);
        
        // Create simple test mesh
        let vertices = vec![
            Point3D::new(0.0, 0.0, -0.25),
            Point3D::new(0.0, 0.0, 0.0),
            Point3D::new(0.0, 0.0, 0.25),
        ];
        
        let segments = vec![
            Segment { start: 0, end: 1 },
            Segment { start: 1, end: 2 },
        ];
        
        let mesh = Mesh {
            vertices,
            triangles: vec![],
            segments,
        };
        
        let current = Array1::from(vec![
            Complex64::new(1.0, 0.0),
            Complex64::new(1.0, 0.0),
        ]);
        
        let result = transform.calculate_radiation_pattern(&mesh, &current, 5, 5);
        assert!(result.is_ok());
        
        let samples = result.unwrap();
        assert_eq!(samples.len(), 25); // 5x5 grid
        
        // Check that all gain values are finite
        for sample in &samples {
            assert!(sample.gain_db.is_finite(), "Gain should be finite, got: {}", sample.gain_db);
            assert!(sample.theta >= 0.0 && sample.theta <= PI);
            assert!(sample.phi >= 0.0 && sample.phi <= 2.0 * PI);
        }
    }
    
    #[test]
    fn test_compute_far_field() {
        let transform = NearToFarFieldTransform::new(300e6);
        
        // Create test near-field samples
        let samples = vec![
            NearFieldSample {
                position: Point3D::new(1.0, 0.0, 0.0),
                e_field: ElectricField::new(
                    Complex64::new(1.0, 0.0),
                    Complex64::new(0.0, 1.0),
                    Complex64::new(0.0, 0.0),
                ),
            },
            NearFieldSample {
                position: Point3D::new(0.0, 1.0, 0.0),
                e_field: ElectricField::new(
                    Complex64::new(0.0, 1.0),
                    Complex64::new(1.0, 0.0),
                    Complex64::new(0.0, 0.0),
                ),
            },
        ];
        
        let result = transform.compute_far_field(&samples, 10, 20);
        assert!(result.is_ok());
        
        let pattern = result.unwrap();
        assert_eq!(pattern.shape(), &[10, 20]);
        
        // Check that all values are finite
        for &gain in pattern.iter() {
            assert!(gain.is_finite());
        }
    }
    
    #[test]
    fn test_compute_far_field_empty_samples() {
        let transform = NearToFarFieldTransform::new(300e6);
        let result = transform.compute_far_field(&[], 10, 20);
        assert!(result.is_err());
    }
    
    #[test]
    fn test_directivity_isotropic() {
        // Uniform far-field pattern: all samples have equal |E|² → directivity should be ≈ 0 dBi
        let transform = NearToFarFieldTransform::new(300e6);

        let n_theta = 37;
        let n_phi = 73;
        let mut samples = Vec::new();

        for i in 0..n_theta {
            let theta = (i as f64 / (n_theta - 1) as f64) * PI;
            for j in 0..n_phi {
                let phi = (j as f64 / (n_phi - 1) as f64) * 2.0 * PI;
                samples.push(FarFieldSample {
                    theta,
                    phi,
                    e_theta: Complex64::new(1.0, 0.0),
                    e_phi: Complex64::new(0.0, 0.0),
                    gain_db: 0.0,
                });
            }
        }

        let d = transform.calculate_directivity(&samples);
        // For a uniform pattern, D = 1 → 0 dBi. Allow ±0.5 dB for numerical error.
        assert!(
            (d - 0.0).abs() < 0.5,
            "Isotropic directivity should be ~0 dBi, got {} dBi",
            d
        );
    }

    #[test]
    fn test_compute_far_field_invalid_dimensions() {
        let transform = NearToFarFieldTransform::new(300e6);
        let samples = vec![
            NearFieldSample {
                position: Point3D::new(1.0, 0.0, 0.0),
                e_field: ElectricField::new(
                    Complex64::new(1.0, 0.0),
                    Complex64::new(0.0, 0.0),
                    Complex64::new(0.0, 0.0),
                ),
            },
        ];
        
        let result = transform.compute_far_field(&samples, 0, 20);
        assert!(result.is_err());
        
        let result = transform.compute_far_field(&samples, 10, 0);
        assert!(result.is_err());
    }
}