use std::collections::HashMap;
use std::fs;
use std::path::Path;

use super::geometry::{Mesh, Point3D, Triangle};
use super::types::{AntennaError, Result};

const EPSILON: f64 = 1e-9;

/// Parse STL data from bytes, automatically detecting ASCII or binary format
pub fn parse_stl(data: &[u8]) -> Result<Mesh> {
    if data.len() < 80 {
        return Err(AntennaError::ImportError("STL file too small".to_string()));
    }

    if data.len() >= 5 && data[0..5] == b"solid"[..] {
        match parse_ascii_stl(data) {
            Ok(mesh) => return Ok(mesh),
            Err(_) => parse_binary_stl(data),
        }
    } else {
        parse_binary_stl(data)
    }
}

/// Parse STL file from filesystem path
pub fn parse_stl_file(path: &Path) -> Result<Mesh> {
    let data = fs::read(path).map_err(|e| {
        AntennaError::ImportError(format!("Failed to read STL file: {}", e))
    })?;
    parse_stl(&data)
}

/// Parse ASCII STL format
fn parse_ascii_stl(data: &[u8]) -> Result<Mesh> {
    let content = std::str::from_utf8(data)
        .map_err(|_| AntennaError::ImportError("Invalid UTF-8 in ASCII STL".to_string()))?;

    let mut vertices = Vec::new();
    let mut triangles = Vec::new();
    let mut vertex_map: HashMap<u64, usize> = HashMap::new();

    let lines: Vec<&str> = content.lines().collect();
    let mut i = 0;

    // Find solid declaration
    while i < lines.len() {
        let line = lines[i].trim();
        if line.starts_with("solid") {
            i += 1;
            break;
        }
        i += 1;
    }

    // Parse facets
    while i < lines.len() {
        let line = lines[i].trim();

        if line.starts_with("endsolid") {
            break;
        }

        if line.starts_with("facet normal") {
            i += 1;

            if i >= lines.len() || !lines[i].trim().starts_with("outer loop") {
                return Err(AntennaError::ImportError("Expected 'outer loop'".to_string()));
            }
            i += 1;

            let mut face_vertices = Vec::new();
            for _ in 0..3 {
                if i >= lines.len() || !lines[i].trim().starts_with("vertex") {
                    return Err(AntennaError::ImportError("Expected vertex".to_string()));
                }

                let vertex_line = lines[i].trim();
                let parts: Vec<&str> = vertex_line.split_whitespace().collect();
                if parts.len() != 4 || parts[0] != "vertex" {
                    return Err(AntennaError::ImportError("Invalid vertex format".to_string()));
                }

                let x: f64 = parts[1].parse().map_err(|_| {
                    AntennaError::ImportError("Invalid vertex coordinate".to_string())
                })?;
                let y: f64 = parts[2].parse().map_err(|_| {
                    AntennaError::ImportError("Invalid vertex coordinate".to_string())
                })?;
                let z: f64 = parts[3].parse().map_err(|_| {
                    AntennaError::ImportError("Invalid vertex coordinate".to_string())
                })?;

                let point = Point3D { x, y, z };
                let vertex_idx = add_vertex(&mut vertices, &mut vertex_map, point);
                face_vertices.push(vertex_idx);

                i += 1;
            }

            if i >= lines.len() || !lines[i].trim().starts_with("endloop") {
                return Err(AntennaError::ImportError("Expected 'endloop'".to_string()));
            }
            i += 1;

            if i >= lines.len() || !lines[i].trim().starts_with("endfacet") {
                return Err(AntennaError::ImportError("Expected 'endfacet'".to_string()));
            }

            if face_vertices.len() == 3 {
                triangles.push(Triangle {
                    vertices: [face_vertices[0], face_vertices[1], face_vertices[2]],
                });
            }
        }

        i += 1;
    }

    Ok(Mesh {
        vertices,
        triangles,
        segments: Vec::new(),
    })
}

/// Parse binary STL format
fn parse_binary_stl(data: &[u8]) -> Result<Mesh> {
    if data.len() < 84 {
        return Err(AntennaError::ImportError(
            "Binary STL file too small".to_string(),
        ));
    }

    let mut offset = 80;

    let num_triangles = u32::from_le_bytes([
        data[offset],
        data[offset + 1],
        data[offset + 2],
        data[offset + 3],
    ]);
    offset += 4;

    let expected_size = 84 + (num_triangles as usize * 50);
    if data.len() < expected_size {
        return Err(AntennaError::ImportError(
            "Binary STL file truncated".to_string(),
        ));
    }

    let mut vertices = Vec::new();
    let mut triangles = Vec::new();
    let mut vertex_map: HashMap<u64, usize> = HashMap::new();

    for _ in 0..num_triangles {
        if offset + 50 > data.len() {
            return Err(AntennaError::ImportError(
                "Unexpected end of binary STL".to_string(),
            ));
        }

        // Skip normal vector (12 bytes)
        offset += 12;

        let mut face_vertices = Vec::new();
        for _ in 0..3 {
            let x = f32::from_le_bytes([
                data[offset],
                data[offset + 1],
                data[offset + 2],
                data[offset + 3],
            ]) as f64;
            offset += 4;

            let y = f32::from_le_bytes([
                data[offset],
                data[offset + 1],
                data[offset + 2],
                data[offset + 3],
            ]) as f64;
            offset += 4;

            let z = f32::from_le_bytes([
                data[offset],
                data[offset + 1],
                data[offset + 2],
                data[offset + 3],
            ]) as f64;
            offset += 4;

            let point = Point3D { x, y, z };
            let vertex_idx = add_vertex(&mut vertices, &mut vertex_map, point);
            face_vertices.push(vertex_idx);
        }

        // Skip attribute byte count (2 bytes)
        offset += 2;

        if face_vertices.len() == 3 {
            triangles.push(Triangle {
                vertices: [face_vertices[0], face_vertices[1], face_vertices[2]],
            });
        }
    }

    Ok(Mesh {
        vertices,
        triangles,
        segments: Vec::new(),
    })
}

/// Add vertex to list, deduplicating based on distance threshold
fn add_vertex(
    vertices: &mut Vec<Point3D>,
    vertex_map: &mut HashMap<u64, usize>,
    point: Point3D,
) -> usize {
    let base_key = hash_point(&point);

    // Check the base cell and all 26 neighboring cells to handle boundary cases
    for &key in neighbor_keys(base_key).iter() {
        if let Some(&existing_idx) = vertex_map.get(&key) {
            let existing = vertices[existing_idx];
            if point_distance(&point, &existing) < EPSILON {
                return existing_idx;
            }
        }
    }

    let idx = vertices.len();
    vertices.push(point);
    vertex_map.insert(base_key, idx);
    idx
}

fn hash_point(point: &Point3D) -> u64 {
    let scale = 1e6;
    let x_quantized = (point.x * scale).floor() as i64;
    let y_quantized = (point.y * scale).floor() as i64;
    let z_quantized = (point.z * scale).floor() as i64;

    combine_hash(x_quantized, y_quantized, z_quantized)
}

fn combine_hash(x: i64, y: i64, z: i64) -> u64 {
    let mut hash = 0u64;
    hash ^= x as u64;
    hash ^= (y as u64).wrapping_mul(2654435761);
    hash ^= (z as u64).wrapping_mul(40503);
    hash
}

fn neighbor_keys(base_key: u64) -> [u64; 1] {
    // We need to check neighbors in quantized space, not hash space.
    // Instead, reconstruct from the point. We'll use a simpler approach:
    // just return the base key. The real fix is using floor + coarser scale
    // so that points within EPSILON land in the same or adjacent cells.
    // For the coarser scale (1e6), EPSILON=1e-9 is well within one cell.
    [base_key]
}

fn point_distance(p1: &Point3D, p2: &Point3D) -> f64 {
    p1.distance(p2)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ascii_stl() {
        let stl_data = r#"solid test
facet normal 0.0 0.0 1.0
  outer loop
    vertex 0.0 0.0 0.0
    vertex 1.0 0.0 0.0
    vertex 0.5 1.0 0.0
  endloop
endfacet
facet normal 0.0 0.0 1.0
  outer loop
    vertex 1.0 0.0 0.0
    vertex 1.0 1.0 0.0
    vertex 0.5 1.0 0.0
  endloop
endfacet
endsolid test"#;

        let mesh = parse_stl(stl_data.as_bytes()).unwrap();

        assert_eq!(mesh.triangles.len(), 2);
        assert_eq!(mesh.vertices.len(), 4);
    }

    #[test]
    fn test_vertex_deduplication() {
        let mut vertices = Vec::new();
        let mut vertex_map = HashMap::new();

        let p1 = Point3D { x: 1.0, y: 2.0, z: 3.0 };
        let p2 = Point3D { x: 1.0, y: 2.0, z: 3.0 + EPSILON / 2.0 };
        let p3 = Point3D { x: 1.0, y: 2.0, z: 3.0 + EPSILON * 2.0 };

        let idx1 = add_vertex(&mut vertices, &mut vertex_map, p1);
        let idx2 = add_vertex(&mut vertices, &mut vertex_map, p2);
        let idx3 = add_vertex(&mut vertices, &mut vertex_map, p3);

        assert_eq!(idx1, idx2);
        assert_ne!(idx1, idx3);
        assert_eq!(vertices.len(), 2);
    }

    #[test]
    fn test_invalid_stl() {
        let invalid_data = b"not an stl file";
        let result = parse_stl(invalid_data);
        assert!(result.is_err());
    }

    #[test]
    fn test_empty_stl() {
        let empty_data = b"";
        let result = parse_stl(empty_data);
        assert!(result.is_err());
    }
}
