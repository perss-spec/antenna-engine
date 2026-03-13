import { Point3D, AntennaGeometry } from '../types/antenna';
import { FieldResult } from '../types/simulation';
import type { Scene, PerspectiveCamera, WebGLRenderer, Material, BufferGeometry } from 'three';

// Extended types for viewport rendering (not in core antenna.ts)
export type Vec3 = Point3D;

export interface ViewportAntennaElement {
  id: string;
  type: 'wire' | 'patch' | 'qfh' | 'monopole';
  vertices: Point3D[];
  radius?: number;
  thickness?: number;
  material?: string;
}

export interface ViewportAntennaGeometry {
  elements: ViewportAntennaElement[];
  feedPoints?: Point3D[];
  boundingBox?: [Point3D, Point3D];
}

export interface RadiationPatternData {
  frequency: number;
  theta: number[];
  phi: number[];
  gain: number[][];
}

export interface FieldData {
  positions: Vec3[];
  magnitude: number[];
}

export interface ViewportSettings {
  showGrid: boolean;
  showAxes: boolean;
  showBoundingBox: boolean;
  backgroundColor: string;
  gridColor: string;
  axesColor: string;
}

export interface CameraSettings {
  position: Point3D;
  target: Point3D;
  fov: number;
  near: number;
  far: number;
}

export interface RenderSettings {
  wireframeMode: boolean;
  showNormals: boolean;
  shadingMode: 'flat' | 'smooth';
  materialOverride?: string;
}

export interface FieldVisualizationSettings {
  showEField: boolean;
  showHField: boolean;
  showPowerDensity: boolean;
  fieldScale: number;
  colorMap: 'viridis' | 'plasma' | 'jet' | 'hot';
  opacity: number;
  vectorDensity: number;
}

export interface AntennaModelProps {
  geometry: AntennaGeometry;
  renderSettings: RenderSettings;
  isSelected?: boolean;
  onSelect?: () => void;
}

export interface FieldVisualizationProps {
  fieldData: FieldResult;
  settings: FieldVisualizationSettings;
  visible: boolean;
}

export interface ViewportProps {
  geometry?: AntennaGeometry;
  fieldData?: FieldResult;
  viewportSettings: ViewportSettings;
  cameraSettings: CameraSettings;
  renderSettings: RenderSettings;
  fieldSettings: FieldVisualizationSettings;
  onCameraChange?: (camera: CameraSettings) => void;
  onGeometrySelect?: (elementId: string) => void;
}

// Three.js specific types
export interface ThreeJSContext {
  scene: Scene;
  camera: PerspectiveCamera;
  renderer: WebGLRenderer;
  controls: any; // OrbitControls type
}

export interface MaterialLibrary {
  wire: Material;
  surface: Material;
  feedPoint: Material;
  ground: Material;
  substrate: Material;
}

export interface GeometryCache {
  [key: string]: BufferGeometry;
}

// Animation types
export interface AnimationSettings {
  enabled: boolean;
  speed: number;
  type: 'rotation' | 'field_propagation' | 'current_flow';
}

export interface AnimationFrame {
  timestamp: number;
  fieldData?: FieldResult;
  currentDistribution?: number[];
}