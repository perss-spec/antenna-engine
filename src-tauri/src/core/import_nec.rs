use crate::core::geometry::{Point3D, Mesh, MeshElement};
use anyhow::{Result, anyhow, Context};
use num_complex::Complex64;
use std::collections::HashMap;
use std::fs;
use std::path::Path;

#[derive(Debug, Clone)]
pub struct NecModel {
    pub mesh: Mesh,
    pub ports: Vec<(usize, Complex64)>,  // segment_idx, voltage
    pub frequency: Option<f64>,
    pub wire_radius: f64,
}

#[derive(Debug, Clone)]
struct WireSegment {
    start: Point3D,
    end: Point3D,
    radius: f64,
    tag: i32,
    segments: i32,
}

#[derive(Debug, Clone)]
struct PatchSurface {
    corners: [Point3D; 4],  // 4 corners for quadrilateral patch
}

#[derive(Debug, Clone)]
struct Excitation {
    tag: i32,
    segment: i32,
    voltage: Complex64,
}

pub fn parse_nec_file(path: &Path) -> Result<NecModel> {
    let content = fs::read_to_string(path)
        .with_context(|| format!("Failed to read NEC file: {}", path.display()))?;
    parse_nec(&content)
}

pub fn parse_nec(content: &str) -> Result<NecModel> {
    let mut wires = Vec::new();
    let mut patches = Vec::new();
    let mut excitations = Vec::new();
    let mut frequency = None;
    let mut wire_radius = 0.001; // Default 1mm radius

    for line in content.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('*') {
            continue; // Skip comments and empty lines
        }

        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.is_empty() {
            continue;
        }

        let card_type = parts[0].to_uppercase();
        
        match card_type.as_str() {
            "GW" => {
                if let Ok(wire) = parse_gw_card(&parts) {
                    if wire.radius > 0.0 {
                        wire_radius = wire.radius;
                    }
                    wires.push(wire);
                }
            }
            "SP" => {
                if let Ok(patch) = parse_sp_card(&parts) {
                    patches.push(patch);
                }
            }
            "EX" => {
                if let Ok(excitation) = parse_ex_card(&parts) {
                    excitations.push(excitation);
                }
            }
            "FR" => {
                if let Ok(freq) = parse_fr_card(&parts) {
                    frequency = Some(freq);
                }
            }
            "GE" => break, // End of geometry
            _ => {} // Ignore other cards
        }
    }

    let mesh = build_mesh_from_geometry(&wires, &patches)?;
    let ports = map_excitations_to_segments(&mesh, &excitations, &wires)?;

    Ok(NecModel {
        mesh,
        ports,
        frequency,
        wire_radius,
    })
}

fn parse_gw_card(parts: &[&str]) -> Result<WireSegment> {
    if parts.len() < 8 {
        return Err(anyhow!("GW card requires at least 8 parameters"));
    }

    let tag: i32 = parts[1].parse().context("Invalid tag in GW card")?;
    let segments: i32 = parts[2].parse().context("Invalid segment count in GW card")?;
    let x1: f64 = parts[3].parse().context("Invalid x1 in GW card")?;
    let y1: f64 = parts[4].parse().context("Invalid y1 in GW card")?;
    let z1: f64 = parts[5].parse().context("Invalid z1 in GW card")?;
    let x2: f64 = parts[6].parse().context("Invalid x2 in GW card")?;
    let y2: f64 = parts[7].parse().context("Invalid y2 in GW card")?;
    let z2: f64 = parts[8].parse().context("Invalid z2 in GW card")?;
    
    let radius: f64 = if parts.len() > 9 {
        parts[9].parse().unwrap_or(0.001)
    } else {
        0.001
    };

    Ok(WireSegment {
        start: Point3D::new(x1, y1, z1),
        end: Point3D::new(x2, y2, z2),
        radius,
        tag,
        segments,
    })
}

fn parse_sp_card(parts: &[&str]) -> Result<PatchSurface> {
    if parts.len() < 13 {
        return Err(anyhow!("SP card requires at least 13 parameters"));
    }

    let x1: f64 = parts[1].parse().context("Invalid x1 in SP card")?;
    let y1: f64 = parts[2].parse().context("Invalid y1 in SP card")?;
    let z1: f64 = parts[3].parse().context("Invalid z1 in SP card")?;
    let x2: f64 = parts[4].parse().context("Invalid x2 in SP card")?;
    let y2: f64 = parts[5].parse().context("Invalid y2 in SP card")?;
    let z2: f64 = parts[6].parse().context("Invalid z2 in SP card")?;
    let x3: f64 = parts[7].parse().context("Invalid x3 in SP card")?;
    let y3: f64 = parts[8].parse().context("Invalid y3 in SP card")?;
    let z3: f64 = parts[9].parse().context("Invalid z3 in SP card")?;
    let x4: f64 = parts[10].parse().context("Invalid x4 in SP card")?;
    let y4: f64 = parts[11].parse().context("Invalid y4 in SP card")?;
    let z4: f64 = parts[12].parse().context("Invalid z4 in SP card")?;

    Ok(PatchSurface {
        corners: [
            Point3D::new(x1, y1, z1),
            Point3D::new(x2, y2, z2),
            Point3D::new(x3, y3, z3),
            Point3D::new(x4, y4, z4),
        ],
    })
}

fn parse_ex_card(parts: &[&str]) -> Result<Excitation> {
    if parts.len() < 6 {
        return Err(anyhow!("EX card requires at least 6 parameters"));
    }

    let tag: i32 = parts[2].parse().context("Invalid tag in EX card")?;
    let segment: i32 = parts[3].parse().context("Invalid segment in EX card")?;
    let real: f64 = parts[4].parse().context("Invalid real part in EX card")?;
    let imag: f64 = parts[5].parse().context("Invalid imaginary part in EX card")?;

    Ok(Excitation {
        tag,
        segment,
        voltage: Complex64::new(real, imag),
    })
}

fn parse_fr_card(parts: &[&str]) -> Result<f64> {
    if parts.len() < 5 {
        return Err(anyhow!("FR card requires at least 5 parameters"));
    }

    let frequency: f64 = parts[4].parse().context("Invalid frequency in FR card")?;
    Ok(frequency * 1e6) // Convert MHz to Hz
}

fn build_mesh_from_geometry(wires: &[WireSegment], patches: &[PatchSurface]) -> Result<Mesh> {
    let mut vertices = Vec::new();
    let mut elements = Vec::new();
    let mut vertex_map = HashMap::new();

    // Add wire segments as line elements
    for wire in wires {
        let segments = wire.segments.max(1) as usize;
        
        for i in 0..segments {
            let t1 = i as f64 / segments as f64;
            let t2 = (i + 1) as f64 / segments as f64;
            
            let p1 = interpolate_point(&wire.start, &wire.end, t1);
            let p2 = interpolate_point(&wire.start, &wire.end, t2);
            
            let idx1 = add_vertex(&mut vertices, &mut vertex_map, p1);
            let idx2 = add_vertex(&mut vertices, &mut vertex_map, p2);
            
            elements.push(MeshElement::Line { 
                vertices: [idx1, idx2],
                tag: wire.tag as u32,
            });
        }
    }

    // Add patches as triangular elements
    for patch in patches {
        // Split quadrilateral into two triangles
        let idx1 = add_vertex(&mut vertices, &mut vertex_map, patch.corners[0]);
        let idx2 = add_vertex(&mut vertices, &mut vertex_map, patch.corners[1]);
        let idx3 = add_vertex(&mut vertices, &mut vertex_map, patch.corners[2]);
        let idx4 = add_vertex(&mut vertices, &mut vertex_map, patch.corners[3]);
        
        elements.push(MeshElement::Triangle { 
            vertices: [idx1, idx2, idx3],
            tag: 0,
        });
        elements.push(MeshElement::Triangle { 
            vertices: [idx1, idx3, idx4],
            tag: 0,
        });
    }

    Ok(Mesh { vertices, elements })
}

fn interpolate_point(start: &Point3D, end: &Point3D, t: f64) -> Point3D {
    Point3D::new(
        start.x + t * (end.x - start.x),
        start.y + t * (end.y - start.y),
        start.z + t * (end.z - start.z),
    )
}

fn add_vertex(
    vertices: &mut Vec<Point3D>,
    vertex_map: &mut HashMap<String, usize>,
    point: Point3D,
) -> usize {
    let key = format!("{:.6},{:.6},{:.6}", point.x, point.y, point.z);
    
    if let Some(&idx) = vertex_map.get(&key) {
        idx
    } else {
        let idx = vertices.len();
        vertices.push(point);
        vertex_map.insert(key, idx);
        idx
    }
}

fn map_excitations_to_segments(
    mesh: &Mesh,
    excitations: &[Excitation],
    wires: &[WireSegment],
) -> Result<Vec<(usize, Complex64)>> {
    let mut ports = Vec::new();
    
    for excitation in excitations {
        let segment_idx = find_segment_index(mesh, excitation, wires)?;
        ports.push((segment_idx, excitation.voltage));
    }
    
    Ok(ports)
}

fn find_segment_index(
    mesh: &Mesh,
    excitation: &Excitation,
    wires: &[WireSegment],
) -> Result<usize> {
    let wire = wires
        .iter()
        .find(|w| w.tag == excitation.tag)
        .ok_or_else(|| anyhow!("Wire with tag {} not found", excitation.tag))?;

    let segment_in_wire = (excitation.segment - 1).max(0) as usize;
    let total_segments_before = wires
        .iter()
        .take_while(|w| w.tag < excitation.tag)
        .map(|w| w.segments.max(1) as usize)
        .sum::<usize>();

    let segment_idx = total_segments_before + segment_in_wire;
    
    if segment_idx >= mesh.elements.len() {
        return Err(anyhow!("Segment index {} out of bounds", segment_idx));
    }
    
    Ok(segment_idx)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::f64::consts::PI;

    #[test]
    fn test_parse_dipole_nec() {
        let nec_content = r#"
CM Dipole Antenna
CE
GW 1 21 0.0 0.0 -0.25 0.0 0.0 0.25 0.001
GE 0
EX 0 1 11 0 1.0 0.0
FR 0 1 0 0 100.0
EN
"#;

        let model = parse_nec(nec_content).unwrap();
        
        // Should have 21 segments
        assert_eq!(model.mesh.elements.len(), 21);
        
        // Should have one excitation port
        assert_eq!(model.ports.len(), 1);
        assert_eq!(model.ports[0].1, Complex64::new(1.0, 0.0));
        
        // Should have frequency set
        assert_eq!(model.frequency, Some(100e6)); // 100 MHz in Hz
        
        // Should have wire radius
        assert_eq!(model.wire_radius, 0.001);
    }

    #[test]
    fn test_parse_gw_card() {
        let parts = vec!["GW", "1", "21", "0.0", "0.0", "-0.25", "0.0", "0.0", "0.25", "0.001"];
        let wire = parse_gw_card(&parts).unwrap();
        
        assert_eq!(wire.tag, 1);
        assert_eq!(wire.segments, 21);
        assert_eq!(wire.start, Point3D::new(0.0, 0.0, -0.25));
        assert_eq!(wire.end, Point3D::new(0.0, 0.0, 0.25));
        assert_eq!(wire.radius, 0.001);
    }

    #[test]
    fn test_parse_ex_card() {
        let parts = vec!["EX", "0", "1", "11", "1.0", "0.0"];
        let excitation = parse_ex_card(&parts).unwrap();
        
        assert_eq!(excitation.tag, 1);
        assert_eq!(excitation.segment, 11);
        assert_eq!(excitation.voltage, Complex64::new(1.0, 0.0));
    }

    #[test]
    fn test_parse_fr_card() {
        let parts = vec!["FR", "0", "1", "0", "100.0"];
        let frequency = parse_fr_card(&parts).unwrap();
        
        assert_eq!(frequency, 100e6); // 100 MHz converted to Hz
    }

    #[test]
    fn test_build_mesh_from_wire() {
        let wire = WireSegment {
            start: Point3D::new(0.0, 0.0, -1.0),
            end: Point3D::new(0.0, 0.0, 1.0),
            radius: 0.001,
            tag: 1,
            segments: 2,
        };
        
        let mesh = build_mesh_from_geometry(&[wire], &[]).unwrap();
        
        assert_eq!(mesh.vertices.len(), 3); // 3 vertices for 2 segments
        assert_eq!(mesh.elements.len(), 2); // 2 line elements
        
        // Check first segment
        if let MeshElement::Line { vertices, tag } = &mesh.elements[0] {
            assert_eq!(*tag, 1);
            let v1 = mesh.vertices[vertices[0]];
            let v2 = mesh.vertices[vertices[1]];
            assert!((v1.z + 1.0).abs() < 1e-10);
            assert!(v2.z.abs() < 1e-10);
        } else {
            panic!("Expected line element");
        }
    }

    #[test]
    fn test_patch_surface_to_triangles() {
        let patch = PatchSurface {
            corners: [
                Point3D::new(0.0, 0.0, 0.0),
                Point3D::new(1.0, 0.0, 0.0),
                Point3D::new(1.0, 1.0, 0.0),
                Point3D::new(0.0, 1.0, 0.0),
            ],
        };
        
        let mesh = build_mesh_from_geometry(&[], &[patch]).unwrap();
        
        assert_eq!(mesh.vertices.len(), 4);
        assert_eq!(mesh.elements.len(), 2); // Two triangles from quad
        
        for element in &mesh.elements {
            if let MeshElement::Triangle { vertices, .. } = element {
                assert!(vertices[0] != vertices[1]);
                assert!(vertices[1] != vertices[2]);
                assert!(vertices[0] != vertices[2]);
            } else {
                panic!("Expected triangle element");
            }
        }
    }
}