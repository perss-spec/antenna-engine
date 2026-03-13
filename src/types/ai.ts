import { SParameterResult } from './simulation';

export interface AIPredictionRequest {
  antennaType: string;
  parameters: Record<string, number>;
  frequencyRange: [number, number];
  numPoints: number;
}

export interface AIPredictionResponse {
  sParameters: SParameterResult[];
  confidence: number;
  modelVersion: string;
  predictionTime: number;
}

export interface ModelMetadata {
  id: string;
  name: string;
  antennaType: string;
  version: string;
  accuracy: number;
  trainingDate: string;
  inputFeatures: string[];
  outputFeatures: string[];
}

export interface OptimizationObjective {
  type: 'minimize' | 'maximize';
  target: 's11_magnitude' | 'vswr' | 'bandwidth' | 'efficiency';
  weight: number;
  constraint?: {
    min?: number;
    max?: number;
  };
}

export interface OptimizationParams {
  objectives: OptimizationObjective[];
  parameterBounds: Record<string, [number, number]>;
  algorithm: 'genetic' | 'particle_swarm' | 'differential_evolution';
  populationSize: number;
  maxGenerations: number;
  convergenceTolerance: number;
}

export interface OptimizationResult {
  bestParameters: Record<string, number>;
  bestObjectiveValues: number[];
  paretoFront: Array<{
    parameters: Record<string, number>;
    objectives: number[];
  }>;
  convergenceHistory: number[][];
  totalEvaluations: number;
  computationTime: number;
}