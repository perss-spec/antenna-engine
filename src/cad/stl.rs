//! STL file format importer

use std::path::Path;
use crate::geometry::{Geometry, Surface, Point3D};
use super::{CadImporter, CadImportError};

pub struct StlImporter {
    // Configuration options for STL import
}

impl StlImporter {
    pub fn new() -> Self {
        Self {}
    }

    fn parse_stl_file(&self, path: &Path) -> Result<Vec<Surface>, CadImportError> {
        // Read STL file
        let content = std::fs::read_to_string(path)
            .map_err(|e| CadImportError::IoError(e.to_string()))?;
        
        // Basic ASCII STL parsing
        if !content.starts_with("solid") {
            return Err(CadImportError::ParseError("Invalid STL file format".to_string()));
        }

        let mut vertices = Vec::new();
        let mut faces = Vec::new();
        let mut vertex_index = 0;

        let lines: Vec<&str> = content.lines().collect();
        let mut i = 0;
        
        while i < lines.len() {
            let line = lines[i].trim();
            if line.starts_with("facet normal") {
                // Skip to vertex data
                i += 2; // Skip "facet normal" and "outer loop"
                let mut face = [0; 3];
                
                for j in 0..3 {
                    if i < lines.len() && lines[i].trim().starts_with("vertex") {
                        let vertex_line = lines[i].trim();
                        let coords: Vec<&str> = vertex_line.split_whitespace().collect();
                        if coords.len() >= 4 {
                            let x = coords[1].parse::<f64>().unwrap_or(0.0);
                            let y = coords[2].parse::<f64>().unwrap_or(0.0);
                            let z = coords[3].parse::<f64>().unwrap_or(0.0);
                            
                            vertices.push(Point3D { x, y, z });
                            face[j] = vertex_index;
                            vertex_index += 1;
                        }
                        i += 1;
                    }
                }
                
                faces.push(face);
                i += 2; // Skip "endloop" and "endfacet"
            } else {
                i += 1;
            }
        }

        let surface = Surface {
            vertices,
            faces,
        };

        Ok(vec![surface])
    }
}

impl CadImporter for StlImporter {
    fn import(&self, path: &Path) -> Result<Geometry, CadImportError> {
        if !path.exists() {
            return Err(CadImportError::FileNotFound);
        }

        let surfaces = self.parse_stl_file(path)?;
        
        Ok(Geometry {
            surfaces,
            metadata: std::collections::HashMap::new(),
        })
    }

    fn supported_extensions(&self) -> Vec<&'static str> {
        vec!["stl"]
    }
}

impl Default for StlImporter {
    fn default() -> Self {
        Self::new()
    }
}