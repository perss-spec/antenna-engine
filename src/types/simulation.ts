import { Point3D } from './antenna';

export interface SimulationParams {
  frequency: number;
  resolution: number;
  referenceImpedance: number;
}

export interface FrequencySweepParams {
  startFrequency: number;
  stopFrequency: number;
  numPoints: number;
  referenceImpedance: number;
  resolution: number;
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

export interface ConvergenceInfo {
  iterations: number;
  residual: number;
  converged: boolean;
  conditionNumber: number;
}

export interface SimulationResult {
  sParams: SParameterResult[];
  field: FieldResult;
  numUnknowns: number;
  solverType: string;
  computationTime: number;
  convergenceInfo: ConvergenceInfo;
}

export interface SimulationProgress {
  stage: string;
  progress: number;
  message: string;
  etaSeconds?: number;
}

export enum SamplingMethod {
  Random = 'Random',
  LatinHypercube = 'LatinHypercube',
  Grid = 'Grid',
  Sobol = 'Sobol'
}

export interface BatchSimulationParams {
  parameterRanges: Record<string, [number, number]>;
  numSamples: number;
  frequencySweep: FrequencySweepParams;
  samplingMethod: SamplingMethod;
}

export interface DatasetMetadata {
  antennaType: string;
  timestamp: string;
  solverVersion: string;
  convergenceQuality: number;
}

export interface DatasetEntry {
  parameters: Record<string, number>;
  results: SimulationResult;
  metadata: DatasetMetadata;
}

// Chart data interfaces
export interface ChartDataPoint {
  x: number;
  y: number;
}

export interface S11ChartData {
  frequency: number[];
  magnitude: number[];
  phase: number[];
  vswr: number[];
}

export interface SmithChartData {
  real: number[];
  imaginary: number[];
  frequency: number[];
}

// Touchstone file interfaces
export interface TouchstoneData {
  frequencies: number[];
  sParameters: SParameterResult[];
  format: 'MA' | 'DB' | 'RI';
  frequencyUnit: string;
  referenceImpedance: number;
}