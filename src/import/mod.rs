//! High-level import orchestration

use std::path::Path;
use crate::cad::{CadImportError, get_importer_for_extension};
use crate::geometry::Geometry;
use crate::materials::{MaterialDatabase, MaterialAssignment};
use crate::mesh::{MeshGenerator, MeshParameters, TetrahedralMesh, MeshError};

#[derive(Debug, Clone)]
pub struct ImportOptions {
    pub mesh_parameters: MeshParameters,
    pub auto_assign_materials: bool,
    pub scale_factor: f64,
}

impl ImportOptions {
    pub fn new() -> Self {
        Self {
            mesh_parameters: MeshParameters::new(),
            auto_assign_materials: true,
            scale_factor: 1.0,
        }
    }

    pub fn with_scale(mut self, scale: f64) -> Self {
        self.scale_factor = scale;
        self
    }
}

impl Default for ImportOptions {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug)]
pub struct ImportResult {
    pub geometry: Geometry,
    pub mesh: Option<TetrahedralMesh>,
    pub material_assignments: Vec<MaterialAssignment>,
}

pub struct ImportEngine {
    material_db: MaterialDatabase,
}

impl ImportEngine {
    pub fn new() -> Self {
        Self {
            material_db: MaterialDatabase::new(),
        }
    }

    pub fn import_cad_file(&self, path: &Path, options: ImportOptions) -> Result<ImportResult, ImportError> {
        // Get file extension
        let extension = path.extension()
            .and_then(|ext| ext.to_str())
            .ok_or(ImportError::UnsupportedFormat)?;

        // Get appropriate importer
        let importer = get_importer_for_extension(extension)
            .ok_or(ImportError::UnsupportedFormat)?;

        // Import geometry
        let mut geometry = importer.import(path)
            .map_err(ImportError::CadImportError)?;

        // Apply scaling if needed
        if (options.scale_factor - 1.0).abs() > f64::EPSILON {
            self.scale_geometry(&mut geometry, options.scale_factor);
        }

        // Generate mesh if requested
        let mesh = if !options.mesh_parameters.max_element_size.is_infinite() {
            let mesh_generator = MeshGenerator::new(options.mesh_parameters);
            Some(mesh_generator.generate_mesh(&geometry)
                .map_err(ImportError::MeshError)?)
        } else {
            None
        };

        // Auto-assign materials if requested
        let material_assignments = if options.auto_assign_materials {
            self.auto_assign_materials(&geometry)
        } else {
            Vec::new()
        };

        Ok(ImportResult {
            geometry,
            mesh,
            material_assignments,
        })
    }

    fn scale_geometry(&self, geometry: &mut Geometry, scale_factor: f64) {
        for surface in &mut geometry.surfaces {
            for vertex in &mut surface.vertices {
                vertex.x *= scale_factor;
                vertex.y *= scale_factor;
                vertex.z *= scale_factor;
            }
        }
    }

    fn auto_assign_materials(&self, geometry: &Geometry) -> Vec<MaterialAssignment> {
        let mut assignments = Vec::new();
        
        // Simple heuristic: assign copper to all surfaces for now
        // In practice, you'd use more sophisticated material detection
        for (i, _surface) in geometry.surfaces.iter().enumerate() {
            assignments.push(MaterialAssignment::new(i, "Copper".to_string()));
        }
        
        assignments
    }

    pub fn get_material_database(&self) -> &MaterialDatabase {
        &self.material_db
    }
}

impl Default for ImportEngine {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug)]
pub enum ImportError {
    UnsupportedFormat,
    CadImportError(CadImportError),
    MeshError(MeshError),
    InvalidOptions(String),
}

impl std::fmt::Display for ImportError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ImportError::UnsupportedFormat => write!(f, "Unsupported file format"),
            ImportError::CadImportError(err) => write!(f, "CAD import error: {}", err),
            ImportError::MeshError(err) => write!(f, "Mesh generation error: {}", err),
            ImportError::InvalidOptions(msg) => write!(f, "Invalid import options: {}", msg),
        }
    }
}

impl std::error::Error for ImportError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            ImportError::CadImportError(err) => Some(err),
            ImportError::MeshError(err) => Some(err),
            _ => None,
        }
    }
}