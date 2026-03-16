use crate::geometry::{Wire, Segment};
use crate::utils::constants::*;
use nalgebra::{DMatrix, Complex};
use std::f64::consts::PI;

pub struct ImpedanceMatrix {
    matrix: DMatrix<Complex<f64>>,
    frequency: f64,
    wavenumber: f64,
}

impl ImpedanceMatrix {
    pub fn new(frequency: f64) -> Self {
        let wavenumber = 2.0 * PI * frequency / SPEED_OF_LIGHT;
        Self {
            matrix: DMatrix::zeros(0, 0),
            frequency,
            wavenumber,
        }
    }

    pub fn compute(&mut self, segments: &[Segment]) -> Result<(), Box<dyn std::error::Error>> {
        let n = segments.len();
        self.matrix = DMatrix::zeros(n, n);

        for i in 0..n {
            for j in 0..n {
                self.matrix[(i, j)] = self.compute_element(i, j, segments)?;
            }
        }
        Ok(())
    }

    fn compute_element(&self, i: usize, j: usize, segments: &[Segment]) -> Result<Complex<f64>, Box<dyn std::error::Error>> {
        let seg_i = &segments[i];
        let seg_j = &segments[j];
        
        if i == j {
            // Self impedance - critical for convergence
            self.self_impedance(seg_i)
        } else {
            // Mutual impedance
            self.mutual_impedance(seg_i, seg_j)
        }
    }

    fn self_impedance(&self, segment: &Segment) -> Result<Complex<f64>, Box<dyn std::error::Error>> {
        let length = segment.length();
        let radius = segment.radius();
        
        // Self impedance with wire radius correction
        let eta = (MU_0 / EPS_0).sqrt(); // Free space impedance
        let k = self.wavenumber;
        
        // Thin wire approximation with radius correction
        let gamma = 0.5772156649; // Euler's constant
        let arg = k * length / 2.0;
        
        // Real part - resistance
        let r_self = eta * k / (4.0 * PI) * length;
        
        // Imaginary part - reactance with wire radius
        let ln_term = if radius > 0.0 {
            (length / (2.0 * radius)).ln() - 1.0
        } else {
            (length * k / 4.0).ln() - gamma
        };
        
        let x_self = -eta / (2.0 * PI) * (
            (1.0 - arg.cos()) / arg.sin() - 
            (arg.sin() * ln_term)
        );
        
        Ok(Complex::new(r_self, x_self))
    }

    fn mutual_impedance(&self, seg_i: &Segment, seg_j: &Segment) -> Result<Complex<f64>, Box<dyn std::error::Error>> {
        // Mutual impedance using exact Green's function
        let r1 = seg_i.center();
        let r2 = seg_j.center();
        let distance = (r1 - r2).norm();
        
        if distance < 1e-10 {
            return Err("Segments too close".into());
        }
        
        let k = self.wavenumber;
        let eta = (MU_0 / EPS_0).sqrt();
        
        // Green's function for free space
        let kr = k * distance;
        let exp_term = Complex::new(0.0, -kr).exp();
        let green = exp_term / (4.0 * PI * distance);
        
        // Mutual impedance with proper scaling
        let z_mutual = eta * k * k * green * seg_i.length() * seg_j.length() / (4.0 * PI);
        
        Ok(z_mutual)
    }

    pub fn matrix(&self) -> &DMatrix<Complex<f64>> {
        &self.matrix
    }

    pub fn solve_current(&self, voltage: &nalgebra::DVector<Complex<f64>>) -> Result<nalgebra::DVector<Complex<f64>>, Box<dyn std::error::Error>> {
        if self.matrix.nrows() != voltage.len() {
            return Err("Matrix and voltage vector size mismatch".into());
        }

        // LU decomposition for solving Z * I = V
        match self.matrix.lu().solve(voltage) {
            Some(current) => Ok(current),
            None => Err("Matrix is singular - cannot solve for current".into()),
        }
    }

    pub fn input_impedance(&self, feed_index: usize, current: &nalgebra::DVector<Complex<f64>>) -> Complex<f64> {
        // Z_in = V_feed / I_feed, assuming 1V excitation
        if feed_index < current.len() && current[feed_index].norm() > 1e-12 {
            Complex::new(1.0, 0.0) / current[feed_index]
        } else {
            Complex::new(1e12, 0.0) // Very high impedance if no current
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::geometry::{Point3D, Segment};

    #[test]
    fn test_dipole_impedance() {
        // Half-wave dipole at 300 MHz
        let freq = 300e6;
        let wavelength = SPEED_OF_LIGHT / freq;
        let length = wavelength / 2.0;
        let radius = wavelength / 1000.0; // Thin wire
        
        // Create dipole segments
        let n_segments = 21; // Odd number for center feed
        let seg_length = length / n_segments as f64;
        let mut segments = Vec::new();
        
        for i in 0..n_segments {
            let z_start = -length / 2.0 + i as f64 * seg_length;
            let z_end = z_start + seg_length;
            let start = Point3D::new(0.0, 0.0, z_start);
            let end = Point3D::new(0.0, 0.0, z_end);
            segments.push(Segment::new(start, end, radius));
        }
        
        // Compute impedance matrix
        let mut z_matrix = ImpedanceMatrix::new(freq);
        z_matrix.compute(&segments).unwrap();
        
        // Create voltage excitation (1V at center segment)
        let feed_index = n_segments / 2; // Center segment
        let mut voltage = nalgebra::DVector::zeros(n_segments);
        voltage[feed_index] = Complex::new(1.0, 0.0);
        
        // Solve for current
        let current = z_matrix.solve_current(&voltage).unwrap();
        
        // Calculate input impedance
        let z_in = z_matrix.input_impedance(feed_index, &current);
        
        println!("Input impedance: {:.1} + j{:.1} Ω", z_in.re, z_in.im);
        
        // Check against theoretical values (73 + j42 Ω for half-wave dipole)
        assert!((z_in.re - 73.0).abs() < 10.0, "Resistance should be ~73Ω, got {:.1}Ω", z_in.re);
        assert!((z_in.im - 42.0).abs() < 15.0, "Reactance should be ~42Ω, got {:.1}Ω", z_in.im);
    }
}