export interface AntennaParams {
  frequency: number;
  elements: Element[];
}

export interface Element {
  position: [number, number, number];
  length: number;
  radius: number;
}

export interface SimulationResult {
  impedance: [number, number];
  gainDb: number;
  pattern: number[][];
}
