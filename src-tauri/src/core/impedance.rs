use ndarray::Array2;
use num_complex::Complex64;

use crate::core::geometry::Mesh;
use crate::core::green::GreenFunction;
use crate::core::types::Result;

pub struct ImpedanceMatrix<'a> {
    mesh: &'a Mesh,
    green: &'a GreenFunction,
    wire_radius: f64,
}

impl<'a> ImpedanceMatrix<'a> {
    pub fn new(mesh: &'a Mesh, green: &'a GreenFunction) -> Result<Self> {
        Ok(Self { mesh, green, wire_radius: 0.001 })
    }

    pub fn with_wire_radius(mut self, radius: f64) -> Self {
        self.wire_radius = radius;
        self
    }

    pub fn build(&mut self) -> Result<Array2<Complex64>> {
        let n = self.mesh.segments.len();
        let mut z = Array2::<Complex64>::zeros((n, n));

        for i in 0..n {
            let seg_i = &self.mesh.segments[i];
            let p1_i = &self.mesh.vertices[seg_i.start];
            let p2_i = &self.mesh.vertices[seg_i.end];

            for j in 0..n {
                let seg_j = &self.mesh.segments[j];
                let p1_j = &self.mesh.vertices[seg_j.start];
                let p2_j = &self.mesh.vertices[seg_j.end];

                z[[i, j]] = self.green.wire_impedance(p1_i, p2_i, p1_j, p2_j, self.wire_radius);
            }
        }

        Ok(z)
    }
}
