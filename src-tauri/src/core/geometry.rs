use serde::{Deserialize, Serialize};

/// 3D point
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub struct Point3D {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl Point3D {
    pub fn new(x: f64, y: f64, z: f64) -> Self {
        Self { x, y, z }
    }

    pub fn origin() -> Self {
        Self::new(0.0, 0.0, 0.0)
    }

    pub fn distance(&self, other: &Point3D) -> f64 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        let dz = self.z - other.z;
        (dx * dx + dy * dy + dz * dz).sqrt()
    }

    pub fn dot(&self, other: &Point3D) -> f64 {
        self.x * other.x + self.y * other.y + self.z * other.z
    }

    pub fn norm(&self) -> f64 {
        (self.x * self.x + self.y * self.y + self.z * self.z).sqrt()
    }

    pub fn normalized(&self) -> Self {
        let n = self.norm();
        if n < 1e-15 {
            return *self;
        }
        Self::new(self.x / n, self.y / n, self.z / n)
    }

    pub fn scale(&self, s: f64) -> Self {
        Self::new(self.x * s, self.y * s, self.z * s)
    }

    pub fn add(&self, other: &Point3D) -> Self {
        Self::new(self.x + other.x, self.y + other.y, self.z + other.z)
    }

    pub fn sub(&self, other: &Point3D) -> Self {
        Self::new(self.x - other.x, self.y - other.y, self.z - other.z)
    }
}

/// Wire segment between two points
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Segment {
    pub start: usize,
    pub end: usize,
}

/// Triangular mesh element
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Triangle {
    pub vertices: [usize; 3],
}

/// Surface/wire mesh
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Mesh {
    pub vertices: Vec<Point3D>,
    pub triangles: Vec<Triangle>,
    pub segments: Vec<Segment>,
}

impl Mesh {
    pub fn empty() -> Self {
        Self {
            vertices: Vec::new(),
            triangles: Vec::new(),
            segments: Vec::new(),
        }
    }

    pub fn num_vertices(&self) -> usize {
        self.vertices.len()
    }

    pub fn num_elements(&self) -> usize {
        self.triangles.len() + self.segments.len()
    }
}

/// 3D bounding box
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Bounds3D {
    pub min: Point3D,
    pub max: Point3D,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_point3d_distance() {
        let a = Point3D::new(0.0, 0.0, 0.0);
        let b = Point3D::new(3.0, 4.0, 0.0);
        assert!((a.distance(&b) - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_point3d_normalized() {
        let p = Point3D::new(3.0, 0.0, 4.0);
        let n = p.normalized();
        assert!((n.norm() - 1.0).abs() < 1e-10);
    }

    #[test]
    fn test_mesh_empty() {
        let m = Mesh::empty();
        assert_eq!(m.num_vertices(), 0);
        assert_eq!(m.num_elements(), 0);
    }

    #[test]
    fn test_segment_triangle() {
        let seg = Segment { start: 0, end: 1 };
        assert_eq!(seg.start, 0);

        let tri = Triangle { vertices: [0, 1, 2] };
        assert_eq!(tri.vertices[2], 2);
    }
}
