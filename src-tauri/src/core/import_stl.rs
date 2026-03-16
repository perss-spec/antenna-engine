use std::collections::HashMap;
use std::fs;
use std::path::Path;

use crate::core::geometry::{Mesh, Point3D, Triangle, Vector3D};
use crate::core::types::{AntennaError, Result};

const EPSILON: f64 = 1e-9;

/// Parse STL data from bytes, automatically detecting ASCII or binary format
pub fn parse_stl(data: &[u8]) -> Result<Mesh> {
    if data.len() < 80 {
        return Err(AntennaError::ImportError("STL file too small".to_string()));
    }

    // Try to detect if it's ASCII by checking for "solid" keyword at start
    if data.len() >= 5 && data[0..5] == b"solid"[..] {
        // Could be ASCII, but binary files can also start with "solid"
        // Try ASCII first, fallback to binary if parsing fails
        match parse_ascii_stl(data) {
            Ok(mesh) => return Ok(mesh),
            Err(_) => {
                // ASCII parsing failed, try binary
                parse_binary_stl(data)
            }
        }
    } else {
        // Definitely binary
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
            // Parse normal vector (we'll calculate it ourselves)
            i += 1;
            
            // Expect "outer loop"
            if i >= lines.len() || !lines[i].trim().starts_with("outer loop") {
                return Err(AntennaError::ImportError("Expected 'outer loop'".to_string()));
            }
            i += 1;
            
            // Parse three vertices
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
                
                let x: f64 = parts[1].parse()
                    .map_err(|_| AntennaError::ImportError("Invalid vertex coordinate".to_string()))?;
                let y: f64 = parts[2].parse()
                    .map_err(|_| AntennaError::ImportError("Invalid vertex coordinate".to_string()))?;
                let z: f64 = parts[3].parse()
                    .map_err(|_| AntennaError::ImportError("Invalid vertex coordinate".to_string()))?;
                
                let point = Point3D { x, y, z };
                let vertex_idx = add_vertex(&mut vertices, &mut vertex_map, point);
                face_vertices.push(vertex_idx);
                
                i += 1;
            }
            
            // Expect "endloop"
            if i >= lines.len() || !lines[i].trim().starts_with("endloop") {
                return Err(AntennaError::ImportError("Expected 'endloop'".to_string()));
            }
            i += 1;
            
            // Expect "endfacet"
            if i >= lines.len() || !lines[i].trim().starts_with("endfacet") {
                return Err(AntennaError::ImportError("Expected 'endfacet'".to_string()));
            }
            
            // Create triangle
            if face_vertices.len() == 3 {
                let p1 = vertices[face_vertices[0]];
                let p2 = vertices[face_vertices[1]];
                let p3 = vertices[face_vertices[2]];
                
                // Calculate normal
                let v1 = Vector3D {
                    x: p2.x - p1.x,
                    y: p2.y - p1.y,
                    z: p2.z - p1.z,
                };
                let v2 = Vector3D {
                    x: p3.x - p1.x,
                    y: p3.y - p1.y,
                    z: p3.z - p1.z,
                };
                let normal = cross_product(&v1, &v2).normalize();
                
                triangles.push(Triangle {
                    vertices: [face_vertices[0], face_vertices[1], face_vertices[2]],
                    normal,
                });
            }
        }
        
        i += 1;
    }

    Ok(Mesh {
        vertices,
        triangles,
        edges: Vec::new(),
    })
}

/// Parse binary STL format
fn parse_binary_stl(data: &[u8]) -> Result<Mesh> {
    if data.len() < 84 {
        return Err(AntennaError::ImportError("Binary STL file too small".to_string()));
    }

    // Skip 80-byte header
    let mut offset = 80;
    
    // Read number of triangles (4 bytes, little endian)
    let num_triangles = u32::from_le_bytes([
        data[offset], data[offset + 1], data[offset + 2], data[offset + 3]
    ]);
    offset += 4;

    let expected_size = 84 + (num_triangles as usize * 50);
    if data.len() < expected_size {
        return Err(AntennaError::ImportError("Binary STL file truncated".to_string()));
    }

    let mut vertices = Vec::new();
    let mut triangles = Vec::new();
    let mut vertex_map: HashMap<u64, usize> = HashMap::new();

    for _ in 0..num_triangles {
        if offset + 50 > data.len() {
            return Err(AntennaError::ImportError("Unexpected end of binary STL".to_string()));
        }

        // Skip normal vector (12 bytes) - we'll calculate it ourselves
        offset += 12;

        // Read three vertices (36 bytes total)
        let mut face_vertices = Vec::new();
        for _ in 0..3 {
            let x = f32::from_le_bytes([
                data[offset], data[offset + 1], data[offset + 2], data[offset + 3]
            ]) as f64;
            offset += 4;
            
            let y = f32::from_le_bytes([
                data[offset], data[offset + 1], data[offset + 2], data[offset + 3]
            ]) as f64;
            offset += 4;
            
            let z = f32::from_le_bytes([
                data[offset], data[offset + 1], data[offset + 2], data[offset + 3]
            ]) as f64;
            offset += 4;

            let point = Point3D { x, y, z };
            let vertex_idx = add_vertex(&mut vertices, &mut vertex_map, point);
            face_vertices.push(vertex_idx);
        }

        // Skip attribute byte count (2 bytes)
        offset += 2;

        // Create triangle
        if face_vertices.len() == 3 {
            let p1 = vertices[face_vertices[0]];
            let p2 = vertices[face_vertices[1]];
            let p3 = vertices[face_vertices[2]];
            
            // Calculate normal
            let v1 = Vector3D {
                x: p2.x - p1.x,
                y: p2.y - p1.y,
                z: p2.z - p1.z,
            };
            let v2 = Vector3D {
                x: p3.x - p1.x,
                y: p3.y - p1.y,
                z: p3.z - p1.z,
            };
            let normal = cross_product(&v1, &v2).normalize();
            
            triangles.push(Triangle {
                vertices: [face_vertices[0], face_vertices[1], face_vertices[2]],
                normal,
            });
        }
    }

    Ok(Mesh {
        vertices,
        triangles,
        edges: Vec::new(),
    })
}

/// Add vertex to list, deduplicating based on distance threshold
fn add_vertex(
    vertices: &mut Vec<Point3D>,
    vertex_map: &mut HashMap<u64, usize>,
    point: Point3D,
) -> usize {
    // Create a hash key based on quantized coordinates
    let hash_key = hash_point(&point);
    
    // Check if we've seen this vertex before
    if let Some(&existing_idx) = vertex_map.get(&hash_key) {
        let existing = vertices[existing_idx];
        if point_distance(&point, &existing) < EPSILON {
            return existing_idx;
        }
    }
    
    // Add new vertex
    let idx = vertices.len();
    vertices.push(point);
    vertex_map.insert(hash_key, idx);
    idx
}

/// Create a hash key for a point by quantizing coordinates
fn hash_point(point: &Point3D) -> u64 {
    let scale = 1e9;
    let x_quantized = (point.x * scale).round() as i64;
    let y_quantized = (point.y * scale).round() as i64;
    let z_quantized = (point.z * scale).round() as i64;
    
    // Simple hash combination
    let mut hash = 0u64;
    hash ^= x_quantized as u64;
    hash ^= (y_quantized as u64).wrapping_shl(21).wrapping_shr(21);
    hash ^= (z_quantized as u64).wrapping_shl(42).wrapping_shr(42);
    hash
}

/// Calculate distance between two points
fn point_distance(p1: &Point3D, p2: &Point3D) -> f64 {
    let dx = p1.x - p2.x;
    let dy = p1.y - p2.y;
    let dz = p1.z - p2.z;
    (dx * dx + dy * dy + dz * dz).sqrt()
}

/// Calculate cross product of two vectors
fn cross_product(v1: &Vector3D, v2: &Vector3D) -> Vector3D {
    Vector3D {
        x: v1.y * v2.z - v1.z * v2.y,
        y: v1.z * v2.x - v1.x * v2.z,
        z: v1.x * v2.y - v1.y * v2.x,
    }
}

impl Vector3D {
    /// Normalize the vector to unit length
    fn normalize(self) -> Self {
        let length = (self.x * self.x + self.y * self.y + self.z * self.z).sqrt();
        if length > 0.0 {
            Vector3D {
                x: self.x / length,
                y: self.y / length,
                z: self.z / length,
            }
        } else {
            Vector3D { x: 0.0, y: 0.0, z: 1.0 }
        }
    }
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
        assert_eq!(mesh.vertices.len(), 4); // Should deduplicate shared vertices
        
        // Check that vertices are properly deduplicated
        let vertex_0_5_1_0 = Point3D { x: 0.5, y: 1.0, z: 0.0 };
        let vertex_1_0_0_0 = Point3D { x: 1.0, y: 0.0, z: 0.0 };
        
        assert!(mesh.vertices.iter().any(|v| point_distance(v, &vertex_0_5_1_0) < EPSILON));
        assert!(mesh.vertices.iter().any(|v| point_distance(v, &vertex_1_0_0_0) < EPSILON));
    }

    #[test]
    fn test_vertex_deduplication() {
        let mut vertices = Vec::new();
        let mut vertex_map = HashMap::new();
        
        let p1 = Point3D { x: 1.0, y: 2.0, z: 3.0 };
        let p2 = Point3D { x: 1.0, y: 2.0, z: 3.0 + EPSILON / 2.0 }; // Within threshold
        let p3 = Point3D { x: 1.0, y: 2.0, z: 3.0 + EPSILON * 2.0 }; // Outside threshold
        
        let idx1 = add_vertex(&mut vertices, &mut vertex_map, p1);
        let idx2 = add_vertex(&mut vertices, &mut vertex_map, p2);
        let idx3 = add_vertex(&mut vertices, &mut vertex_map, p3);
        
        assert_eq!(idx1, idx2); // Should be deduplicated
        assert_ne!(idx1, idx3); // Should be different
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

    #[test]
    fn test_cross_product() {
        let v1 = Vector3D { x: 1.0, y: 0.0, z: 0.0 };
        let v2 = Vector3D { x: 0.0, y: 1.0, z: 0.0 };
        let cross = cross_product(&v1, &v2);
        
        assert!((cross.x - 0.0).abs() < EPSILON);
        assert!((cross.y - 0.0).abs() < EPSILON);
        assert!((cross.z - 1.0).abs() < EPSILON);
    }

    #[test]
    fn test_vector_normalize() {
        let v = Vector3D { x: 3.0, y: 4.0, z: 0.0 };
        let normalized = v.normalize();
        
        let length = (normalized.x * normalized.x + normalized.y * normalized.y + normalized.z * normalized.z).sqrt();
        assert!((length - 1.0).abs() < EPSILON);
    }
}