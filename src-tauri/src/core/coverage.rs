//! Parameter space coverage analysis for optimization and design space exploration

use crate::core::types::{Result, AntennaError};
use crate::core::batch::{BatchResult, SimulationPoint, ParameterSweep, ScaleType};
use crate::core::solver::SimulationResult;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use rayon::prelude::*;

/// Coverage analysis configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoverageConfig {
    pub parameter_ranges: HashMap<String, ParameterRange>,
    pub objectives: Vec<ObjectiveFunction>,
    pub constraints: Vec<Constraint>,
    pub coverage_metric: CoverageMetric,
    pub resolution: usize,
}

/// Parameter range definition
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParameterRange {
    pub min_value: f64,
    pub max_value: f64,
    pub preferred_value: Option<f64>,
    pub weight: f64,
}

/// Objective function for optimization
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ObjectiveFunction {
    pub name: String,
    pub target: ObjectiveTarget,
    pub weight: f64,
    pub tolerance: f64,
}

/// Objective target types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ObjectiveTarget {
    MaximizeGain,
    MinimizeVSWR,
    MaximizeEfficiency,
    MinimizeCrossPol,
    TargetImpedance { real: f64, imag: f64 },
    TargetFrequency(f64),
}

/// Design constraint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Constraint {
    pub name: String,
    pub constraint_type: ConstraintType,
    pub violation_penalty: f64,
}

/// Constraint types
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ConstraintType {
    MaxVSWR(f64),
    MinGain(f64),
    MaxSize { width: f64, height: f64, depth: f64 },
    MinEfficiency(f64),
    MaxCrossPol(f64),
}

/// Coverage analysis metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CoverageMetric {
    UniformSampling,
    AdaptiveSampling,
    MonteCarloSampling,
    LatinHypercube,
}

/// Coverage analysis result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoverageResult {
    pub config: CoverageConfig,
    pub design_points: Vec<DesignPoint>,
    pub pareto_front: Vec<DesignPoint>,
    pub coverage_statistics: CoverageStatistics,
    pub sensitivity_analysis: SensitivityAnalysis,
    pub recommendations: Vec<DesignRecommendation>,
}

/// Individual design point in parameter space
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignPoint {
    pub parameters: HashMap<String, f64>,
    pub objectives: HashMap<String, f64>,
    pub constraint_violations: Vec<ConstraintViolation>,
    pub feasible: bool,
    pub pareto_optimal: bool,
    pub simulation_result: Option<SimulationResult>,
}

/// Constraint violation record
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConstraintViolation {
    pub constraint_name: String,
    pub violation_amount: f64,
    pub penalty: f64,
}

/// Coverage statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CoverageStatistics {
    pub total_points: usize,
    pub feasible_points: usize,
    pub pareto_points: usize,
    pub coverage_percentage: f64,
    pub objective_ranges: HashMap<String, (f64, f64)>,
    pub parameter_correlations: HashMap<String, f64>,
}

/// Sensitivity analysis results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensitivityAnalysis {
    pub parameter_sensitivities: HashMap<String, f64>,
    pub interaction_effects: HashMap<String, f64>,
    pub most_sensitive_parameters: Vec<String>,
    pub robust_regions: Vec<RobustRegion>,
}

/// Robust design region
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RobustRegion {
    pub center: HashMap<String, f64>,
    pub radius: HashMap<String, f64>,
    pub performance_variance: f64,
    pub feasibility_probability: f64,
}

/// Design recommendation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DesignRecommendation {
    pub recommendation_type: RecommendationType,
    pub parameters: HashMap<String, f64>,
    pub expected_performance: HashMap<String, f64>,
    pub confidence: f64,
    pub rationale: String,
}

/// Types of design recommendations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum RecommendationType {
    OptimalDesign,
    RobustDesign,
    CompromiseDesign,
    ExplorationTarget,
}

/// Parameter space coverage analyzer
pub struct CoverageAnalyzer;

impl CoverageAnalyzer {
    /// Analyze parameter space coverage from batch results
    pub fn analyze_coverage(
        batch_results: &BatchResult,
        config: &CoverageConfig,
    ) -> Result<CoverageResult> {
        // Convert simulation points to design points
        let design_points = Self::convert_to_design_points(batch_results, config)?;
        
        // Find Pareto front
        let pareto_front = Self::find_pareto_front(&design_points, config)?;
        
        // Calculate coverage statistics
        let coverage_statistics = Self::calculate_coverage_statistics(&design_points, config)?;
        
        // Perform sensitivity analysis
        let sensitivity_analysis = Self::perform_sensitivity_analysis(&design_points, config)?;
        
        // Generate recommendations
        let recommendations = Self::generate_recommendations(&design_points, &pareto_front, config)?;
        
        Ok(CoverageResult {
            config: config.clone(),
            design_points,
            pareto_front,
            coverage_statistics,
            sensitivity_analysis,
            recommendations,
        })
    }

    /// Generate parameter space sampling points
    pub fn generate_sampling_points(
        config: &CoverageConfig,
    ) -> Result<Vec<HashMap<String, f64>>> {
        match config.coverage_metric {
            CoverageMetric::UniformSampling => Self::generate_uniform_sampling(config),
            CoverageMetric::AdaptiveSampling => Self::generate_adaptive_sampling(config),
            CoverageMetric::MonteCarloSampling => Self::generate_monte_carlo_sampling(config),
            CoverageMetric::LatinHypercube => Self::generate_latin_hypercube_sampling(config),
        }
    }

    /// Convert simulation points to design points with objectives
    fn convert_to_design_points(
        batch_results: &BatchResult,
        config: &CoverageConfig,
    ) -> Result<Vec<DesignPoint>> {
        let design_points: Vec<DesignPoint> = batch_results.points
            .par_iter()
            .map(|point| Self::convert_simulation_point(point, config))
            .collect::<Result<Vec<_>>>()?;
        
        Ok(design_points)
    }

    /// Convert single simulation point to design point
    fn convert_simulation_point(
        point: &SimulationPoint,
        config: &CoverageConfig,
    ) -> Result<DesignPoint> {
        let mut objectives = HashMap::new();
        let mut constraint_violations = Vec::new();
        let mut feasible = true;
        
        if let Some(ref result) = point.result {
            // Calculate objective values
            for objective in &config.objectives {
                let value = Self::calculate_objective_value(objective, result)?;
                objectives.insert(objective.name.clone(), value);
            }
            
            // Check constraints
            for constraint in &config.constraints {
                if let Some(violation) = Self::check_constraint(constraint, result)? {
                    constraint_violations.push(violation);
                    feasible = false;
                }
            }
        } else {
            feasible = false;
        }
        
        Ok(DesignPoint {
            parameters: point.parameters.clone(),
            objectives,
            constraint_violations,
            feasible,
            pareto_optimal: false, // Will be set later
            simulation_result: point.result.clone(),
        })
    }

    /// Calculate objective function value
    fn calculate_objective_value(
        objective: &ObjectiveFunction,
        result: &SimulationResult,
    ) -> Result<f64> {
        let sp = result.s_parameters.first()
            .ok_or_else(|| AntennaError::SimulationFailed("No S-parameter results".to_string()))?;
        let value = match &objective.target {
            ObjectiveTarget::MaximizeGain => result.field_results.max_gain_dbi,
            ObjectiveTarget::MinimizeVSWR => -sp.vswr, // Negative for minimization
            ObjectiveTarget::MaximizeEfficiency => result.field_results.efficiency,
            ObjectiveTarget::MinimizeCrossPol => -result.field_results.cross_pol_discrimination_db,
            ObjectiveTarget::TargetImpedance { real, imag } => {
                let z_re = sp.input_impedance_re;
                let z_im = sp.input_impedance_im;
                -((z_re - real).powi(2) + (z_im - imag).powi(2)).sqrt() // Negative distance
            },
            ObjectiveTarget::TargetFrequency(target_freq) => {
                -(sp.frequency - target_freq).abs()
            },
        };
        
        Ok(value)
    }

    /// Check constraint and return violation if any
    fn check_constraint(
        constraint: &Constraint,
        result: &SimulationResult,
    ) -> Result<Option<ConstraintViolation>> {
        let sp = result.s_parameters.first()
            .ok_or_else(|| AntennaError::SimulationFailed("No S-parameter results".to_string()))?;
        let violation_amount = match &constraint.constraint_type {
            ConstraintType::MaxVSWR(max_vswr) => {
                if sp.vswr > *max_vswr {
                    sp.vswr - max_vswr
                } else {
                    return Ok(None);
                }
            },
            ConstraintType::MinGain(min_gain) => {
                if result.field_results.max_gain_dbi < *min_gain {
                    min_gain - result.field_results.max_gain_dbi
                } else {
                    return Ok(None);
                }
            },
            ConstraintType::MinEfficiency(min_eff) => {
                if result.field_results.efficiency < *min_eff {
                    min_eff - result.field_results.efficiency
                } else {
                    return Ok(None);
                }
            },
            ConstraintType::MaxCrossPol(max_xpol) => {
                if result.field_results.cross_pol_discrimination_db > *max_xpol {
                    result.field_results.cross_pol_discrimination_db - max_xpol
                } else {
                    return Ok(None);
                }
            },
            ConstraintType::MaxSize { .. } => {
                // Size constraint would need geometry information
                return Ok(None);
            },
        };
        
        Ok(Some(ConstraintViolation {
            constraint_name: constraint.name.clone(),
            violation_amount,
            penalty: violation_amount * constraint.violation_penalty,
        }))
    }

    /// Find Pareto front from design points
    fn find_pareto_front(
        design_points: &[DesignPoint],
        _config: &CoverageConfig,
    ) -> Result<Vec<DesignPoint>> {
        let feasible_points: Vec<&DesignPoint> = design_points
            .iter()
            .filter(|p| p.feasible)
            .collect();
        
        let mut pareto_front = Vec::new();
        
        for point in &feasible_points {
            let mut is_dominated = false;
            
            for other in &feasible_points {
                if Self::dominates(other, point) {
                    is_dominated = true;
                    break;
                }
            }
            
            if !is_dominated {
                let mut pareto_point = (*point).clone();
                pareto_point.pareto_optimal = true;
                pareto_front.push(pareto_point);
            }
        }
        
        Ok(pareto_front)
    }

    /// Check if point1 dominates point2 (all objectives better or equal, at least one strictly better)
    fn dominates(point1: &DesignPoint, point2: &DesignPoint) -> bool {
        let mut all_better_or_equal = true;
        let mut at_least_one_better = false;
        
        for (obj_name, &value1) in &point1.objectives {
            if let Some(&value2) = point2.objectives.get(obj_name) {
                if value1 < value2 {
                    all_better_or_equal = false;
                    break;
                } else if value1 > value2 {
                    at_least_one_better = true;
                }
            }
        }
        
        all_better_or_equal && at_least_one_better
    }

    /// Calculate coverage statistics
    fn calculate_coverage_statistics(
        design_points: &[DesignPoint],
        config: &CoverageConfig,
    ) -> Result<CoverageStatistics> {
        let total_points = design_points.len();
        let feasible_points = design_points.iter().filter(|p| p.feasible).count();
        let pareto_points = design_points.iter().filter(|p| p.pareto_optimal).count();
        
        let coverage_percentage = if total_points > 0 {
            (feasible_points as f64 / total_points as f64) * 100.0
        } else {
            0.0
        };
        
        // Calculate objective ranges
        let mut objective_ranges = HashMap::new();
        for objective in &config.objectives {
            let values: Vec<f64> = design_points
                .iter()
                .filter_map(|p| p.objectives.get(&objective.name))
                .copied()
                .collect();
            
            if !values.is_empty() {
                let min_val = values.iter().fold(f64::INFINITY, |a, &b| a.min(b));
                let max_val = values.iter().fold(f64::NEG_INFINITY, |a, &b| a.max(b));
                objective_ranges.insert(objective.name.clone(), (min_val, max_val));
            }
        }
        
        // Simple parameter correlations (placeholder)
        let parameter_correlations = HashMap::new();
        
        Ok(CoverageStatistics {
            total_points,
            feasible_points,
            pareto_points,
            coverage_percentage,
            objective_ranges,
            parameter_correlations,
        })
    }

    /// Perform sensitivity analysis
    fn perform_sensitivity_analysis(
        _design_points: &[DesignPoint],
        _config: &CoverageConfig,
    ) -> Result<SensitivityAnalysis> {
        // Placeholder implementation - would need more sophisticated analysis
        let parameter_sensitivities = HashMap::new();
        let interaction_effects = HashMap::new();
        let most_sensitive_parameters = Vec::new();
        let robust_regions = Vec::new();
        
        Ok(SensitivityAnalysis {
            parameter_sensitivities,
            interaction_effects,
            most_sensitive_parameters,
            robust_regions,
        })
    }

    /// Generate design recommendations
    fn generate_recommendations(
        _design_points: &[DesignPoint],
        pareto_front: &[DesignPoint],
        _config: &CoverageConfig,
    ) -> Result<Vec<DesignRecommendation>> {
        let mut recommendations = Vec::new();
        
        // Find best overall design from Pareto front
        if let Some(best_point) = pareto_front.first() {
            recommendations.push(DesignRecommendation {
                recommendation_type: RecommendationType::OptimalDesign,
                parameters: best_point.parameters.clone(),
                expected_performance: best_point.objectives.clone(),
                confidence: 0.9,
                rationale: "Best overall performance from Pareto front".to_string(),
            });
        }
        
        Ok(recommendations)
    }

    /// Generate uniform sampling points
    fn generate_uniform_sampling(
        config: &CoverageConfig,
    ) -> Result<Vec<HashMap<String, f64>>> {
        let mut points = Vec::new();
        let n_params = config.parameter_ranges.len();
        
        if n_params == 0 {
            return Ok(points);
        }
        
        let points_per_dim = (config.resolution as f64).powf(1.0 / n_params as f64).ceil() as usize;
        
        // Generate grid points (simplified for now)
        for (param_name, range) in &config.parameter_ranges {
            let mut param_points = HashMap::new();
            
            for i in 0..points_per_dim {
                let t = i as f64 / (points_per_dim - 1).max(1) as f64;
                let value = range.min_value + t * (range.max_value - range.min_value);
                param_points.insert(param_name.clone(), value);
            }
            
            if points.is_empty() {
                points.push(param_points);
            }
        }
        
        Ok(points)
    }

    /// Generate adaptive sampling points
    fn generate_adaptive_sampling(
        config: &CoverageConfig,
    ) -> Result<Vec<HashMap<String, f64>>> {
        // Placeholder - would implement adaptive sampling based on previous results
        Self::generate_uniform_sampling(config)
    }

    /// Generate Monte Carlo sampling points
    fn generate_monte_carlo_sampling(
        config: &CoverageConfig,
    ) -> Result<Vec<HashMap<String, f64>>> {
        let mut points = Vec::new();
        
        for _ in 0..config.resolution {
            let mut point = HashMap::new();
            
            for (param_name, range) in &config.parameter_ranges {
                // Simple uniform random sampling (would use proper RNG in practice)
                let t = 0.5; // Placeholder random value
                let value = range.min_value + t * (range.max_value - range.min_value);
                point.insert(param_name.clone(), value);
            }
            
            points.push(point);
        }
        
        Ok(points)
    }

    /// Generate Latin Hypercube sampling points
    fn generate_latin_hypercube_sampling(
        config: &CoverageConfig,
    ) -> Result<Vec<HashMap<String, f64>>> {
        // Placeholder - would implement proper LHS
        Self::generate_uniform_sampling(config)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_coverage_config_creation() {
        let config = CoverageConfig {
            parameter_ranges: HashMap::new(),
            objectives: vec![],
            constraints: vec![],
            coverage_metric: CoverageMetric::UniformSampling,
            resolution: 100,
        };
        
        assert_eq!(config.resolution, 100);
        assert!(matches!(config.coverage_metric, CoverageMetric::UniformSampling));
    }

    #[test]
    fn test_parameter_range_creation() {
        let range = ParameterRange {
            min_value: 0.0,
            max_value: 1.0,
            preferred_value: Some(0.5),
            weight: 1.0,
        };
        
        assert_eq!(range.min_value, 0.0);
        assert_eq!(range.max_value, 1.0);
        assert_eq!(range.preferred_value, Some(0.5));
    }

    #[test]
    fn test_objective_function_creation() {
        let objective = ObjectiveFunction {
            name: "gain".to_string(),
            target: ObjectiveTarget::MaximizeGain,
            weight: 1.0,
            tolerance: 0.1,
        };
        
        assert_eq!(objective.name, "gain");
        assert!(matches!(objective.target, ObjectiveTarget::MaximizeGain));
    }

    #[test]
    fn test_coverage_analyzer_creation() {
        // CoverageAnalyzer is a unit struct
        let _analyzer = CoverageAnalyzer;
        assert!(true);
    }
}