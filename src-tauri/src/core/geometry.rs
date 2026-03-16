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

    pub fn normalize(&self) -> Self {
        self.normalized()
    }

    pub fn magnitude(&self) -> f64 {
        self.norm()
    }

    pub fn cross(&self, other: &Point3D) -> Point3D {
        Point3D::new(
            self.y * other.z - self.z * other.y,
            self.z * other.x - self.x * other.z,
            self.x * other.y - self.y * other.x,
        )
    }
}

impl std::ops::Sub for Point3D {
    type Output = Point3D;
    fn sub(self, rhs: Point3D) -> Point3D {
        Point3D::new(self.x - rhs.x, self.y - rhs.y, self.z - rhs.z)
    }
}

impl std::ops::Sub for &Point3D {
    type Output = Point3D;
    fn sub(self, rhs: &Point3D) -> Point3D {
        Point3D::new(self.x - rhs.x, self.y - rhs.y, self.z - rhs.z)
    }
}

impl std::ops::Add for Point3D {
    type Output = Point3D;
    fn add(self, rhs: Point3D) -> Point3D {
        Point3D::new(self.x + rhs.x, self.y + rhs.y, self.z + rhs.z)
    }
}

impl std::ops::Add for &Point3D {
    type Output = Point3D;
    fn add(self, rhs: &Point3D) -> Point3D {
        Point3D::new(self.x + rhs.x, self.y + rhs.y, self.z + rhs.z)
    }
}

impl std::ops::Mul<f64> for Point3D {
    type Output = Point3D;
    fn mul(self, rhs: f64) -> Point3D {
        Point3D::new(self.x * rhs, self.y * rhs, self.z * rhs)
    }
}

impl std::ops::Mul<f64> for &Point3D {
    type Output = Point3D;
    fn mul(self, rhs: f64) -> Point3D {
        Point3D::new(self.x * rhs, self.y * rhs, self.z * rhs)
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
    pub fn new() -> Self {
        Self::empty()
    }

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

    pub fn bounds(&self) -> Bounds3D {
        if self.vertices.is_empty() {
            return Bounds3D {
                min: Point3D::origin(),
                max: Point3D::origin(),
            };
        }
        let mut min = self.vertices[0];
        let mut max = self.vertices[0];
        for v in &self.vertices {
            if v.x < min.x { min.x = v.x; }
            if v.y < min.y { min.y = v.y; }
            if v.z < min.z { min.z = v.z; }
            if v.x > max.x { max.x = v.x; }
            if v.y > max.y { max.y = v.y; }
            if v.z > max.z { max.z = v.z; }
        }
        Bounds3D { min, max }
    }
}

/// 3D bounding box
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Bounds3D {
    pub min: Point3D,
    pub max: Point3D,
}

impl Bounds3D {
    pub fn center(&self) -> Point3D {
        Point3D::new(
            (self.min.x + self.max.x) / 2.0,
            (self.min.y + self.max.y) / 2.0,
            (self.min.z + self.max.z) / 2.0,
        )
    }

    pub fn size(&self) -> Point3D {
        Point3D::new(
            self.max.x - self.min.x,
            self.max.y - self.min.y,
            self.max.z - self.min.z,
        )
    }
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
