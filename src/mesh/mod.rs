//! Mesh generation and refinement utilities

use crate::geometry::{Geometry, Surface, Point3D};

#[derive(Debug, Clone)]
pub struct MeshParameters {
    pub max_element_size: f64,
    pub min_element_size: f64,
    pub growth_rate: f64,
    pub surface_curvature_factor: f64,
}

impl MeshParameters {
    pub fn new() -> Self {
        Self {
            max_element_size: 1.0,
            min_element_size: 0.01,
            growth_rate: 1.3,
            surface_curvature_factor: 0.1,
        }
    }

    pub fn with_max_size(mut self, size: f64) -> Self {
        self.max_element_size = size;
        self
    }

    pub fn with_min_size(mut self, size: f64) -> Self {
        self.min_element_size = size;
        self
    }
}

impl Default for MeshParameters {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone)]
pub struct TetrahedralMesh {
    pub vertices: Vec<Point3D>,
    pub tetrahedra: Vec<[usize; 4]>, // Four vertex indices per tetrahedron
}

impl TetrahedralMesh {
    pub fn new() -> Self {
        Self {
            vertices: Vec::new(),
            tetrahedra: Vec::new(),
        }
    }

    pub fn vertex_count(&self) -> usize {
        self.vertices.len()
    }

    pub fn element_count(&self) -> usize {
        self.tetrahedra.len()
    }

    pub fn add_tetrahedron(&mut self, p1: Point3D, p2: Point3D, p3: Point3D, p4: Point3D) {
        let start_index = self.vertices.len();
        self.vertices.extend([p1, p2, p3, p4]);
        self.tetrahedra.push([start_index, start_index + 1, start_index + 2, start_index + 3]);
    }
}

impl Default for TetrahedralMesh {
    fn default() -> Self {
        Self::new()
    }
}

pub struct MeshGenerator {
    parameters: MeshParameters,
}

impl MeshGenerator {
    pub fn new(parameters: MeshParameters) -> Self {
        Self { parameters }
    }

    pub fn generate_mesh(&self, geometry: &Geometry) -> Result<TetrahedralMesh, MeshError> {
        let mut mesh = TetrahedralMesh::new();

        // Simple mesh generation - in practice, you'd use a sophisticated meshing algorithm
        for surface in &geometry.surfaces {
            self.mesh_surface(&mut mesh, surface)?;
        }

        if mesh.vertex_count() == 0 {
            return Err(MeshError::EmptyGeometry);
        }

        Ok(mesh)
    }

    fn mesh_surface(&self, mesh: &mut TetrahedralMesh, surface: &Surface) -> Result<(), MeshError> {
        // For each triangle face, create tetrahedra
        for face in &surface.faces {
            if face.iter().all(|&i| i < surface.vertices.len()) {
                let v1 = surface.vertices[face[0]].clone();
                let v2 = surface.vertices[face[1]].clone();
                let v3 = surface.vertices[face[2]].clone();
                
                // Create a simple tetrahedron by adding a point above the triangle
                let center_x = (v1.x + v2.x + v3.x) / 3.0;
                let center_y = (v1.y + v2.y + v3.y) / 3.0;
                let center_z = (v1.z + v2.z + v3.z) / 3.0;
                let v4 = Point3D::new(center_x, center_y, center_z + self.parameters.max_element_size);
                
                mesh.add_tetrahedron(v1, v2, v3, v4);
            }
        }
        Ok(())
    }
}

#[derive(Debug, Clone)]
pub enum MeshError {
    EmptyGeometry,
    InvalidParameters,
    GenerationFailed(String),
}

impl std::fmt::Display for MeshError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            MeshError::EmptyGeometry => write!(f, "Empty geometry provided for meshing"),
            MeshError::InvalidParameters => write!(f, "Invalid mesh parameters"),
            MeshError::GenerationFailed(msg) => write!(f, "Mesh generation failed: {}", msg),
        }
    }
}

impl std::error::Error for MeshError {}