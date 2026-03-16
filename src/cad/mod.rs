//! CAD file format support and parsing

pub mod step;
pub mod iges;
pub mod stl;

use std::path::Path;
use crate::geometry::Geometry;

pub trait CadImporter {
    fn import(&self, path: &Path) -> Result<Geometry, CadImportError>;
    fn supported_extensions(&self) -> Vec<&'static str>;
}

#[derive(Debug, Clone)]
pub enum CadImportError {
    FileNotFound,
    UnsupportedFormat,
    ParseError(String),
    IoError(String),
}

impl std::fmt::Display for CadImportError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            CadImportError::FileNotFound => write!(f, "File not found"),
            CadImportError::UnsupportedFormat => write!(f, "Unsupported file format"),
            CadImportError::ParseError(msg) => write!(f, "Parse error: {}", msg),
            CadImportError::IoError(msg) => write!(f, "IO error: {}", msg),
        }
    }
}

impl std::error::Error for CadImportError {}

pub fn get_importer_for_extension(ext: &str) -> Option<Box<dyn CadImporter>> {
    match ext.to_lowercase().as_str() {
        "step" | "stp" => Some(Box::new(step::StepImporter::new())),
        "iges" | "igs" => Some(Box::new(iges::IgesImporter::new())),
        "stl" => Some(Box::new(stl::StlImporter::new())),
        _ => None,
    }
}