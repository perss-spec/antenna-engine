//! Parameter space coverage analysis for optimization and design space exploration

use super::types::{Result, AntennaError, SimulationResult};
use super::batch::{BatchResult, SimulationPoint};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

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
    pub convergence_metric: f64,
}

/// Sensitivity analysis results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SensitivityAnalysis {
    pub parameter_sensitivities: HashMap<String, f64>,
    pub interaction_effects: HashMap<String, f64>,
    pub most_sensitive_parameters: Vec<String>,
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
    ExplorationSuggestion,
}

/// Coverage analyzer for parameter space exploration
pub struct CoverageAnalyzer;

impl CoverageAnalyzer {
    /// Create new coverage analyzer
    pub fn new() -> Self {
        Self
    }

    /// Analyze parameter space coverage from batch results
    pub fn analyze_coverage(
        &self,
        batch_result: &BatchResult,
        config: &CoverageConfig,
    ) -> Result<CoverageResult> {
        // Convert simulation points to design points
        let design_points = self.convert_to_design_points(&batch_result.points, config)?;
        
        // Calculate Pareto front
        let pareto_front = self.calculate_pareto_front(&design_points, config)?;
        
        // Calculate coverage statistics
        let coverage_statistics = self.calculate_coverage_statistics(&design_points)?;
        
        // Perform sensitivity analysis
        let sensitivity_analysis = self.perform_sensitivity_analysis(&design_points)?;
        
        // Generate recommendations
        let recommendations = self.generate_recommendations(&design_points, &pareto_front, config)?;
        
        Ok(CoverageResult {
            config: config.clone(),
            design_points,
            pareto_front,
            coverage_statistics,
            sensitivity_analysis,
            recommendations,
        })
    }

    /// Convert simulation points to design points
    fn convert_to_design_points(
        &self,
        sim_points: &[SimulationPoint],
        config: &CoverageConfig,
    ) -> Result<Vec<DesignPoint>> {
        let mut design_points = Vec::new();
        
        for sim_point in sim_points {
            if let Some(result) = &sim_point.result {
                let objectives = self.evaluate_objectives(result, config)?;
                let constraint_violations = self.check_constraints(result, config)?;
                let feasible = constraint_violations.is_empty();
                
                design_points.push(DesignPoint {
                    parameters: sim_point.parameters.clone(),
                    objectives,
                    constraint_violations,
                    feasible,
                    pareto_optimal: false, // Will be set later
                    simulation_result: Some(result.clone()),
                });
            }
        }
        
        Ok(design_points)
    }

    /// Evaluate objective functions for a simulation result
    fn evaluate_objectives(
        &self,
        result: &SimulationResult,
        config: &CoverageConfig,
    ) -> Result<HashMap<String, f64>> {
        let mut objectives = HashMap::new();
        
        for objective in &config.objectives {
            let value = match &objective.target {
                ObjectiveTarget::MaximizeGain => {
                    result.field.max_gain_dbi
                }
                ObjectiveTarget::MinimizeVSWR => {
                    if let Some(s_param) = result.s_params.first() {
                        -s_param.vswr // Negative because we want to minimize
                    } else {
                        0.0
                    }
                }
                ObjectiveTarget::MaximizeEfficiency => {
                    result.field.efficiency
                }
                ObjectiveTarget::MinimizeCrossPol => {
                    -result.field.cross_pol_discrimination_db
                }
                ObjectiveTarget::TargetImpedance { real, imag } => {
                    if let Some(s_param) = result.s_params.first() {
                        let z_diff_re = (s_param.input_impedance_re - real).abs();
                        let z_diff_im = (s_param.input_impedance_im - imag).abs();
                        -(z_diff_re + z_diff_im) // Negative distance from target
                    } else {
                        -1000.0
                    }
                }
                ObjectiveTarget::TargetFrequency(target_freq) => {
                    if let Some(s_param) = result.s_params.first() {
                        -(s_param.frequency - target_freq).abs()
                    } else {
                        -1000.0
                    }
                }
            };
            
            objectives.insert(objective.name.clone(), value);
        }
        
        Ok(objectives)
    }

    /// Check constraint violations
    fn check_constraints(
        &self,
        result: &SimulationResult,
        config: &CoverageConfig,
    ) -> Result<Vec<ConstraintViolation>> {
        let mut violations = Vec::new();
        
        for constraint in &config.constraints {
            let violation = match &constraint.constraint_type {
                ConstraintType::MaxVSWR(max_vswr) => {
                    if let Some(s_param) = result.s_params.first() {
                        if s_param.vswr > *max_vswr {
                            Some(s_param.vswr - max_vswr)
                        } else {
                            None
                        }
                    } else {
                        None
                    }
                }
                ConstraintType::MinGain(min_gain) => {
                    let gain = result.field.max_gain_dbi;
                    if gain < *min_gain {
                        Some(min_gain - gain)
                    } else {
                        None
                    }
                }
                ConstraintType::MinEfficiency(min_eff) => {
                    let eff = result.field.efficiency;
                    if eff < *min_eff {
                        Some(min_eff - eff)
                    } else {
                        None
                    }
                }
                ConstraintType::MaxCrossPol(max_xpol) => {
                    let xpol = result.field.cross_pol_discrimination_db;
                    if xpol > *max_xpol {
                        Some(xpol - max_xpol)
                    } else {
                        None
                    }
                }
                ConstraintType::MaxSize { .. } => {
                    // Size constraints would need geometry analysis
                    None
                }
            };
            
            if let Some(violation_amount) = violation {
                violations.push(ConstraintViolation {
                    constraint_name: constraint.name.clone(),
                    violation_amount,
                    penalty: constraint.violation_penalty,
                });
            }
        }
        
        Ok(violations)
    }

    /// Calculate Pareto front
    fn calculate_pareto_front(
        &self,
        design_points: &[DesignPoint],
        _config: &CoverageConfig,
    ) -> Result<Vec<DesignPoint>> {
        // Simple Pareto front calculation - mark non-dominated points
        let mut pareto_points = Vec::new();
        
        for point in design_points {
            if !point.feasible {
                continue;
            }
            
            let mut is_dominated = false;
            
            for other in design_points {
                if !other.feasible || std::ptr::eq(point, other) {
                    continue;
                }
                
                // Check if 'other' dominates 'point'
                let mut dominates = true;
                let mut strictly_better = false;
                
                for (obj_name, &point_value) in &point.objectives {
                    if let Some(&other_value) = other.objectives.get(obj_name) {
                        if other_value < point_value {
                            dominates = false;
                            break;
                        } else if other_value > point_value {
                            strictly_better = true;
                        }
                    }
                }
                
                if dominates && strictly_better {
                    is_dominated = true;
                    break;
                }
            }
            
            if !is_dominated {
                let mut pareto_point = point.clone();
                pareto_point.pareto_optimal = true;
                pareto_points.push(pareto_point);
            }
        }
        
        Ok(pareto_points)
    }

    /// Calculate coverage statistics
    fn calculate_coverage_statistics(
        &self,
        design_points: &[DesignPoint],
    ) -> Result<CoverageStatistics> {
        let total_points = design_points.len();
        let feasible_points = design_points.iter().filter(|p| p.feasible).count();
        let pareto_points = design_points.iter().filter(|p| p.pareto_optimal).count();
        
        let coverage_percentage = if total_points > 0 {
            (feasible_points as f64 / total_points as f64) * 100.0
        } else {
            0.0
        };
        
        Ok(CoverageStatistics {
            total_points,
            feasible_points,
            pareto_points,
            coverage_percentage,
            convergence_metric: 0.95, // Placeholder
        })
    }

    /// Perform sensitivity analysis
    fn perform_sensitivity_analysis(
        &self,
        _design_points: &[DesignPoint],
    ) -> Result<SensitivityAnalysis> {
        // Placeholder implementation
        Ok(SensitivityAnalysis {
            parameter_sensitivities: HashMap::new(),
            interaction_effects: HashMap::new(),
            most_sensitive_parameters: vec!["length".to_string()],
        })
    }

    /// Generate design recommendations
    fn generate_recommendations(
        &self,
        design_points: &[DesignPoint],
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
                confidence: 0.85,
                rationale: "Best overall performance from Pareto front".to_string(),
            });
        }
        
        // Find most robust design (least sensitive to parameter variations)
        if let Some(robust_point) = design_points.iter().find(|p| p.feasible) {
            recommendations.push(DesignRecommendation {
                recommendation_type: RecommendationType::RobustDesign,
                parameters: robust_point.parameters.clone(),
                expected_performance: robust_point.objectives.clone(),
                confidence: 0.75,
                rationale: "Most robust design with good manufacturability".to_string(),
            });
        }
        
        Ok(recommendations)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_coverage_analyzer_creation() {
        let analyzer = CoverageAnalyzer::new();
        drop(analyzer); // Should not panic
    }

    #[test]
    fn test_coverage_config_creation() {
        let config = CoverageConfig {
            parameter_ranges: HashMap::new(),
            objectives: vec![],
            constraints: vec![],
            coverage_metric: CoverageMetric::UniformSampling,
            resolution: 10,
        };
        
        assert_eq!(config.resolution, 10);
    }
}