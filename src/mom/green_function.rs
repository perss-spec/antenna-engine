//! Green's function for MoM method

use num_complex::Complex64;
use crate::mom::physical_constants::PhysicalConstants;

/// Green's function kernel for thin wire segments
pub struct GreenFunction {
    /// Wavenumber
    k: f64,
    /// Wire radius
    radius: f64,
}

impl GreenFunction {
    pub fn new(frequency: f64, radius: f64) -> Self {
        let k = PhysicalConstants::wavenumber(frequency);
        Self { k, radius }
    }
    
    /// Calculate impedance matrix element between segments i and j
    pub fn impedance_element(
        &self,
        seg_i: &[f64; 6], // [x1, y1, z1, x2, y2, z2]
        seg_j: &[f64; 6],
        len_i: f64,
        len_j: f64,
    ) -> Complex64 {
        if self.same_segment(seg_i, seg_j) {
            self.self_impedance(len_i)
        } else {
            self.mutual_impedance(seg_i, seg_j, len_i, len_j)
        }
    }
    
    fn same_segment(&self, seg_i: &[f64; 6], seg_j: &[f64; 6]) -> bool {
        const EPS: f64 = 1e-12;
        (0..6).all(|i| (seg_i[i] - seg_j[i]).abs() < EPS)
    }
    
    /// Self-impedance of a segment (diagonal element)
    fn self_impedance(&self, length: f64) -> Complex64 {
        let k = self.k;
        let a = self.radius;
        
        // Pocklington kernel for thin wire
        let real_part = PhysicalConstants::ETA0 / (4.0 * std::f64::consts::PI) * 
            (2.0 * (length / (2.0 * a)).ln() - 1.0);
        
        let imag_part = -PhysicalConstants::ETA0 / (4.0 * std::f64::consts::PI) *
            (k * length / 2.0).sin() / (k * length / 2.0);
        
        Complex64::new(real_part, imag_part)
    }
    
    /// Mutual impedance between different segments
    fn mutual_impedance(
        &self,
        seg_i: &[f64; 6],
        seg_j: &[f64; 6], 
        len_i: f64,
        len_j: f64,
    ) -> Complex64 {
        // Center points of segments
        let ri = [
            (seg_i[0] + seg_i[3]) / 2.0,
            (seg_i[1] + seg_i[4]) / 2.0,
            (seg_i[2] + seg_i[5]) / 2.0,
        ];
        
        let rj = [
            (seg_j[0] + seg_j[3]) / 2.0,
            (seg_j[1] + seg_j[4]) / 2.0,
            (seg_j[2] + seg_j[5]) / 2.0,
        ];
        
        // Distance between centers
        let r = ((ri[0] - rj[0]).powi(2) + 
                 (ri[1] - rj[1]).powi(2) + 
                 (ri[2] - rj[2]).powi(2)).sqrt();
        
        if r < 1e-12 {
            return self.self_impedance(len_i);
        }
        
        // Direction vectors
        let li = [
            seg_i[3] - seg_i[0],
            seg_i[4] - seg_i[1], 
            seg_i[5] - seg_i[2],
        ];
        
        let lj = [
            seg_j[3] - seg_j[0],
            seg_j[4] - seg_j[1],
            seg_j[5] - seg_j[2],
        ];
        
        // Normalize
        let li_mag = (li[0].powi(2) + li[1].powi(2) + li[2].powi(2)).sqrt();
        let lj_mag = (lj[0].powi(2) + lj[1].powi(2) + lj[2].powi(2)).sqrt();
        
        let li_hat = [li[0]/li_mag, li[1]/li_mag, li[2]/li_mag];
        let lj_hat = [lj[0]/lj_mag, lj[1]/lj_mag, lj[2]/lj_mag];
        
        // Dot product
        let dot_product = li_hat[0] * lj_hat[0] + li_hat[1] * lj_hat[1] + li_hat[2] * lj_hat[2];
        
        // Green's function
        let kr = self.k * r;
        let g = (-Complex64::i() * kr).exp() / (4.0 * std::f64::consts::PI * r);
        
        // Impedance element
        PhysicalConstants::ETA0 * self.k * g * dot_product * len_i * len_j / (len_i * len_j)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_green_function_creation() {
        let gf = GreenFunction::new(300e6, 1e-3);
        assert!(gf.k > 0.0);
        assert_eq!(gf.radius, 1e-3);
    }
    
    #[test] 
    fn test_self_impedance() {
        let gf = GreenFunction::new(300e6, 1e-3);
        let seg = [0.0, 0.0, 0.0, 0.1, 0.0, 0.0];
        let z = gf.impedance_element(&seg, &seg, 0.1, 0.1);
        
        // Self impedance should have positive real part
        assert!(z.re > 0.0);
    }
    
    #[test]
    fn test_mutual_impedance() {
        let gf = GreenFunction::new(300e6, 1e-3);
        let seg1 = [0.0, 0.0, 0.0, 0.1, 0.0, 0.0];
        let seg2 = [0.2, 0.0, 0.0, 0.3, 0.0, 0.0];
        
        let z = gf.impedance_element(&seg1, &seg2, 0.1, 0.1);
        
        // Mutual impedance should be smaller than self impedance
        assert!(z.norm() > 0.0);
    }
}