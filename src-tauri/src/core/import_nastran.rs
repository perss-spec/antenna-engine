use std::collections::HashMap;
use std::path::Path;

use super::geometry::{Mesh, Point3D, Triangle, Segment};
use super::types::{AntennaError, Result};

#[derive(Debug, Clone)]
struct BdfCard {
    name: String,
    fields: Vec<String>,
}

impl BdfCard {
    fn get_field(&self, index: usize) -> Option<&str> {
        self.fields.get(index).map(|s| s.trim()).filter(|s| !s.is_empty())
    }

    fn get_int(&self, index: usize) -> Result<i32> {
        self.get_field(index)
            .ok_or_else(|| AntennaError::ImportError(format!("Missing field at index {}", index)))?
            .parse()
            .map_err(|e| AntennaError::ImportError(format!("Failed to parse integer at index {}: {}", index, e)))
    }

    fn get_float(&self, index: usize) -> Result<f64> {
        let field = self.get_field(index)
            .ok_or_else(|| AntennaError::ImportError(format!("Missing field at index {}", index)))?;

        let normalized = field.replace('D', "E").replace('d', "e");

        normalized
            .parse()
            .map_err(|e| AntennaError::ImportError(format!("Failed to parse float at index {}: {}", index, e)))
    }

    fn get_float_opt(&self, index: usize) -> Result<Option<f64>> {
        match self.get_field(index) {
            Some(field) => {
                let normalized = field.replace('D', "E").replace('d', "e");
                Ok(Some(normalized.parse().map_err(|e| {
                    AntennaError::ImportError(format!(
                        "Failed to parse optional float at index {}: {}",
                        index, e
                    ))
                })?))
            }
            None => Ok(None),
        }
    }
}

/// Parse a NASTRAN BDF file content into a Mesh
pub fn parse_nastran(content: &str) -> Result<Mesh> {
    let cards = parse_bdf_cards(content)?;
    convert_cards_to_mesh(cards)
}

/// Parse a NASTRAN BDF file into a Mesh
pub fn parse_nastran_file(path: &Path) -> Result<Mesh> {
    let content = std::fs::read_to_string(path)
        .map_err(|e| AntennaError::IoError(format!("Failed to read file {}: {}", path.display(), e)))?;
    parse_nastran(&content)
}

fn parse_bdf_cards(content: &str) -> Result<Vec<BdfCard>> {
    let mut cards = Vec::new();
    let mut current_card_lines = Vec::new();

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed.is_empty() || trimmed.starts_with('$') {
            continue;
        }

        if trimmed.starts_with('+') {
            current_card_lines.push(line);
            continue;
        }

        if !current_card_lines.is_empty() {
            if let Ok(card) = parse_single_card(&current_card_lines) {
                cards.push(card);
            }
            current_card_lines.clear();
        }

        current_card_lines.push(line);
    }

    if !current_card_lines.is_empty() {
        if let Ok(card) = parse_single_card(&current_card_lines) {
            cards.push(card);
        }
    }

    Ok(cards)
}

fn parse_single_card(lines: &[&str]) -> Result<BdfCard> {
    if lines.is_empty() {
        return Err(AntennaError::ImportError("Empty card".to_string()));
    }

    let first_line = lines[0];
    let is_fixed_format = is_fixed_field_format(first_line);

    if is_fixed_format {
        parse_fixed_field_card(lines)
    } else {
        parse_free_field_card(lines)
    }
}

fn is_fixed_field_format(line: &str) -> bool {
    line.len() >= 8 && !line.contains(',')
}

fn parse_fixed_field_card(lines: &[&str]) -> Result<BdfCard> {
    let first_line = lines[0];
    let card_name = first_line[0..8.min(first_line.len())].trim().to_uppercase();

    let mut all_fields = Vec::new();
    all_fields.push(card_name.clone());

    for line in lines {
        let data_start = 8;
        let mut pos = data_start;
        while pos < line.len() {
            let end = std::cmp::min(pos + 8, line.len());
            let field = line[pos..end].trim();
            if !field.is_empty() && field != "+" {
                all_fields.push(field.to_string());
            }
            pos += 8;
        }
    }

    Ok(BdfCard {
        name: card_name,
        fields: all_fields,
    })
}

fn parse_free_field_card(lines: &[&str]) -> Result<BdfCard> {
    let mut all_text = String::new();

    for (i, line) in lines.iter().enumerate() {
        if i == 0 {
            all_text.push_str(line);
        } else {
            let clean_line = line.trim_start_matches('+').trim_start_matches(' ');
            if !all_text.ends_with(',') && !clean_line.starts_with(',') {
                all_text.push(',');
            }
            all_text.push_str(clean_line);
        }
    }

    let mut fields: Vec<String> = all_text.split(',').map(|s| s.trim().to_string()).collect();

    if fields.is_empty() {
        return Err(AntennaError::ImportError("No fields found".to_string()));
    }

    let card_name = fields[0].to_uppercase();
    fields[0] = card_name.clone();

    Ok(BdfCard {
        name: card_name,
        fields,
    })
}

fn convert_cards_to_mesh(cards: Vec<BdfCard>) -> Result<Mesh> {
    // Collect GRID nodes: node_id -> Point3D
    let mut grid_nodes: HashMap<i32, Point3D> = HashMap::new();

    for card in &cards {
        if card.name == "GRID" {
            let (node_id, point) = parse_grid_card(card)?;
            grid_nodes.insert(node_id, point);
        }
    }

    // Build ordered vertex list and node_id -> vertex_index map
    let mut node_ids: Vec<i32> = grid_nodes.keys().cloned().collect();
    node_ids.sort();

    let mut vertices = Vec::new();
    let mut node_to_idx: HashMap<i32, usize> = HashMap::new();

    for &node_id in &node_ids {
        let idx = vertices.len();
        vertices.push(grid_nodes[&node_id]);
        node_to_idx.insert(node_id, idx);
    }

    let mut triangles = Vec::new();
    let mut segments = Vec::new();

    for card in &cards {
        match card.name.as_str() {
            "CTRIA3" => {
                let tri = parse_ctria3_card(card, &node_to_idx)?;
                triangles.push(tri);
            }
            "CQUAD4" => {
                let tris = parse_cquad4_card(card, &node_to_idx)?;
                triangles.extend(tris);
            }
            "CBAR" | "CBEAM" => {
                let seg = parse_cbar_card(card, &node_to_idx)?;
                segments.push(seg);
            }
            _ => {}
        }
    }

    Ok(Mesh {
        vertices,
        triangles,
        segments,
    })
}

fn parse_grid_card(card: &BdfCard) -> Result<(i32, Point3D)> {
    let node_id = card.get_int(1)?;

    let x = card.get_float_opt(3)?.unwrap_or(0.0);
    let y = card.get_float_opt(4)?.unwrap_or(0.0);
    let z = card.get_float_opt(5)?.unwrap_or(0.0);

    Ok((node_id, Point3D { x, y, z }))
}

fn parse_ctria3_card(
    card: &BdfCard,
    node_to_idx: &HashMap<i32, usize>,
) -> Result<Triangle> {
    let n1 = card.get_int(3)?;
    let n2 = card.get_int(4)?;
    let n3 = card.get_int(5)?;

    let &i1 = node_to_idx.get(&n1).ok_or_else(|| {
        AntennaError::ImportError(format!("Vertex {} not found", n1))
    })?;
    let &i2 = node_to_idx.get(&n2).ok_or_else(|| {
        AntennaError::ImportError(format!("Vertex {} not found", n2))
    })?;
    let &i3 = node_to_idx.get(&n3).ok_or_else(|| {
        AntennaError::ImportError(format!("Vertex {} not found", n3))
    })?;

    Ok(Triangle { vertices: [i1, i2, i3] })
}

fn parse_cquad4_card(
    card: &BdfCard,
    node_to_idx: &HashMap<i32, usize>,
) -> Result<Vec<Triangle>> {
    let n1 = card.get_int(3)?;
    let n2 = card.get_int(4)?;
    let n3 = card.get_int(5)?;
    let n4 = card.get_int(6)?;

    let &i1 = node_to_idx.get(&n1).ok_or_else(|| {
        AntennaError::ImportError(format!("Vertex {} not found", n1))
    })?;
    let &i2 = node_to_idx.get(&n2).ok_or_else(|| {
        AntennaError::ImportError(format!("Vertex {} not found", n2))
    })?;
    let &i3 = node_to_idx.get(&n3).ok_or_else(|| {
        AntennaError::ImportError(format!("Vertex {} not found", n3))
    })?;
    let &i4 = node_to_idx.get(&n4).ok_or_else(|| {
        AntennaError::ImportError(format!("Vertex {} not found", n4))
    })?;

    Ok(vec![
        Triangle { vertices: [i1, i2, i3] },
        Triangle { vertices: [i1, i3, i4] },
    ])
}

fn parse_cbar_card(
    card: &BdfCard,
    node_to_idx: &HashMap<i32, usize>,
) -> Result<Segment> {
    let n1 = card.get_int(3)?;
    let n2 = card.get_int(4)?;

    let &i1 = node_to_idx.get(&n1).ok_or_else(|| {
        AntennaError::ImportError(format!("Vertex {} not found", n1))
    })?;
    let &i2 = node_to_idx.get(&n2).ok_or_else(|| {
        AntennaError::ImportError(format!("Vertex {} not found", n2))
    })?;

    Ok(Segment { start: i1, end: i2 })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_grid_card_free_format() {
        let content = "GRID,1,,0.0,1.0,2.0";
        let cards = parse_bdf_cards(content).unwrap();
        assert_eq!(cards.len(), 1);
        assert_eq!(cards[0].name, "GRID");

        let (node_id, point) = parse_grid_card(&cards[0]).unwrap();
        assert_eq!(node_id, 1);
        assert!((point.x - 0.0).abs() < 1e-10);
        assert!((point.y - 1.0).abs() < 1e-10);
        assert!((point.z - 2.0).abs() < 1e-10);
    }

    #[test]
    fn test_parse_ctria3() {
        let content = r#"
GRID,1,,0.0,0.0,0.0
GRID,2,,1.0,0.0,0.0
GRID,3,,0.5,1.0,0.0
CTRIA3,100,1,1,2,3
"#;

        let mesh = parse_nastran(content).unwrap();
        assert_eq!(mesh.vertices.len(), 3);
        assert_eq!(mesh.triangles.len(), 1);
    }

    #[test]
    fn test_parse_cquad4() {
        let content = r#"
GRID,1,,0.0,0.0,0.0
GRID,2,,1.0,0.0,0.0
GRID,3,,1.0,1.0,0.0
GRID,4,,0.0,1.0,0.0
CQUAD4,200,1,1,2,3,4
"#;

        let mesh = parse_nastran(content).unwrap();
        assert_eq!(mesh.vertices.len(), 4);
        assert_eq!(mesh.triangles.len(), 2);
    }

    #[test]
    fn test_parse_cbar() {
        let content = r#"
GRID,1,,0.0,0.0,0.0
GRID,2,,1.0,0.0,0.0
CBAR,300,1,1,2
"#;

        let mesh = parse_nastran(content).unwrap();
        assert_eq!(mesh.vertices.len(), 2);
        assert_eq!(mesh.segments.len(), 1);
    }

    #[test]
    fn test_scientific_notation() {
        let content = "GRID,1,,1.0D+2,2.5E-1,0.0";
        let cards = parse_bdf_cards(content).unwrap();
        let (_, point) = parse_grid_card(&cards[0]).unwrap();
        assert!((point.x - 100.0).abs() < 1e-10);
        assert!((point.y - 0.25).abs() < 1e-10);
    }

    #[test]
    fn test_error_handling() {
        let content = r#"
GRID,1,,0.0,0.0,0.0
CTRIA3,100,1,1,2,999
"#;

        let result = parse_nastran(content);
        assert!(result.is_err());
    }
}
