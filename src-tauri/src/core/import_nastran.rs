use std::collections::HashMap;
use std::path::Path;
use anyhow::{anyhow, Result};
use crate::core::geometry::{Point3D, Triangle, Segment, Mesh, Element};

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
            .ok_or_else(|| anyhow!("Missing field at index {}", index))?
            .parse()
            .map_err(|e| anyhow!("Failed to parse integer at index {}: {}", index, e))
    }

    fn get_float(&self, index: usize) -> Result<f64> {
        let field = self.get_field(index)
            .ok_or_else(|| anyhow!("Missing field at index {}", index))?;
        
        // Handle scientific notation with D instead of E
        let normalized = field.replace('D', "E").replace('d', "e");
        
        normalized.parse()
            .map_err(|e| anyhow!("Failed to parse float at index {}: {}", index, e))
    }

    fn get_float_opt(&self, index: usize) -> Result<Option<f64>> {
        match self.get_field(index) {
            Some(field) => {
                let normalized = field.replace('D', "E").replace('d', "e");
                Ok(Some(normalized.parse().map_err(|e| {
                    anyhow!("Failed to parse optional float at index {}: {}", index, e)
                })?))
            },
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
        .map_err(|e| anyhow!("Failed to read file {}: {}", path.display(), e))?;
    parse_nastran(&content)
}

fn parse_bdf_cards(content: &str) -> Result<Vec<BdfCard>> {
    let mut cards = Vec::new();
    let mut current_card_lines = Vec::new();
    
    for line in content.lines() {
        let trimmed = line.trim();
        
        // Skip empty lines and comments
        if trimmed.is_empty() || trimmed.starts_with('$') {
            continue;
        }
        
        // Check if this is a continuation line
        if trimmed.starts_with('+') {
            current_card_lines.push(line);
            continue;
        }
        
        // If we have accumulated card lines, process them
        if !current_card_lines.is_empty() {
            if let Ok(card) = parse_single_card(&current_card_lines) {
                cards.push(card);
            }
            current_card_lines.clear();
        }
        
        // Start a new card
        current_card_lines.push(line);
    }
    
    // Process the last card if any
    if !current_card_lines.is_empty() {
        if let Ok(card) = parse_single_card(&current_card_lines) {
            cards.push(card);
        }
    }
    
    Ok(cards)
}

fn parse_single_card(lines: &[&str]) -> Result<BdfCard> {
    if lines.is_empty() {
        return Err(anyhow!("Empty card"));
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
    // Fixed format typically has card name in first 8 characters
    // and doesn't contain commas as separators
    line.len() >= 8 && !line.contains(',')
}

fn parse_fixed_field_card(lines: &[&str]) -> Result<BdfCard> {
    let first_line = lines[0];
    let card_name = first_line[0..8].trim().to_uppercase();
    
    let mut all_fields = Vec::new();
    all_fields.push(card_name.clone());
    
    for line in lines {
        // Skip continuation marker in first 8 chars for continuation lines
        let data_start = if line.trim_start().starts_with('+') { 8 } else { 8 };
        
        // Fixed format: 8 characters per field
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
            // Remove continuation marker and add the rest
            let clean_line = line.trim_start_matches('+').trim_start_matches(' ');
            if !all_text.ends_with(',') && !clean_line.starts_with(',') {
                all_text.push(',');
            }
            all_text.push_str(clean_line);
        }
    }
    
    // Split by commas and clean up
    let mut fields: Vec<String> = all_text
        .split(',')
        .map(|s| s.trim().to_string())
        .collect();
    
    if fields.is_empty() {
        return Err(anyhow!("No fields found"));
    }
    
    let card_name = fields[0].to_uppercase();
    fields[0] = card_name.clone();
    
    Ok(BdfCard {
        name: card_name,
        fields,
    })
}

fn convert_cards_to_mesh(cards: Vec<BdfCard>) -> Result<Mesh> {
    let mut vertices = HashMap::new();
    let mut elements = Vec::new();
    
    // First pass: collect all GRID cards
    for card in &cards {
        if card.name == "GRID" {
            let grid = parse_grid_card(card)?;
            vertices.insert(grid.0, grid.1);
        }
    }
    
    // Second pass: process element cards
    for card in &cards {
        match card.name.as_str() {
            "CTRIA3" => {
                let triangle = parse_ctria3_card(card, &vertices)?;
                elements.push(Element::Triangle(triangle));
            },
            "CQUAD4" => {
                let triangles = parse_cquad4_card(card, &vertices)?;
                for triangle in triangles {
                    elements.push(Element::Triangle(triangle));
                }
            },
            "CBAR" | "CBEAM" => {
                let segment = parse_cbar_card(card, &vertices)?;
                elements.push(Element::Segment(segment));
            },
            _ => {} // Ignore other card types
        }
    }
    
    // Convert HashMap to Vec maintaining order by node ID
    let mut vertex_pairs: Vec<_> = vertices.into_iter().collect();
    vertex_pairs.sort_by_key(|&(id, _)| id);
    let vertices_vec = vertex_pairs.into_iter().map(|(_, v)| v).collect();
    
    Ok(Mesh {
        vertices: vertices_vec,
        elements,
    })
}

fn parse_grid_card(card: &BdfCard) -> Result<(i32, Point3D)> {
    let node_id = card.get_int(1)?;
    
    let x = card.get_float_opt(3)?.unwrap_or(0.0);
    let y = card.get_float_opt(4)?.unwrap_or(0.0);
    let z = card.get_float_opt(5)?.unwrap_or(0.0);
    
    Ok((node_id, Point3D { x, y, z }))
}

fn parse_ctria3_card(card: &BdfCard, vertices: &HashMap<i32, Point3D>) -> Result<Triangle> {
    let n1 = card.get_int(3)?;
    let n2 = card.get_int(4)?;
    let n3 = card.get_int(5)?;
    
    let v1 = vertices.get(&n1)
        .ok_or_else(|| anyhow!("Vertex {} not found", n1))?;
    let v2 = vertices.get(&n2)
        .ok_or_else(|| anyhow!("Vertex {} not found", n2))?;
    let v3 = vertices.get(&n3)
        .ok_or_else(|| anyhow!("Vertex {} not found", n3))?;
    
    Ok(Triangle {
        v0: *v1,
        v1: *v2,
        v2: *v3,
    })
}

fn parse_cquad4_card(card: &BdfCard, vertices: &HashMap<i32, Point3D>) -> Result<Vec<Triangle>> {
    let n1 = card.get_int(3)?;
    let n2 = card.get_int(4)?;
    let n3 = card.get_int(5)?;
    let n4 = card.get_int(6)?;
    
    let v1 = vertices.get(&n1)
        .ok_or_else(|| anyhow!("Vertex {} not found", n1))?;
    let v2 = vertices.get(&n2)
        .ok_or_else(|| anyhow!("Vertex {} not found", n2))?;
    let v3 = vertices.get(&n3)
        .ok_or_else(|| anyhow!("Vertex {} not found", n3))?;
    let v4 = vertices.get(&n4)
        .ok_or_else(|| anyhow!("Vertex {} not found", n4))?;
    
    // Split quad into two triangles: (1,2,3) and (1,3,4)
    Ok(vec![
        Triangle {
            v0: *v1,
            v1: *v2,
            v2: *v3,
        },
        Triangle {
            v0: *v1,
            v1: *v3,
            v2: *v4,
        },
    ])
}

fn parse_cbar_card(card: &BdfCard, vertices: &HashMap<i32, Point3D>) -> Result<Segment> {
    let n1 = card.get_int(3)?;
    let n2 = card.get_int(4)?;
    
    let v1 = vertices.get(&n1)
        .ok_or_else(|| anyhow!("Vertex {} not found", n1))?;
    let v2 = vertices.get(&n2)
        .ok_or_else(|| anyhow!("Vertex {} not found", n2))?;
    
    Ok(Segment {
        start: *v1,
        end: *v2,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f64::EPSILON;

    fn assert_point_eq(p1: &Point3D, p2: &Point3D) {
        assert!((p1.x - p2.x).abs() < EPSILON);
        assert!((p1.y - p2.y).abs() < EPSILON);
        assert!((p1.z - p2.z).abs() < EPSILON);
    }

    #[test]
    fn test_parse_grid_card_fixed_format() {
        let content = "GRID    1       0.0     1.0     2.0";
        let cards = parse_bdf_cards(content).unwrap();
        assert_eq!(cards.len(), 1);
        assert_eq!(cards[0].name, "GRID");
        
        let vertices = HashMap::new();
        let (node_id, point) = parse_grid_card(&cards[0]).unwrap();
        assert_eq!(node_id, 1);
        assert_point_eq(&point, &Point3D { x: 0.0, y: 1.0, z: 2.0 });
    }

    #[test]
    fn test_parse_grid_card_free_format() {
        let content = "GRID,1,,0.0,1.0,2.0";
        let cards = parse_bdf_cards(content).unwrap();
        assert_eq!(cards.len(), 1);
        assert_eq!(cards[0].name, "GRID");
        
        let (node_id, point) = parse_grid_card(&cards[0]).unwrap();
        assert_eq!(node_id, 1);
        assert_point_eq(&point, &Point3D { x: 0.0, y: 1.0, z: 2.0 });
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
        assert_eq!(mesh.elements.len(), 1);
        
        match &mesh.elements[0] {
            Element::Triangle(tri) => {
                assert_point_eq(&tri.v0, &Point3D { x: 0.0, y: 0.0, z: 0.0 });
                assert_point_eq(&tri.v1, &Point3D { x: 1.0, y: 0.0, z: 0.0 });
                assert_point_eq(&tri.v2, &Point3D { x: 0.5, y: 1.0, z: 0.0 });
            },
            _ => panic!("Expected triangle element"),
        }
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
        assert_eq!(mesh.elements.len(), 2); // Quad split into 2 triangles
        
        // Both elements should be triangles
        for element in &mesh.elements {
            match element {
                Element::Triangle(_) => {},
                _ => panic!("Expected triangle element"),
            }
        }
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
        assert_eq!(mesh.elements.len(), 1);
        
        match &mesh.elements[0] {
            Element::Segment(seg) => {
                assert_point_eq(&seg.start, &Point3D { x: 0.0, y: 0.0, z: 0.0 });
                assert_point_eq(&seg.end, &Point3D { x: 1.0, y: 0.0, z: 0.0 });
            },
            _ => panic!("Expected segment element"),
        }
    }

    #[test]
    fn test_continuation_lines() {
        let content = r#"
GRID,1,,0.0,0.0,0.0
GRID,2,,1.0,0.0,0.0
CTRIA3,100,1,1,2,
+,3
"#;
        
        let mesh = parse_nastran(content).unwrap();
        assert_eq!(mesh.elements.len(), 1);
        
        match &mesh.elements[0] {
            Element::Triangle(_) => {},
            _ => panic!("Expected triangle element"),
        }
    }

    #[test]
    fn test_scientific_notation() {
        let content = "GRID,1,,1.0D+2,2.5E-1,0.0";
        let cards = parse_bdf_cards(content).unwrap();
        let (_, point) = parse_grid_card(&cards[0]).unwrap();
        
        assert_point_eq(&point, &Point3D { x: 100.0, y: 0.25, z: 0.0 });
    }

    #[test]
    fn test_comments_and_empty_lines() {
        let content = r#"
$ This is a comment
GRID,1,,0.0,0.0,0.0

$ Another comment
GRID,2,,1.0,0.0,0.0

CTRIA3,100,1,1,2,3
"#;
        
        let cards = parse_bdf_cards(content).unwrap();
        assert_eq!(cards.len(), 3); // 2 GRID + 1 CTRIA3
    }

    #[test]
    fn test_mixed_formats() {
        let content = r#"
GRID    1       0.0     0.0     0.0
GRID,2,,1.0,0.0,0.0
GRID    3       0.5     1.0     0.0
CTRIA3,100,1,1,2,3
"#;
        
        let mesh = parse_nastran(content).unwrap();
        assert_eq!(mesh.vertices.len(), 3);
        assert_eq!(mesh.elements.len(), 1);
    }

    #[test]
    fn test_error_handling() {
        // Test missing vertex reference
        let content = r#"
GRID,1,,0.0,0.0,0.0
CTRIA3,100,1,1,2,999
"#;
        
        let result = parse_nastran(content);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Vertex 999 not found"));
    }
}