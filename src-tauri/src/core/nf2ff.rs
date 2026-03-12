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
                
                // Calculate gain
                let e_mag_sq = e_theta.norm_sqr() + e_phi.norm_sqr();
                let power_density = e_mag_sq / (2.0 * ETA0);
                let gain_linear = 4.0 * PI * power_density;
                let gain_db = 10.0 * gain_linear.log10();
                
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
        // Unit vector in observation direction
        let r_hat = Point3D::new(
            theta.sin() * phi.cos(),
            theta.sin() * phi.sin(),
            theta.cos(),
        );
        
        // Spherical unit vectors
        let theta_hat = Point3D::new(
            theta.cos() * phi.cos(),
            theta.cos() * phi.sin(),
            -theta.sin(),
        );
        
        let phi_hat = Point3D::new(-phi.sin(), phi.cos(), 0.0);
        
        let mut n_theta = Complex64::new(0.0, 0.0);
        let mut n_phi = Complex64::new(0.0, 0.0);
        
        // Integrate over current elements
        for (idx, segment) in mesh.segments.iter().enumerate() {
            if idx >= current_distribution.len() {
                break;
            }
            
            let current = current_distribution[idx];
            if current.norm() < 1e-12 {
                continue;
            }
            
            // Get segment endpoints
            let p1 = mesh.vertices[segment.start];
            let p2 = mesh.vertices[segment.end];
            let center = Point3D::new(
                (p1.x + p2.x) / 2.0,
                (p1.y + p2.y) / 2.0,
                (p1.z + p2.z) / 2.0,
            );
            
            // Current direction
            let dl = p2 - p1;
            let length = dl.distance(&Point3D::origin());
            let current_dir = dl.normalize();
            
            // Phase factor
            let phase = -self.k * center.dot(&r_hat);
            let exp_phase = Complex64::new(0.0, phase).exp();
            
            // Vector potential contribution
            let a_contrib = current * exp_phase * length;
            
            // Project onto spherical components
            n_theta += a_contrib * current_dir.dot(&theta_hat);
            n_phi += a_contrib * current_dir.dot(&phi_hat);
        }
        
        // Far field expressions
        let factor = Complex64::new(0.0, self.k * ETA0 / (4.0 * PI));
        let e_theta = factor * n_theta;
        let e_phi = factor * n_phi;
        
        Ok((e_theta, e_phi))
    }

    /// Calculate complete field results including metrics
    pub fn calculate_field_results(
        &self,
        mesh: &Mesh,
        current_distribution: &Array1<Complex64>,
    ) -> Result<FieldResult> {
        // Calculate far field pattern
        let far_field = self.calculate_radiation_pattern(
            mesh,
            current_distribution,
            181, // 1-degree resolution in theta
            360, // 1-degree resolution in phi
        )?;
        
        // Calculate metrics from pattern
        let (max_gain_dbi, directivity_dbi) = self.calculate_gain_metrics(&far_field)?;
        let beamwidth = self.calculate_beamwidth(&far_field)?;
        let front_to_back = self.calculate_front_to_back_ratio(&far_field)?;
        
        // Simplified near field (just a few sample points)
        let near_field = self.calculate_near_field_samples(mesh, current_distribution)?;
        
        Ok(FieldResult {
            near_field,
            far_field,
            beamwidth_deg: beamwidth,
            directivity_dbi,
            efficiency: 0.95, // Assume 95% efficiency for now
            max_gain_dbi,
            front_to_back_ratio_db: front_to_back,
            cross_pol_discrimination_db: 20.0, // Placeholder
            impedance_bandwidth_mhz: 100.0, // Placeholder
        })
    }

    fn calculate_gain_metrics(&self, pattern: &[FarFieldSample]) -> Result<(f64, f64)> {
        let max_gain = pattern
            .iter()
            .map(|s| s.gain_db)
            .fold(f64::NEG_INFINITY, f64::max);
        
        // Directivity approximation (should integrate over sphere)
        let directivity = max_gain; // Simplified
        
        Ok((max_gain, directivity))
    }

    fn calculate_beamwidth(&self, pattern: &[FarFieldSample]) -> Result<f64> {
        // Find E-plane pattern (phi = 0)
        let e_plane: Vec<_> = pattern
            .iter()
            .filter(|s| (s.phi - 0.0).abs() < 0.1)
            .collect();
        
        if e_plane.is_empty() {
            return Ok(70.0); // Default
        }
        
        // Find max gain
        let max_gain = e_plane
            .iter()
            .map(|s| s.gain_db)
            .fold(f64::NEG_INFINITY, f64::max);
        
        // Find 3dB points
        let threshold = max_gain - 3.0;
        let beamwidth = 70.0; // Default for dipole
        
        Ok(beamwidth)
    }

    fn calculate_front_to_back_ratio(&self, pattern: &[FarFieldSample]) -> Result<f64> {
        // Find gain at theta=90° (broadside) and theta=270° (back)
        let front_gain = pattern
            .iter()
            .filter(|s| (s.theta - PI / 2.0).abs() < 0.1)
            .map(|s| s.gain_db)
            .fold(f64::NEG_INFINITY, f64::max);
        
        let back_gain = pattern
            .iter()
            .filter(|s| (s.theta - 3.0 * PI / 2.0).abs() < 0.1)
            .map(|s| s.gain_db)
            .fold(f64::NEG_INFINITY, f64::max);
        
        Ok((front_gain - back_gain).abs())
    }

    fn calculate_near_field_samples(
        &self,
        mesh: &Mesh,
        current_distribution: &Array1<Complex64>,
    ) -> Result<Vec<NearFieldSample>> {
        let mut samples = Vec::new();
        
        // Sample a few points around the antenna
        let bounds = mesh.bounds();
        let center = bounds.center();
        let size = bounds.size();
        let max_dim = size.x.max(size.y).max(size.z);
        
        // Sample points at 1 wavelength distance
        let distance = self.wavelength;
        
        for i in 0..8 {
            let angle = (i as f64 / 8.0) * 2.0 * PI;
            let position = Point3D::new(
                center.x + distance * angle.cos(),
                center.y + distance * angle.sin(),
                center.z,
            );
            
            let e_field = self.calculate_near_field_at_point(
                mesh,
                current_distribution,
                &position,
            )?;
            
            samples.push(NearFieldSample { position, e_field });
        }
        
        Ok(samples)
    }

    fn calculate_near_field_at_point(
        &self,
        mesh: &Mesh,
        current_distribution: &Array1<Complex64>,
        point: &Point3D,
    ) -> Result<ElectricField> {
        let mut e_x = Complex64::new(0.0, 0.0);
        let mut e_y = Complex64::new(0.0, 0.0);
        let mut e_z = Complex64::new(0.0, 0.0);
        
        // Simplified near field calculation
        for (idx, segment) in mesh.segments.iter().enumerate() {
            if idx >= current_distribution.len() {
                break;
            }
            
            let current = current_distribution[idx];
            if current.norm() < 1e-12 {
                continue;
            }
            
            let p1 = &mesh.vertices[segment.start];
            let p2 = &mesh.vertices[segment.end];
            let center = Point3D::new(
                (p1.x + p2.x) / 2.0,
                (p1.y + p2.y) / 2.0,
                (p1.z + p2.z) / 2.0,
            );
            
            let r = point.distance(&center);
            if r < 1e-6 {
                continue;
            }
            
            // Simplified field calculation
            let phase = -self.k * r;
            let exp_phase = Complex64::new(0.0, phase).exp();
            let factor = exp_phase / (4.0 * PI * r);
            
            let dl = p2.clone() - p1.clone();
            e_z += current * factor * dl.z;
        }
        
        Ok(ElectricField {
            x: e_x,
            y: e_y,
            z: e_z,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_nf2ff_creation() {
        let nf2ff = NearToFarFieldTransform::new(1e9);
        assert!((nf2ff.wavelength - 0.3).abs() < 0.01);
    }

    #[test]
    fn test_radiation_pattern_calculation() {
        let nf2ff = NearToFarFieldTransform::new(1e9);
        let mesh = Mesh::new();
        let current = Array1::zeros(0);
        
        let result = nf2ff.calculate_radiation_pattern(&mesh, &current, 10, 10);
        assert!(result.is_ok());
    }
}