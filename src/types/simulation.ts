/**
 * TypeScript interfaces for simulation configuration and results
 */

import { Complex, Vec3, Vec3Complex } from './antenna';

// Simulation configuration
export interface SimulationParams {
  frequencyStart: number;
  frequencyStop: number;
  frequencyPoints: number;
  solverType: SolverType;
  boundaryConditions: BoundaryConditions;
  excitation: Excitation;
  convergenceThreshold: number;
  maxIterations: number;
}

export type SolverType =
  | 'methodOfMoments'
  | 'finiteDifference'
  | 'finiteElement'
  | 'hybrid';

export interface BoundaryConditions {
  type: BoundaryType;
  distance: number;
  layers: number;
}

export type BoundaryType =
  | 'perfectlyMatchedLayer'
  | 'absorbingBoundary'
  | 'periodic'
  | 'perfectElectricConductor';

export interface Excitation {
  type: ExcitationType;
  amplitude: number;
  phase: number;
  impedance: number;
}

export type ExcitationType =
  | 'voltageSource'
  | 'currentSource'
  | 'planeWave'
  | 'gaussianBeam';

// Simulation results
export interface SimulationResults {
  id: string;
  antennaId: string;
  timestamp: number;
  frequencies: number[];
  sParameters: SParameters;
  radiationPatterns: RadiationPattern[];
  antennaMetrics: AntennaMetrics;
  currentDistribution?: CurrentDistribution;
  convergenceHistory: number[];
}

export interface SParameters {
  s11: Complex[];
  s21?: Complex[];
  s12?: Complex[];
  s22?: Complex[];
  vswr: number[];
  inputImpedance: Complex[];
}

export interface RadiationPattern {
  frequency: number;
  theta: number[];
  phi: number[];
  eTheta: Complex[][];
  ePhi: Complex[][];
  gain: number[][];
  phase: number[][];
}

export interface AntennaMetrics {
  maxGain: number;
  directivity: number;
  efficiency: number;
  bandwidth: number;
  beamwidthEPlane: number;
  beamwidthHPlane: number;
  frontToBackRatio: number;
  polarization: PolarizationType;
}

export type PolarizationType =
  | { type: 'linear'; angle: number }
  | { type: 'circular'; direction: CircularPolarization }
  | { type: 'elliptical'; majorAxis: number; minorAxis: number };

export type CircularPolarization = 'rightHand' | 'leftHand';

export interface CurrentDistribution {
  meshVertices: Vec3[];
  meshTriangles: [number, number, number][];
  currentDensity: Vec3Complex[];
  magnitude: number[];
  phase: number[];
}

// Progress and status types
export interface SimulationProgress {
  status: SimulationStatus;
  currentFrequency?: number;
  progressPercentage: number;
  estimatedTimeRemaining?: number;
  message: string;
}

export type SimulationStatus =
  | 'idle'
  | 'initializing'
  | 'meshing'
  | 'solving'
  | 'postProcessing'
  | 'completed'
  | { failed: string }
  | 'cancelled';

export interface OptimizationProgress {
  iteration: number;
  bestFitness: number;
  currentFitness: number;
  convergenceMetric: number;
  populationDiversity?: number;
  paretoFront?: Solution[];
}

export interface Solution {
  id: string;
  variables: Record<string, number>;
  objectives: Record<string, number>;
  constraintsSatisfied: boolean;
  simulationResults?: SimulationResults;
}

// Single-frequency S-parameter result (matches Rust SParameterResult)
export interface SParameterResult {
  frequency: number;
  s11Re: number;
  s11Im: number;
  vswr: number;
  inputImpedanceRe: number;
  inputImpedanceIm: number;
}

// Utility functions for working with complex numbers
export const complexMagnitude = (c: Complex): number =>
  Math.sqrt(c.real * c.real + c.imag * c.imag);

export const complexPhase = (c: Complex): number =>
  Math.atan2(c.imag, c.real);

export const complexAdd = (a: Complex, b: Complex): Complex => ({
  real: a.real + b.real,
  imag: a.imag + b.imag,
});

export const complexMultiply = (a: Complex, b: Complex): Complex => ({
  real: a.real * b.real - a.imag * b.imag,
  imag: a.real * b.imag + a.imag * b.real,
});

export const complexToDb = (c: Complex): number =>
  20 * Math.log10(complexMagnitude(c));

export const vswrFromS11 = (s11: Complex): number => {
  const mag = complexMagnitude(s11);
  return (1 + mag) / (1 - mag);
};

// Type guards
export const isSimulationComplete = (
  status: SimulationStatus
): boolean => status === 'completed';

export const isSimulationFailed = (
  status: SimulationStatus
): status is { failed: string } =>
  typeof status === 'object' && 'failed' in status;

export const isCircularPolarization = (
  pol: PolarizationType
): pol is { type: 'circular'; direction: CircularPolarization } =>
  typeof pol === 'object' && pol.type === 'circular';