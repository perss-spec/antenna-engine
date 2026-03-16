use std::path::Path;
use crate::core::geometry::{Mesh, Material, Vertex};
use crate::core::{stl, nec, nastran};

#[derive(Debug, Clone, PartialEq)]
pub enum ImportFormat {
    Stl,
    Nec,
    Nastran,
    Step,
}

#[derive(Debug, Clone)]
pub struct ImportMetadata {
    pub filename: String,
    pub file_size: u64,
    pub vertex_count: usize,
    pub face_count: usize,
    pub material_count: usize,
    pub import_time_ms: u128,
}

#[derive(Debug, Clone)]
pub struct ImportedModel {
    pub mesh: Mesh,
    pub format: ImportFormat,
    pub metadata: ImportMetadata,
}

pub fn detect_format(path: &Path) -> Result<ImportFormat, Box<dyn std::error::Error>> {
    let extension = path
        .extension()
        .and_then(|ext| ext.to_str())
        .ok_or("No file extension found")?
        .to_lowercase();

    match extension.as_str() {
        "stl" => Ok(ImportFormat::Stl),
        "nec" => Ok(ImportFormat::Nec),
        "nas" | "bdf" | "nastran" => Ok(ImportFormat::Nastran),
        "stp" | "step" => Ok(ImportFormat::Step),
        _ => Err(format!("Unsupported file format: {}", extension).into()),
    }
}

pub fn import_file(path: &Path) -> Result<ImportedModel, Box<dyn std::error::Error>> {
    let start_time = std::time::Instant::now();
    let format = detect_format(path)?;
    
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

    let import_time_ms = start_time.elapsed().as_millis();
    let file_size = std::fs::metadata(path)?.len();
    let filename = path.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("unknown")
        .to_string();

    let metadata = ImportMetadata {
        filename,
        file_size,
        vertex_count: mesh.vertices.len(),
        face_count: mesh.faces.len(),
        material_count: mesh.materials.len(),
        import_time_ms,
    };

    Ok(ImportedModel {
        mesh,
        format,
        metadata,
    })
}

fn parse_step(path: &Path) -> Result<Mesh, Box<dyn std::error::Error>> {
    // Basic STEP parser implementation
    // This is a simplified parser - full STEP support would require extensive parsing
    let content = std::fs::read_to_string(path)?;
    
    if !content.starts_with("ISO-10303") {
        return Err("Invalid STEP file format".into());
    }

    // Extract basic geometry data from STEP file
    let mut vertices = Vec::new();
    let mut faces = Vec::new();
    let materials = vec![Material::default()];

    // Parse CARTESIAN_POINT entities
    for line in content.lines() {
        if line.contains("CARTESIAN_POINT") {
            if let Some(coords) = extract_coordinates(line) {
                vertices.push(Vertex {
                    position: coords,
                    normal: [0.0, 0.0, 1.0],
                    texture_coords: [0.0, 0.0],
                });
            }
        }
    }

    // Create triangulated faces from vertices
    // This is a very basic triangulation
    for i in (0..vertices.len()).step_by(3) {
        if i + 2 < vertices.len() {
            faces.push([i as u32, (i + 1) as u32, (i + 2) as u32]);
        }
    }

    Ok(Mesh {
        vertices,
        faces,
        materials,
        name: path.file_stem()
            .and_then(|name| name.to_str())
            .unwrap_or("step_model")
            .to_string(),
    })
}

fn extract_coordinates(line: &str) -> Option<[f32; 3]> {
    // Extract coordinates from CARTESIAN_POINT('',(-1.5,0.,1.5));
    let start = line.find('(')?;
    let end = line.rfind(')')?;
    let coords_str = &line[start + 1..end];
    
    // Find the coordinate values (skip the name part)
    let comma_pos = coords_str.find(',')?;
    let coords_part = &coords_str[comma_pos + 1..];
    let paren_start = coords_part.find('(')?;
    let paren_end = coords_part.rfind(')')?;
    let numbers_str = &coords_part[paren_start + 1..paren_end];
    
    let coords: Vec<f32> = numbers_str
        .split(',')
        .map(|s| s.trim().parse().ok())
        .collect::<Option<Vec<f32>>>()?;
    
    if coords.len() >= 3 {
        Some([coords[0], coords[1], coords[2]])
    } else {
        None
    }
}