use std::path::Path;
use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use anyhow::{Result, anyhow};

use super::geometry::{Mesh, Vertex, Triangle};
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
    pub triangle_count: usize,
    pub properties: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportedModel {
    pub mesh: Mesh,
    pub format: ImportFormat,
    pub metadata: ImportMetadata,
}

/// Detect file format based on extension and content
pub fn detect_format(path: &Path) -> Result<ImportFormat> {
    let extension = path.extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_lowercase();

    match extension.as_str() {
        "stl" => Ok(ImportFormat::Stl),
        "nec" => Ok(ImportFormat::Nec),
        "nas" | "bdf" | "nastran" => Ok(ImportFormat::Nastran),
        "stp" | "step" => Ok(ImportFormat::Step),
        _ => {
            // Try to detect by content
            let content = std::fs::read_to_string(path)
                .map_err(|e| anyhow!("Failed to read file: {}", e))?;
            
            if content.starts_with("solid") || content.contains("facet normal") {
                Ok(ImportFormat::Stl)
            } else if content.contains("CE") || content.contains("GW") || content.contains("FR") {
                Ok(ImportFormat::Nec)
            } else if content.contains("GRID") || content.contains("CTRIA3") {
                Ok(ImportFormat::Nastran)
            } else if content.contains("ISO-10303") || content.contains("STEP") {
                Ok(ImportFormat::Step)
            } else {
                Err(anyhow!("Unknown file format"))
            }
        }
    }
}

/// Import a file and return unified model structure
pub fn import_file(path: &Path) -> Result<ImportedModel> {
    let format = detect_format(path)?;
    let filename = path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("unknown")
        .to_string();

    let file_size = std::fs::metadata(path)
        .map(|m| m.len())
        .unwrap_or(0);

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

    let mut properties = HashMap::new();
    properties.insert("format".to_string(), format!("{:?}", format));
    properties.insert("source".to_string(), filename.clone());

    let metadata = ImportMetadata {
        filename,
        file_size,
        vertex_count: mesh.vertices.len(),
        triangle_count: mesh.triangles.len(),
        properties,
    };

    Ok(ImportedModel {
        mesh,
        format,
        metadata,
    })
}

/// Basic STEP parser - converts STEP geometry to mesh
fn parse_step(path: &Path) -> Result<Mesh> {
    let content = std::fs::read_to_string(path)?;
    
    // This is a simplified STEP parser
    // In production, you'd use a proper STEP library like opencascade-rs
    let mut vertices = Vec::new();
    let mut triangles = Vec::new();

    // Parse CARTESIAN_POINT entities
    for line in content.lines() {
        if line.contains("CARTESIAN_POINT") {
            if let Some(coords) = extract_coordinates(line) {
                vertices.push(Vertex {
                    x: coords.0,
                    y: coords.1,
                    z: coords.2,
                });
            }
        }
    }

    // Generate triangles from vertices (simplified triangulation)
    // This is a placeholder - real STEP parsing would extract faces
    if vertices.len() >= 3 {
        for i in (0..vertices.len()).step_by(3) {
            if i + 2 < vertices.len() {
                triangles.push(Triangle {
                    v0: i,
                    v1: i + 1,
                    v2: i + 2,
                });
            }
        }
    }

    Ok(Mesh { vertices, triangles })
}

/// Extract coordinates from STEP CARTESIAN_POINT line
fn extract_coordinates(line: &str) -> Option<(f32, f32, f32)> {
    // Example: #123=CARTESIAN_POINT('',(1.0,2.0,3.0));
    let start = line.find('(')?;
    let end = line.rfind(')')?;
    let coords_str = &line[start+1..end];
    
    // Find the coordinate tuple
    let tuple_start = coords_str.find('(')?;
    let tuple_end = coords_str.rfind(')')?;
    let coords = &coords_str[tuple_start+1..tuple_end];
    
    let parts: Vec<&str> = coords.split(',').collect();
    if parts.len() >= 3 {
        let x = parts[0].trim().parse().ok()?;
        let y = parts[1].trim().parse().ok()?;
        let z = parts[2].trim().parse().ok()?;
        Some((x, y, z))
    } else {
        None
    }
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
        assert!(matches!(detect_format(&PathBuf::from("test.step")), Ok(ImportFormat::Step)));
    }

    #[test]
    fn test_coordinate_extraction() {
        let line = "#123=CARTESIAN_POINT('',(1.5,2.7,3.9));";
        let coords = extract_coordinates(line);
        assert_eq!(coords, Some((1.5, 2.7, 3.9)));
    }
}