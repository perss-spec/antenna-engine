use crate::geometry::{Wire, Segment};
use crate::mom::{ImpedanceMatrix, ExcitationVector};
use nalgebra::{DVector, Complex};

pub struct MoMSolver {
    frequency: f64,
    impedance_matrix: ImpedanceMatrix,
    excitation: ExcitationVector,
    current: Option<DVector<Complex<f64>>>,
    segments: Vec<Segment>,
}

impl MoMSolver {
    pub fn new(frequency: f64) -> Self {
        Self {
            frequency,
            impedance_matrix: ImpedanceMatrix::new(frequency),
            excitation: ExcitationVector::new(0),
            current: None,
            segments: Vec::new(),
        }
    }

    pub fn set_geometry(&mut self, wire: &Wire) -> Result<(), Box<dyn std::error::Error>> {
        self.segments = wire.segments().to_vec();
        
        // Resize excitation vector
        self.excitation = ExcitationVector::new(self.segments.len());
        
        // Compute impedance matrix
        self.impedance_matrix.compute(&self.segments)?;
        
        Ok(())
    }

    pub fn set_excitation(&mut self, feed_index: usize, voltage: Complex<f64>) -> Result<(), String> {
        self.excitation.delta_gap_feed(feed_index, voltage)
    }

    pub fn solve(&mut self) -> Result<(), Box<dyn std::error::Error>> {
        let voltage_vector = self.excitation.vector().clone();
        self.current = Some(self.impedance_matrix.solve_current(&voltage_vector)?);
        Ok(())
    }

    pub fn input_impedance(&self, feed_index: usize) -> Result<Complex<f64>, String> {
        match &self.current {
            Some(current) => Ok(self.impedance_matrix.input_impedance(feed_index, current)),
            None => Err("Solution not computed. Call solve() first.".to_string()),
        }
    }

    pub fn current_distribution(&self) -> Option<&DVector<Complex<f64>>> {
        self.current.as_ref()
    }

    pub fn segments(&self) -> &[Segment] {
        &self.segments
    }

    pub fn frequency(&self) -> f64 {
        self.frequency
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::geometry::{Point3D, Wire};
    use crate::utils::constants::SPEED_OF_LIGHT;

    #[test]
    fn test_dipole_solver() {
        let freq = 300e6; // 300 MHz
        let wavelength = SPEED_OF_LIGHT / freq;
        let length = wavelength / 2.0;
        let radius = wavelength / 1000.0;

        // Create half-wave dipole
        let start = Point3D::new(0.0, 0.0, -length / 2.0);
        let end = Point3D::new(0.0, 0.0, length / 2.0);
        let wire = Wire::new(start, end, radius, 21); // 21 segments

        let mut solver = MoMSolver::new(freq);
        solver.set_geometry(&wire).unwrap();

        // Feed at center (segment 10 for 0-based indexing)
        let feed_index = 10;
        solver.set_excitation(feed_index, Complex::new(1.0, 0.0)).unwrap();

        // Solve
        solver.solve().unwrap();

        // Get input impedance
        let z_in = solver.input_impedance(feed_index).unwrap();
        
        println!("Dipole input impedance: {:.1} + j{:.1} Ω", z_in.re, z_in.im);

        // Verify against theoretical values
        assert!((z_in.re - 73.0).abs() < 15.0, 
            "Dipole resistance should be ~73Ω, got {:.1}Ω", z_in.re);
    }

    #[test]
    fn test_convergence_with_mesh_refinement() {
        let freq = 300e6;
        let wavelength = SPEED_OF_LIGHT / freq;
        let length = wavelength / 2.0;
        let radius = wavelength / 1000.0;

        let start = Point3D::new(0.0, 0.0, -length / 2.0);
        let end = Point3D::new(0.0, 0.0, length / 2.0);

        let mut results = Vec::new();

        // Test different mesh densities
        for n_segments in [11, 21, 41].iter() {
            let wire = Wire::new(start, end, radius, *n_segments);
            let mut solver = MoMSolver::new(freq);
            solver.set_geometry(&wire).unwrap();

            let feed_index = n_segments / 2;
            solver.set_excitation(feed_index, Complex::new(1.0, 0.0)).unwrap();
            solver.solve().unwrap();

            let z_in = solver.input_impedance(feed_index).unwrap();
            results.push(z_in);
            
            println!("N={}: Z_in = {:.1} + j{:.1} Ω", n_segments, z_in.re, z_in.im);
        }

        // Check convergence - resistance should stabilize around 73Ω
        let final_r = results.last().unwrap().re;
        assert!((final_r - 73.0).abs() < 20.0, 
            "Final resistance {:.1}Ω should converge to ~73Ω", final_r);
    }
}