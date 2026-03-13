use serde::{Deserialize, Serialize};
use std::fmt;

/// Error types for the antenna simulation engine
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AntennaError {
    InvalidGeometry(String),
    SimulationFailed(String),
    InvalidParameter(String),
    NumericalError(String),
}

impl fmt::Display for AntennaError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AntennaError::InvalidGeometry(msg) => write!(f, "Invalid geometry: {}", msg),
            AntennaError::SimulationFailed(msg) => write!(f, "Simulation failed: {}", msg),
            AntennaError::InvalidParameter(msg) => write!(f, "Invalid parameter: {}", msg),
            AntennaError::NumericalError(msg) => write!(f, "Numerical error: {}", msg),
        }
    }
}

impl std::error::Error for AntennaError {}

impl From<&str> for AntennaError {
    fn from(msg: &str) -> Self {
        AntennaError::InvalidParameter(msg.to_string())
    }
}

impl From<String> for AntennaError {
    fn from(msg: String) -> Self {
        AntennaError::InvalidParameter(msg)
    }
}

pub type Result<T> = std::result::Result<T, AntennaError>;

/// Basis function type for MoM solver
#[derive(Debug, Clone, Copy, Serialize, Deserialize, Default, PartialEq)]
pub enum BasisType {
    #[default]
    Pulse,
    PiecewiseSinusoidal,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_error_display() {
        let err = AntennaError::InvalidGeometry("bad mesh".into());
        assert!(err.to_string().contains("bad mesh"));
    }

    #[test]
    fn test_error_from_str() {
        let err: AntennaError = "oops".into();
        matches!(err, AntennaError::InvalidParameter(_));
    }
}
