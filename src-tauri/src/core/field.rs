use num_complex::Complex64;
use serde::{Deserialize, Serialize};

use crate::core::geometry::Point3D;

/// Electric field vector at a point
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ElectricField {
    pub x: Complex64,
    pub y: Complex64,
    pub z: Complex64,
}

impl ElectricField {
    pub fn zero() -> Self {
        let z = Complex64::new(0.0, 0.0);
        Self { x: z, y: z, z: z }
    }

    pub fn magnitude(&self) -> f64 {
        (self.x.norm_sqr() + self.y.norm_sqr() + self.z.norm_sqr()).sqrt()
    }
}

/// Combined near-field / far-field results
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FieldResult {
    pub frequency: f64,
    pub max_gain_dbi: f64,
    pub directivity_dbi: f64,
    pub efficiency: f64,
    pub beamwidth_deg: f64,
    pub front_to_back_ratio_db: f64,
    pub polarization: String,
    pub near_field: Vec<NearFieldSample>,
    pub far_field: Vec<FarFieldSample>,
}

impl FieldResult {
    /// Return a placeholder field result for stubs
    pub fn placeholder(frequency: f64) -> Self {
        Self {
            frequency,
            max_gain_dbi: 2.15,
            directivity_dbi: 2.15,
            efficiency: 1.0,
            beamwidth_deg: 78.0,
            front_to_back_ratio_db: 0.0,
            polarization: "linear".to_string(),
            near_field: Vec::new(),
            far_field: vec![
                FarFieldSample {
                    theta_deg: 0.0,
                    phi_deg: 0.0,
                    gain_dbi: -30.0,
                    e_theta: ElectricField::zero(),
                },
                FarFieldSample {
                    theta_deg: 90.0,
                    phi_deg: 0.0,
                    gain_dbi: 2.15,
                    e_theta: ElectricField::zero(),
                },
            ],
        }
    }
}

/// Near-field sample at a specific point
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NearFieldSample {
    pub position: Point3D,
    pub e_field: ElectricField,
}

/// Far-field sample at a specific direction
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FarFieldSample {
    pub theta_deg: f64,
    pub phi_deg: f64,
    pub gain_dbi: f64,
    pub e_theta: ElectricField,
}

/// Compute placeholder far-field at a given direction
pub fn compute_far_field_placeholder(
    _position: &Point3D,
    _current_element: &Point3D,
    _current: Complex64,
    _k: f64,
) -> ElectricField {
    // Stub: return zero field. Real implementation would integrate Green's function.
    ElectricField::zero()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_electric_field_magnitude() {
        let f = ElectricField {
            x: Complex64::new(3.0, 0.0),
            y: Complex64::new(4.0, 0.0),
            z: Complex64::new(0.0, 0.0),
        };
        assert!((f.magnitude() - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_electric_field_zero() {
        let f = ElectricField::zero();
        assert!((f.magnitude() - 0.0).abs() < 1e-10);
    }

    #[test]
    fn test_field_result_placeholder() {
        let fr = FieldResult::placeholder(1e9);
        assert!((fr.frequency - 1e9).abs() < 1.0);
        assert!((fr.max_gain_dbi - 2.15).abs() < 1e-10);
        assert_eq!(fr.far_field.len(), 2);
        assert!(fr.near_field.is_empty());
    }

    #[test]
    fn test_compute_far_field_placeholder() {
        let pos = Point3D::new(1.0, 0.0, 0.0);
        let src = Point3D::origin();
        let current = Complex64::new(1.0, 0.0);
        let k = 2.0 * std::f64::consts::PI;
        let e = compute_far_field_placeholder(&pos, &src, current, k);
        assert!((e.magnitude() - 0.0).abs() < 1e-10);
    }
}
