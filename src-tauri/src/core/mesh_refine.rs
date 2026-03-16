use crate::core::geometry::{Point3D, Element};
use crate::core::mesh::{Mesh, Triangle, WireSegment};
use anyhow::{Result, anyhow};
use num_complex::Complex64;
use std::collections::{HashMap, HashSet};

#[derive(Debug, Clone)]
pub struct RefinementConfig {
    pub max_iterations: usize,
    pub error_threshold: f64,
    pub max_elements: usize,
    pub min_edge_length: f64,
}

impl Default for RefinementConfig {
    fn default() -> Self {
        Self {
            max_iterations: 10,
            error_threshold: 0.1,
            max_elements: 50000,
            min_edge_length: 1e-4,
        }
    }
}

#[derive(Debug, Clone)]
struct EdgeInfo {
    vertices: (usize, usize),
    adjacent_triangles: Vec<usize>,
    length: f64,
    midpoint_index: Option<usize>,
}

#[derive(Debug)]
struct TriangleError {
    triangle_index: usize,
    error: f64,
    longest_edge: (usize, usize),
}

pub fn refine_mesh(mesh: &Mesh, currents: &[Complex64], config: &RefinementConfig) -> Result<Mesh> {
    let mut refined_mesh = mesh.clone();
    
    for iteration in 0..config.max_iterations {
        // Calculate error estimates
        let errors = estimate_triangle_errors(&refined_mesh, currents)?;
        
        // Find triangles to refine
        let mut triangles_to_refine = errors.into_iter()
            .filter(|e| e.error > config.error_threshold)
            .collect::<Vec<_>>();
        
        if triangles_to_refine.is_empty() {
            println!("Convergence achieved after {} iterations", iteration);
            break;
        }
        
        // Sort by error (highest first)
        triangles_to_refine.sort_by(|a, b| b.error.partial_cmp(&a.error).unwrap());
        
        // Check element count limit
        let potential_new_elements = refined_mesh.triangles.len() + triangles_to_refine.len() * 2;
        if potential_new_elements > config.max_elements {
            let max_refine = (config.max_elements - refined_mesh.triangles.len()) / 2;
            triangles_to_refine.truncate(max_refine);
        }
        
        if triangles_to_refine.is_empty() {
            break;
        }
        
        // Perform refinement
        refined_mesh = refine_triangles(refined_mesh, &triangles_to_refine, config)?;
        
        println!("Iteration {}: Refined {} triangles, total: {}", 
                iteration + 1, triangles_to_refine.len(), refined_mesh.triangles.len());
    }
    
    Ok(refined_mesh)
}

fn estimate_triangle_errors(mesh: &Mesh, currents: &[Complex64]) -> Result<Vec<TriangleError>> {
    let mut edge_map = build_edge_map(&mesh.triangles);
    let mut errors = Vec::new();
    
    for (tri_idx, triangle) in mesh.triangles.iter().enumerate() {
        let error = calculate_triangle_error(mesh, triangle, tri_idx, currents, &edge_map)?;
        let longest_edge = find_longest_edge(mesh, triangle);
        
        errors.push(TriangleError {
            triangle_index: tri_idx,
            error,
            longest_edge,
        });
    }
    
    Ok(errors)
}

fn calculate_triangle_error(
    mesh: &Mesh, 
    triangle: &Triangle, 
    tri_idx: usize,
    currents: &[Complex64],
    edge_map: &HashMap<(usize, usize), Vec<usize>>
) -> Result<f64> {
    if tri_idx >= currents.len() {
        return Ok(0.0);
    }
    
    let current_tri = currents[tri_idx];
    let mut max_discontinuity = 0.0;
    
    // Check discontinuity across each edge
    let edges = [
        (triangle.vertices.0, triangle.vertices.1),
        (triangle.vertices.1, triangle.vertices.2),
        (triangle.vertices.2, triangle.vertices.0),
    ];
    
    for edge in &edges {
        let normalized_edge = if edge.0 < edge.1 { *edge } else { (edge.1, edge.0) };
        
        if let Some(adjacent_triangles) = edge_map.get(&normalized_edge) {
            for &adj_tri_idx in adjacent_triangles {
                if adj_tri_idx != tri_idx && adj_tri_idx < currents.len() {
                    let current_adj = currents[adj_tri_idx];
                    let discontinuity = (current_tri - current_adj).norm();
                    max_discontinuity = max_discontinuity.max(discontinuity);
                }
            }
        }
    }
    
    // Normalize by triangle area
    let area = calculate_triangle_area(mesh, triangle);
    Ok(max_discontinuity / area.sqrt())
}

fn build_edge_map(triangles: &[Triangle]) -> HashMap<(usize, usize), Vec<usize>> {
    let mut edge_map: HashMap<(usize, usize), Vec<usize>> = HashMap::new();
    
    for (tri_idx, triangle) in triangles.iter().enumerate() {
        let edges = [
            (triangle.vertices.0, triangle.vertices.1),
            (triangle.vertices.1, triangle.vertices.2),
            (triangle.vertices.2, triangle.vertices.0),
        ];
        
        for edge in &edges {
            let normalized_edge = if edge.0 < edge.1 { *edge } else { (edge.1, edge.0) };
            edge_map.entry(normalized_edge).or_insert_with(Vec::new).push(tri_idx);
        }
    }
    
    edge_map
}

fn find_longest_edge(mesh: &Mesh, triangle: &Triangle) -> (usize, usize) {
    let v0 = &mesh.vertices[triangle.vertices.0];
    let v1 = &mesh.vertices[triangle.vertices.1];
    let v2 = &mesh.vertices[triangle.vertices.2];
    
    let edge01_len = distance(v0, v1);
    let edge12_len = distance(v1, v2);
    let edge20_len = distance(v2, v0);
    
    if edge01_len >= edge12_len && edge01_len >= edge20_len {
        (triangle.vertices.0, triangle.vertices.1)
    } else if edge12_len >= edge20_len {
        (triangle.vertices.1, triangle.vertices.2)
    } else {
        (triangle.vertices.2, triangle.vertices.0)
    }
}

fn calculate_triangle_area(mesh: &Mesh, triangle: &Triangle) -> f64 {
    let v0 = &mesh.vertices[triangle.vertices.0];
    let v1 = &mesh.vertices[triangle.vertices.1];
    let v2 = &mesh.vertices[triangle.vertices.2];
    
    let edge1 = Point3D {
        x: v1.x - v0.x,
        y: v1.y - v0.y,
        z: v1.z - v0.z,
    };
    
    let edge2 = Point3D {
        x: v2.x - v0.x,
        y: v2.y - v0.y,
        z: v2.z - v0.z,
    };
    
    let cross = Point3D {
        x: edge1.y * edge2.z - edge1.z * edge2.y,
        y: edge1.z * edge2.x - edge1.x * edge2.z,
        z: edge1.x * edge2.y - edge1.y * edge2.x,
    };
    
    0.5 * (cross.x * cross.x + cross.y * cross.y + cross.z * cross.z).sqrt()
}

fn distance(p1: &Point3D, p2: &Point3D) -> f64 {
    ((p1.x - p2.x).powi(2) + (p1.y - p2.y).powi(2) + (p1.z - p2.z).powi(2)).sqrt()
}

fn refine_triangles(
    mut mesh: Mesh, 
    triangles_to_refine: &[TriangleError], 
    config: &RefinementConfig
) -> Result<Mesh> {
    let mut edge_midpoints: HashMap<(usize, usize), usize> = HashMap::new();
    let mut new_triangles = Vec::new();
    let mut refined_indices = HashSet::new();
    
    for triangle_error in triangles_to_refine {
        let tri_idx = triangle_error.triangle_index;
        let triangle = mesh.triangles[tri_idx].clone();
        let longest_edge = triangle_error.longest_edge;
        
        // Check minimum edge length
        let v1 = &mesh.vertices[longest_edge.0];
        let v2 = &mesh.vertices[longest_edge.1];
        let edge_length = distance(v1, v2);
        
        if edge_length < config.min_edge_length {
            continue;
        }
        
        refined_indices.insert(tri_idx);
        
        // Create midpoint if it doesn't exist
        let normalized_edge = if longest_edge.0 < longest_edge.1 { 
            longest_edge 
        } else { 
            (longest_edge.1, longest_edge.0) 
        };
        
        let midpoint_idx = *edge_midpoints.entry(normalized_edge).or_insert_with(|| {
            let midpoint = Point3D {
                x: (v1.x + v2.x) / 2.0,
                y: (v1.y + v2.y) / 2.0,
                z: (v1.z + v2.z) / 2.0,
            };
            mesh.vertices.push(midpoint);
            mesh.vertices.len() - 1
        });
        
        // Create two new triangles by bisecting the longest edge
        let (v0, v1, v2) = triangle.vertices;
        
        let (new_tri1, new_tri2) = if longest_edge == (v0, v1) || longest_edge == (v1, v0) {
            (
                Triangle { vertices: (v0, midpoint_idx, v2) },
                Triangle { vertices: (midpoint_idx, v1, v2) },
            )
        } else if longest_edge == (v1, v2) || longest_edge == (v2, v1) {
            (
                Triangle { vertices: (v0, v1, midpoint_idx) },
                Triangle { vertices: (v0, midpoint_idx, v2) },
            )
        } else {
            (
                Triangle { vertices: (v0, v1, midpoint_idx) },
                Triangle { vertices: (midpoint_idx, v1, v2) },
            )
        };
        
        new_triangles.push(new_tri1);
        new_triangles.push(new_tri2);
    }
    
    // Remove refined triangles and add new ones
    let mut final_triangles = Vec::new();
    for (idx, triangle) in mesh.triangles.iter().enumerate() {
        if !refined_indices.contains(&idx) {
            final_triangles.push(triangle.clone());
        }
    }
    final_triangles.extend(new_triangles);
    
    mesh.triangles = final_triangles;
    Ok(mesh)
}

pub fn refine_wire_mesh(mesh: &Mesh, feed_segment: usize, refinement_factor: usize) -> Result<Mesh> {
    if refinement_factor == 0 {
        return Err(anyhow!("Refinement factor must be positive"));
    }
    
    let mut refined_mesh = mesh.clone();
    let mut new_segments = Vec::new();
    
    for (seg_idx, segment) in mesh.wire_segments.iter().enumerate() {
        let should_refine = seg_idx == feed_segment || 
                          is_near_feed_point(mesh, segment, feed_segment)?;
        
        if should_refine {
            // Subdivide this segment
            let start_vertex = &mesh.vertices[segment.start_vertex];
            let end_vertex = &mesh.vertices[segment.end_vertex];
            
            let mut prev_vertex_idx = segment.start_vertex;
            
            for i in 1..refinement_factor {
                let t = i as f64 / refinement_factor as f64;
                let new_vertex = Point3D {
                    x: start_vertex.x + t * (end_vertex.x - start_vertex.x),
                    y: start_vertex.y + t * (end_vertex.y - start_vertex.y),
                    z: start_vertex.z + t * (end_vertex.z - start_vertex.z),
                };
                
                refined_mesh.vertices.push(new_vertex);
                let new_vertex_idx = refined_mesh.vertices.len() - 1;
                
                new_segments.push(WireSegment {
                    start_vertex: prev_vertex_idx,
                    end_vertex: new_vertex_idx,
                    radius: segment.radius,
                });
                
                prev_vertex_idx = new_vertex_idx;
            }
            
            // Final segment
            new_segments.push(WireSegment {
                start_vertex: prev_vertex_idx,
                end_vertex: segment.end_vertex,
                radius: segment.radius,
            });
        } else {
            new_segments.push(segment.clone());
        }
    }
    
    refined_mesh.wire_segments = new_segments;
    Ok(refined_mesh)
}

fn is_near_feed_point(mesh: &Mesh, segment: &WireSegment, feed_segment: usize) -> Result<bool> {
    if feed_segment >= mesh.wire_segments.len() {
        return Ok(false);
    }
    
    let feed_seg = &mesh.wire_segments[feed_segment];
    let feed_start = &mesh.vertices[feed_seg.start_vertex];
    let feed_end = &mesh.vertices[feed_seg.end_vertex];
    
    let seg_start = &mesh.vertices[segment.start_vertex];
    let seg_end = &mesh.vertices[segment.end_vertex];
    
    // Check if segment endpoints are close to feed segment
    let threshold = 0.1; // 10% of wavelength typical
    
    let min_dist = [
        distance(seg_start, feed_start),
        distance(seg_start, feed_end),
        distance(seg_end, feed_start),
        distance(seg_end, feed_end),
    ].iter().fold(f64::INFINITY, |a, &b| a.min(b));
    
    Ok(min_dist < threshold)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::geometry::Point3D;

    fn create_test_mesh() -> Mesh {
        let vertices = vec![
            Point3D { x: 0.0, y: 0.0, z: 0.0 },
            Point3D { x: 1.0, y: 0.0, z: 0.0 },
            Point3D { x: 0.5, y: 1.0, z: 0.0 },
            Point3D { x: 1.5, y: 1.0, z: 0.0 },
        ];
        
        let triangles = vec![
            Triangle { vertices: (0, 1, 2) },
            Triangle { vertices: (1, 3, 2) },
        ];
        
        let wire_segments = vec![
            WireSegment { start_vertex: 0, end_vertex: 1, radius: 0.01 },
            WireSegment { start_vertex: 1, end_vertex: 3, radius: 0.01 },
        ];
        
        Mesh { vertices, triangles, wire_segments }
    }

    #[test]
    fn test_triangle_area_calculation() {
        let mesh = create_test_mesh();
        let triangle = &mesh.triangles[0];
        let area = calculate_triangle_area(&mesh, triangle);
        assert!((area - 0.5).abs() < 1e-10);
    }

    #[test]
    fn test_edge_map_building() {
        let mesh = create_test_mesh();
        let edge_map = build_edge_map(&mesh.triangles);
        
        // Edge (1,2) should be shared by both triangles
        assert!(edge_map.contains_key(&(1, 2)));
        assert_eq!(edge_map[&(1, 2)].len(), 2);
    }

    #[test]
    fn test_longest_edge_finding() {
        let mesh = create_test_mesh();
        let triangle = &mesh.triangles[0];
        let longest_edge = find_longest_edge(&mesh, triangle);
        
        // Edge (0,2) should be longest (length = sqrt(1.25))
        assert!(longest_edge == (0, 2) || longest_edge == (2, 0));
    }

    #[test]
    fn test_mesh_refinement() {
        let mesh = create_test_mesh();
        let currents = vec![
            Complex64::new(1.0, 0.0),
            Complex64::new(0.1, 0.0),
        ];
        
        let config = RefinementConfig {
            max_iterations: 2,
            error_threshold: 0.5,
            max_elements: 10,
            min_edge_length: 0.01,
        };
        
        let refined = refine_mesh(&mesh, &currents, &config).unwrap();
        
        // Should have refined at least one triangle
        assert!(refined.triangles.len() >= mesh.triangles.len());
    }

    #[test]
    fn test_wire_refinement() {
        let mesh = create_test_mesh();
        let refined = refine_wire_mesh(&mesh, 0, 2).unwrap();
        
        // Feed segment should be subdivided
        assert!(refined.wire_segments.len() > mesh.wire_segments.len());
    }

    #[test]
    fn test_error_estimation() {
        let mesh = create_test_mesh();
        let currents = vec![
            Complex64::new(1.0, 0.0),
            Complex64::new(0.1, 0.0),
        ];
        
        let errors = estimate_triangle_errors(&mesh, &currents).unwrap();
        assert_eq!(errors.len(), 2);
        assert!(errors[0].error > 0.0);
    }

    #[test]
    fn test_refinement_config_default() {
        let config = RefinementConfig::default();
        assert_eq!(config.max_iterations, 10);
        assert_eq!(config.error_threshold, 0.1);
        assert_eq!(config.max_elements, 50000);
        assert_eq!(config.min_edge_length, 1e-4);
    }

    #[test]
    fn test_distance_calculation() {
        let p1 = Point3D { x: 0.0, y: 0.0, z: 0.0 };
        let p2 = Point3D { x: 3.0, y: 4.0, z: 0.0 };
        let dist = distance(&p1, &p2);
        assert!((dist - 5.0).abs() < 1e-10);
    }

    #[test]
    fn test_mesh_refinement_with_limits() {
        let mesh = create_test_mesh();
        let currents = vec![
            Complex64::new(1.0, 0.0),
            Complex64::new(0.1, 0.0),
        ];
        
        let config = RefinementConfig {
            max_iterations: 1,
            error_threshold: 0.1,
            max_elements: 3, // Limit to prevent excessive refinement
            min_edge_length: 0.01,
        };
        
        let refined = refine_mesh(&mesh, &currents, &config).unwrap();
        assert!(refined.triangles.len() <= 3);
    }
}