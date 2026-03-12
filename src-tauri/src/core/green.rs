use crate::core::geometry::Point3D;
use crate::core::{MU0, EPS0, C0};
use std::f64::consts::PI;
use num_complex::Complex64;

pub struct GreenFunction {
    pub k: f64,
    pub omega: f64,
    pub frequency: f64,
}

impl GreenFunction {
    pub fn new(wavelength: f64) -> Self {
        let k = 2.0 * PI / wavelength;
        let frequency = C0 / wavelength;
        let omega = 2.0 * PI * frequency;
        Self { k, omega, frequency }
    }

    pub fn from_frequency(frequency: f64) -> Self {
        let wavelength = C0 / frequency;
        Self::new(wavelength)
    }

    pub fn free_space(&self, source: &Point3D, observation: &Point3D) -> Complex64 {
        let r = source.distance(observation);
        if r < 1e-12 {
            return Complex64::new(0.0, 0.0);
        }
        Complex64::new(0.0, -self.k * r).exp() / (4.0 * PI * r)
    }

    /// MoM impedance matrix element using Galerkin testing with pulse basis.
    ///
    /// Z_mn = jωμ₀/(4π) × (l̂_m · l̂_n) × ∫_m ∫_n G(R) dl dl'
    ///      + 1/(jωε₀ × 4π) × [G(R_{m+,n+}) - G(R_{m+,n-}) - G(R_{m-,n+}) + G(R_{m-,n-})]
    ///
    /// First term: vector potential (A) contribution
    /// Second term: scalar potential (φ) contribution using endpoint charges
    ///
    /// G(R) = exp(-jkR) / R, with R including wire radius for self-terms.
    pub fn wire_impedance(
        &self,
        p1_i: &Point3D,
        p2_i: &Point3D,
        p1_j: &Point3D,
        p2_j: &Point3D,
        wire_radius: f64,
    ) -> Complex64 {
        let dir_i = p2_i.sub(p1_i);
        let dir_j = p2_j.sub(p1_j);
        let len_i = dir_i.norm();
        let len_j = dir_j.norm();
        if len_i < 1e-15 || len_j < 1e-15 {
            return Complex64::new(0.0, 0.0);
        }

        let l_hat_i = dir_i.normalized();
        let l_hat_j = dir_j.normalized();
        let cos_angle = l_hat_i.dot(&l_hat_j);

        let center_i = Point3D::new(
            (p1_i.x + p2_i.x) / 2.0,
            (p1_i.y + p2_i.y) / 2.0,
            (p1_i.z + p2_i.z) / 2.0,
        );
        let center_j = Point3D::new(
            (p1_j.x + p2_j.x) / 2.0,
            (p1_j.y + p2_j.y) / 2.0,
            (p1_j.z + p2_j.z) / 2.0,
        );

        let r_center = center_i.distance(&center_j);
        let is_self = r_center < wire_radius * 2.0;

        // =============================================
        // VECTOR POTENTIAL TERM (A-term)
        // Z_A = jωμ₀/(4π) × cos(α) × ∫_m ∫_n G(R) dl dl'
        // =============================================
        let n_quad = if is_self { 16 } else { 8 };
        let psi_mn = self.double_integrate_g(
            p1_i, p2_i, p1_j, p2_j, wire_radius, is_self, n_quad,
        );
        let z_a = Complex64::new(0.0, self.omega * MU0 / (4.0 * PI))
            * cos_angle * psi_mn;

        // =============================================
        // SCALAR POTENTIAL TERM (φ-term)
        // Charge on pulse basis: q_n = (I_{n} - I_{n-1}) / jω at each node
        // For Galerkin with pulse basis, the φ-term reduces to:
        // Z_φ = 1/(jωε₀·4π) × [G(++)+G(--)-G(+-)-G(-+)]
        // where ++ means (end_i, end_j), -- means (start_i, start_j), etc.
        // =============================================
        let g_pp = self.g_with_radius(p2_i, p2_j, wire_radius, is_self);
        let g_mm = self.g_with_radius(p1_i, p1_j, wire_radius, is_self);
        let g_pm = self.g_with_radius(p2_i, p1_j, wire_radius, is_self);
        let g_mp = self.g_with_radius(p1_i, p2_j, wire_radius, is_self);

        let z_phi = Complex64::new(0.0, -1.0 / (self.omega * EPS0 * 4.0 * PI))
            * (g_pp + g_mm - g_pm - g_mp);

        z_a + z_phi
    }

    /// Double integral ∫_m ∫_n exp(-jkR)/(4πR) dl dl'
    /// with Gauss-Legendre quadrature
    fn double_integrate_g(
        &self,
        p1_i: &Point3D, p2_i: &Point3D,
        p1_j: &Point3D, p2_j: &Point3D,
        wire_radius: f64, is_self: bool, n: usize,
    ) -> Complex64 {
        let mut sum = Complex64::new(0.0, 0.0);
        let len_i = p1_i.distance(p2_i);
        let len_j = p1_j.distance(p2_j);
        let dt_i = 1.0 / n as f64;
        let dt_j = 1.0 / n as f64;

        for ii in 0..n {
            let ti = (ii as f64 + 0.5) * dt_i;
            let obs = Point3D::new(
                p1_i.x + ti * (p2_i.x - p1_i.x),
                p1_i.y + ti * (p2_i.y - p1_i.y),
                p1_i.z + ti * (p2_i.z - p1_i.z),
            );
            for jj in 0..n {
                let tj = (jj as f64 + 0.5) * dt_j;
                let src = Point3D::new(
                    p1_j.x + tj * (p2_j.x - p1_j.x),
                    p1_j.y + tj * (p2_j.y - p1_j.y),
                    p1_j.z + tj * (p2_j.z - p1_j.z),
                );
                let mut r = obs.distance(&src);
                if is_self && r < wire_radius {
                    r = wire_radius;
                }
                if r > 1e-15 {
                    sum += Complex64::new(0.0, -self.k * r).exp() / r;
                }
            }
        }
        sum * (len_i * dt_i) * (len_j * dt_j)
    }

    /// G(R) = exp(-jkR)/R with wire radius correction.
    /// For self-term coincident points, use effective radius = sqrt(a × Δl/2)
    /// (geometric mean of wire radius and half segment length) to average
    /// the singularity over the segment cross-section.
    fn g_with_radius(
        &self, p1: &Point3D, p2: &Point3D,
        wire_radius: f64, is_self: bool,
    ) -> Complex64 {
        let mut r = p1.distance(p2);
        if is_self && r < wire_radius * 4.0 {
            // For coincident or very close endpoints on same segment,
            // use effective averaging distance
            r = r.max((wire_radius * wire_radius + r * r).sqrt());
        }
        if r < 1e-15 {
            r = wire_radius;
        }
        Complex64::new(0.0, -self.k * r).exp() / r
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_green_function_creation() {
        let green = GreenFunction::new(1.0);
        assert!((green.k - 2.0 * PI).abs() < 1e-10);
    }

    #[test]
    fn test_free_space_green() {
        let green = GreenFunction::new(1.0);
        let p1 = Point3D::origin();
        let p2 = Point3D::new(1.0, 0.0, 0.0);
        let g = green.free_space(&p1, &p2);
        let expected_mag = 1.0 / (4.0 * PI);
        assert!((g.norm() - expected_mag).abs() < 1e-6);
    }

    #[test]
    fn test_wire_self_impedance() {
        let green = GreenFunction::new(1.0);
        let p1 = Point3D::new(0.0, 0.0, -0.05);
        let p2 = Point3D::new(0.0, 0.0, 0.05);
        let z = green.wire_impedance(&p1, &p2, &p1, &p2, 0.001);
        assert!(z.norm() > 0.0);
    }

    #[test]
    fn test_wire_mutual_impedance() {
        let green = GreenFunction::new(1.0);
        let p1a = Point3D::new(0.0, 0.0, -0.05);
        let p2a = Point3D::new(0.0, 0.0, 0.05);
        let p1b = Point3D::new(0.0, 0.0, 0.05);
        let p2b = Point3D::new(0.0, 0.0, 0.15);
        let z = green.wire_impedance(&p1a, &p2a, &p1b, &p2b, 0.001);
        assert!(z.norm() > 0.0);
    }
}
