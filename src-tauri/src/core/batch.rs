//! Batch simulation API for parameter sweeps and optimization

use crate::core::types::{Result, AntennaError};
use crate::core::element::AntennaElement;
use crate::core::solver::{MomSolver, SimulationParams, SimulationResult};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use rayon::prelude::*;

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
            
            for combo in &combinations {
                for &value in &values {
                    let mut new_combo = combo.clone();
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
            return Err(AntennaError::InvalidParameter("Number of points must be > 0".to_string()));
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
            },
            ScaleType::Logarithmic => {
                if sweep.start_value <= 0.0 || sweep.end_value <= 0.0 {
                    return Err(AntennaError::InvalidParameter("Logarithmic sweep requires positive values".to_string()));
                }
                let log_start = sweep.start_value.ln();
                let log_end = sweep.end_value.ln();
                let log_step = (log_end - log_start) / (sweep.num_points - 1) as f64;
                for i in 0..sweep.num_points {
                    values.push((log_start + i as f64 * log_step).exp());
                }
            },
        }
        
        Ok(values)
    }

    /// Run simulations in parallel
    fn run_parallel_simulations(
        &self,
        config: &BatchConfig,
        parameter_sets: Vec<HashMap<String, f64>>
    ) -> Result<Vec<SimulationPoint>> {
        let points: Vec<SimulationPoint> = parameter_sets
            .into_par_iter()
            .map(|params| self.simulate_point(config, params))
            .collect();
        
        Ok(points)
    }

    /// Run simulations sequentially
    fn run_sequential_simulations(
        &mut self,
        config: &BatchConfig,
        parameter_sets: Vec<HashMap<String, f64>>
    ) -> Result<Vec<SimulationPoint>> {
        let mut points = Vec::new();
        
        for params in parameter_sets {
            points.push(self.simulate_point(config, params));
        }
        
        Ok(points)
    }

    /// Simulate a single parameter point
    fn simulate_point(&self, config: &BatchConfig, parameters: HashMap<String, f64>) -> SimulationPoint {
        // Apply parameters to create modified element and simulation params
        let element = match self.apply_parameters_to_element(&config.base_element, &parameters) {
            Ok(elem) => elem,
            Err(e) => {
                return SimulationPoint {
                    parameters,
                    result: None,
                    error: Some(format!("Parameter application failed: {}", e)),
                };
            }
        };
        
        let sim_params = self.apply_parameters_to_sim_params(&config.base_params, &parameters);
        
        // Create new solver for this simulation
        let mut solver = match MomSolver::new(&element, &sim_params) {
            Ok(s) => s,
            Err(e) => {
                return SimulationPoint {
                    parameters,
                    result: None,
                    error: Some(format!("Solver creation failed: {}", e)),
                };
            }
        };

        match solver.solve(&sim_params) {
            Ok(result) => SimulationPoint {
                parameters,
                result: Some(result),
                error: None,
            },
            Err(e) => SimulationPoint {
                parameters,
                result: None,
                error: Some(format!("Simulation failed: {}", e)),
            },
        }
    }

    /// Apply parameter values to antenna element
    fn apply_parameters_to_element(
        &self,
        base_element: &AntennaElement,
        parameters: &HashMap<String, f64>
    ) -> Result<AntennaElement> {
        let mut element = base_element.clone();
        
        match &mut element {
            AntennaElement::Dipole(params) => {
                if let Some(&length) = parameters.get("length") {
                    params.length = length;
                }
                if let Some(&radius) = parameters.get("radius") {
                    params.radius = radius;
                }
            },
            AntennaElement::Patch(params) => {
                if let Some(&width) = parameters.get("width") {
                    params.width = width;
                }
                if let Some(&length) = parameters.get("length") {
                    params.length = length;
                }
                if let Some(&substrate_height) = parameters.get("substrate_height") {
                    params.substrate_height = substrate_height;
                }
                if let Some(&substrate_er) = parameters.get("substrate_er") {
                    params.substrate_er = substrate_er;
                }
            },
            AntennaElement::Qfh(params) => {
                if let Some(&frequency) = parameters.get("frequency") {
                    params.frequency = frequency;
                }
                if let Some(&turns) = parameters.get("turns") {
                    params.turns = turns;
                }
                if let Some(&diameter) = parameters.get("diameter") {
                    params.diameter = diameter;
                }
                if let Some(&height) = parameters.get("height") {
                    params.height = height;
                }
                if let Some(&wire_radius) = parameters.get("wire_radius") {
                    params.wire_radius = wire_radius;
                }
            },
        }
        
        Ok(element)
    }

    /// Apply parameter values to simulation parameters
    fn apply_parameters_to_sim_params(
        &self,
        base_params: &SimulationParams,
        parameters: &HashMap<String, f64>
    ) -> SimulationParams {
        let mut params = base_params.clone();
        
        if let Some(&frequency) = parameters.get("frequency") {
            params.frequency = frequency;
        }
        if let Some(&resolution) = parameters.get("resolution") {
            params.resolution = resolution;
        }
        if let Some(&reference_impedance) = parameters.get("reference_impedance") {
            params.reference_impedance = reference_impedance;
        }
        
        params
    }
}

impl Default for BatchSimulator {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::core::geometry::Point3D;

    #[test]
    fn test_parameter_sweep_creation() {
        let sweep = ParameterSweep {
            parameter_name: "frequency".to_string(),
            start_value: 1e9,
            end_value: 2e9,
            num_points: 11,
            scale_type: ScaleType::Linear,
        };
        
        assert_eq!(sweep.parameter_name, "frequency");
        assert_eq!(sweep.num_points, 11);
    }

    #[test]
    fn test_batch_config_creation() {
        let element = AntennaElement::new_dipole(0.15, 0.001);
        let params = SimulationParams {
            frequency: 1e9,
            resolution: 0.01,
            reference_impedance: 50.0,
        };
        
        let config = BatchConfig {
            base_element: element,
            base_params: params,
            sweeps: vec![],
            parallel: true,
        };
        
        assert!(config.parallel);
        assert!(config.sweeps.is_empty());
    }

    #[test]
    fn test_generate_linear_sweep_values() {
        let simulator = BatchSimulator::new();
        let sweep = ParameterSweep {
            parameter_name: "test".to_string(),
            start_value: 0.0,
            end_value: 10.0,
            num_points: 6,
            scale_type: ScaleType::Linear,
        };
        
        let values = simulator.generate_sweep_values(&sweep).unwrap();
        assert_eq!(values.len(), 6);
        assert!((values[0] - 0.0).abs() < 1e-10);
        assert!((values[5] - 10.0).abs() < 1e-10);
    }

    #[test]
    fn test_generate_log_sweep_values() {
        let simulator = BatchSimulator::new();
        let sweep = ParameterSweep {
            parameter_name: "test".to_string(),
            start_value: 1.0,
            end_value: 100.0,
            num_points: 3,
            scale_type: ScaleType::Logarithmic,
        };
        
        let values = simulator.generate_sweep_values(&sweep).unwrap();
        assert_eq!(values.len(), 3);
        assert!((values[0] - 1.0).abs() < 1e-10);
        assert!((values[2] - 100.0).abs() < 1e-10);
    }

    #[test]
    fn test_batch_simulator_creation() {
        let simulator = BatchSimulator::new();
        // Just test that it doesn't panic
        assert!(true);
    }
}