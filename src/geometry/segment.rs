use super::Point3D;
use nalgebra::Vector3;

#[derive(Debug, Clone)]
pub struct Segment {
    start: Point3D,
    end: Point3D,
    radius: f64,
    length: f64,
    center: Point3D,
    direction: Vector3<f64>,
}

impl Segment {
    pub fn new(start: Point3D, end: Point3D, radius: f64) -> Self {
        let direction = end - start;
        let length = direction.norm();
        let center_coords = (start.coords + end.coords) / 2.0;
        let center = Point3D { coords: center_coords };

        Self {
            start,
            end,
            radius,
            length,
            center,
            direction: if length > 1e-12 { direction / length } else { Vector3::zeros() },
        }
    }

    pub fn start(&self) -> Point3D {
        self.start
    }

    pub fn end(&self) -> Point3D {
        self.end
    }

    pub fn center(&self) -> Point3D {
        self.center
    }

    pub fn radius(&self) -> f64 {
        self.radius
    }

    pub fn length(&self) -> f64 {
        self.length
    }

    pub fn direction(&self) -> Vector3<f64> {
        self.direction
    }
}