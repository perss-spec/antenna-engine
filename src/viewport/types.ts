import { Point3D, AntennaGeometry } from '../types/antenna';
import { FieldResult } from '../types/simulation';

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
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: any; // OrbitControls type
}

export interface MaterialLibrary {
  wire: THREE.Material;
  surface: THREE.Material;
  feedPoint: THREE.Material;
  ground: THREE.Material;
  substrate: THREE.Material;
}

export interface GeometryCache {
  [key: string]: THREE.BufferGeometry;
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