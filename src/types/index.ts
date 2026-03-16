export interface AntennaPattern {
  id: string;
  name: string;
  frequency: number;
  gain: number;
  directivity: number;
  efficiency: number;
  beamwidth: number;
  polarization: 'horizontal' | 'vertical' | 'circular' | 'linear' | 'elliptical';
  created_at: string;
  updated_at: string;
}

export interface SimulationConfig {
  frequency: number;
  power: number;
  impedance: number;
  environment: 'free_space' | 'ground_plane' | 'urban' | 'rural';
  resolution: number;
}

export interface SimulationResult {
  id: string;
  pattern_id: string;
  config: SimulationConfig;
  gain_data: number[][];
  phase_data: number[][];
  vswr: number;
  bandwidth: number;
  efficiency: number;
  created_at: string;
}

export interface OptimizationTarget {
  parameter: string;
  target_value: number;
  weight: number;
}

export interface OptimizationResult {
  id: string;
  pattern_id: string;
  targets: OptimizationTarget[];
  optimized_parameters: Record<string, number>;
  fitness_score: number;
  iterations: number;
  created_at: string;
}

export interface TauriResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface TauriInvokeArgs {
  [key: string]: any;
}