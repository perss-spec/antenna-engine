use nalgebra::{DVector, Complex};
use crate::geometry::Segment;

pub struct ExcitationVector {
    vector: DVector<Complex<f64>>,
}

impl ExcitationVector {
    pub fn new(size: usize) -> Self {
        Self {
            vector: DVector::zeros(size),
        }
    }

    pub fn delta_gap_feed(&mut self, feed_index: usize, voltage: Complex<f64>) -> Result<(), String> {
        if feed_index >= self.vector.len() {
            return Err("Feed index out of bounds".to_string());
        }
        
        // Delta-gap feed: voltage applied only at feed segment
        self.vector.fill(Complex::new(0.0, 0.0));
        self.vector[feed_index] = voltage;
        Ok(())
    }

    pub fn magnetic_frill_feed(&mut self, feed_index: usize, voltage: Complex<f64>, segments: &[Segment]) -> Result<(), String> {
        if feed_index >= self.vector.len() || feed_index >= segments.len() {
            return Err("Feed index out of bounds".to_string());
        }
        
        // Magnetic frill generator - more accurate for thick wires
        self.vector.fill(Complex::new(0.0, 0.0));
        
        let feed_segment = &segments[feed_index];
        let current_density = voltage / feed_segment.length();
        
        self.vector[feed_index] = current_density;
        Ok(())
    }

    pub fn vector(&self) -> &DVector<Complex<f64>> {
        &self.vector
    }

    pub fn vector_mut(&mut self) -> &mut DVector<Complex<f64>> {
        &mut self.vector
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::geometry::{Point3D, Segment};

    #[test]
    fn test_delta_gap_excitation() {
        let mut excitation = ExcitationVector::new(5);
        let voltage = Complex::new(1.0, 0.0);
        
        excitation.delta_gap_feed(2, voltage).unwrap();
        
        // Check that only feed segment has voltage
        for i in 0..5 {
            if i == 2 {
                assert_eq!(excitation.vector[i], voltage);
            } else {
                assert_eq!(excitation.vector[i], Complex::new(0.0, 0.0));
            }
        }
    }
}