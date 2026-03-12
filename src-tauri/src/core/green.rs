use crate::core::geometry::Point3D;
use crate::core::constants::{ETA0, PI};
use num_complex::Complex64;

pub struct GreenFunction {
    pub k: f64, // Wave number
}

impl GreenFunction {
    pub fn new(wavelength: f64) -> Self {
        Self { k: 2.0 * PI / wavelength }
    }

    pub fn from_k(k: f64) -> Self {
        Self { k }
    }

    pub fn wire_impedance(
        &self,
        p1_i: &Point3D,
        p2_i: &Point3D,
        p1_j: &Point3D,
        p2_j: &Point3D,
        wire_radius: f64
    ) -> Complex64 {
        let length_i = p1_i.distance(p2_i);
        let length_j = p1_j.distance(p2_j);
        
        // Segment centers
        let center_i = Point3D::new(
            (p1_i.x + p2_i.x) / 2.0,
            (p1_i.y + p2_i.y) / 2.0,
            (p1_i.z + p2_i.z) / 2.0
        );
        let center_j = Point3D::new(
            (p1_j.x + p2_j.x) / 2.0,
            (p1_j.y + p2_j.y) / 2.0,
            (p1_j.z + p2_j.z) / 2.0
        );
        
        let r = center_i.distance(&center_j);
        
        // Self-impedance case
        if r < wire_radius {
            let psi = (2.0 * length_i / wire_radius).ln() - 1.0;
            let z_self = Complex64::new(0.0, ETA0 / (4.0 * PI)) * 
                        (self.k * length_i * psi);
            return z_self;
        }
        
        // Mutual impedance
        let phase = Complex64::new(0.0, -self.k * r);
        let g = phase.exp() / (4.0 * PI * r);
        
        // Simplified thin-wire approximation
        let z_mutual = Complex64::new(0.0, ETA0 * self.k) * g * length_i * length_j;
        
        z_mutual
    }

    pub fn free_space(
        &self,
        source: &Point3D,
        observation: &Point3D
    ) -> Complex64 {
        let r = source.distance(observation);
        if r < 1e-10 {
            return Complex64::new(0.0, 0.0);
        }
        
        let phase = Complex64::new(0.0, -self.k * r);
        phase.exp() / (4.0 * PI * r)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_green_function_creation() {
        let wavelength = 1.0; // 1m wavelength
        let k = 2.0 * PI / wavelength;
        let green = GreenFunction::new(wavelength);
        assert!((green.k - k).abs() < 1e-10);
    }

    #[test]
    fn test_free_space_green() {
        let green = GreenFunction::new(1.0);
        let p1 = Point3D::origin();
        let p2 = Point3D::new(1.0, 0.0, 0.0);
        let g = green.free_space(&p1, &p2);
        assert!(g.norm() > 0.0);
    }

    #[test]
    fn test_wire_impedance() {
        let green = GreenFunction::new(1.0);
        let p1 = Point3D::new(0.0, 0.0, -0.25);
        let p2 = Point3D::new(0.0, 0.0, 0.25);
        let z = green.wire_impedance(&p1, &p2, &p1, &p2, 0.001);
        assert!(z.im > 0.0); // Inductive
    }
}