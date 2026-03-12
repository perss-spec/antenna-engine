use crate::core::types::{AntennaError, Result};

pub struct TouchstoneData {
    pub frequencies: Vec<f64>,
    pub s_parameters: Vec<(f64, f64)>,
}

impl TouchstoneData {
    pub fn from_file(_path: &str) -> Result<Self> {
        Err(AntennaError::InvalidParameter("Touchstone loading not yet implemented".to_string()))
    }
}
