use std::path::Path;
use serde::{Deserialize, Serialize};

use super::geometry::{Mesh, Point3D, Triangle};
use super::types::{AntennaError, Result};

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
            let content = std::fs::read_to_string(path)
                .map_err(|e| AntennaError::ImportError(format!("Cannot read file: {}", e)))?;
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
                Err(AntennaError::ImportError(format!(
                    "Unknown file format for: {}",
                    path.display()
                )))
            }
        }
    }
}

pub fn import_file(path: &Path) -> Result<ImportedModel> {
    let format = detect_format(path)?;
    let filename = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("unknown")
        .to_string();

    let file_size = std::fs::metadata(path)
        .map_err(|e| AntennaError::IoError(format!("Cannot read file metadata: {}", e)))?
        .len();

    let mesh = match format {
        ImportFormat::Stl => parse_stl_simple(path)?,
        ImportFormat::Nec => parse_nec_simple(path)?,
        ImportFormat::Nastran => parse_nastran_simple(path)?,
        ImportFormat::Step => parse_step(path)?,
    };

    let metadata = ImportMetadata {
        filename,
        file_size,
        vertex_count: mesh.vertices.len(),
        face_count: mesh.triangles.len(),
        units: None,
        description: None,
    };

    Ok(ImportedModel {
        mesh,
        format,
        metadata,
    })
}

/// Simplified STL parser (placeholder — reads vertices from ASCII STL)
fn parse_stl_simple(path: &Path) -> Result<Mesh> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| AntennaError::ImportError(format!("Failed to read STL file: {}", e)))?;

    let mut vertices = Vec::new();
    let mut triangles = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("vertex") {
            let parts: Vec<&str> = trimmed.split_whitespace().collect();
            if parts.len() == 4 {
                if let (Ok(x), Ok(y), Ok(z)) = (
                    parts[1].parse::<f64>(),
                    parts[2].parse::<f64>(),
                    parts[3].parse::<f64>(),
                ) {
                    vertices.push(Point3D::new(x, y, z));
                }
            }
        }
    }

    // Group vertices into triangles (every 3 vertices = 1 triangle)
    for i in (0..vertices.len()).step_by(3) {
        if i + 2 < vertices.len() {
            let base = i;
            triangles.push(Triangle {
                vertices: [base, base + 1, base + 2],
            });
        }
    }

    Ok(Mesh {
        vertices,
        triangles,
        segments: Vec::new(),
    })
}

/// Simplified NEC parser (placeholder)
fn parse_nec_simple(path: &Path) -> Result<Mesh> {
    let _content = std::fs::read_to_string(path)
        .map_err(|e| AntennaError::ImportError(format!("Failed to read NEC file: {}", e)))?;

    // TODO: implement NEC parsing
    Ok(Mesh::empty())
}

/// Simplified Nastran parser (placeholder)
fn parse_nastran_simple(path: &Path) -> Result<Mesh> {
    let _content = std::fs::read_to_string(path)
        .map_err(|e| AntennaError::ImportError(format!("Failed to read Nastran file: {}", e)))?;

    // TODO: implement Nastran parsing
    Ok(Mesh::empty())
}

/// Basic STEP parser placeholder
fn parse_step(path: &Path) -> Result<Mesh> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| AntennaError::ImportError(format!("Failed to read STEP file: {}", e)))?;

    let mut vertices = Vec::new();
    let mut triangles = Vec::new();

    // Look for CARTESIAN_POINT entities
    for line in content.lines() {
        if line.contains("CARTESIAN_POINT") {
            if let Some(coords_start) = line.find('(') {
                if let Some(coords_end) = line.rfind(')') {
                    let coords_str = &line[coords_start + 1..coords_end];
                    let coords: Vec<&str> = coords_str.split(',').collect();

                    if coords.len() >= 3 {
                        if let (Ok(x), Ok(y), Ok(z)) = (
                            coords[0].trim().parse::<f64>(),
                            coords[1].trim().parse::<f64>(),
                            coords[2].trim().parse::<f64>(),
                        ) {
                            vertices.push(Point3D::new(x, y, z));
                        }
                    }
                }
            }
        }
    }

    // Generate basic triangulation for demo
    for i in 0..(vertices.len().saturating_sub(2)) {
        triangles.push(Triangle {
            vertices: [i, i + 1, i + 2],
        });
    }

    if vertices.is_empty() {
        return Err(AntennaError::ImportError(
            "No valid geometry found in STEP file".to_string(),
        ));
    }

    Ok(Mesh {
        vertices,
        triangles,
        segments: Vec::new(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn test_format_detection() {
        assert!(matches!(
            detect_format(&PathBuf::from("test.stl")),
            Ok(ImportFormat::Stl)
        ));
        assert!(matches!(
            detect_format(&PathBuf::from("test.nec")),
            Ok(ImportFormat::Nec)
        ));
        assert!(matches!(
            detect_format(&PathBuf::from("test.nas")),
            Ok(ImportFormat::Nastran)
        ));
        assert!(matches!(
            detect_format(&PathBuf::from("test.stp")),
            Ok(ImportFormat::Step)
        ));
    }
}
