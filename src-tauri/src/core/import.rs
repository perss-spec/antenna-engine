use std::path::Path;
use std::fs;
use anyhow::{Result, anyhow, Context};
use serde::{Serialize, Deserialize};

use crate::core::geometry::{Mesh, Vertex, Face};
use super::parsers::{stl, nec, nastran};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub enum ImportFormat {
    Stl,
    Nec,
    Nastran,
    Step,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportMetadata {
    pub filename: String,
    pub file_size: u64,
    pub vertex_count: usize,
    pub face_count: usize,
    pub bounds: Option<BoundingBox>,
    pub units: Option<String>,
    pub source_info: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BoundingBox {
    pub min: [f32; 3],
    pub max: [f32; 3],
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ImportedModel {
    pub mesh: Mesh,
    pub format: ImportFormat,
    pub metadata: ImportMetadata,
}

/// Detect file format based on file extension and content analysis
pub fn detect_format(path: &Path) -> Result<ImportFormat> {
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase());

    match extension.as_deref() {
        Some("stl") => Ok(ImportFormat::Stl),
        Some("nec") => Ok(ImportFormat::Nec),
        Some("nas") | Some("nastran") | Some("bdf") => Ok(ImportFormat::Nastran),
        Some("step") | Some("stp") => Ok(ImportFormat::Step),
        _ => {
            // Fallback to content analysis
            detect_format_by_content(path)
        }
    }
}

/// Detect format by analyzing file content
fn detect_format_by_content(path: &Path) -> Result<ImportFormat> {
    let content = fs::read_to_string(path)
        .context("Failed to read file for format detection")?;
    
    let first_lines: Vec<&str> = content.lines().take(10).collect();
    
    // Check for STEP format
    if first_lines.iter().any(|line| line.starts_with("ISO-10303")) {
        return Ok(ImportFormat::Step);
    }
    
    // Check for STL format (ASCII)
    if first_lines.iter().any(|line| line.trim_start().starts_with("solid")) {
        return Ok(ImportFormat::Stl);
    }
    
    // Check for NEC format
    if first_lines.iter().any(|line| 
        line.starts_with("CM") || 
        line.starts_with("CE") ||
        line.starts_with("GW") ||
        line.starts_with("GE")
    ) {
        return Ok(ImportFormat::Nec);
    }
    
    // Check for NASTRAN format
    if first_lines.iter().any(|line|
        line.starts_with("CEND") ||
        line.starts_with("BEGIN BULK") ||
        line.starts_with("GRID") ||
        line.starts_with("CTRIA")
    ) {
        return Ok(ImportFormat::Nastran);
    }
    
    Err(anyhow!("Unable to detect file format"))
}

/// Import a file and return the loaded model
pub fn import_file(path: &Path) -> Result<ImportedModel> {
    let format = detect_format(path)?;
    
    let filename = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("unknown")
        .to_string();
    
    let file_size = fs::metadata(path)
        .map(|meta| meta.len())
        .unwrap_or(0);
    
    let mesh = match format {
        ImportFormat::Stl => {
            stl::parse_stl_file(path)?
        },
        ImportFormat::Nec => {
            nec::parse_nec_file(path)?
        },
        ImportFormat::Nastran => {
            nastran::parse_nastran_file(path)?
        },
        ImportFormat::Step => {
            parse_step_file(path)?
        },
    };
    
    let bounds = calculate_bounding_box(&mesh);
    
    let metadata = ImportMetadata {
        filename,
        file_size,
        vertex_count: mesh.vertices.len(),
        face_count: mesh.faces.len(),
        bounds: Some(bounds),
        units: detect_units(format),
        source_info: None,
    };
    
    Ok(ImportedModel {
        mesh,
        format,
        metadata,
    })
}

/// Basic STEP file parser (simplified implementation)
fn parse_step_file(path: &Path) -> Result<Mesh> {
    let content = fs::read_to_string(path)
        .context("Failed to read STEP file")?;
    
    // This is a very basic STEP parser - in production you'd use a proper STEP library
    // For now, we'll create a simple placeholder mesh
    let mut vertices = Vec::new();
    let mut faces = Vec::new();
    
    // Look for CARTESIAN_POINT entities
    for line in content.lines() {
        if line.contains("CARTESIAN_POINT") {
            if let Some(coords) = extract_coordinates(line) {
                vertices.push(Vertex {
                    position: coords,
                    normal: None,
                });
            }
        }
    }
    
    // Generate simple triangular faces if we have vertices
    if vertices.len() >= 3 {
        for i in (0..vertices.len().saturating_sub(2)).step_by(3) {
            if i + 2 < vertices.len() {
                faces.push(Face {
                    vertices: [i as u32, (i + 1) as u32, (i + 2) as u32],
                    normal: None,
                });
            }
        }
    }
    
    // If no vertices found, create a simple cube as fallback
    if vertices.is_empty() {
        vertices = create_cube_vertices();
        faces = create_cube_faces();
    }
    
    Ok(Mesh { vertices, faces })
}

/// Extract coordinates from a STEP CARTESIAN_POINT line
fn extract_coordinates(line: &str) -> Option<[f32; 3]> {
    // Very basic parsing - look for pattern like (x, y, z)
    if let Some(start) = line.find('(') {
        if let Some(end) = line.find(')') {
            let coords_str = &line[start + 1..end];
            let coords: Vec<&str> = coords_str.split(',').collect();
            
            if coords.len() >= 3 {
                if let (Ok(x), Ok(y), Ok(z)) = (
                    coords[0].trim().parse::<f32>(),
                    coords[1].trim().parse::<f32>(),
                    coords[2].trim().parse::<f32>(),
                ) {
                    return Some([x, y, z]);
                }
            }
        }
    }
    None
}

/// Create vertices for a simple cube
fn create_cube_vertices() -> Vec<Vertex> {
    vec![
        Vertex { position: [-1.0, -1.0, -1.0], normal: None },
        Vertex { position: [1.0, -1.0, -1.0], normal: None },
        Vertex { position: [1.0, 1.0, -1.0], normal: None },
        Vertex { position: [-1.0, 1.0, -1.0], normal: None },
        Vertex { position: [-1.0, -1.0, 1.0], normal: None },
        Vertex { position: [1.0, -1.0, 1.0], normal: None },
        Vertex { position: [1.0, 1.0, 1.0], normal: None },
        Vertex { position: [-1.0, 1.0, 1.0], normal: None },
    ]
}

/// Create faces for a simple cube
fn create_cube_faces() -> Vec<Face> {
    vec![
        // Bottom face
        Face { vertices: [0, 1, 2], normal: None },
        Face { vertices: [0, 2, 3], normal: None },
        // Top face
        Face { vertices: [4, 6, 5], normal: None },
        Face { vertices: [4, 7, 6], normal: None },
        // Front face
        Face { vertices: [0, 4, 5], normal: None },
        Face { vertices: [0, 5, 1], normal: None },
        // Back face
        Face { vertices: [2, 6, 7], normal: None },
        Face { vertices: [2, 7, 3], normal: None },
        // Left face
        Face { vertices: [0, 3, 7], normal: None },
        Face { vertices: [0, 7, 4], normal: None },
        // Right face
        Face { vertices: [1, 5, 6], normal: None },
        Face { vertices: [1, 6, 2], normal: None },
    ]
}

/// Calculate bounding box for a mesh
fn calculate_bounding_box(mesh: &Mesh) -> BoundingBox {
    if mesh.vertices.is_empty() {
        return BoundingBox {
            min: [0.0, 0.0, 0.0],
            max: [0.0, 0.0, 0.0],
        };
    }
    
    let mut min = mesh.vertices[0].position;
    let mut max = mesh.vertices[0].position;
    
    for vertex in &mesh.vertices {
        for i in 0..3 {
            min[i] = min[i].min(vertex.position[i]);
            max[i] = max[i].max(vertex.position[i]);
        }
    }
    
    BoundingBox { min, max }
}

/// Detect likely units based on file format
fn detect_units(format: ImportFormat) -> Option<String> {
    match format {
        ImportFormat::Stl => Some("mm".to_string()),
        ImportFormat::Nec => Some("m".to_string()),
        ImportFormat::Nastran => Some("mm".to_string()),
        ImportFormat::Step => Some("mm".to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_format_detection() {
        assert_eq!(detect_format(&PathBuf::from("test.stl")).unwrap(), ImportFormat::Stl);
        assert_eq!(detect_format(&PathBuf::from("test.nec")).unwrap(), ImportFormat::Nec);
        assert_eq!(detect_format(&PathBuf::from("test.step")).unwrap(), ImportFormat::Step);
        assert_eq!(detect_format(&PathBuf::from("test.stp")).unwrap(), ImportFormat::Step);
    }
    
    #[test]
    fn test_bounding_box_calculation() {
        let vertices = vec![
            Vertex { position: [0.0, 0.0, 0.0], normal: None },
            Vertex { position: [1.0, 1.0, 1.0], normal: None },
            Vertex { position: [-1.0, -1.0, -1.0], normal: None },
        ];
        let mesh = Mesh { vertices, faces: vec![] };
        let bbox = calculate_bounding_box(&mesh);
        
        assert_eq!(bbox.min, [-1.0, -1.0, -1.0]);
        assert_eq!(bbox.max, [1.0, 1.0, 1.0]);
    }
}