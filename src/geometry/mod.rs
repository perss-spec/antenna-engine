//! Geometric data structures and operations

use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq)]
pub struct Point3D {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

impl Point3D {
    pub fn new(x: f64, y: f64, z: f64) -> Self {
        Self { x, y, z }
    }

    pub fn distance_to(&self, other: &Point3D) -> f64 {
        let dx = self.x - other.x;
        let dy = self.y - other.y;
        let dz = self.z - other.z;
        (dx * dx + dy * dy + dz * dz).sqrt()
    }
}

#[derive(Debug, Clone)]
pub struct Surface {
    pub vertices: Vec<Point3D>,
    pub faces: Vec<[usize; 3]>, // Triangle faces as indices into vertices
}

impl Surface {
    pub fn new() -> Self {
        Self {
            vertices: Vec::new(),
            faces: Vec::new(),
        }
    }

    pub fn add_triangle(&mut self, p1: Point3D, p2: Point3D, p3: Point3D) {
        let start_index = self.vertices.len();
        self.vertices.push(p1);
        self.vertices.push(p2);
        self.vertices.push(p3);
        self.faces.push([start_index, start_index + 1, start_index + 2]);
    }

    pub fn vertex_count(&self) -> usize {
        self.vertices.len()
    }

    pub fn face_count(&self) -> usize {
        self.faces.len()
    }
}

impl Default for Surface {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone)]
pub struct Geometry {
    pub surfaces: Vec<Surface>,
    pub metadata: HashMap<String, String>,
}

impl Geometry {
    pub fn new() -> Self {
        Self {
            surfaces: Vec::new(),
            metadata: HashMap::new(),
        }
    }

    pub fn add_surface(&mut self, surface: Surface) {
        self.surfaces.push(surface);
    }

    pub fn total_vertex_count(&self) -> usize {
        self.surfaces.iter().map(|s| s.vertex_count()).sum()
    }

    pub fn total_face_count(&self) -> usize {
        self.surfaces.iter().map(|s| s.face_count()).sum()
    }

    pub fn set_metadata(&mut self, key: String, value: String) {
        self.metadata.insert(key, value);
    }

    pub fn get_metadata(&self, key: &str) -> Option<&String> {
        self.metadata.get(key)
    }
}

impl Default for Geometry {
    fn default() -> Self {
        Self::new()
    }
}