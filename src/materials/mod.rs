//! Material property definitions and management

use std::collections::HashMap;

#[derive(Debug, Clone, PartialEq)]
pub struct MaterialProperties {
    pub name: String,
    pub dielectric_constant: f64,
    pub loss_tangent: f64,
    pub conductivity: f64, // S/m
    pub density: f64,      // kg/m³
    pub thermal_conductivity: f64, // W/(m·K)
}

impl MaterialProperties {
    pub fn new(name: String) -> Self {
        Self {
            name,
            dielectric_constant: 1.0,
            loss_tangent: 0.0,
            conductivity: 0.0,
            density: 1000.0,
            thermal_conductivity: 1.0,
        }
    }

    pub fn is_conductor(&self) -> bool {
        self.conductivity > 1e6 // Consider materials with conductivity > 1MS/m as conductors
    }

    pub fn is_dielectric(&self) -> bool {
        !self.is_conductor() && self.dielectric_constant > 1.0
    }
}

#[derive(Debug, Clone)]
pub struct MaterialDatabase {
    materials: HashMap<String, MaterialProperties>,
}

impl MaterialDatabase {
    pub fn new() -> Self {
        let mut db = Self {
            materials: HashMap::new(),
        };
        db.load_default_materials();
        db
    }

    pub fn add_material(&mut self, material: MaterialProperties) {
        self.materials.insert(material.name.clone(), material);
    }

    pub fn get_material(&self, name: &str) -> Option<&MaterialProperties> {
        self.materials.get(name)
    }

    pub fn list_materials(&self) -> Vec<&String> {
        self.materials.keys().collect()
    }

    fn load_default_materials(&mut self) {
        // Copper
        let copper = MaterialProperties {
            name: "Copper".to_string(),
            dielectric_constant: 1.0,
            loss_tangent: 0.0,
            conductivity: 5.8e7,
            density: 8960.0,
            thermal_conductivity: 401.0,
        };
        self.add_material(copper);

        // Aluminum
        let aluminum = MaterialProperties {
            name: "Aluminum".to_string(),
            dielectric_constant: 1.0,
            loss_tangent: 0.0,
            conductivity: 3.8e7,
            density: 2700.0,
            thermal_conductivity: 237.0,
        };
        self.add_material(aluminum);

        // FR4
        let fr4 = MaterialProperties {
            name: "FR4".to_string(),
            dielectric_constant: 4.3,
            loss_tangent: 0.02,
            conductivity: 1e-12,
            density: 1850.0,
            thermal_conductivity: 0.3,
        };
        self.add_material(fr4);

        // Air
        let air = MaterialProperties {
            name: "Air".to_string(),
            dielectric_constant: 1.0,
            loss_tangent: 0.0,
            conductivity: 0.0,
            density: 1.225,
            thermal_conductivity: 0.024,
        };
        self.add_material(air);
    }
}

impl Default for MaterialDatabase {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone)]
pub struct MaterialAssignment {
    pub surface_id: usize,
    pub material_name: String,
}

impl MaterialAssignment {
    pub fn new(surface_id: usize, material_name: String) -> Self {
        Self {
            surface_id,
            material_name,
        }
    }
}