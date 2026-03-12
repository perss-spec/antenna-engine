use serde::{Deserialize, Serialize};

// Module declarations
pub mod types;

/// Returns a hello world message
pub fn hello() -> String {
    "Hello World".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hello() {
        assert_eq!(hello(), "Hello World");
    }
}