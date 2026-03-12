/**
 * TypeScript interfaces matching Rust antenna types
 */

// Core antenna geometry types
export type AntennaType =
  | { type: 'dipole'; params: DipoleParams }
  | { type: 'patch'; params: PatchParams }
  | { type: 'yagi'; params: YagiParams }
  | { type: 'horn'; params: HornParams }
  | { type: 'custom'; params: CustomGeometry };

export interface DipoleParams {
  length: number;
  radius: number;
  feedGap: number;
  orientation: Vec3;
}

export interface PatchParams {
  width: number;
  length: number;
  substrateHeight: number;
  substratePermittivity: number;
  feedPosition: Vec2;
}

export interface YagiParams {
  drivenElement: DipoleParams;
  reflectorSpacing: number;
  directorSpacings: number[];
  elementLengths: number[];
}

export interface HornParams {
  apertureWidth: number;
  apertureHeight: number;
  length: number;
  waveguideWidth: number;
  waveguideHeight: number;
}

export interface CustomGeometry {
  vertices: Vec3[];
  triangles: [number, number, number][];
  feedEdges: [number, number][];
}

// Material properties
export interface Material {
  name: string;
  permittivity: Complex;
  permeability: Complex;
  conductivity: number;
}

// Antenna parameters for simulation
export interface AntennaParams {
  id: string;
  name: string;
  antennaType: AntennaType;
  material: Material;
  position: Vec3;
  rotation: Vec3;
  meshResolution: MeshResolution;
}

export interface MeshResolution {
  minEdgeLength: number;
  maxEdgeLength: number;
  curvatureRefinement: number;
}

// Optimization types
export interface OptimizationConfig {
  id: string;
  objectives: Objective[];
  constraints: Constraint[];
  variables: DesignVariable[];
  algorithm: OptimizationAlgorithm;
  settings: OptimizationSettings;
}

export interface Objective {
  name: string;
  type: ObjectiveType;
  weight: number;
  targetValue?: number;
}

export type ObjectiveType =
  | 'maximizeGain'
  | 'minimizeReturnLoss'
  | 'maximizeBandwidth'
  | 'minimizeSideLobes'
  | { matchImpedance: Complex }
  | { custom: string };

export interface Constraint {
  name: string;
  type: ConstraintType;
  minValue?: number;
  maxValue?: number;
}

export type ConstraintType =
  | 'dimension'
  | 'gain'
  | 'bandwidth'
  | 'efficiency'
  | 'returnLoss'
  | { custom: string };

export interface DesignVariable {
  name: string;
  path: string;
  minValue: number;
  maxValue: number;
  stepSize?: number;
}

export type OptimizationAlgorithm =
  | { type: 'geneticAlgorithm'; params: GeneticAlgorithmParams }
  | { type: 'particleSwarm'; params: ParticleSwarmParams }
  | { type: 'gradientDescent'; params: GradientDescentParams }
  | { type: 'bayesian'; params: BayesianParams }
  | { type: 'hybrid'; algorithms: OptimizationAlgorithm[] };

export interface GeneticAlgorithmParams {
  populationSize: number;
  mutationRate: number;
  crossoverRate: number;
  eliteSize: number;
}

export interface ParticleSwarmParams {
  particleCount: number;
  inertiaWeight: number;
  cognitiveWeight: number;
  socialWeight: number;
}

export interface GradientDescentParams {
  learningRate: number;
  momentum: number;
  adaptive: boolean;
}

export interface BayesianParams {
  acquisitionFunction: string;
  explorationWeight: number;
  nInitialPoints: number;
}

export interface OptimizationSettings {
  maxIterations: number;
  maxEvaluations: number;
  convergenceTolerance: number;
  parallelEvaluations: number;
  useSurrogateModel: boolean;
  saveHistory: boolean;
}

// Helper types
export interface Vec2 {
  x: number;
  y: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Complex {
  real: number;
  imag: number;
}

export interface Vec3Complex {
  x: Complex;
  y: Complex;
  z: Complex;
}

// Error types
export type AntennaError =
  | { type: 'invalidGeometry'; message: string }
  | { type: 'simulationFailed'; message: string }
  | { type: 'optimizationFailed'; message: string }
  | { type: 'gpuError'; message: string }
  | { type: 'ioError'; message: string }
  | { type: 'serializationError'; message: string };

// Additional types for UI
export interface MeshData {
  vertices: Vec3[];
  triangles: [number, number, number][];
  normals: Vec3[];
  edges: [number, number][];
}

export type ExportFormat = 'json' | 'csv' | 'touchstone' | 'matlab' | 'vtu';
export type ImportFormat = 'json' | 'stl' | 'step' | 'gerber';

export interface SurrogateModelConfig {
  modelType: string;
  inputFeatures: string[];
  outputFeatures: string[];
  hyperparameters: Record<string, number>;
}