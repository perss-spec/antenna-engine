use std::path::Path;
use anyhow::{Result, anyhow};
use serde::{Deserialize, Serialize};

use super::geometry::{Mesh, Vector3};
use super::parsers::{stl, nec, nastran};

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
    pub units: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportedModel {
    pub mesh: Mesh,
    pub format: ImportFormat,
    pub metadata: ImportMetadata,
}

pub fn detect_format(path: &Path) -> Result<ImportFormat> {
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .map(|ext| ext.to_lowercase());

    match extension.as_deref() {
        Some("stl") => Ok(ImportFormat::Stl),
        Some("nec") => Ok(ImportFormat::Nec),
        Some("nas") | Some("nastran") | Some("bdf") => Ok(ImportFormat::Nastran),
        Some("stp") | Some("step") => Ok(ImportFormat::Step),
        _ => {
            // Try to detect by file content
            let content = std::fs::read_to_string(path)?;
            let first_line = content.lines().next().unwrap_or("").to_lowercase();
            
            if first_line.contains("solid") {
                Ok(ImportFormat::Stl)
            } else if first_line.contains("cm") || first_line.contains("ce") {
                Ok(ImportFormat::Nec)
            } else if first_line.contains("begin bulk") || first_line.contains("grid") {
                Ok(ImportFormat::Nastran)
            } else if first_line.contains("iso-10303") {
                Ok(ImportFormat::Step)
            } else {
                Err(anyhow!("Unknown file format for: {}", path.display()))
            }
        }
    }
}

pub fn import_file(path: &Path) -> Result<ImportedModel> {
    let format = detect_format(path)?;
    let filename = path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("unknown")
        .to_string();
    
    let file_size = std::fs::metadata(path)?.len();

    let mesh = match format {
        ImportFormat::Stl => {
            stl::parse_stl(path)?
        },
        ImportFormat::Nec => {
            nec::parse_nec(path)?
        },
        ImportFormat::Nastran => {
            nastran::parse_nastran(path)?
        },
        ImportFormat::Step => {
            parse_step(path)?
        },
    };

    let metadata = ImportMetadata {
        filename,
        file_size,
        vertex_count: mesh.vertices.len(),
        face_count: mesh.indices.len() / 3,
        units: None, // TODO: Extract from format-specific metadata
        description: None,
    };

    Ok(ImportedModel {
        mesh,
        format,
        metadata,
    })
}

// Basic STEP parser placeholder - would need full STEP library in production
fn parse_step(path: &Path) -> Result<Mesh> {
    let content = std::fs::read_to_string(path)?;
    
    // This is a simplified STEP parser for demo purposes
    // In production, use a proper STEP library like opencascade-rs
    let mut vertices = Vec::new();
    let mut indices = Vec::new();
    
    // Look for CARTESIAN_POINT entities
    for line in content.lines() {
        if line.contains("CARTESIAN_POINT") {
            if let Some(coords_start) = line.find('(') {
                if let Some(coords_end) = line.find(')') {
                    let coords_str = &line[coords_start + 1..coords_end];
                    let coords: Vec<&str> = coords_str.split(',').collect();
                    
                    if coords.len() >= 3 {
                        if let (Ok(x), Ok(y), Ok(z)) = (
                            coords[0].trim().parse::<f32>(),
                            coords[1].trim().parse::<f32>(),
                            coords[2].trim().parse::<f32>(),
                        ) {
                            vertices.push(Vector3::new(x, y, z));
                        }
                    }
                }
            }
        }
    }
    
    // Generate basic triangulation for demo
    for i in 0..(vertices.len().saturating_sub(2)) {
        indices.push(i as u32);
        indices.push((i + 1) as u32);
        indices.push((i + 2) as u32);
    }
    
    if vertices.is_empty() {
        return Err(anyhow!("No valid geometry found in STEP file"));
    }
    
    Ok(Mesh {
        vertices,
        indices,
        normals: Vec::new(), // TODO: Calculate normals
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_format_detection() {
        assert!(matches!(detect_format(&PathBuf::from("test.stl")), Ok(ImportFormat::Stl)));
        assert!(matches!(detect_format(&PathBuf::from("test.nec")), Ok(ImportFormat::Nec)));
        assert!(matches!(detect_format(&PathBuf::from("test.nas")), Ok(ImportFormat::Nastran)));
        assert!(matches!(detect_format(&PathBuf::from("test.stp")), Ok(ImportFormat::Step)));
    }
}