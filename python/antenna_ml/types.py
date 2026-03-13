from pydantic import BaseModel
from typing import List, Optional, Dict, Union
from enum import Enum

class Point3D(BaseModel):
    x: float
    y: float
    z: float

class Material(BaseModel):
    name: str
    epsilon_r: float
    mu_r: float
    sigma: float
    tan_delta: float

class UnitSystem(str, Enum):
    METRIC = "Metric"
    IMPERIAL = "Imperial"

class LengthUnit(str, Enum):
    METERS = "Meters"
    CENTIMETERS = "Centimeters"
    MILLIMETERS = "Millimeters"
    INCHES = "Inches"

class FrequencyUnit(str, Enum):
    HZ = "Hz"
    KHZ = "KHz"
    MHZ = "MHz"
    GHZ = "GHz"

class DipoleParams(BaseModel):
    length: float
    radius: float
    center: Point3D
    orientation: Point3D

class PatchParams(BaseModel):
    width: float
    length: float
    substrate_height: float
    substrate_er: float
    center: Point3D

class QfhParams(BaseModel):
    frequency: float
    turns: float
    diameter: float
    height: float
    wire_radius: float
    center: Point3D

class MonopoleParams(BaseModel):
    length: float
    radius: float
    ground_plane_radius: float
    center: Point3D

class YagiParams(BaseModel):
    reflector_length: float
    driven_length: float
    director_length: float
    element_spacing: float
    wire_radius: float
    center: Point3D

AntennaParameters = Union[DipoleParams, PatchParams, QfhParams, MonopoleParams, YagiParams]

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

class RadiationPattern(BaseModel):
    theta: List[float]
    phi: List[float]
    gain_db: List[List[float]]
    directivity_db: float
    efficiency: float

class SimulationResult(BaseModel):
    s_params: List[SParameterResult]
    field: Optional[FieldResult] = None
    radiation_pattern: Optional[RadiationPattern] = None
    num_unknowns: int
    solver_type: str
    computation_time_ms: float
    memory_used_mb: float

class TrainingDataset(BaseModel):
    antenna_type: str
    parameters: List[Dict[str, float]]
    s_parameter_results: List[List[SParameterResult]]
    metadata: Dict[str, Union[str, float, int]]

class ModelConfig(BaseModel):
    model_type: str
    input_features: List[str]
    output_features: List[str]
    hidden_layers: List[int]
    learning_rate: float
    batch_size: int
    epochs: int
    validation_split: float

class ModelPrediction(BaseModel):
    s_parameters: List[SParameterResult]
    confidence: float
    uncertainty: Optional[float] = None
    inference_time_ms: float
    model_version: str

class OptimizationConfig(BaseModel):
    target_frequency: float
    target_s11_db: float
    parameter_bounds: Dict[str, tuple[float, float]]
    population_size: int
    mutation_rate: float
    crossover_rate: float
    max_generations: int

class OptimizationResult(BaseModel):
    optimal_parameters: Dict[str, float]
    achieved_s11_db: float
    target_frequency: float
    generations: int
    convergence_history: List[float]
    optimization_time_ms: float