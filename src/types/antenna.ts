export interface Point3D {
  x: number;
  y: number;
  z: number;
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
  height: number;
  radius: number;
  groundPlaneRadius: number;
  center: Point3D;
}

export type AntennaType = 'dipole' | 'patch' | 'qfh' | 'monopole';

export interface AntennaElement {
  type: AntennaType;
  params: DipoleParams | PatchParams | QfhParams | MonopoleParams;
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

export interface AntennaTemplate {
  id: string;
  name: string;
  description: string;
  antennaType: string;
  defaultParams: Record<string, any>;
  frequencyRange: [number, number];
  typicalApplications: string[];
}

export interface WireSegment {
  start: Point3D;
  end: Point3D;
  radius: number;
  materialId: string;
}

export interface SurfaceElement {
  vertices: Point3D[];
  normal: Point3D;
  area: number;
  materialId: string;
}

export interface AntennaGeometry {
  wireSegments: WireSegment[];
  surfaceElements: SurfaceElement[];
  feedPoints: Point3D[];
  boundingBox: [Point3D, Point3D];
}