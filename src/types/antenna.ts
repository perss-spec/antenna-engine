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

export enum UnitSystem {
  Metric = 'Metric',
  Imperial = 'Imperial'
}

export enum LengthUnit {
  Meters = 'Meters',
  Centimeters = 'Centimeters',
  Millimeters = 'Millimeters',
  Inches = 'Inches'
}

export enum FrequencyUnit {
  Hz = 'Hz',
  KHz = 'KHz',
  MHz = 'MHz',
  GHz = 'GHz'
}

export interface DipoleParams {
  length: number;
  radius: number;
  center: Point3D;
  orientation: Point3D;
}

export interface PatchParams {
  width: number;
  length: number;
  substrateHeight: number;
  substrateEr: number;
  center: Point3D;
}

export interface QfhParams {
  frequency: number;
  turns: number;
  diameter: number;
  height: number;
  wireRadius: number;
  center: Point3D;
}

export interface MonopoleParams {
  length: number;
  radius: number;
  groundPlaneRadius: number;
  center: Point3D;
}

export interface YagiParams {
  reflectorLength: number;
  drivenLength: number;
  directorLength: number;
  elementSpacing: number;
  wireRadius: number;
  center: Point3D;
}

export type AntennaType = 'Dipole' | 'Patch' | 'Qfh' | 'Monopole' | 'Yagi';

export type AntennaParams = DipoleParams | PatchParams | QfhParams | MonopoleParams | YagiParams;

export interface AntennaElement {
  type: AntennaType;
  params: AntennaParams;
}

export interface AntennaTemplate {
  id: string;
  name: string;
  type: AntennaType;
  defaultFrequency: number;
  defaultParams: Record<string, number>;
  description: string;
  frequencyRange: [number, number];
  typicalApplications: string[];
}

export enum AntennaError {
  InvalidGeometry = 'InvalidGeometry',
  SimulationFailed = 'SimulationFailed',
  InvalidParameter = 'InvalidParameter',
  NumericalError = 'NumericalError'
}