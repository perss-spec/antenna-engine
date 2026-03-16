export interface AntennaPattern {
  id: string;
  name: string;
  frequency: number;
  gain: number;
  beamwidth: number;
  efficiency: number;
  polarization: 'horizontal' | 'vertical' | 'circular';
  created_at: string;
  updated_at: string;
  pattern_data: PatternData;
}

export interface PatternData {
  azimuth: number[];
  elevation: number[];
  gain_values: number[][];
  max_gain: number;
  min_gain: number;
}

export interface SimulationParams {
  frequency: number;
  power: number;
  impedance: number;
  ground_type: 'perfect' | 'real' | 'seawater';
  height: number;
}

export interface SimulationResult {
  id: string;
  pattern_id: string;
  params: SimulationParams;
  results: {
    swr: number;
    efficiency: number;
    bandwidth: number;
    resonant_frequency: number;
  };
  created_at: string;
}

export interface AntennaGeometry {
  type: 'dipole' | 'yagi' | 'patch' | 'horn';
  dimensions: {
    length?: number;
    width?: number;
    height?: number;
    elements?: number;
    spacing?: number;
  };
}