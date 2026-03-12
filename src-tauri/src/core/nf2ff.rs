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
        
        // Find maximum gain
        let max_gain_dbi = far_field
            .iter()
            .map(|s| s.gain_db)
            .fold(f64::NEG_INFINITY, f64::max);
        
        // Calculate directivity (simplified)
        let directivity_dbi = max_gain_dbi - 2.15; // Assume some loss
        
        // Calculate beamwidth (simplified)
        let half_power_level = max_gain_dbi - 3.0;
        let beamwidth_deg = self.calculate_beamwidth(far_field, half_power_level);
        
        // Calculate front-to-back ratio
        let front_to_back_ratio_db = self.calculate_front_to_back_ratio(far_field);
        
        Ok(PatternMetrics {
            beamwidth_deg,
            directivity_dbi,
            efficiency: 0.85, // Typical efficiency
            max_gain_dbi,
            front_to_back_ratio_db,
            cross_pol_discrimination_db: 20.0, // Typical value
            impedance_bandwidth_mhz: 50.0, // Typical value
        })
    }

    /// Calculate 3dB beamwidth
    fn calculate_beamwidth(&self, far_field: &[FarFieldSample], half_power_level: f64) -> f64 {
        // Simplified beamwidth calculation
        let mut angles_above_half_power = Vec::new();
        
        for sample in far_field {
            if sample.gain_db >= half_power_level {
                angles_above_half_power.push(sample.theta * 180.0 / PI);
            }
        }
        
        if angles_above_half_power.len() < 2 {
            return 60.0; // Default beamwidth
        }
        
        angles_above_half_power.sort_by(|a, b| a.partial_cmp(b).unwrap());
        let min_angle = angles_above_half_power[0];
        let max_angle = angles_above_half_power[angles_above_half_power.len() - 1];
        
        max_angle - min_angle
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