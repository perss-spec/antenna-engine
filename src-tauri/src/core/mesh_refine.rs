use super::geometry::Point3D;
use super::types::{AntennaError, Result};
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

/// Triangle for mesh refinement (vertex indices)
#[derive(Debug, Clone)]
pub struct RefineTriangle {
    pub vertices: [usize; 3],
}

/// Wire segment for mesh refinement
#[derive(Debug, Clone)]
pub struct RefineWireSegment {
    pub start_vertex: usize,
    pub end_vertex: usize,
    pub radius: f64,
}

/// Mesh used for refinement
#[derive(Debug, Clone)]
pub struct RefineMesh {
    pub vertices: Vec<Point3D>,
    pub triangles: Vec<RefineTriangle>,
    pub wire_segments: Vec<RefineWireSegment>,
}

#[derive(Debug)]
struct TriangleError {
    triangle_index: usize,
    error: f64,
    longest_edge: (usize, usize),
}

pub fn refine_mesh(
    mesh: &RefineMesh,
    currents: &[Complex64],
    config: &RefinementConfig,
) -> Result<RefineMesh> {
    let mut refined_mesh = mesh.clone();

    for iteration in 0..config.max_iterations {
        let errors = estimate_triangle_errors(&refined_mesh, currents)?;

        let mut triangles_to_refine = errors
            .into_iter()
            .filter(|e| e.error > config.error_threshold)
            .collect::<Vec<_>>();

        if triangles_to_refine.is_empty() {
            break;
        }

        triangles_to_refine.sort_by(|a, b| b.error.partial_cmp(&a.error).unwrap());

        let potential_new_elements =
            refined_mesh.triangles.len() + triangles_to_refine.len() * 2;
        if potential_new_elements > config.max_elements {
            let max_refine = (config.max_elements - refined_mesh.triangles.len()) / 2;
            triangles_to_refine.truncate(max_refine);
        }

        if triangles_to_refine.is_empty() {
            break;
        }

        refined_mesh = refine_triangles(refined_mesh, &triangles_to_refine, config)?;

        let _ = iteration; // suppress unused warning
    }

    Ok(refined_mesh)
}

fn estimate_triangle_errors(
    mesh: &RefineMesh,
    currents: &[Complex64],
) -> Result<Vec<TriangleError>> {
    let edge_map = build_edge_map(&mesh.triangles);
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
    mesh: &RefineMesh,
    triangle: &RefineTriangle,
    tri_idx: usize,
    currents: &[Complex64],
    edge_map: &HashMap<(usize, usize), Vec<usize>>,
) -> Result<f64> {
    if tri_idx >= currents.len() {
        return Ok(0.0);
    }

    let current_tri = currents[tri_idx];
    let mut max_discontinuity: f64 = 0.0;

    let v = triangle.vertices;
    let edges = [(v[0], v[1]), (v[1], v[2]), (v[2], v[0])];

    for edge in &edges {
        let normalized_edge = if edge.0 < edge.1 {
            *edge
        } else {
            (edge.1, edge.0)
        };

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

    let area = calculate_triangle_area(mesh, triangle);
    Ok(max_discontinuity / area.sqrt())
}

fn build_edge_map(triangles: &[RefineTriangle]) -> HashMap<(usize, usize), Vec<usize>> {
    let mut edge_map: HashMap<(usize, usize), Vec<usize>> = HashMap::new();

    for (tri_idx, triangle) in triangles.iter().enumerate() {
        let v = triangle.vertices;
        let edges = [(v[0], v[1]), (v[1], v[2]), (v[2], v[0])];

        for edge in &edges {
            let normalized_edge = if edge.0 < edge.1 {
                *edge
            } else {
                (edge.1, edge.0)
            };
            edge_map.entry(normalized_edge).or_default().push(tri_idx);
        }
    }

    edge_map
}

fn find_longest_edge(mesh: &RefineMesh, triangle: &RefineTriangle) -> (usize, usize) {
    let v = triangle.vertices;
    let v0 = &mesh.vertices[v[0]];
    let v1 = &mesh.vertices[v[1]];
    let v2 = &mesh.vertices[v[2]];

    let edge01_len = pt_distance(v0, v1);
    let edge12_len = pt_distance(v1, v2);
    let edge20_len = pt_distance(v2, v0);

    if edge01_len >= edge12_len && edge01_len >= edge20_len {
        (v[0], v[1])
    } else if edge12_len > edge20_len {
        (v[1], v[2])
    } else {
        (v[2], v[0])
    }
}

fn calculate_triangle_area(mesh: &RefineMesh, triangle: &RefineTriangle) -> f64 {
    let v = triangle.vertices;
    let v0 = &mesh.vertices[v[0]];
    let v1 = &mesh.vertices[v[1]];
    let v2 = &mesh.vertices[v[2]];

    let edge1 = v1.sub(v0);
    let edge2 = v2.sub(v0);
    let cross = edge1.cross(&edge2);

    0.5 * cross.magnitude()
}

fn pt_distance(p1: &Point3D, p2: &Point3D) -> f64 {
    p1.distance(p2)
}

fn refine_triangles(
    mut mesh: RefineMesh,
    triangles_to_refine: &[TriangleError],
    config: &RefinementConfig,
) -> Result<RefineMesh> {
    let mut edge_midpoints: HashMap<(usize, usize), usize> = HashMap::new();
    let mut new_triangles = Vec::new();
    let mut refined_indices = HashSet::new();

    for triangle_error in triangles_to_refine {
        let tri_idx = triangle_error.triangle_index;
        let triangle = mesh.triangles[tri_idx].clone();
        let longest_edge = triangle_error.longest_edge;

        let p1 = mesh.vertices[longest_edge.0];
        let p2 = mesh.vertices[longest_edge.1];
        let edge_length = pt_distance(&p1, &p2);

        if edge_length < config.min_edge_length {
            continue;
        }

        refined_indices.insert(tri_idx);

        let normalized_edge = if longest_edge.0 < longest_edge.1 {
            longest_edge
        } else {
            (longest_edge.1, longest_edge.0)
        };

        let mid = Point3D {
            x: (p1.x + p2.x) / 2.0,
            y: (p1.y + p2.y) / 2.0,
            z: (p1.z + p2.z) / 2.0,
        };

        let midpoint_idx = *edge_midpoints.entry(normalized_edge).or_insert_with(|| {
            mesh.vertices.push(mid);
            mesh.vertices.len() - 1
        });

        let [va, vb, vc] = triangle.vertices;

        let (new_tri1, new_tri2) = if longest_edge == (va, vb) || longest_edge == (vb, va) {
            (
                RefineTriangle { vertices: [va, midpoint_idx, vc] },
                RefineTriangle { vertices: [midpoint_idx, vb, vc] },
            )
        } else if longest_edge == (vb, vc) || longest_edge == (vc, vb) {
            (
                RefineTriangle { vertices: [va, vb, midpoint_idx] },
                RefineTriangle { vertices: [va, midpoint_idx, vc] },
            )
        } else {
            (
                RefineTriangle { vertices: [va, vb, midpoint_idx] },
                RefineTriangle { vertices: [midpoint_idx, vb, vc] },
            )
        };

        new_triangles.push(new_tri1);
        new_triangles.push(new_tri2);
    }

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

pub fn refine_wire_mesh(
    mesh: &RefineMesh,
    feed_segment: usize,
    refinement_factor: usize,
) -> Result<RefineMesh> {
    if refinement_factor == 0 {
        return Err(AntennaError::InvalidParameter(
            "Refinement factor must be positive".to_string(),
        ));
    }

    let mut refined_mesh = mesh.clone();
    let mut new_segments = Vec::new();

    for (seg_idx, segment) in mesh.wire_segments.iter().enumerate() {
        let should_refine =
            seg_idx == feed_segment || is_near_feed_point(mesh, segment, feed_segment);

        if should_refine {
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

                new_segments.push(RefineWireSegment {
                    start_vertex: prev_vertex_idx,
                    end_vertex: new_vertex_idx,
                    radius: segment.radius,
                });

                prev_vertex_idx = new_vertex_idx;
            }

            new_segments.push(RefineWireSegment {
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

fn is_near_feed_point(
    mesh: &RefineMesh,
    segment: &RefineWireSegment,
    feed_segment: usize,
) -> bool {
    if feed_segment >= mesh.wire_segments.len() {
        return false;
    }

    let feed_seg = &mesh.wire_segments[feed_segment];
    let feed_start = &mesh.vertices[feed_seg.start_vertex];
    let feed_end = &mesh.vertices[feed_seg.end_vertex];

    let seg_start = &mesh.vertices[segment.start_vertex];
    let seg_end = &mesh.vertices[segment.end_vertex];

    let threshold = 0.1;

    let min_dist = [
        pt_distance(seg_start, feed_start),
        pt_distance(seg_start, feed_end),
        pt_distance(seg_end, feed_start),
        pt_distance(seg_end, feed_end),
    ]
    .iter()
    .fold(f64::INFINITY, |a, &b| a.min(b));

    min_dist < threshold
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_mesh() -> RefineMesh {
        let vertices = vec![
            Point3D { x: 0.0, y: 0.0, z: 0.0 },
            Point3D { x: 1.0, y: 0.0, z: 0.0 },
            Point3D { x: 0.5, y: 1.0, z: 0.0 },
            Point3D { x: 1.5, y: 1.0, z: 0.0 },
        ];

        let triangles = vec![
            RefineTriangle { vertices: [0, 1, 2] },
            RefineTriangle { vertices: [1, 3, 2] },
        ];

        let wire_segments = vec![
            RefineWireSegment { start_vertex: 0, end_vertex: 1, radius: 0.01 },
            RefineWireSegment { start_vertex: 1, end_vertex: 3, radius: 0.01 },
        ];

        RefineMesh { vertices, triangles, wire_segments }
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
        assert!(edge_map.contains_key(&(1, 2)));
        assert_eq!(edge_map[&(1, 2)].len(), 2);
    }

    #[test]
    fn test_longest_edge_finding() {
        let mesh = create_test_mesh();
        let triangle = &mesh.triangles[0];
        let longest_edge = find_longest_edge(&mesh, triangle);
        assert!(longest_edge == (0, 2) || longest_edge == (2, 0));
    }

    #[test]
    fn test_mesh_refinement() {
        let mesh = create_test_mesh();
        let currents = vec![Complex64::new(1.0, 0.0), Complex64::new(0.1, 0.0)];

        let config = RefinementConfig {
            max_iterations: 2,
            error_threshold: 0.5,
            max_elements: 10,
            min_edge_length: 0.01,
        };

        let refined = refine_mesh(&mesh, &currents, &config).unwrap();
        assert!(refined.triangles.len() >= mesh.triangles.len());
    }

    #[test]
    fn test_wire_refinement() {
        let mesh = create_test_mesh();
        let refined = refine_wire_mesh(&mesh, 0, 2).unwrap();
        assert!(refined.wire_segments.len() > mesh.wire_segments.len());
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
        let dist = pt_distance(&p1, &p2);
        assert!((dist - 5.0).abs() < 1e-10);
    }
}
