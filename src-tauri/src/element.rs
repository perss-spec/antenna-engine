use serde::{Deserialize, Serialize};
use crate::types::Point3D;

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
    pub length: f64,
    pub radius: f64,
    pub ground_plane_radius: f64,
    pub center: Point3D,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct YagiParams {
    pub reflector_length: f64,
    pub driven_length: f64,
    pub director_length: f64,
    pub element_spacing: f64,
    pub wire_radius: f64,
    pub center: Point3D,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AntennaElement {
    Dipole(DipoleParams),
    Patch(PatchParams),
    Qfh(QfhParams),
    Monopole(MonopoleParams),
    Yagi(YagiParams),
}

pub trait AntennaGeometry {
    fn get_segments(&self) -> Vec<Point3D>;
    fn get_feed_points(&self) -> Vec<Point3D>;
    fn get_bounding_box(&self) -> (Point3D, Point3D);
    fn validate_parameters(&self) -> Result<(), crate::types::AntennaError>;
    fn get_resonant_frequency(&self) -> f64;
}