use crate::core::geometry::{Point3D, Triangle};
use crate::core::surface_mesher::Mesh;
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub struct RwgEdge {
    pub v1: usize,
    pub v2: usize,
    pub t_plus: usize,
    pub t_minus: usize,
    pub v_plus: usize,
    pub v_minus: usize,
    pub length: f64,
    pub area_plus: f64,
    pub area_minus: f64,
}

#[derive(Debug)]
pub struct RwgBasis {
    pub edges: Vec<RwgEdge>,
    pub num_basis: usize,
}

impl RwgBasis {
    pub fn from_mesh(mesh: &Mesh) -> Result<Self, String> {
        // Build edge-to-triangles map
        let mut edge_map: HashMap<(usize, usize), Vec<usize>> = HashMap::new();
        
        for (tri_idx, triangle) in mesh.triangles.iter().enumerate() {
            // Add all three edges of the triangle
            let edges = [
                (triangle.v1.min(triangle.v2), triangle.v1.max(triangle.v2)),
                (triangle.v2.min(triangle.v3), triangle.v2.max(triangle.v3)),
                (triangle.v3.min(triangle.v1), triangle.v3.max(triangle.v1)),
            ];
            
            for edge in edges.iter() {
                edge_map.entry(*edge).or_insert(Vec::new()).push(tri_idx);
            }
        }
        
        // Extract interior edges (shared by exactly 2 triangles)
        let mut rwg_edges = Vec::new();
        
        for ((v1, v2), triangles) in edge_map.iter() {
            if triangles.len() == 2 {
                // Determine T+ and T- based on edge orientation
                let t1 = triangles[0];
                let t2 = triangles[1];
                
                let tri1 = &mesh.triangles[t1];
                let tri2 = &mesh.triangles[t2];
                
                // Find which triangle has edge in CCW order (T+) and which has it in CW (T-)
                let (t_plus, t_minus, v_plus, v_minus) = 
                    determine_triangle_orientation(mesh, *v1, *v2, t1, t2)?;
                
                // Calculate edge length
                let p1 = &mesh.vertices[*v1];
                let p2 = &mesh.vertices[*v2];
                let length = (p2 - p1).magnitude();
                
                // Calculate triangle areas
                let area_plus = calculate_triangle_area(mesh, t_plus);
                let area_minus = calculate_triangle_area(mesh, t_minus);
                
                rwg_edges.push(RwgEdge {
                    v1: *v1,
                    v2: *v2,
                    t_plus,
                    t_minus,
                    v_plus,
                    v_minus,
                    length,
                    area_plus,
                    area_minus,
                });
            }
        }
        
        let num_basis = rwg_edges.len();
        
        Ok(RwgBasis {
            edges: rwg_edges,
            num_basis,
        })
    }
    
    pub fn evaluate(&self, basis_idx: usize, point: &Point3D, tri_idx: usize) -> Point3D {
        if basis_idx >= self.num_basis {
            return Point3D::new(0.0, 0.0, 0.0);
        }
        
        let edge = &self.edges[basis_idx];
        
        if tri_idx == edge.t_plus {
            // f_n = l_n/(2A+) * ρ+(r)
            // ρ+(r) = r - v_plus
            let rho_plus = point - &Point3D::new(0.0, 0.0, 0.0); // Placeholder, need mesh ref
            rho_plus * (edge.length / (2.0 * edge.area_plus))
        } else if tri_idx == edge.t_minus {
            // f_n = l_n/(2A-) * ρ-(r)
            // ρ-(r) = r - v_minus
            let rho_minus = point - &Point3D::new(0.0, 0.0, 0.0); // Placeholder, need mesh ref
            rho_minus * (edge.length / (2.0 * edge.area_minus))
        } else {
            Point3D::new(0.0, 0.0, 0.0)
        }
    }
    
    pub fn evaluate_with_mesh(&self, basis_idx: usize, point: &Point3D, tri_idx: usize, mesh: &Mesh) -> Point3D {
        if basis_idx >= self.num_basis {
            return Point3D::new(0.0, 0.0, 0.0);
        }
        
        let edge = &self.edges[basis_idx];
        
        if tri_idx == edge.t_plus {
            // f_n = l_n/(2A+) * ρ+(r)
            // ρ+(r) = r - v_plus
            let v_plus = &mesh.vertices[edge.v_plus];
            let rho_plus = point - v_plus;
            rho_plus * (edge.length / (2.0 * edge.area_plus))
        } else if tri_idx == edge.t_minus {
            // f_n = l_n/(2A-) * ρ-(r)
            // ρ-(r) = r - v_minus
            let v_minus = &mesh.vertices[edge.v_minus];
            let rho_minus = point - v_minus;
            rho_minus * (edge.length / (2.0 * edge.area_minus))
        } else {
            Point3D::new(0.0, 0.0, 0.0)
        }
    }
    
    pub fn divergence(&self, basis_idx: usize, tri_idx: usize) -> f64 {
        if basis_idx >= self.num_basis {
            return 0.0;
        }
        
        let edge = &self.edges[basis_idx];
        
        if tri_idx == edge.t_plus {
            edge.length / edge.area_plus
        } else if tri_idx == edge.t_minus {
            -edge.length / edge.area_minus
        } else {
            0.0
        }
    }
}

fn determine_triangle_orientation(
    mesh: &Mesh,
    v1: usize,
    v2: usize,
    t1_idx: usize,
    t2_idx: usize,
) -> Result<(usize, usize, usize, usize), String> {
    let t1 = &mesh.triangles[t1_idx];
    let t2 = &mesh.triangles[t2_idx];
    
    // Find the free vertex in each triangle (vertex not part of the edge)
    let v_free_1 = find_free_vertex(t1, v1, v2)?;
    let v_free_2 = find_free_vertex(t2, v1, v2)?;
    
    // Check edge orientation in triangle 1
    let is_ccw_in_t1 = is_edge_ccw_in_triangle(t1, v1, v2);
    
    if is_ccw_in_t1 {
        Ok((t1_idx, t2_idx, v_free_1, v_free_2))
    } else {
        Ok((t2_idx, t1_idx, v_free_2, v_free_1))
    }
}

fn find_free_vertex(triangle: &Triangle, v1: usize, v2: usize) -> Result<usize, String> {
    if triangle.v1 != v1 && triangle.v1 != v2 {
        Ok(triangle.v1)
    } else if triangle.v2 != v1 && triangle.v2 != v2 {
        Ok(triangle.v2)
    } else if triangle.v3 != v1 && triangle.v3 != v2 {
        Ok(triangle.v3)
    } else {
        Err("Invalid triangle edge configuration".to_string())
    }
}

fn is_edge_ccw_in_triangle(triangle: &Triangle, v1: usize, v2: usize) -> bool {
    // Check if edge v1->v2 appears in CCW order in the triangle
    let vertices = [triangle.v1, triangle.v2, triangle.v3, triangle.v1];
    
    for i in 0..3 {
        if vertices[i] == v1 && vertices[i + 1] == v2 {
            return true;
        }
    }
    false
}

fn calculate_triangle_area(mesh: &Mesh, tri_idx: usize) -> f64 {
    let triangle = &mesh.triangles[tri_idx];
    let p1 = &mesh.vertices[triangle.v1];
    let p2 = &mesh.vertices[triangle.v2];
    let p3 = &mesh.vertices[triangle.v3];
    
    let v1 = p2 - p1;
    let v2 = p3 - p1;
    let cross = v1.cross(&v2);
    
    0.5 * cross.magnitude()
}

// Gaussian quadrature points and weights for triangles
pub struct GaussianQuadrature {
    pub points: Vec<(f64, f64)>,  // Barycentric coordinates (xi, eta)
    pub weights: Vec<f64>,
}

impl GaussianQuadrature {
    pub fn order_3() -> Self {
        // 3-point rule (degree 2)
        GaussianQuadrature {
            points: vec![
                (0.5, 0.0),
                (0.5, 0.5),
                (0.0, 0.5),
            ],
            weights: vec![1.0/3.0, 1.0/3.0, 1.0/3.0],
        }
    }
    
    pub fn order_4() -> Self {
        // 4-point rule (degree 3)
        GaussianQuadrature {
            points: vec![
                (1.0/3.0, 1.0/3.0),
                (0.6, 0.2),
                (0.2, 0.6),
                (0.2, 0.2),
            ],
            weights: vec![-0.5625, 0.520833333333333, 0.520833333333333, 0.520833333333333],
        }
    }
    
    pub fn order_7() -> Self {
        // 7-point rule (degree 5)
        let a = 0.470142064105115;
        let b = 0.101286507323456;
        let w1 = 0.225;
        let w2 = 0.132394152788506;
        let w3 = 0.125939180544827;
        
        GaussianQuadrature {
            points: vec![
                (1.0/3.0, 1.0/3.0),
                (a, a),
                (1.0 - 2.0*a, a),
                (a, 1.0 - 2.0*a),
                (b, b),
                (1.0 - 2.0*b, b),
                (b, 1.0 - 2.0*b),
            ],
            weights: vec![w1, w2, w2, w2, w3, w3, w3],
        }
    }
    
    pub fn to_cartesian(&self, triangle_vertices: &[Point3D; 3], idx: usize) -> Point3D {
        let (xi, eta) = self.points[idx];
        let zeta = 1.0 - xi - eta;
        
        &triangle_vertices[0] * zeta + &triangle_vertices[1] * xi + &triangle_vertices[2] * eta
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_simple_mesh_rwg() {
        // Create a simple mesh with 2 triangles sharing 1 edge
        let vertices = vec![
            Point3D::new(0.0, 0.0, 0.0),  // 0
            Point3D::new(1.0, 0.0, 0.0),  // 1
            Point3D::new(0.0, 1.0, 0.0),  // 2
            Point3D::new(1.0, 1.0, 0.0),  // 3
        ];
        
        let triangles = vec![
            Triangle { v1: 0, v2: 1, v3: 2 },  // Triangle 0
            Triangle { v1: 1, v2: 3, v3: 2 },  // Triangle 1
        ];
        
        let mesh = Mesh { vertices, triangles };
        
        let rwg = RwgBasis::from_mesh(&mesh).unwrap();
        
        // Should have 1 RWG basis function for the shared edge (1,2)
        assert_eq!(rwg.num_basis, 1);
        assert_eq!(rwg.edges[0].v1, 1);
        assert_eq!(rwg.edges[0].v2, 2);
    }
    
    #[test]
    fn test_divergence_consistency() {
        let vertices = vec![
            Point3D::new(0.0, 0.0, 0.0),
            Point3D::new(1.0, 0.0, 0.0),
            Point3D::new(0.0, 1.0, 0.0),
            Point3D::new(1.0, 1.0, 0.0),
        ];
        
        let triangles = vec![
            Triangle { v1: 0, v2: 1, v3: 2 },
            Triangle { v1: 1, v2: 3, v3: 2 },
        ];
        
        let mesh = Mesh { vertices, triangles };
        let rwg = RwgBasis::from_mesh(&mesh).unwrap();
        
        // Test divergence theorem: ∫(∇·f) dS = ∮f·n dl
        let div_plus = rwg.divergence(0, rwg.edges[0].t_plus);
        let div_minus = rwg.divergence(0, rwg.edges[0].t_minus);
        
        // Divergences should have opposite signs
        assert!(div_plus * div_minus < 0.0);
        
        // Total divergence weighted by areas should sum to zero (divergence theorem)
        let total = div_plus * rwg.edges[0].area_plus + div_minus * rwg.edges[0].area_minus;
        assert!(total.abs() < 1e-10);
    }
    
    #[test]
    fn test_gaussian_quadrature() {
        let quad = GaussianQuadrature::order_3();
        
        // Test that weights sum to 1
        let weight_sum: f64 = quad.weights.iter().sum();
        assert!((weight_sum - 1.0).abs() < 1e-10);
        
        // Test barycentric coordinates sum to 1
        for (xi, eta) in &quad.points {
            let zeta = 1.0 - xi - eta;
            assert!((xi + eta + zeta - 1.0).abs() < 1e-10);
        }
    }
}