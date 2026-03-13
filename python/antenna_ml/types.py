from pydantic import BaseModel
from typing import List, Dict, Optional, Union, Literal
from datetime import datetime

class Point3D(BaseModel):
    x: float
    y: float
    z: float

class DipoleParameters(BaseModel):
    length: float
    radius: float
    center: Point3D
    orientation: Point3D

class PatchParameters(BaseModel):
    width: float
    length: float
    substrate_height: float
    substrate_er: float
    center: Point3D

class QfhParameters(BaseModel):
    frequency: float
    turns: float
    diameter: float
    height: float
    wire_radius: float
    center: Point3D

class MonopoleParameters(BaseModel):
    height: float
    radius: float
    ground_plane_radius: float
    center: Point3D

AntennaParameters = Union[DipoleParameters, PatchParameters, QfhParameters, MonopoleParameters]

class Material(BaseModel):
    name: str
    epsilon_r: float
    mu_r: float
    sigma: float
    tan_delta: float

class SParameterResult(BaseModel):
    frequency: float
    s11_re: float
    s11_im: float
    vswr: float
    input_impedance_re: float
    input_impedance_im: float

class FieldResult(BaseModel):
    points: List[Point3D]
    e_field: List[Point3D]
    h_field: List[Point3D]
    power_density: List[float]

class ConvergenceInfo(BaseModel):
    iterations: int
    residual: float
    converged: bool
    condition_number: float

class SimulationResult(BaseModel):
    s_params: List[SParameterResult]
    field: FieldResult
    num_unknowns: int
    solver_type: str
    computation_time: float
    convergence_info: ConvergenceInfo

class DatasetMetadata(BaseModel):
    antenna_type: str
    timestamp: str
    solver_version: str
    convergence_quality: float

class DatasetEntry(BaseModel):
    parameters: Dict[str, float]
    results: SimulationResult
    metadata: DatasetMetadata

class TrainingConfig(BaseModel):
    model_type: Literal['mlp', 'transformer', 'cnn']
    hidden_layers: List[int]
    activation: Literal['relu', 'tanh', 'gelu']
    dropout_rate: float
    learning_rate: float
    batch_size: int
    max_epochs: int
    early_stopping_patience: int
    validation_split: float

class ModelMetadata(BaseModel):
    id: str
    name: str
    antenna_type: str
    version: str
    accuracy: float
    training_date: datetime
    input_features: List[str]
    output_features: List[str]
    training_config: TrainingConfig
    dataset_size: int

class PredictionRequest(BaseModel):
    antenna_type: str
    parameters: Dict[str, float]
    frequency_range: tuple[float, float]
    num_points: int

class PredictionResponse(BaseModel):
    s_parameters: List[SParameterResult]
    confidence: float
    model_version: str
    prediction_time: float

class OptimizationObjective(BaseModel):
    type: Literal['minimize', 'maximize']
    target: Literal['s11_magnitude', 'vswr', 'bandwidth', 'efficiency']
    weight: float
    constraint: Optional[Dict[str, float]] = None

class OptimizationParams(BaseModel):
    objectives: List[OptimizationObjective]
    parameter_bounds: Dict[str, tuple[float, float]]
    algorithm: Literal['genetic', 'particle_swarm', 'differential_evolution']
    population_size: int
    max_generations: int
    convergence_tolerance: float

class OptimizationResult(BaseModel):
    best_parameters: Dict[str, float]
    best_objective_values: List[float]
    pareto_front: List[Dict[str, Union[Dict[str, float], List[float]]]]
    convergence_history: List[List[float]]
    total_evaluations: int
    computation_time: float