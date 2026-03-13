use serde::{Deserialize, Serialize};
use crate::core::types::Point3D;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DipoleParams {
    pub length: f64,
    pub radius: f64,
    pub center: Point3D,
    pub orientation: Point3D,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PatchParams {
    pub width: f64,
    pub length: f64,
    pub substrate_height: f64,
    pub substrate_er: f64,
    pub center: Point3D,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QfhParams {
    pub frequency: f64,
    pub turns: f64,
    pub diameter: f64,
    pub height: f64,
    pub wire_radius: f64,
    pub center: Point3D,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonopoleParams {
    pub height: f64,
    pub radius: f64,
    pub ground_plane_radius: f64,
    pub center: Point3D,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AntennaElement {
    Dipole(DipoleParams),
    Patch(PatchParams),
    Qfh(QfhParams),
    Monopole(MonopoleParams),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WireSegment {
    pub start: Point3D,
    pub end: Point3D,
    pub radius: f64,
    pub material_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SurfaceElement {
    pub vertices: Vec<Point3D>,
    pub normal: Point3D,
    pub area: f64,
    pub material_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AntennaGeometry {
    pub wire_segments: Vec<WireSegment>,
    pub surface_elements: Vec<SurfaceElement>,
    pub feed_points: Vec<Point3D>,
    pub bounding_box: (Point3D, Point3D),
}