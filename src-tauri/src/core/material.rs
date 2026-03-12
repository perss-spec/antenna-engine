use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Material {
    pub name: String,
    pub epsilon_r: f64,
    pub mu_r: f64,
    pub sigma: f64,
}

impl Material {
    pub fn vacuum() -> Self {
        Self {
            name: "Vacuum".to_string(),
            epsilon_r: 1.0,
            mu_r: 1.0,
            sigma: 0.0,
        }
    }

    pub fn pec() -> Self {
        Self {
            name: "PEC".to_string(),
            epsilon_r: 1.0,
            mu_r: 1.0,
            sigma: f64::INFINITY,
        }
    }
}
