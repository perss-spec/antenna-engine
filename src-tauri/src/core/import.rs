use std::path::Path;
use serde::{Deserialize, Serialize};
use crate::core::geometry::{Mesh, Vertex, Triangle};

mod stl;
mod nec;
mod nastran;

pub use stl::StlParser;
pub use nec::NecParser;
pub use nastran::NastranParser;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ImportFormat {
    Stl,
    Nec,
    Nastran,
    Step,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportMetadata {
    pub file_size: u64,
    pub vertex_count: usize,
    pub triangle_count: usize,
    pub units: Option<String>,
    pub description: Option<String>,
    pub imported_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportedModel {
    pub mesh: Mesh,
    pub format: ImportFormat,
    pub metadata: ImportMetadata,
}

#[derive(Debug, thiserror::Error)]
pub enum ImportError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Unsupported file format")]
    UnsupportedFormat,
    #[error("Parse error: {0}")]
    ParseError(String),
    #[error("Invalid file extension")]
    InvalidExtension,
}

pub type Result<T> = std::result::Result<T, ImportError>;

pub fn detect_format(path: &Path) -> Result<ImportFormat> {
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .ok_or(ImportError::InvalidExtension)?
        .to_lowercase();

    match extension.as_str() {
        "stl" => Ok(ImportFormat::Stl),
        "nec" => Ok(ImportFormat::Nec),
        "nas" | "bdf" | "dat" => Ok(ImportFormat::Nastran),
        "stp" | "step" => Ok(ImportFormat::Step),
        _ => Err(ImportError::UnsupportedFormat),
    }
}

pub fn import_file(path: &Path) -> Result<ImportedModel> {
    let format = detect_format(path)?;
    let file_size = std::fs::metadata(path)?.len();
    
    let mesh = match format {
        ImportFormat::Stl => {
            let parser = StlParser::new();
            parser.parse_file(path)?
        },
        ImportFormat::Nec => {
            let parser = NecParser::new();
            parser.parse_file(path)?
        },
        ImportFormat::Nastran => {
            let parser = NastranParser::new();
            parser.parse_file(path)?
        },
        ImportFormat::Step => {
            // STEP files require specialized CAD kernel - placeholder for now
            return Err(ImportError::ParseError("STEP import not yet implemented".to_string()));
        },
    };

    let metadata = ImportMetadata {
        file_size,
        vertex_count: mesh.vertices.len(),
        triangle_count: mesh.triangles.len(),
        units: detect_units(&format),
        description: Some(format!("Imported {:?} file", format)),
        imported_at: chrono::Utc::now().to_rfc3339(),
    };

    Ok(ImportedModel {
        mesh,
        format,
        metadata,
    })
}

fn detect_units(format: &ImportFormat) -> Option<String> {
    match format {
        ImportFormat::Stl => Some("mm".to_string()),
        ImportFormat::Nec => Some("meters".to_string()),
        ImportFormat::Nastran => Some("mm".to_string()),
        ImportFormat::Step => Some("mm".to_string()),
    }
}

pub fn get_supported_formats() -> Vec<ImportFormat> {
    vec![
        ImportFormat::Stl,
        ImportFormat::Nec,
        ImportFormat::Nastran,
        ImportFormat::Step,
    ]
}

pub fn get_file_extensions() -> Vec<&'static str> {
    vec!["stl", "nec", "nas", "bdf", "dat", "stp", "step"]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_format() {
        assert!(matches!(detect_format(Path::new("test.stl")), Ok(ImportFormat::Stl)));
        assert!(matches!(detect_format(Path::new("test.nec")), Ok(ImportFormat::Nec)));
        assert!(matches!(detect_format(Path::new("test.nas")), Ok(ImportFormat::Nastran)));
        assert!(matches!(detect_format(Path::new("test.step")), Ok(ImportFormat::Step)));
        assert!(matches!(detect_format(Path::new("test.xyz")), Err(ImportError::UnsupportedFormat)));
    }

    #[test]
    fn test_get_supported_formats() {
        let formats = get_supported_formats();
        assert_eq!(formats.len(), 4);
    }

    #[test]
    fn test_get_file_extensions() {
        let extensions = get_file_extensions();
        assert!(extensions.contains(&"stl"));
        assert!(extensions.contains(&"step"));
    }
}