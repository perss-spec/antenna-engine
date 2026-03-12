use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Core antenna geometry types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AntennaType {
    Dipole(DipoleParams),
    Patch(PatchParams),
    Yagi(YagiParams),
    Horn(HornParams),
    Custom(CustomGeometry),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DipoleParams {
    pub length: f64,
    pub radius: f64,
    pub feed_gap: f64,
    pub orientation: Vec3,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchParams {
    pub width: f64,
    pub length: f64,
    pub substrate_height: f64,
    pub substrate_permittivity: f64,
    pub feed_position: Vec2,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YagiParams {
    pub driven_element: DipoleParams,
    pub reflector_spacing: f64,
    pub director_spacings: Vec<f64>,
    pub element_lengths: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HornParams {
    pub aperture_width: f64,
    pub aperture_height: f64,
    pub length: f64,
    pub waveguide_width: f64,
    pub waveguide_height: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomGeometry {
    pub vertices: Vec<Vec3>,
    pub triangles: Vec<[u32; 3]>,
    pub feed_edges: Vec<[u32; 2]>,
}

/// Material properties
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Material {
    pub name: String,
    pub permittivity: Complex,
    pub permeability: Complex,
    pub conductivity: f64,
}

/// Antenna parameters for simulation
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AntennaParams {
    pub id: String,
    pub name: String,
    pub antenna_type: AntennaType,
    pub material: Material,
    pub position: Vec3,
    pub rotation: Vec3,
    pub mesh_resolution: MeshResolution,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeshResolution {
    pub min_edge_length: f64,
    pub max_edge_length: f64,
    pub curvature_refinement: f64,
}

/// Simulation configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulationParams {
    pub frequency_start: f64,
    pub frequency_stop: f64,
    pub frequency_points: u32,
    pub solver_type: SolverType,
    pub boundary_conditions: BoundaryConditions,
    pub excitation: Excitation,
    pub convergence_threshold: f64,
    pub max_iterations: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SolverType {
    MethodOfMoments,
    FiniteDifference,
    FiniteElement,
    Hybrid,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BoundaryConditions {
    pub type_: BoundaryType,
    pub distance: f64,
    pub layers: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum BoundaryType {
    PerfectlyMatchedLayer,
    AbsorbingBoundary,
    Periodic,
    PerfectElectricConductor,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Excitation {
    pub type_: ExcitationType,
    pub amplitude: f64,
    pub phase: f64,
    pub impedance: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ExcitationType {
    VoltageSource,
    CurrentSource,
    PlaneWave,
    GaussianBeam,
}

/// Simulation results
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulationResults {
    pub id: String,
    pub antenna_id: String,
    pub timestamp: i64,
    pub frequencies: Vec<f64>,
    pub s_parameters: SParameters,
    pub radiation_patterns: Vec<RadiationPattern>,
    pub antenna_metrics: AntennaMetrics,
    pub current_distribution: Option<CurrentDistribution>,
    pub convergence_history: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SParameters {
    pub s11: Vec<Complex>,
    pub s21: Option<Vec<Complex>>,
    pub s12: Option<Vec<Complex>>,
    pub s22: Option<Vec<Complex>>,
    pub vswr: Vec<f64>,
    pub input_impedance: Vec<Complex>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RadiationPattern {
    pub frequency: f64,
    pub theta: Vec<f64>,
    pub phi: Vec<f64>,
    pub e_theta: Vec<Vec<Complex>>,
    pub e_phi: Vec<Vec<Complex>>,
    pub gain: Vec<Vec<f64>>,
    pub phase: Vec<Vec<f64>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AntennaMetrics {
    pub max_gain: f64,
    pub directivity: f64,
    pub efficiency: f64,
    pub bandwidth: f64,
    pub beamwidth_e_plane: f64,
    pub beamwidth_h_plane: f64,
    pub front_to_back_ratio: f64,
    pub polarization: PolarizationType,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum PolarizationType {
    Linear(f64),
    Circular(CircularPolarization),
    Elliptical(f64, f64),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CircularPolarization {
    RightHand,
    LeftHand,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CurrentDistribution {
    pub mesh_vertices: Vec<Vec3>,
    pub mesh_triangles: Vec<[u32; 3]>,
    pub current_density: Vec<Vec3Complex>,
    pub magnitude: Vec<f64>,
    pub phase: Vec<f64>,
}

/// Optimization types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptimizationConfig {
    pub id: String,
    pub objectives: Vec<Objective>,
    pub constraints: Vec<Constraint>,
    pub variables: Vec<DesignVariable>,
    pub algorithm: OptimizationAlgorithm,
    pub settings: OptimizationSettings,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Objective {
    pub name: String,
    pub type_: ObjectiveType,
    pub weight: f64,
    pub target_value: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ObjectiveType {
    MaximizeGain,
    MinimizeReturnLoss,
    MaximizeBandwidth,
    MinimizeSideLobes,
    MatchImpedance(Complex),
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Constraint {
    pub name: String,
    pub type_: ConstraintType,
    pub min_value: Option<f64>,
    pub max_value: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ConstraintType {
    Dimension,
    Gain,
    Bandwidth,
    Efficiency,
    ReturnLoss,
    Custom(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DesignVariable {
    pub name: String,
    pub path: String,
    pub min_value: f64,
    pub max_value: f64,
    pub step_size: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum OptimizationAlgorithm {
    GeneticAlgorithm(GeneticAlgorithmParams),
    ParticleSwarm(ParticleSwarmParams),
    GradientDescent(GradientDescentParams),
    Bayesian(BayesianParams),
    Hybrid(Vec<OptimizationAlgorithm>),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneticAlgorithmParams {
    pub population_size: u32,
    pub mutation_rate: f64,
    pub crossover_rate: f64,
    pub elite_size: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ParticleSwarmParams {
    pub particle_count: u32,
    pub inertia_weight: f64,
    pub cognitive_weight: f64,
    pub social_weight: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GradientDescentParams {
    pub learning_rate: f64,
    pub momentum: f64,
    pub adaptive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BayesianParams {
    pub acquisition_function: String,
    pub exploration_weight: f64,
    pub n_initial_points: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptimizationSettings {
    pub max_iterations: u32,
    pub max_evaluations: u32,
    pub convergence_tolerance: f64,
    pub parallel_evaluations: u32,
    pub use_surrogate_model: bool,
    pub save_history: bool,
}

/// Progress and status types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulationProgress {
    pub status: SimulationStatus,
    pub current_frequency: Option<f64>,
    pub progress_percentage: f64,
    pub estimated_time_remaining: Option<u64>,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum SimulationStatus {
    Idle,
    Initializing,
    Meshing,
    Solving,
    PostProcessing,
    Completed,
    Failed(String),
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OptimizationProgress {
    pub iteration: u32,
    pub best_fitness: f64,
    pub current_fitness: f64,
    pub convergence_metric: f64,
    pub population_diversity: Option<f64>,
    pub pareto_front: Option<Vec<Solution>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Solution {
    pub id: String,
    pub variables: HashMap<String, f64>,
    pub objectives: HashMap<String, f64>,
    pub constraints_satisfied: bool,
    pub simulation_results: Option<SimulationResults>,
}

/// Helper types
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vec2 {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vec3 {
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Complex {
    pub real: f64,
    pub imag: f64,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Vec3Complex {
    pub x: Complex,
    pub y: Complex,
    pub z: Complex,
}

/// Error types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AntennaError {
    InvalidGeometry(String),
    SimulationFailed(String),
    OptimizationFailed(String),
    GpuError(String),
    IoError(String),
    SerializationError(String),
}

pub type Result<T> = std::result::Result<T, AntennaError>;