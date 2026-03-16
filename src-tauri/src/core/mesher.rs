use crate::core::geometry::{Point3D, Vector3D};
use crate::core::element::{AntennaElement, ElementType, WireElement, PatchElement, SurfaceElement};
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct MeshConfig {
    pub wavelength: f64,
    pub elements_per_wavelength: usize,
    pub min_edge_length: f64,
    pub max_edge_length: f64,
    pub adaptive: bool,
}

impl Default for MeshConfig {
    fn default() -> Self {
        Self {
            wavelength: 1.0,
            elements_per_wavelength: 10,
            min_edge_length: 0.001,
            max_edge_length: 0.1,
            adaptive: false,
        }
    }
}

#[derive(Debug, Clone)]
pub struct Triangle {
    pub vertices: [usize; 3],
    pub center: Point3D,
    pub area: f64,
    pub normal: Vector3D,
}

#[derive(Debug, Clone)]
pub struct Mesh {
    pub vertices: Vec<Point3D>,
    pub triangles: Vec<Triangle>,
    pub edges: Vec<[usize; 2]>,
    pub vertex_adjacency: HashMap<usize, Vec<usize>>,
}

#[derive(Debug, Clone)]
pub struct MeshQuality {
    pub min_angle: f64,
    pub max_angle: f64,
    pub avg_aspect_ratio: f64,
    pub min_area: f64,
    pub max_area: f64,
    pub total_triangles: usize,
}

impl Mesh {
    pub fn new() -> Self {
        Self {
            vertices: Vec::new(),
            triangles: Vec::new(),
            edges: Vec::new(),
            vertex_adjacency: HashMap::new(),
        }
    }

    pub fn add_vertex(&mut self, vertex: Point3D) -> usize {
        let index = self.vertices.len();
        self.vertices.push(vertex);
        self.vertex_adjacency.insert(index, Vec::new());
        index
    }

    pub fn add_triangle(&mut self, v0: usize, v1: usize, v2: usize) -> Result<usize, String> {
        if v0 >= self.vertices.len() || v1 >= self.vertices.len() || v2 >= self.vertices.len() {
            return Err("Invalid vertex indices".to_string());
        }

        let p0 = self.vertices[v0];
        let p1 = self.vertices[v1];
        let p2 = self.vertices[v2];

        let center = Point3D {
            x: (p0.x + p1.x + p2.x) / 3.0,
            y: (p0.y + p1.y + p2.y) / 3.0,
            z: (p0.z + p1.z + p2.z) / 3.0,
        };

        let v1_vec = Vector3D {
            x: p1.x - p0.x,
            y: p1.y - p0.y,
            z: p1.z - p0.z,
        };

        let v2_vec = Vector3D {
            x: p2.x - p0.x,
            y: p2.y - p0.y,
            z: p2.z - p0.z,
        };

        let cross = Vector3D {
            x: v1_vec.y * v2_vec.z - v1_vec.z * v2_vec.y,
            y: v1_vec.z * v2_vec.x - v1_vec.x * v2_vec.z,
            z: v1_vec.x * v2_vec.y - v1_vec.y * v2_vec.x,
        };

        let area = 0.5 * (cross.x * cross.x + cross.y * cross.y + cross.z * cross.z).sqrt();
        let magnitude = (cross.x * cross.x + cross.y * cross.y + cross.z * cross.z).sqrt();
        
        let normal = if magnitude > 1e-10 {
            Vector3D {
                x: cross.x / magnitude,
                y: cross.y / magnitude,
                z: cross.z / magnitude,
            }
        } else {
            Vector3D { x: 0.0, y: 0.0, z: 1.0 }
        };

        let triangle = Triangle {
            vertices: [v0, v1, v2],
            center,
            area,
            normal,
        };

        let index = self.triangles.len();
        self.triangles.push(triangle);

        // Update adjacency
        self.vertex_adjacency.get_mut(&v0).unwrap().extend_from_slice(&[v1, v2]);
        self.vertex_adjacency.get_mut(&v1).unwrap().extend_from_slice(&[v0, v2]);
        self.vertex_adjacency.get_mut(&v2).unwrap().extend_from_slice(&[v0, v1]);

        // Add edges
        self.add_edge(v0, v1);
        self.add_edge(v1, v2);
        self.add_edge(v2, v0);

        Ok(index)
    }

    fn add_edge(&mut self, v0: usize, v1: usize) {
        let edge = if v0 < v1 { [v0, v1] } else { [v1, v0] };
        if !self.edges.contains(&edge) {
            self.edges.push(edge);
        }
    }
}

pub fn mesh_antenna(element: &AntennaElement, config: &MeshConfig) -> Result<Mesh, String> {
    match &element.element_type {
        ElementType::Wire(wire) => mesh_wire(wire, config),
        ElementType::Patch(patch) => mesh_patch(patch, config),
        ElementType::Surface(surface) => mesh_surface(surface, config),
        ElementType::QFH { turns, diameter, height, .. } => mesh_qfh(*turns, *diameter, *height, config),
    }
}

fn mesh_wire(wire: &WireElement, config: &MeshConfig) -> Result<Mesh, String> {
    let mut mesh = Mesh::new();
    
    let length = ((wire.end.x - wire.start.x).powi(2) + 
                  (wire.end.y - wire.start.y).powi(2) + 
                  (wire.end.z - wire.start.z).powi(2)).sqrt();
    
    let target_length = config.wavelength / config.elements_per_wavelength as f64;
    let mut segments = (length / target_length).ceil() as usize;
    segments = segments.max(1);
    
    // Create wire segments with adaptive spacing if enabled
    for i in 0..=segments {
        let t = if config.adaptive && segments > 1 {
            // Finer spacing near ends (feed points)
            let uniform_t = i as f64 / segments as f64;
            let beta = 2.0; // Concentration factor
            uniform_t.powf(1.0 / beta)
        } else {
            i as f64 / segments as f64
        };
        
        let point = Point3D {
            x: wire.start.x + t * (wire.end.x - wire.start.x),
            y: wire.start.y + t * (wire.end.y - wire.start.y),
            z: wire.start.z + t * (wire.end.z - wire.start.z),
        };
        
        mesh.add_vertex(point);
        
        if i > 0 {
            mesh.add_edge(i - 1, i);
        }
    }
    
    Ok(mesh)
}

fn mesh_patch(patch: &PatchElement, config: &MeshConfig) -> Result<Mesh, String> {
    let mut mesh = Mesh::new();
    
    let target_length = config.wavelength / config.elements_per_wavelength as f64;
    
    let nx = ((patch.width / target_length).ceil() as usize).max(1);
    let ny = ((patch.height / target_length).ceil() as usize).max(1);
    
    // Generate vertices in a grid
    for j in 0..=ny {
        for i in 0..=nx {
            let x = patch.center.x - patch.width / 2.0 + (i as f64 * patch.width) / nx as f64;
            let y = patch.center.y - patch.height / 2.0 + (j as f64 * patch.height) / ny as f64;
            let z = patch.center.z;
            
            mesh.add_vertex(Point3D { x, y, z });
        }
    }
    
    // Generate triangles (2 per grid cell)
    for j in 0..ny {
        for i in 0..nx {
            let v0 = j * (nx + 1) + i;
            let v1 = v0 + 1;
            let v2 = (j + 1) * (nx + 1) + i;
            let v3 = v2 + 1;
            
            // First triangle: v0, v1, v2
            mesh.add_triangle(v0, v1, v2)?;
            
            // Second triangle: v1, v3, v2
            mesh.add_triangle(v1, v3, v2)?;
        }
    }
    
    Ok(mesh)
}

fn mesh_surface(surface: &SurfaceElement, config: &MeshConfig) -> Result<Mesh, String> {
    let mut mesh = Mesh::new();
    
    // Add all vertices from surface
    for vertex in &surface.vertices {
        mesh.add_vertex(*vertex);
    }
    
    // Add all triangles from surface
    for triangle_indices in &surface.triangles {
        if triangle_indices.len() != 3 {
            return Err("Surface element must contain triangles (3 vertices each)".to_string());
        }
        mesh.add_triangle(triangle_indices[0], triangle_indices[1], triangle_indices[2])?;
    }
    
    Ok(mesh)
}

fn mesh_qfh(turns: f64, diameter: f64, height: f64, config: &MeshConfig) -> Result<Mesh, String> {
    let mut mesh = Mesh::new();
    
    let circumference = std::f64::consts::PI * diameter;
    let helix_length = (turns * circumference.powi(2) + height.powi(2)).sqrt();
    
    let target_length = config.wavelength / config.elements_per_wavelength as f64;
    let segments = (helix_length / target_length).ceil() as usize;
    
    for i in 0..=segments {
        let t = i as f64 / segments as f64;
        let angle = 2.0 * std::f64::consts::PI * turns * t;
        let z = height * t;
        
        let point = Point3D {
            x: (diameter / 2.0) * angle.cos(),
            y: (diameter / 2.0) * angle.sin(),
            z,
        };
        
        mesh.add_vertex(point);
        
        if i > 0 {
            mesh.add_edge(i - 1, i);
        }
    }
    
    Ok(mesh)
}

pub fn compute_mesh_quality(mesh: &Mesh) -> MeshQuality {
    if mesh.triangles.is_empty() {
        return MeshQuality {
            min_angle: 0.0,
            max_angle: 0.0,
            avg_aspect_ratio: 0.0,
            min_area: 0.0,
            max_area: 0.0,
            total_triangles: 0,
        };
    }
    
    let mut min_angle = std::f64::INFINITY;
    let mut max_angle = 0.0;
    let mut total_aspect_ratio = 0.0;
    let mut min_area = std::f64::INFINITY;
    let mut max_area = 0.0;
    
    for triangle in &mesh.triangles {
        let p0 = mesh.vertices[triangle.vertices[0]];
        let p1 = mesh.vertices[triangle.vertices[1]];
        let p2 = mesh.vertices[triangle.vertices[2]];
        
        // Calculate edge lengths
        let a = distance(p1, p2);
        let b = distance(p0, p2);
        let c = distance(p0, p1);
        
        // Calculate angles using law of cosines
        let angle_a = ((b.powi(2) + c.powi(2) - a.powi(2)) / (2.0 * b * c)).acos().to_degrees();
        let angle_b = ((a.powi(2) + c.powi(2) - b.powi(2)) / (2.0 * a * c)).acos().to_degrees();
        let angle_c = ((a.powi(2) + b.powi(2) - c.powi(2)) / (2.0 * a * b)).acos().to_degrees();
        
        min_angle = min_angle.min(angle_a).min(angle_b).min(angle_c);
        max_angle = max_angle.max(angle_a).max(angle_b).max(angle_c);
        
        // Aspect ratio: ratio of longest edge to shortest altitude
        let longest_edge = a.max(b).max(c);
        let aspect_ratio = longest_edge / (2.0 * triangle.area / longest_edge);
        total_aspect_ratio += aspect_ratio;
        
        min_area = min_area.min(triangle.area);
        max_area = max_area.max(triangle.area);
    }
    
    MeshQuality {
        min_angle,
        max_angle,
        avg_aspect_ratio: total_aspect_ratio / mesh.triangles.len() as f64,
        min_area,
        max_area,
        total_triangles: mesh.triangles.len(),
    }
}

fn distance(p1: Point3D, p2: Point3D) -> f64 {
    ((p2.x - p1.x).powi(2) + (p2.y - p1.y).powi(2) + (p2.z - p1.z).powi(2)).sqrt()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mesh_dipole() {
        let wire = WireElement {
            start: Point3D { x: 0.0, y: 0.0, z: -0.5 },
            end: Point3D { x: 0.0, y: 0.0, z: 0.5 },
            radius: 0.001,
        };
        
        let element = AntennaElement {
            id: 1,
            element_type: ElementType::Wire(wire),
        };
        
        let config = MeshConfig {
            wavelength: 1.0,
            elements_per_wavelength: 10,
            ..Default::default()
        };
        
        let mesh = mesh_antenna(&element, &config).unwrap();
        
        assert!(mesh.vertices.len() >= 10);
        assert!(!mesh.edges.is_empty());
        
        // Check that vertices form a line along z-axis
        for vertex in &mesh.vertices {
            assert!((vertex.x.abs() < 1e-10) && (vertex.y.abs() < 1e-10));
            assert!(vertex.z >= -0.5 && vertex.z <= 0.5);
        }
    }

    #[test]
    fn test_mesh_patch() {
        let patch = PatchElement {
            center: Point3D { x: 0.0, y: 0.0, z: 0.0 },
            width: 1.0,
            height: 0.8,
            substrate_thickness: 0.016,
            permittivity: 4.4,
        };
        
        let element = AntennaElement {
            id: 1,
            element_type: ElementType::Patch(patch),
        };
        
        let config = MeshConfig {
            wavelength: 1.0,
            elements_per_wavelength: 5,
            ..Default::default()
        };
        
        let mesh = mesh_antenna(&element, &config).unwrap();
        
        // Should have at least 6 vertices (2x2 grid minimum)
        assert!(mesh.vertices.len() >= 6);
        // Should have triangles (2 per grid cell minimum)
        assert!(mesh.triangles.len() >= 2);
        
        let quality = compute_mesh_quality(&mesh);
        assert!(quality.total_triangles == mesh.triangles.len());
        assert!(quality.min_area > 0.0);
        assert!(quality.max_area >= quality.min_area);
    }

    #[test]
    fn test_mesh_quality() {
        let mut mesh = Mesh::new();
        
        // Create a simple equilateral triangle
        let v0 = mesh.add_vertex(Point3D { x: 0.0, y: 0.0, z: 0.0 });
        let v1 = mesh.add_vertex(Point3D { x: 1.0, y: 0.0, z: 0.0 });
        let v2 = mesh.add_vertex(Point3D { x: 0.5, y: (3.0_f64).sqrt() / 2.0, z: 0.0 });
        
        mesh.add_triangle(v0, v1, v2).unwrap();
        
        let quality = compute_mesh_quality(&mesh);
        
        // Equilateral triangle should have all 60° angles
        assert!((quality.min_angle - 60.0).abs() < 1.0);
        assert!((quality.max_angle - 60.0).abs() < 1.0);
        assert!(quality.total_triangles == 1);
    }

    #[test]
    fn test_adaptive_wire_meshing() {
        let wire = WireElement {
            start: Point3D { x: 0.0, y: 0.0, z: 0.0 },
            end: Point3D { x: 1.0, y: 0.0, z: 0.0 },
            radius: 0.001,
        };
        
        let element = AntennaElement {
            id: 1,
            element_type: ElementType::Wire(wire),
        };
        
        let config = MeshConfig {
            wavelength: 1.0,
            elements_per_wavelength: 10,
            adaptive: true,
            ..Default::default()
        };
        
        let mesh = mesh_antenna(&element, &config).unwrap();
        
        assert!(mesh.vertices.len() >= 10);
        
        // In adaptive meshing, spacing should be non-uniform
        let mut spacings = Vec::new();
        for i in 1..mesh.vertices.len() {
            let spacing = distance(mesh.vertices[i-1], mesh.vertices[i]);
            spacings.push(spacing);
        }
        
        // Check that spacings are not all equal (within tolerance)
        let first_spacing = spacings[0];
        let all_equal = spacings.iter().all(|&s| (s - first_spacing).abs() < 1e-10);
        assert!(!all_equal, "Adaptive meshing should produce non-uniform spacing");
    }
}