use nalgebra::Vector3;
use std::ops::{Add, Sub};

#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Point3D {
    pub coords: Vector3<f64>,
}

impl Point3D {
    pub fn new(x: f64, y: f64, z: f64) -> Self {
        Self {
            coords: Vector3::new(x, y, z),
        }
    }

    pub fn origin() -> Self {
        Self::new(0.0, 0.0, 0.0)
    }

    pub fn x(&self) -> f64 {
        self.coords[0]
    }

    pub fn y(&self) -> f64 {
        self.coords[1]
    }

    pub fn z(&self) -> f64 {
        self.coords[2]
    }

    pub fn distance_to(&self, other: &Point3D) -> f64 {
        (self.coords - other.coords).norm()
    }
}

impl Add<Vector3<f64>> for Point3D {
    type Output = Point3D;

    fn add(self, rhs: Vector3<f64>) -> Self::Output {
        Point3D {
            coords: self.coords + rhs,
        }
    }
}

impl Sub for Point3D {
    type Output = Vector3<f64>;

    fn sub(self, rhs: Point3D) -> Self::Output {
        self.coords - rhs.coords
    }
}