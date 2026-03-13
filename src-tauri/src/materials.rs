use serde::{Deserialize, Serialize};
use crate::types::Material;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaterialDatabase {
    pub materials: HashMap<String, Material>,
}

impl MaterialDatabase {
    pub fn new() -> Self {
        let mut materials = HashMap::new();
        
        // Perfect Electric Conductor
        materials.insert("PEC".to_string(), Material {
            name: "Perfect Electric Conductor".to_string(),
            epsilon_r: 1.0,
            mu_r: 1.0,
            sigma: 1e10,
            tan_delta: 0.0,
        });
        
        // Copper
        materials.insert("Copper".to_string(), Material {
            name: "Copper".to_string(),
            epsilon_r: 1.0,
            mu_r: 1.0,
            sigma: 5.96e7,
            tan_delta: 0.0,
        });
        
        // FR4 Substrate
        materials.insert("FR4".to_string(), Material {
            name: "FR4 Substrate".to_string(),
            epsilon_r: 4.4,
            mu_r: 1.0,
            sigma: 0.0,
            tan_delta: 0.02,
        });
        
        // Air/Vacuum
        materials.insert("Air".to_string(), Material {
            name: "Air".to_string(),
            epsilon_r: 1.0,
            mu_r: 1.0,
            sigma: 0.0,
            tan_delta: 0.0,
        });
        
        // Rogers RT/duroid 5880
        materials.insert("RT5880".to_string(), Material {
            name: "Rogers RT/duroid 5880".to_string(),
            epsilon_r: 2.2,
            mu_r: 1.0,
            sigma: 0.0,
            tan_delta: 0.0009,
        });
        
        Self { materials }
    }
    
    pub fn get_material(&self, name: &str) -> Option<&Material> {
        self.materials.get(name)
    }
    
    pub fn add_material(&mut self, material: Material) {
        self.materials.insert(material.name.clone(), material);
    }
    
    pub fn list_materials(&self) -> Vec<&String> {
        self.materials.keys().collect()
    }
}