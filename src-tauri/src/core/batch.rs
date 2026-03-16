//! Batch simulation API for parameter sweeps and optimization

use super::types::{Result, AntennaError, SimulationParams, SimulationResult};
use super::element::AntennaElement;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Parameter sweep configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParameterSweep {
    pub parameter_name: String,
    pub start_value: f64,
    pub end_value: f64,
    pub num_points: usize,
    pub scale_type: ScaleType,
}

/// Scale type for parameter sweeps
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ScaleType {
    Linear,
    Logarithmic,
}

/// Batch simulation configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchConfig {
    pub base_element: AntennaElement,
    pub base_params: SimulationParams,
    pub sweeps: Vec<ParameterSweep>,
    pub parallel: bool,
}

/// Single simulation point in batch
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationPoint {
    pub parameters: HashMap<String, f64>,
    pub result: Option<SimulationResult>,
    pub error: Option<String>,
}

/// Batch simulation results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BatchResult {
    pub config: BatchConfig,
    pub points: Vec<SimulationPoint>,
    pub total_points: usize,
    pub successful_points: usize,
    pub failed_points: usize,
    pub execution_time_ms: u64,
}

/// Batch simulation engine
pub struct BatchSimulator;

impl BatchSimulator {
    /// Create new batch simulator
    pub fn new() -> Self {
        Self
    }

    /// Run batch simulation
    pub fn run_batch(&mut self, config: BatchConfig) -> Result<BatchResult> {
        let start_time = std::time::Instant::now();
        
        // Generate parameter combinations
        let parameter_sets = self.generate_parameter_combinations(&config.sweeps)?;
        let total_points = parameter_sets.len();
        
        // Run simulations
        let points = if config.parallel {
            self.run_parallel_simulations(&config, parameter_sets)?
        } else {
            self.run_sequential_simulations(&config, parameter_sets)?
        };
        
        let successful_points = points.iter().filter(|p| p.result.is_some()).count();
        let failed_points = total_points - successful_points;
        
        Ok(BatchResult {
            config,
            points,
            total_points,
            successful_points,
            failed_points,
            execution_time_ms: start_time.elapsed().as_millis() as u64,
        })
    }

    /// Generate all parameter combinations from sweeps
    fn generate_parameter_combinations(&self, sweeps: &[ParameterSweep]) -> Result<Vec<HashMap<String, f64>>> {
        if sweeps.is_empty() {
            return Ok(vec![HashMap::new()]);
        }
        
        let mut combinations = vec![HashMap::new()];
        
        for sweep in sweeps {
            let values = self.generate_sweep_values(sweep)?;
            let mut new_combinations = Vec::new();
            
            for combination in &combinations {
                for &value in &values {
                    let mut new_combo = combination.clone();
                    new_combo.insert(sweep.parameter_name.clone(), value);
                    new_combinations.push(new_combo);
                }
            }
            
            combinations = new_combinations;
        }
        
        Ok(combinations)
    }

    /// Generate values for a single parameter sweep
    fn generate_sweep_values(&self, sweep: &ParameterSweep) -> Result<Vec<f64>> {
        if sweep.num_points == 0 {
            return Ok(vec![]);
        }
        
        if sweep.num_points == 1 {
            return Ok(vec![sweep.start_value]);
        }
        
        let mut values = Vec::with_capacity(sweep.num_points);
        
        match sweep.scale_type {
            ScaleType::Linear => {
                let step = (sweep.end_value - sweep.start_value) / (sweep.num_points - 1) as f64;
                for i in 0..sweep.num_points {
                    values.push(sweep.start_value + i as f64 * step);
                }
            }
            ScaleType::Logarithmic => {
                if sweep.start_value <= 0.0 || sweep.end_value <= 0.0 {
                    return Err(AntennaError::InvalidParameter(
                        "Logarithmic sweep requires positive values".to_string()
                    ));
                }
                
                let log_start = sweep.start_value.ln();
                let log_end = sweep.end_value.ln();
                let log_step = (log_end - log_start) / (sweep.num_points - 1) as f64;
                
                for i in 0..sweep.num_points {
                    values.push((log_start + i as f64 * log_step).exp());
                }
            }
        }
        
        Ok(values)
    }

    /// Run simulations sequentially
    fn run_sequential_simulations(
        &self,
        config: &BatchConfig,
        parameter_sets: Vec<HashMap<String, f64>>,
    ) -> Result<Vec<SimulationPoint>> {
        let mut points = Vec::new();
        
        for parameters in parameter_sets {
            let point = self.run_single_simulation(config, parameters)?;
            points.push(point);
        }
        
        Ok(points)
    }

    /// Run simulations in parallel
    fn run_parallel_simulations(
        &self,
        config: &BatchConfig,
        parameter_sets: Vec<HashMap<String, f64>>,
    ) -> Result<Vec<SimulationPoint>> {
        // For now, fall back to sequential (parallel requires more complex setup)
        self.run_sequential_simulations(config, parameter_sets)
    }

    /// Run a single simulation with given parameters
    fn run_single_simulation(
        &self,
        config: &BatchConfig,
        parameters: HashMap<String, f64>,
    ) -> Result<SimulationPoint> {
        // Apply parameters to create modified element
        let _element = self.apply_parameters_to_element(&config.base_element, &parameters)?;

        // TODO: integrate with actual solver when solver API stabilizes
        Ok(SimulationPoint {
            parameters,
            result: None,
            error: Some("Batch solver integration pending".to_string()),
        })
    }

    /// Apply parameter values to antenna element
    fn apply_parameters_to_element(
        &self,
        base_element: &AntennaElement,
        parameters: &HashMap<String, f64>,
    ) -> Result<AntennaElement> {
        match base_element {
            AntennaElement::Dipole(params) => {
                let mut new_params = params.clone();
                
                if let Some(&length) = parameters.get("length") {
                    new_params.length = length;
                }
                if let Some(&radius) = parameters.get("radius") {
                    new_params.radius = radius;
                }
                
                Ok(AntennaElement::Dipole(new_params))
            }
            AntennaElement::Patch(params) => {
                let mut new_params = params.clone();
                
                if let Some(&width) = parameters.get("width") {
                    new_params.width = width;
                }
                if let Some(&length) = parameters.get("length") {
                    new_params.length = length;
                }
                if let Some(&substrate_height) = parameters.get("substrate_height") {
                    new_params.substrate_height = substrate_height;
                }
                if let Some(&substrate_er) = parameters.get("substrate_er") {
                    new_params.substrate_er = substrate_er;
                }
                
                Ok(AntennaElement::Patch(new_params))
            }
            AntennaElement::Qfh(params) => {
                let mut new_params = params.clone();

                if let Some(&frequency) = parameters.get("frequency") {
                    new_params.frequency = frequency;
                }
                if let Some(&turns) = parameters.get("turns") {
                    new_params.turns = turns;
                }
                if let Some(&diameter) = parameters.get("diameter") {
                    new_params.diameter = diameter;
                }
                if let Some(&height) = parameters.get("height") {
                    new_params.height = height;
                }
                if let Some(&wire_radius) = parameters.get("wire_radius") {
                    new_params.wire_radius = wire_radius;
                }

                Ok(AntennaElement::Qfh(new_params))
            }
            AntennaElement::Monopole(params) => {
                let mut new_params = params.clone();

                if let Some(&height) = parameters.get("height") {
                    new_params.height = height;
                }
                if let Some(&radius) = parameters.get("radius") {
                    new_params.radius = radius;
                }
                if let Some(&ground_plane_radius) = parameters.get("ground_plane_radius") {
                    new_params.ground_plane_radius = ground_plane_radius;
                }

                Ok(AntennaElement::Monopole(new_params))
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_batch_simulator_creation() {
        let simulator = BatchSimulator::new();
        drop(simulator);
    }

    #[test]
    fn test_parameter_sweep_generation() {
        let simulator = BatchSimulator::new();

        let sweep = ParameterSweep {
            parameter_name: "length".to_string(),
            start_value: 0.1,
            end_value: 0.2,
            num_points: 3,
            scale_type: ScaleType::Linear,
        };

        let values = simulator.generate_sweep_values(&sweep).unwrap();
        assert_eq!(values.len(), 3);
        assert!((values[0] - 0.1).abs() < 1e-10);
        assert!((values[2] - 0.2).abs() < 1e-10);
    }

    #[test]
    fn test_empty_batch_run() {
        let mut simulator = BatchSimulator::new();

        let config = BatchConfig {
            base_element: AntennaElement::Dipole(crate::core::element::DipoleParams {
                length: 0.15,
                radius: 0.001,
                center: crate::core::types::Point3D { x: 0.0, y: 0.0, z: 0.0 },
                orientation: crate::core::types::Point3D { x: 0.0, y: 0.0, z: 1.0 },
            }),
            base_params: SimulationParams {
                frequency: 1e9,
                resolution: 10.0,
                reference_impedance: 50.0,
            },
            sweeps: vec![],
            parallel: false,
        };

        let result = simulator.run_batch(config);
        assert!(result.is_ok());
    }
}