use std::path::Path;
use crate::core::geometry::{Mesh, Vertex, Face};
use crate::core::parsers::{stl, nec, nastran};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ImportFormat {
    Stl,
    Nec,
    Nastran,
    Step,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportMetadata {
    pub filename: String,
    pub file_size: u64,
    pub vertex_count: usize,
    pub face_count: usize,
    pub import_time_ms: u64,
    pub units: Option<String>,
    pub comments: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportedModel {
    pub mesh: Mesh,
    pub format: ImportFormat,
    pub metadata: ImportMetadata,
}

#[derive(Error, Debug)]
pub enum ImportError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Unsupported file format for file: {0}")]
    UnsupportedFormat(String),
    #[error("Parse error: {0}")]
    ParseError(String),
    #[error("STEP format not yet implemented")]
    StepNotImplemented,
}

pub type Result<T> = std::result::Result<T, ImportError>;

pub fn detect_format(path: &Path) -> Result<ImportFormat> {
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .ok_or_else(|| ImportError::UnsupportedFormat(
            path.to_string_lossy().to_string()
        ))?
        .to_lowercase();

    match extension.as_str() {
        "stl" => Ok(ImportFormat::Stl),
        "nec" => Ok(ImportFormat::Nec),
        "nas" | "nastran" | "bdf" => Ok(ImportFormat::Nastran),
        "stp" | "step" => Ok(ImportFormat::Step),
        _ => Err(ImportError::UnsupportedFormat(extension)),
    }
}

pub fn import_file(path: &Path) -> Result<ImportedModel> {
    let start_time = std::time::Instant::now();
    let format = detect_format(path)?;
    let filename = path.file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();
    
    let file_size = std::fs::metadata(path)?.len();
    
    let mesh = match format {
        ImportFormat::Stl => {
            let stl_data = stl::parse_stl_file(path)?;
            stl_to_mesh(stl_data)
        }
        ImportFormat::Nec => {
            let nec_data = nec::parse_nec_file(path)?;
            nec_to_mesh(nec_data)
        }
        ImportFormat::Nastran => {
            let nastran_data = nastran::parse_nastran_file(path)?;
            nastran_to_mesh(nastran_data)
        }
        ImportFormat::Step => {
            return Err(ImportError::StepNotImplemented);
        }
    };

    let import_time_ms = start_time.elapsed().as_millis() as u64;
    
    let metadata = ImportMetadata {
        filename,
        file_size,
        vertex_count: mesh.vertices.len(),
        face_count: mesh.faces.len(),
        import_time_ms,
        units: extract_units(&format),
        comments: extract_comments(&format),
    };

    Ok(ImportedModel {
        mesh,
        format,
        metadata,
    })
}

fn stl_to_mesh(stl_data: stl::StlData) -> Mesh {
    let mut vertices = Vec::new();
    let mut faces = Vec::new();
    
    for (i, triangle) in stl_data.triangles.iter().enumerate() {
        let base_idx = i * 3;
        
        vertices.push(Vertex {
            position: triangle.vertices[0],
            normal: Some(triangle.normal),
        });
        vertices.push(Vertex {
            position: triangle.vertices[1],
            normal: Some(triangle.normal),
        });
        vertices.push(Vertex {
            position: triangle.vertices[2],
            normal: Some(triangle.normal),
        });
        
        faces.push(Face {
            vertices: [base_idx, base_idx + 1, base_idx + 2],
            material_id: None,
        });
    }
    
    Mesh { vertices, faces }
}

fn nec_to_mesh(nec_data: nec::NecData) -> Mesh {
    let mut vertices = Vec::new();
    let mut faces = Vec::new();
    
    // Convert NEC wire segments to line segments (represented as degenerate triangles)
    for segment in &nec_data.segments {
        let start_idx = vertices.len();
        
        vertices.push(Vertex {
            position: segment.start,
            normal: None,
        });
        vertices.push(Vertex {
            position: segment.end,
            normal: None,
        });
        vertices.push(Vertex {
            position: segment.end, // Duplicate for degenerate triangle
            normal: None,
        });
        
        faces.push(Face {
            vertices: [start_idx, start_idx + 1, start_idx + 2],
            material_id: None,
        });
    }
    
    Mesh { vertices, faces }
}

fn nastran_to_mesh(nastran_data: nastran::NastranData) -> Mesh {
    let mut vertices = Vec::new();
    let mut faces = Vec::new();
    
    // Convert NASTRAN nodes to vertices
    for node in &nastran_data.nodes {
        vertices.push(Vertex {
            position: node.coordinates,
            normal: None,
        });
    }
    
    // Convert NASTRAN elements to faces
    for element in &nastran_data.elements {
        match element.element_type.as_str() {
            "CTRIA3" | "CQUAD4" => {
                if element.nodes.len() >= 3 {
                    // Find vertex indices by node IDs
                    let mut vertex_indices = Vec::new();
                    for &node_id in &element.nodes[..3.min(element.nodes.len())] {
                        if let Some(pos) = nastran_data.nodes.iter().position(|n| n.id == node_id) {
                            vertex_indices.push(pos);
                        }
                    }
                    
                    if vertex_indices.len() == 3 {
                        faces.push(Face {
                            vertices: [vertex_indices[0], vertex_indices[1], vertex_indices[2]],
                            material_id: Some(element.property_id),
                        });
                    }
                }
            }
            _ => {} // Skip unsupported element types
        }
    }
    
    Mesh { vertices, faces }
}

fn extract_units(format: &ImportFormat) -> Option<String> {
    match format {
        ImportFormat::Stl => Some("mm".to_string()),
        ImportFormat::Nec => Some("meters".to_string()),
        ImportFormat::Nastran => Some("consistent".to_string()),
        ImportFormat::Step => Some("mm".to_string()),
    }
}

fn extract_comments(format: &ImportFormat) -> Vec<String> {
    match format {
        ImportFormat::Stl => vec!["STL mesh imported".to_string()],
        ImportFormat::Nec => vec!["NEC antenna structure imported".to_string()],
        ImportFormat::Nastran => vec!["NASTRAN finite element model imported".to_string()],
        ImportFormat::Step => vec!["STEP CAD model imported".to_string()],
    }
}

// Helper function to validate imported mesh
pub fn validate_mesh(mesh: &Mesh) -> Result<()> {
    if mesh.vertices.is_empty() {
        return Err(ImportError::ParseError("No vertices found in mesh".to_string()));
    }
    
    if mesh.faces.is_empty() {
        return Err(ImportError::ParseError("No faces found in mesh".to_string()));
    }
    
    // Validate face indices
    for (i, face) in mesh.faces.iter().enumerate() {
        for &vertex_idx in &face.vertices {
            if vertex_idx >= mesh.vertices.len() {
                return Err(ImportError::ParseError(
                    format!("Face {} references invalid vertex index {}", i, vertex_idx)
                ));
            }
        }
    }
    
    Ok(())
}