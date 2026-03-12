use serde::{Deserialize, Serialize};
use crate::core::geometry::{Point3D, Mesh, Segment, Triangle};
use crate::core::types::{AntennaError, Result};

/// Antenna element types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum AntennaElement {
    Dipole(DipoleParams),
    Patch(PatchParams),
    Qfh(QfhParams),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DipoleParams {
    pub length: f64,
    pub radius: f64,
    pub center: Point3D,
    pub orientation: Point3D,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchParams {
    pub width: f64,
    pub length: f64,
    pub substrate_height: f64,
    pub substrate_er: f64,
    pub center: Point3D,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QfhParams {
    pub frequency: f64,
    pub turns: f64,
    pub diameter: f64,
    pub height: f64,
    pub wire_radius: f64,
    pub center: Point3D,
}

impl AntennaElement {
    pub fn new_dipole(length: f64, radius: f64) -> Self {
        AntennaElement::Dipole(DipoleParams {
            length,
            radius,
            center: Point3D::origin(),
            orientation: Point3D::new(0.0, 0.0, 1.0),
        })
    }

    pub fn new_patch(width: f64, length: f64, substrate_height: f64, substrate_er: f64) -> Self {
        AntennaElement::Patch(PatchParams {
            width,
            length,
            substrate_height,
            substrate_er,
            center: Point3D::origin(),
        })
    }

    pub fn validate(&self) -> Result<()> {
        match self {
            AntennaElement::Dipole(p) => {
                if p.length <= 0.0 {
                    return Err(AntennaError::InvalidGeometry("Dipole length must be positive".into()));
                }
                if p.radius <= 0.0 {
                    return Err(AntennaError::InvalidGeometry("Dipole radius must be positive".into()));
                }
                Ok(())
            }
            AntennaElement::Patch(p) => {
                if p.width <= 0.0 || p.length <= 0.0 {
                    return Err(AntennaError::InvalidGeometry("Patch dimensions must be positive".into()));
                }
                if p.substrate_height <= 0.0 {
                    return Err(AntennaError::InvalidGeometry("Substrate height must be positive".into()));
                }
                if p.substrate_er < 1.0 {
                    return Err(AntennaError::InvalidGeometry("Substrate permittivity must be >= 1".into()));
                }
                Ok(())
            }
            AntennaElement::Qfh(p) => {
                if p.frequency <= 0.0 {
                    return Err(AntennaError::InvalidGeometry("QFH frequency must be positive".into()));
                }
                if p.turns <= 0.0 {
                    return Err(AntennaError::InvalidGeometry("QFH turns must be positive".into()));
                }
                if p.diameter <= 0.0 || p.height <= 0.0 {
                    return Err(AntennaError::InvalidGeometry("QFH dimensions must be positive".into()));
                }
                if p.wire_radius <= 0.0 {
                    return Err(AntennaError::InvalidGeometry("QFH wire radius must be positive".into()));
                }
                Ok(())
            }
        }
    }

    pub fn generate_mesh(&self, resolution: f64) -> Result<Mesh> {
        self.validate()?;
        match self {
            AntennaElement::Dipole(p) => generate_dipole_mesh(p, resolution),
            AntennaElement::Patch(p) => generate_patch_mesh(p, resolution),
            AntennaElement::Qfh(p) => generate_qfh_mesh(p, resolution),
        }
    }

    pub fn name(&self) -> &str {
        match self {
            AntennaElement::Dipole(_) => "dipole",
            AntennaElement::Patch(_) => "patch",
            AntennaElement::Qfh(_) => "qfh",
        }
    }
}

fn generate_dipole_mesh(p: &DipoleParams, resolution: f64) -> Result<Mesh> {
    let n_seg = ((p.length / resolution).ceil() as usize).max(10);
    let dir = p.orientation.normalized();
    let mut vertices = Vec::with_capacity(n_seg + 1);
    let mut segments = Vec::with_capacity(n_seg);

    for i in 0..=n_seg {
        let t = (i as f64) / (n_seg as f64) - 0.5;
        let offset = dir.scale(t * p.length);
        vertices.push(p.center.add(&offset));
    }

    for i in 0..n_seg {
        segments.push(Segment { start: i, end: i + 1 });
    }

    Ok(Mesh {
        vertices,
        triangles: Vec::new(),
        segments,
    })
}

fn generate_patch_mesh(p: &PatchParams, resolution: f64) -> Result<Mesh> {
    let nx = ((p.width / resolution).ceil() as usize).max(4);
    let ny = ((p.length / resolution).ceil() as usize).max(4);
    let mut vertices = Vec::with_capacity((nx + 1) * (ny + 1));
    let mut triangles = Vec::with_capacity(nx * ny * 2);

    for j in 0..=ny {
        for i in 0..=nx {
            let x = p.center.x + (i as f64 / nx as f64 - 0.5) * p.width;
            let y = p.center.y + (j as f64 / ny as f64 - 0.5) * p.length;
            let z = p.center.z + p.substrate_height;
            vertices.push(Point3D::new(x, y, z));
        }
    }

    for j in 0..ny {
        for i in 0..nx {
            let v0 = j * (nx + 1) + i;
            let v1 = v0 + 1;
            let v2 = v0 + nx + 1;
            let v3 = v2 + 1;
            triangles.push(Triangle { vertices: [v0, v1, v2] });
            triangles.push(Triangle { vertices: [v1, v3, v2] });
        }
    }

    Ok(Mesh {
        vertices,
        triangles,
        segments: Vec::new(),
    })
}

fn generate_qfh_mesh(p: &QfhParams, resolution: f64) -> Result<Mesh> {
    let circumference = std::f64::consts::PI * p.diameter;
    let wire_length = ((circumference * p.turns).powi(2) + p.height.powi(2)).sqrt();
    let n_seg = ((wire_length / resolution).ceil() as usize).max(20);
    let mut vertices = Vec::with_capacity(n_seg + 1);
    let mut segments = Vec::with_capacity(n_seg);
    let r = p.diameter / 2.0;

    for i in 0..=n_seg {
        let t = i as f64 / n_seg as f64;
        let angle = 2.0 * std::f64::consts::PI * p.turns * t;
        let x = p.center.x + r * angle.cos();
        let y = p.center.y + r * angle.sin();
        let z = p.center.z + p.height * (t - 0.5);
        vertices.push(Point3D::new(x, y, z));
    }

    for i in 0..n_seg {
        segments.push(Segment { start: i, end: i + 1 });
    }

    Ok(Mesh {
        vertices,
        triangles: Vec::new(),
        segments,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dipole_creation_and_mesh() {
        let elem = AntennaElement::new_dipole(0.15, 0.001);
        assert_eq!(elem.name(), "dipole");
        assert!(elem.validate().is_ok());

        let mesh = elem.generate_mesh(0.01).unwrap();
        assert!(mesh.vertices.len() >= 11);
        assert!(mesh.segments.len() >= 10);
        assert!(mesh.triangles.is_empty());
    }

    #[test]
    fn test_patch_creation_and_mesh() {
        let elem = AntennaElement::new_patch(0.03, 0.04, 0.0016, 4.4);
        assert_eq!(elem.name(), "patch");
        assert!(elem.validate().is_ok());

        let mesh = elem.generate_mesh(0.005).unwrap();
        assert!(mesh.vertices.len() > 0);
        assert!(mesh.triangles.len() > 0);
        assert!(mesh.segments.is_empty());
    }

    #[test]
    fn test_invalid_dipole() {
        let elem = AntennaElement::new_dipole(-1.0, 0.001);
        assert!(elem.validate().is_err());
        assert!(elem.generate_mesh(0.01).is_err());
    }

    #[test]
    fn test_invalid_patch() {
        let elem = AntennaElement::new_patch(0.03, 0.04, 0.0016, 0.5);
        assert!(elem.validate().is_err());
    }
}
