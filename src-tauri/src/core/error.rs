use serde::{Deserialize, Serialize};
use std::fmt;

/// Error types for the antenna simulation engine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AntennaError {
    /// Invalid parameter provided
    InvalidParameter(String),
    /// Numerical computation error
    NumericalError(String),
    /// Convergence failure
    ConvergenceError(String),
    /// Unsupported operation
    UnsupportedOperation(String),
    /// Generic error
    Generic(String),
}

impl fmt::Display for AntennaError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AntennaError::InvalidParameter(msg) => write!(f, "Invalid parameter: {}", msg),
            AntennaError::NumericalError(msg) => write!(f, "Numerical error: {}", msg),
            AntennaError::ConvergenceError(msg) => write!(f, "Convergence error: {}", msg),
            AntennaError::UnsupportedOperation(msg) => write!(f, "Unsupported operation: {}", msg),
            AntennaError::Generic(msg) => write!(f, "Error: {}", msg),
        }
    }
}

impl std::error::Error for AntennaError {}