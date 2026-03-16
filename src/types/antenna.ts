export interface AntennaPattern {
  id: string;
  name: string;
  frequency: number;
  gain: number[];
  theta: number[];
  phi: number[];
  polarization: 'horizontal' | 'vertical' | 'circular';
  created_at: string;
  updated_at: string;
}

export interface SimulationConfig {
  frequency_range: [number, number];
  resolution: number;
  ground_plane: boolean;
  environment: 'free_space' | 'ground' | 'urban';
}

export interface SimulationResult {
  id: string;
  pattern_id: string;
  config: SimulationConfig;
  gain_data: number[][];
  directivity: number;
  efficiency: number;
  bandwidth: number;
  created_at: string;
}

export interface TauriResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}