export interface AntennaPattern {
  id: string;
  name: string;
  frequency: number;
  gain: number;
  directivity: number;
  beamwidth: number;
  efficiency: number;
  polarization: 'horizontal' | 'vertical' | 'circular' | 'linear' | 'elliptical';
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

// Types needed by other modules (previously exported, restored)

export interface Point3D {
  x: number;
  y: number;
  z: number;
}

export interface Material {
  name: string;
  epsilonR: number;
  muR: number;
  sigma: number;
  tanDelta: number;
}

export type UnitSystem = 'metric' | 'imperial';

export interface AntennaElement {
  id: string;
  type: 'dipole' | 'monopole' | 'patch' | 'yagi' | 'horn' | 'wire' | 'qfh';
  position: Point3D;
  dimensions: Record<string, number>;
  material?: Material;
  feedPoint?: Point3D;
}

export interface AntennaTemplate {
  id: string;
  name: string;
  type: string;
  description: string;
  defaultParams: Record<string, number>;
  thumbnail?: string;
}