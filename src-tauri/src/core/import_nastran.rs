use crate::core::geometry::{Point3D, Mesh, Element};
use crate::core::types::Result;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone)]
struct BdfCard {
    card_type: String,
    fields: Vec<String>,
}

impl BdfCard {
    fn new(card_type: String) -> Self {
        Self {
            card_type,
            fields: Vec::new(),
        }
    }

    fn add_field(&mut self, field: String) {
        self.fields.push(field);
    }

    fn get_field(&self, index: usize) -> Option<&str> {
        self.fields.get(index).map(|s| s.trim()).filter(|s| !s.is_empty())
    }

    fn get_int(&self, index: usize) -> Option<i32> {
        self.get_field(index)?.parse().ok()
    }

    fn get_float(&self, index: usize) -> Option<f64> {
        self.get_field(index)?.parse().ok()
    }
}

struct BdfParser {
    vertices: HashMap<i32, Point3D>,
    elements: Vec<Element>,
}

impl BdfParser {
    fn new() -> Self {
        Self {
            vertices: HashMap::new(),
            elements: Vec::new(),
        }
    }

    fn parse_content(&mut self, content: &str) -> Result<()> {
        let lines = self.preprocess_lines(content)?;
        let cards = self.parse_cards(&lines)?;

        for card in cards {
            match card.card_type.as_str() {
                "GRID" => self.parse_grid_card(&card)?,
                "CTRIA3" => self.parse_ctria3_card(&card)?,
                "CBAR" | "CBEAM" => self.parse_cbar_card(&card)?,
                "CQUAD4" => self.parse_cquad4_card(&card)?,
                _ => {} // Ignore unknown cards
            }
        }

        Ok(())
    }

    fn preprocess_lines(&self, content: &str) -> Result<Vec<String>> {
        let mut processed_lines = Vec::new();
        let mut current_line = String::new();

        for line in content.lines() {
            let line = line.trim();
            
            // Skip comments and empty lines
            if line.starts_with('$') || line.is_empty() {
                continue;
            }

            // Handle continuation lines
            if line.starts_with('+') {
                // This is a continuation line
                current_line.push(' ');
                current_line.push_str(&line[1..].trim());
            } else {
                // New card or continuation of previous
                if !current_line.is_empty() {
                    processed_lines.push(current_line);
                }
                current_line = line.to_string();
            }
        }

        // Don't forget the last line
        if !current_line.is_empty() {
            processed_lines.push(current_line);
        }

        Ok(processed_lines)
    }

    fn parse_cards(&self, lines: &[String]) -> Result<Vec<BdfCard>> {
        let mut cards = Vec::new();

        for line in lines {
            let card = self.parse_single_card(line)?;
            if let Some(card) = card {
                cards.push(card);
            }
        }

        Ok(cards)
    }

    fn parse_single_card(&self, line: &str) -> Result<Option<BdfCard>> {
        if line.is_empty() {
            return Ok(None);
        }

        // Determine if this is free-field or fixed-field format
        if line.contains(',') {
            self.parse_free_field_card(line)
        } else {
            self.parse_fixed_field_card(line)
        }
    }

    fn parse_free_field_card(&self, line: &str) -> Result<Option<BdfCard>> {
        let parts: Vec<&str> = line.split(',').collect();
        if parts.is_empty() {
            return Ok(None);
        }

        let card_type = parts[0].trim().to_uppercase();
        let mut card = BdfCard::new(card_type);

        for part in parts.iter().skip(1) {
            card.add_field(part.trim().to_string());
        }

        Ok(Some(card))
    }

    fn parse_fixed_field_card(&self, line: &str) -> Result<Option<BdfCard>> {
        if line.len() < 8 {
            return Ok(None);
        }

        let card_type = line[0..8].trim().to_uppercase();
        let mut card = BdfCard::new(card_type);

        // Parse 8-character fields
        let mut pos = 8;
        while pos < line.len() {
            let end = std::cmp::min(pos + 8, line.len());
            let field = line[pos..end].trim().to_string();
            card.add_field(field);
            pos += 8;
        }

        Ok(Some(card))
    }

    fn parse_grid_card(&mut self, card: &BdfCard) -> Result<()> {
        let id = card.get_int(0).ok_or("Invalid GRID ID")?;
        let x = card.get_float(2).unwrap_or(0.0);
        let y = card.get_float(3).unwrap_or(0.0);
        let z = card.get_float(4).unwrap_or(0.0);

        self.vertices.insert(id, Point3D { x, y, z });
        Ok(())
    }

    fn parse_ctria3_card(&mut self, card: &BdfCard) -> Result<()> {
        let _element_id = card.get_int(0).ok_or("Invalid CTRIA3 element ID")?;
        let _property_id = card.get_int(1).ok_or("Invalid CTRIA3 property ID")?;
        let node1 = card.get_int(2).ok_or("Invalid CTRIA3 node 1")?;
        let node2 = card.get_int(3).ok_or("Invalid CTRIA3 node 2")?;
        let node3 = card.get_int(4).ok_or("Invalid CTRIA3 node 3")?;

        if let (Some(&p1), Some(&p2), Some(&p3)) = (
            self.vertices.get(&node1),
            self.vertices.get(&node2),
            self.vertices.get(&node3),
        ) {
            self.elements.push(Element::Triangle([p1, p2, p3]));
        }

        Ok(())
    }

    fn parse_cbar_card(&mut self, card: &BdfCard) -> Result<()> {
        let _element_id = card.get_int(0).ok_or("Invalid CBAR element ID")?;
        let _property_id = card.get_int(1).ok_or("Invalid CBAR property ID")?;
        let node1 = card.get_int(2).ok_or("Invalid CBAR node 1")?;
        let node2 = card.get_int(3).ok_or("Invalid CBAR node 2")?;

        if let (Some(&p1), Some(&p2)) = (
            self.vertices.get(&node1),
            self.vertices.get(&node2),
        ) {
            self.elements.push(Element::Segment([p1, p2]));
        }

        Ok(())
    }

    fn parse_cquad4_card(&mut self, card: &BdfCard) -> Result<()> {
        let _element_id = card.get_int(0).ok_or("Invalid CQUAD4 element ID")?;
        let _property_id = card.get_int(1).ok_or("Invalid CQUAD4 property ID")?;
        let node1 = card.get_int(2).ok_or("Invalid CQUAD4 node 1")?;
        let node2 = card.get_int(3).ok_or("Invalid CQUAD4 node 2")?;
        let node3 = card.get_int(4).ok_or("Invalid CQUAD4 node 3")?;
        let node4 = card.get_int(5).ok_or("Invalid CQUAD4 node 4")?;

        if let (Some(&p1), Some(&p2), Some(&p3), Some(&p4)) = (
            self.vertices.get(&node1),
            self.vertices.get(&node2),
            self.vertices.get(&node3),
            self.vertices.get(&node4),
        ) {
            // Split quad into two triangles: (1,2,3) and (1,3,4)
            self.elements.push(Element::Triangle([p1, p2, p3]));
            self.elements.push(Element::Triangle([p1, p3, p4]));
        }

        Ok(())
    }

    fn into_mesh(self) -> Mesh {
        Mesh {
            elements: self.elements,
        }
    }
}

pub fn parse_nastran(content: &str) -> Result<Mesh> {
    let mut parser = BdfParser::new();
    parser.parse_content(content)?;
    Ok(parser.into_mesh())
}

pub fn parse_nastran_file(path: &Path) -> Result<Mesh> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Failed to read file {}: {}", path.display(), e))?;
    parse_nastran(&content)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_grid_fixed_format() {
        let content = r#"
GRID    1               0.0     1.0     2.0
GRID    2               1.0     0.0     0.0
        "#;

        let mesh = parse_nastran(content).unwrap();
        // We can't directly check vertices since they're not exposed in Mesh
        // But we can verify the parser doesn't crash and returns a valid mesh
        assert!(mesh.elements.is_empty()); // No elements defined
    }

    #[test]
    fn test_parse_grid_free_format() {
        let content = r#"
GRID,1,,0.0,1.0,2.0
GRID,2,,1.0,0.0,0.0
        "#;

        let mesh = parse_nastran(content).unwrap();
        assert!(mesh.elements.is_empty()); // No elements defined
    }

    #[test]
    fn test_parse_triangle() {
        let content = r#"
GRID,1,,0.0,0.0,0.0
GRID,2,,1.0,0.0,0.0
GRID,3,,0.5,1.0,0.0
CTRIA3,1,1,1,2,3
        "#;

        let mesh = parse_nastran(content).unwrap();
        assert_eq!(mesh.elements.len(), 1);
        match &mesh.elements[0] {
            Element::Triangle(_) => {},
            _ => panic!("Expected triangle element"),
        }
    }

    #[test]
    fn test_parse_segment() {
        let content = r#"
GRID,1,,0.0,0.0,0.0
GRID,2,,1.0,0.0,0.0
CBAR,1,1,1,2
        "#;

        let mesh = parse_nastran(content).unwrap();
        assert_eq!(mesh.elements.len(), 1);
        match &mesh.elements[0] {
            Element::Segment(_) => {},
            _ => panic!("Expected segment element"),
        }
    }

    #[test]
    fn test_parse_quad_to_triangles() {
        let content = r#"
GRID,1,,0.0,0.0,0.0
GRID,2,,1.0,0.0,0.0
GRID,3,,1.0,1.0,0.0
GRID,4,,0.0,1.0,0.0
CQUAD4,1,1,1,2,3,4
        "#;

        let mesh = parse_nastran(content).unwrap();
        assert_eq!(mesh.elements.len(), 2); // Quad split into 2 triangles
        
        for element in &mesh.elements {
            match element {
                Element::Triangle(_) => {},
                _ => panic!("Expected triangle elements from quad"),
            }
        }
    }

    #[test]
    fn test_parse_continuation_lines() {
        let content = r#"
GRID,1,,0.0,0.0,0.0
GRID,2,,1.0,0.0,0.0
GRID,3,,0.5,1.0,0.0
CTRIA3,1,1,1,2,
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
    fn test_parse_comments() {
        let content = r#"
$ This is a comment
GRID,1,,0.0,0.0,0.0
$ Another comment
GRID,2,,1.0,0.0,0.0
GRID,3,,0.5,1.0,0.0
CTRIA3,1,1,1,2,3
$ Final comment
        "#;

        let mesh = parse_nastran(content).unwrap();
        assert_eq!(mesh.elements.len(), 1);
    }

    #[test]
    fn test_mixed_formats() {
        let content = r#"
GRID    1               0.0     0.0     0.0
GRID,2,,1.0,0.0,0.0
GRID    3               0.5     1.0     0.0
CTRIA3,1,1,1,2,3
        "#;

        let mesh = parse_nastran(content).unwrap();
        assert_eq!(mesh.elements.len(), 1);
        match &mesh.elements[0] {
            Element::Triangle(_) => {},
            _ => panic!("Expected triangle element"),
        }
    }

    #[test]
    fn test_empty_content() {
        let content = "";
        let mesh = parse_nastran(content).unwrap();
        assert!(mesh.elements.is_empty());
    }

    #[test]
    fn test_only_comments() {
        let content = r#"
$ Comment 1
$ Comment 2
$ Comment 3
        "#;
        let mesh = parse_nastran(content).unwrap();
        assert!(mesh.elements.is_empty());
    }
}