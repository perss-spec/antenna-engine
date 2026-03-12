use crate::core::geometry::Point3D;
use num_complex::Complex64;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct ElectricField {
    pub x: Complex64,
    pub y: Complex64,
    pub z: Complex64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NearFieldSample {
    pub position: Point3D,
    pub e_field: ElectricField,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FarFieldSample {
    pub theta: f64,
    pub phi: f64,
    pub e_theta: Complex64,
    pub e_phi: Complex64,
    pub gain_db: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FieldResult {
    pub near_field: Vec<NearFieldSample>,
    pub far_field: Vec<FarFieldSample>,
    pub beamwidth_deg: f64,
    pub directivity_dbi: f64,
    pub efficiency: f64,
    pub max_gain_dbi: f64,
    pub front_to_back_ratio_db: f64,
    pub cross_pol_discrimination_db: f64,
    pub impedance_bandwidth_mhz: f64,
}

impl ElectricField {
    pub fn new(x: Complex64, y: Complex64, z: Complex64) -> Self {
        Self { x, y, z }
    }
    
    pub fn magnitude(&self) -> f64 {
        (self.x.norm_sqr() + self.y.norm_sqr() + self.z.norm_sqr()).sqrt()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_electric_field_magnitude() {
        let field = ElectricField::new(
            Complex64::new(3.0, 0.0),
            Complex64::new(4.0, 0.0),
            Complex64::new(0.0, 0.0),
        );
        assert_eq!(field.magnitude(), 5.0);
    }
}