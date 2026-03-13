import { Point3D } from './antenna';

export interface SimulationParams {
  frequency: number;
  resolution: number;
  referenceImpedance: number;
}

export interface SimulationConfig {
  startFrequency: number;
  stopFrequency: number;
  numPoints: number;
  referenceImpedance: number;
  useGpu: boolean;
  solverType: string;
  convergenceThreshold: number;
}

export interface SParameterResult {
  frequency: number;
  s11Re: number;
  s11Im: number;
  vswr: number;
  inputImpedanceRe: number;
  inputImpedanceIm: number;
}

export interface FieldResult {
  points: Point3D[];
  eField: Point3D[];
  hField: Point3D[];
  powerDensity: number[];
}

export interface RadiationPattern {
  theta: number[];
  phi: number[];
  gainDb: number[][];
  directivityDb: number;
  efficiency: number;
}

export interface SimulationResult {
  sParams: SParameterResult[];
  field?: FieldResult;
  radiationPattern?: RadiationPattern;
  numUnknowns: number;
  solverType: string;
  computationTimeMs: number;
  memoryUsedMb: number;
}

export interface SimulationProgress {
  stage: string;
  progress: number;
  etaSeconds?: number;
  currentFrequency?: number;
}

export interface GPUCapabilities {
  available: boolean;
  deviceName: string;
  memoryMb: number;
  computeUnits: number;
  supportsCompute: boolean;
}

export interface BenchmarkResult {
  matrixSize: number;
  cpuTimeMs: number;
  gpuTimeMs: number;
  speedupRatio: number;
  memoryUsedMb: number;
}

export interface ModelPrediction {
  sParameters: SParameterResult[];
  confidence: number;
  uncertainty?: number;
  inferenceTimeMs: number;
  modelVersion: string;
}

export interface OptimizationResult {
  optimalParameters: Record<string, number>;
  achievedS11Db: number;
  targetFrequency: number;
  generations: number;
  convergenceHistory: number[];
  optimizationTimeMs: number;
}

export interface FrequencySweepParams {
  startFrequency: number;
  stopFrequency: number;
  numPoints: number;
  referenceImpedance: number;
  resolution: number;
}

export interface BatchSimulationParams {
  parameterRanges: Record<string, [number, number]>;
  numSamples: number;
  frequencySweep: FrequencySweepParams;
  samplingMethod: 'Random' | 'LatinHypercube' | 'Grid' | 'Sobol';
}

export interface TouchstoneData {
  frequencies: number[];
  s11Re: number[];
  s11Im: number[];
  referenceImpedance: number;
  comments: string[];
}

export interface ProjectData {
  name: string;
  version: string;
  createdAt: string;
  modifiedAt: string;
  antennaType: string;
  parameters: Record<string, number>;
  simulationResults?: SimulationResult;
  optimizationResults?: OptimizationResult;
  materials: import('./antenna').Material[];
  unitSystem: import('./antenna').UnitSystem;
}