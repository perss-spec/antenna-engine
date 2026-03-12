"""Pydantic models matching Rust/TypeScript types for ML integration."""

from typing import List, Optional, Dict, Union, Literal
from enum import Enum
from pydantic import BaseModel, Field
import numpy as np
from datetime import datetime


# Helper types
class Vec2(BaseModel):
    x: float
    y: float

    def to_numpy(self) -> np.ndarray:
        return np.array([self.x, self.y])


class Vec3(BaseModel):
    x: float
    y: float
    z: float

    def to_numpy(self) -> np.ndarray:
        return np.array([self.x, self.y, self.z])


class Complex(BaseModel):
    real: float
    imag: float

    def to_complex(self) -> complex:
        return complex(self.real, self.imag)

    @classmethod
    def from_complex(cls, c: complex) -> 'Complex':
        return cls(real=c.real, imag=c.imag)


class Vec3Complex(BaseModel):
    x: Complex
    y: Complex
    z: Complex


# Antenna geometry types
class DipoleParams(BaseModel):
    length: float
    radius: float
    feed_gap: float = Field(alias='feedGap')
    orientation: Vec3


class PatchParams(BaseModel):
    width: float
    length: float
    substrate_height: float = Field(alias='substrateHeight')
    substrate_permittivity: float = Field(alias='substratePermittivity')
    feed_position: Vec2 = Field(alias='feedPosition')


class YagiParams(BaseModel):
    driven_element: DipoleParams = Field(alias='drivenElement')
    reflector_spacing: float = Field(alias='reflectorSpacing')
    director_spacings: List[float] = Field(alias='directorSpacings')
    element_lengths: List[float] = Field(alias='elementLengths')


class HornParams(BaseModel):
    aperture_width: float = Field(alias='apertureWidth')
    aperture_height: float = Field(alias='apertureHeight')
    length: float
    waveguide_width: float = Field(alias='waveguideWidth')
    waveguide_height: float = Field(alias='waveguideHeight')


class CustomGeometry(BaseModel):
    vertices: List[Vec3]
    triangles: List[List[int]]
    feed_edges: List[List[int]] = Field(alias='feedEdges')


class AntennaType(BaseModel):
    type: Literal['dipole', 'patch', 'yagi', 'horn', 'custom']
    params: Union[DipoleParams, PatchParams, YagiParams, HornParams, CustomGeometry]


# Material properties
class Material(BaseModel):
    name: str
    permittivity: Complex
    permeability: Complex
    conductivity: float


# Mesh resolution
class MeshResolution(BaseModel):
    min_edge_length: float = Field(alias='minEdgeLength')
    max_edge_length: float = Field(alias='maxEdgeLength')
    curvature_refinement: float = Field(alias='curvatureRefinement')


# Antenna parameters
class AntennaParams(BaseModel):
    id: str
    name: str
    antenna_type: AntennaType = Field(alias='antennaType')
    material: Material
    position: Vec3
    rotation: Vec3
    mesh_resolution: MeshResolution = Field(alias='meshResolution')

    def to_feature_vector(self) -> np.ndarray:
        """Convert antenna parameters to ML feature vector."""
        features = []
        
        # Encode antenna type
        type_encoding = {
            'dipole': [1, 0, 0, 0, 0],
            'patch': [0, 1, 0, 0, 0],
            'yagi': [0, 0, 1, 0, 0],
            'horn': [0, 0, 0, 1, 0],
            'custom': [0, 0, 0, 0, 1]
        }
        features.extend(type_encoding[self.antenna_type.type])
        
        # Add material properties
        features.extend([
            self.material.permittivity.real,
            self.material.permittivity.imag,
            self.material.permeability.real,
            self.material.permeability.imag,
            self.material.conductivity
        ])
        
        # Add position and rotation
        features.extend(self.position.to_numpy())
        features.extend(self.rotation.to_numpy())
        
        # Add type-specific parameters
        if self.antenna_type.type == 'dipole':
            params = self.antenna_type.params
            features.extend([
                params.length,
                params.radius,
                params.feed_gap
            ])
        elif self.antenna_type.type == 'patch':
            params = self.antenna_type.params
            features.extend([
                params.width,
                params.length,
                params.substrate_height,
                params.substrate_permittivity
            ])
        
        return np.array(features)


# Simulation types
class SolverType(str, Enum):
    METHOD_OF_MOMENTS = 'methodOfMoments'
    FINITE_DIFFERENCE = 'finiteDifference'
    FINITE_ELEMENT = 'finiteElement'
    HYBRID = 'hybrid'


class BoundaryType(str, Enum):
    PERFECTLY_MATCHED_LAYER = 'perfectlyMatchedLayer'
    ABSORBING_BOUNDARY = 'absorbingBoundary'
    PERIODIC = 'periodic'
    PERFECT_ELECTRIC_CONDUCTOR = 'perfectElectricConductor'


class ExcitationType(str, Enum):
    VOLTAGE_SOURCE = 'voltageSource'
    CURRENT_SOURCE = 'currentSource'
    PLANE_WAVE = 'planeWave'
    GAUSSIAN_BEAM = 'gaussianBeam'


class BoundaryConditions(BaseModel):
    type: BoundaryType
    distance: float
    layers: int


class Excitation(BaseModel):
    type: ExcitationType
    amplitude: float
    phase: float
    impedance: float


class SimulationParams(BaseModel):
    frequency_start: float = Field(alias='frequencyStart')
    frequency_stop: float = Field(alias='frequencyStop')
    frequency_points: int = Field(alias='frequencyPoints')
    solver_type: SolverType = Field(alias='solverType')
    boundary_conditions: BoundaryConditions = Field(alias='boundaryConditions')
    excitation: Excitation
    convergence_threshold: float = Field(alias='convergenceThreshold')
    max_iterations: int = Field(alias='maxIterations')


# Simulation results
class SParameters(BaseModel):
    s11: List[Complex]
    s21: Optional[List[Complex]] = None
    s12: Optional[List[Complex]] = None
    s22: Optional[List[Complex]] = None
    vswr: List[float]
    input_impedance: List[Complex] = Field(alias='inputImpedance')

    def to_numpy(self) -> Dict[str, np.ndarray]:
        """Convert S-parameters to numpy arrays."""
        return {
            's11': np.array([c.to_complex() for c in self.s11]),
            'vswr': np.array(self.vswr),
            'input_impedance': np.array([c.to_complex() for c in self.input_impedance])
        }


class RadiationPattern(BaseModel):
    frequency: float
    theta: List[float]
    phi: List[float]
    e_theta: List[List[Complex]] = Field(alias='eTheta')
    e_phi: List[List[Complex]] = Field(alias='ePhi')
    gain: List[List[float]]
    phase: List[List[float]]

    def to_numpy(self) -> Dict[str, np.ndarray]:
        """Convert radiation pattern to numpy arrays."""
        return {
            'theta': np.array(self.theta),
            'phi': np.array(self.phi),
            'gain': np.array(self.gain),
            'phase': np.array(self.phase)
        }


class CircularPolarization(str, Enum):
    RIGHT_HAND = 'rightHand'
    LEFT_HAND = 'leftHand'


class PolarizationType(BaseModel):
    type: Literal['linear', 'circular', 'elliptical']
    angle: Optional[float] = None
    direction: Optional[CircularPolarization] = None
    major_axis: Optional[float] = Field(None, alias='majorAxis')
    minor_axis: Optional[float] = Field(None, alias='minorAxis')


class AntennaMetrics(BaseModel):
    max_gain: float = Field(alias='maxGain')
    directivity: float
    efficiency: float
    bandwidth: float
    beamwidth_e_plane: float = Field(alias='beamwidthEPlane')
    beamwidth_h_plane: float = Field(alias='beamwidthHPlane')
    front_to_back_ratio: float = Field(alias='frontToBackRatio')
    polarization: PolarizationType


class CurrentDistribution(BaseModel):
    mesh_vertices: List[Vec3] = Field(alias='meshVertices')
    mesh_triangles: List[List[int]] = Field(alias='meshTriangles')
    current_density: List[Vec3Complex] = Field(alias='currentDensity')
    magnitude: List[float]
    phase: List[float]


class SimulationResults(BaseModel):
    id: str
    antenna_id: str = Field(alias='antennaId')
    timestamp: int
    frequencies: List[float]
    s_parameters: SParameters = Field(alias='sParameters')
    radiation_patterns: List[RadiationPattern] = Field(alias='radiationPatterns')
    antenna_metrics: AntennaMetrics = Field(alias='antennaMetrics')
    current_distribution: Optional[CurrentDistribution] = Field(None, alias='currentDistribution')
    convergence_history: List[float] = Field(alias='convergenceHistory')

    def to_training_data(self) -> Dict[str, np.ndarray]:
        """Convert results to ML training data format."""
        data = {
            'frequencies': np.array(self.frequencies),
            **self.s_parameters.to_numpy(),
            'max_gain': self.antenna_metrics.max_gain,
            'efficiency': self.antenna_metrics.efficiency,
            'bandwidth': self.antenna_metrics.bandwidth
        }
        
        # Add radiation pattern data
        if self.radiation_patterns:
            pattern = self.radiation_patterns[0]  # Use first frequency
            pattern_data = pattern.to_numpy()
            data['gain_pattern'] = pattern_data['gain']
            
        return data


# Optimization types
class ObjectiveType(BaseModel):
    type: Literal['maximizeGain', 'minimizeReturnLoss', 'maximizeBandwidth', 
                  'minimizeSideLobes', 'matchImpedance', 'custom']
    impedance: Optional[Complex] = None
    custom_name: Optional[str] = Field(None, alias='customName')


class Objective(BaseModel):
    name: str
    type: ObjectiveType
    weight: float
    target_value: Optional[float] = Field(None, alias='targetValue')


class ConstraintType(str, Enum):
    DIMENSION = 'dimension'
    GAIN = 'gain'
    BANDWIDTH = 'bandwidth'
    EFFICIENCY = 'efficiency'
    RETURN_LOSS = 'returnLoss'
    CUSTOM = 'custom'


class Constraint(BaseModel):
    name: str
    type: ConstraintType
    min_value: Optional[float] = Field(None, alias='minValue')
    max_value: Optional[float] = Field(None, alias='maxValue')


class DesignVariable(BaseModel):
    name: str
    path: str
    min_value: float = Field(alias='minValue')
    max_value: float = Field(alias='maxValue')
    step_size: Optional[float] = Field(None, alias='stepSize')


class GeneticAlgorithmParams(BaseModel):
    population_size: int = Field(alias='populationSize')
    mutation_rate: float = Field(alias='mutationRate')
    crossover_rate: float = Field(alias='crossoverRate')
    elite_size: int = Field(alias='eliteSize')


class ParticleSwarmParams(BaseModel):
    particle_count: int = Field(alias='particleCount')
    inertia_weight: float = Field(alias='inertiaWeight')
    cognitive_weight: float = Field(alias='cognitiveWeight')
    social_weight: float = Field(alias='socialWeight')


class GradientDescentParams(BaseModel):
    learning_rate: float = Field(alias='learningRate')
    momentum: float
    adaptive: bool


class BayesianParams(BaseModel):
    acquisition_function: str = Field(alias='acquisitionFunction')
    exploration_weight: float = Field(alias='explorationWeight')
    n_initial_points: int = Field(alias='nInitialPoints')


class OptimizationAlgorithm(BaseModel):
    type: Literal['geneticAlgorithm', 'particleSwarm', 'gradientDescent', 'bayesian', 'hybrid']
    params: Union[GeneticAlgorithmParams, ParticleSwarmParams, 
                  GradientDescentParams, BayesianParams]
    sub_algorithms: Optional[List['OptimizationAlgorithm']] = Field(None, alias='subAlgorithms')


class OptimizationSettings(BaseModel):
    max_iterations: int = Field(alias='maxIterations')
    max_evaluations: int = Field(alias='maxEvaluations')
    convergence_tolerance: float = Field(alias='convergenceTolerance')
    parallel_evaluations: int = Field(alias='parallelEvaluations')
    use_surrogate_model: bool = Field(alias='useSurrogateModel')
    save_history: bool = Field(alias='saveHistory')


class OptimizationConfig(BaseModel):
    id: str
    objectives: List[Objective]
    constraints: List[Constraint]
    variables: List[DesignVariable]
    algorithm: OptimizationAlgorithm
    settings: OptimizationSettings


class Solution(BaseModel):
    id: str
    variables: Dict[str, float]
    objectives: Dict[str, float]
    constraints_satisfied: bool = Field(alias='constraintsSatisfied')
    simulation_results: Optional[SimulationResults] = Field(None, alias='simulationResults')


# ML-specific types
class SurrogateModelConfig(BaseModel):
    model_type: str = Field(alias='modelType')
    input_features: List[str] = Field(alias='inputFeatures')
    output_features: List[str] = Field(alias='outputFeatures')
    hyperparameters: Dict[str, float]


class TrainingDataset(BaseModel):
    """Dataset for training surrogate models."""
    antenna_params: List[AntennaParams]
    simulation_results: List[SimulationResults]
    
    def to_numpy(self) -> tuple[np.ndarray, Dict[str, np.ndarray]]:
        """Convert dataset to numpy arrays for ML training."""
        X = np.array([params.to_feature_vector() for params in self.antenna_params])
        
        # Collect all output data
        Y = {}
        for i, results in enumerate(self.simulation_results):
            result_data = results.to_training_data()
            if i == 0:
                # Initialize output dictionaries
                for key, value in result_data.items():
                    Y[key] = []
            
            for key, value in result_data.items():
                Y[key].append(value)
        
        # Convert lists to numpy arrays
        for key in Y:
            Y[key] = np.array(Y[key])
            
        return X, Y


# Model update for OptimizationAlgorithm to resolve forward reference
OptimizationAlgorithm.model_rebuild()