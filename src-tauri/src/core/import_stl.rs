use crate::core::types::{AntennaError, Result, Point3D, Triangle, Mesh};
use std::collections::HashMap;
use std::path::Path;

/// Parse STL data from bytes, supporting both ASCII and binary formats
pub fn parse_stl(data: &[u8]) -> Result<Mesh> {
    if data.len() < 80 {
        return Err(AntennaError::ImportError("STL file too small".to_string()));
    }

    // Check if it's ASCII by looking for "solid" at the beginning (after trimming whitespace)
    let is_ascii = data.starts_with(b"solid") && 
                   data.iter().take(1024).all(|&b| b.is_ascii());

    if is_ascii {
        parse_ascii_stl(data)
    } else {
        parse_binary_stl(data)
    }
}

/// Parse STL file from filesystem path
pub fn parse_stl_file(path: &Path) -> Result<Mesh> {
    let data = std::fs::read(path)
        .map_err(|e| AntennaError::ImportError(format!("Failed to read STL file: {}", e)))?;
    parse_stl(&data)
}

fn parse_ascii_stl(data: &[u8]) -> Result<Mesh> {
    let content = std::str::from_utf8(data)
        .map_err(|e| AntennaError::ImportError(format!("Invalid UTF-8 in ASCII STL: {}", e)))?;

    let mut triangles = Vec::new();
    let mut vertices = Vec::new();
    let mut vertex_map: HashMap<[u64; 3], usize> = HashMap::new();

    let lines: Vec<&str> = content.lines().collect();
    let mut i = 0;

    // Skip "solid" line
    while i < lines.len() && !lines[i].trim().starts_with("facet normal") {
        i += 1;
    }

    while i < lines.len() {
        let line = lines[i].trim();
        
        if line.starts_with("facet normal") {
            // Parse normal (we'll ignore it and calculate our own)
            i += 1;
            
            // Expect "outer loop"
            if i >= lines.len() || !lines[i].trim().starts_with("outer loop") {
                return Err(AntennaError::ImportError("Expected 'outer loop' after facet normal".to_string()));
            }
            i += 1;

            // Parse three vertices
            let mut triangle_vertices = [0usize; 3];
            for j in 0..3 {
                if i >= lines.len() || !lines[i].trim().starts_with("vertex") {
                    return Err(AntennaError::ImportError("Expected vertex in triangle".to_string()));
                }
                
                let vertex_line = lines[i].trim();
                let parts: Vec<&str> = vertex_line.split_whitespace().collect();
                if parts.len() != 4 || parts[0] != "vertex" {
                    return Err(AntennaError::ImportError("Invalid vertex format".to_string()));
                }

                let x = parts[1].parse::<f64>()
                    .map_err(|e| AntennaError::ImportError(format!("Invalid vertex coordinate: {}", e)))?;
                let y = parts[2].parse::<f64>()
                    .map_err(|e| AntennaError::ImportError(format!("Invalid vertex coordinate: {}", e)))?;
                let z = parts[3].parse::<f64>()
                    .map_err(|e| AntennaError::ImportError(format!("Invalid vertex coordinate: {}", e)))?;

                let vertex = Point3D { x, y, z };
                let vertex_index = get_or_insert_vertex(vertex, &mut vertices, &mut vertex_map);
                triangle_vertices[j] = vertex_index;
                
                i += 1;
            }

            // Expect "endloop"
            if i >= lines.len() || !lines[i].trim().starts_with("endloop") {
                return Err(AntennaError::ImportError("Expected 'endloop' after vertices".to_string()));
            }
            i += 1;

            // Expect "endfacet"
            if i >= lines.len() || !lines[i].trim().starts_with("endfacet") {
                return Err(AntennaError::ImportError("Expected 'endfacet' after endloop".to_string()));
            }
            i += 1;

            // Create triangle
            let triangle = Triangle {
                vertices: triangle_vertices,
                normal: None, // Will be calculated later if needed
            };
            triangles.push(triangle);
        } else if line.starts_with("endsolid") {
            break;
        } else {
            i += 1;
        }
    }

    Ok(Mesh {
        vertices,
        triangles,
        edges: Vec::new(), // STL doesn't contain edge information
        materials: Vec::new(),
        groups: Vec::new(),
    })
}

fn parse_binary_stl(data: &[u8]) -> Result<Mesh> {
    if data.len() < 84 {
        return Err(AntennaError::ImportError("Binary STL file too small".to_string()));
    }

    // Skip 80-byte header
    let triangle_count = u32::from_le_bytes([data[80], data[81], data[82], data[83]]) as usize;
    
    let expected_size = 84 + triangle_count * 50; // 50 bytes per triangle
    if data.len() < expected_size {
        return Err(AntennaError::ImportError("Binary STL file truncated".to_string()));
    }

    let mut triangles = Vec::with_capacity(triangle_count);
    let mut vertices = Vec::new();
    let mut vertex_map: HashMap<[u64; 3], usize> = HashMap::new();

    let mut offset = 84;
    for _ in 0..triangle_count {
        if offset + 50 > data.len() {
            return Err(AntennaError::ImportError("Unexpected end of binary STL data".to_string()));
        }

        // Skip normal vector (12 bytes)
        offset += 12;

        // Read three vertices
        let mut triangle_vertices = [0usize; 3];
        for j in 0..3 {
            let x = f32::from_le_bytes([data[offset], data[offset + 1], data[offset + 2], data[offset + 3]]) as f64;
            let y = f32::from_le_bytes([data[offset + 4], data[offset + 5], data[offset + 6], data[offset + 7]]) as f64;
            let z = f32::from_le_bytes([data[offset + 8], data[offset + 9], data[offset + 10], data[offset + 11]]) as f64;
            
            let vertex = Point3D { x, y, z };
            let vertex_index = get_or_insert_vertex(vertex, &mut vertices, &mut vertex_map);
            triangle_vertices[j] = vertex_index;
            
            offset += 12;
        }

        // Skip attribute byte count (2 bytes)
        offset += 2;

        let triangle = Triangle {
            vertices: triangle_vertices,
            normal: None,
        };
        triangles.push(triangle);
    }

    Ok(Mesh {
        vertices,
        triangles,
        edges: Vec::new(),
        materials: Vec::new(),
        groups: Vec::new(),
    })
}

fn get_or_insert_vertex(
    vertex: Point3D,
    vertices: &mut Vec<Point3D>,
    vertex_map: &mut HashMap<[u64; 3], usize>
) -> usize {
    // Create a hash key for the vertex with tolerance
    let hash_key = [
        (vertex.x * 1e9).round() as i64 as u64,
        (vertex.y * 1e9).round() as i64 as u64,
        (vertex.z * 1e9).round() as i64 as u64,
    ];

    if let Some(&index) = vertex_map.get(&hash_key) {
        // Check if vertices are actually close enough
        let existing = &vertices[index];
        let dx = vertex.x - existing.x;
        let dy = vertex.y - existing.y;
        let dz = vertex.z - existing.z;
        let distance_sq = dx * dx + dy * dy + dz * dz;
        
        if distance_sq < 1e-18 { // 1e-9 squared
            return index;
        }
    }

    // Add new vertex
    let index = vertices.len();
    vertices.push(vertex);
    vertex_map.insert(hash_key, index);
    index
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_ascii_stl() {
        let stl_data = b"solid test
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
endsolid test";

        let mesh = parse_stl(stl_data).expect("Failed to parse ASCII STL");
        
        assert_eq!(mesh.triangles.len(), 2);
        assert_eq!(mesh.vertices.len(), 5); // Should deduplicate shared vertices
        
        // Check that vertices are correct
        assert_eq!(mesh.vertices[0], Point3D { x: 0.0, y: 0.0, z: 0.0 });
        assert_eq!(mesh.vertices[1], Point3D { x: 1.0, y: 0.0, z: 0.0 });
        assert_eq!(mesh.vertices[2], Point3D { x: 0.5, y: 1.0, z: 0.0 });
        assert_eq!(mesh.vertices[3], Point3D { x: 1.0, y: 1.0, z: 0.0 });
    }

    #[test]
    fn test_parse_binary_stl() {
        // Create a simple binary STL with one triangle
        let mut data = vec![0u8; 84]; // 80-byte header + 4-byte triangle count
        
        // Set triangle count to 1
        data[80..84].copy_from_slice(&1u32.to_le_bytes());
        
        // Add one triangle (50 bytes)
        let mut triangle_data = Vec::new();
        
        // Normal vector (0, 0, 1)
        triangle_data.extend_from_slice(&0.0f32.to_le_bytes());
        triangle_data.extend_from_slice(&0.0f32.to_le_bytes());
        triangle_data.extend_from_slice(&1.0f32.to_le_bytes());
        
        // Vertex 1: (0, 0, 0)
        triangle_data.extend_from_slice(&0.0f32.to_le_bytes());
        triangle_data.extend_from_slice(&0.0f32.to_le_bytes());
        triangle_data.extend_from_slice(&0.0f32.to_le_bytes());
        
        // Vertex 2: (1, 0, 0)
        triangle_data.extend_from_slice(&1.0f32.to_le_bytes());
        triangle_data.extend_from_slice(&0.0f32.to_le_bytes());
        triangle_data.extend_from_slice(&0.0f32.to_le_bytes());
        
        // Vertex 3: (0.5, 1, 0)
        triangle_data.extend_from_slice(&0.5f32.to_le_bytes());
        triangle_data.extend_from_slice(&1.0f32.to_le_bytes());
        triangle_data.extend_from_slice(&0.0f32.to_le_bytes());
        
        // Attribute byte count (2 bytes, set to 0)
        triangle_data.extend_from_slice(&0u16.to_le_bytes());
        
        data.extend_from_slice(&triangle_data);
        
        let mesh = parse_stl(&data).expect("Failed to parse binary STL");
        
        assert_eq!(mesh.triangles.len(), 1);
        assert_eq!(mesh.vertices.len(), 3);
        
        // Check vertices
        assert_eq!(mesh.vertices[0], Point3D { x: 0.0, y: 0.0, z: 0.0 });
        assert_eq!(mesh.vertices[1], Point3D { x: 1.0, y: 0.0, z: 0.0 });
        assert_eq!(mesh.vertices[2], Point3D { x: 0.5, y: 1.0, z: 0.0 });
    }

    #[test]
    fn test_vertex_deduplication() {
        let stl_data = b"solid test
facet normal 0.0 0.0 1.0
  outer loop
    vertex 0.0 0.0 0.0
    vertex 1.0 0.0 0.0
    vertex 0.0 1.0 0.0
  endloop
endfacet
facet normal 0.0 0.0 1.0
  outer loop
    vertex 0.0 0.0 0.0
    vertex 1.0 0.0 0.0
    vertex 1.0 1.0 0.0
  endloop
endfacet
endsolid test";

        let mesh = parse_stl(stl_data).expect("Failed to parse STL");
        
        assert_eq!(mesh.triangles.len(), 2);
        assert_eq!(mesh.vertices.len(), 4); // (0,0,0), (1,0,0), (0,1,0), (1,1,0)
        
        // Check that the first two vertices of both triangles reference the same deduplicated vertices
        assert_eq!(mesh.triangles[0].vertices[0], mesh.triangles[1].vertices[0]); // (0,0,0)
        assert_eq!(mesh.triangles[0].vertices[1], mesh.triangles[1].vertices[1]); // (1,0,0)
    }

    #[test]
    fn test_invalid_stl() {
        let invalid_data = b"invalid stl data";
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