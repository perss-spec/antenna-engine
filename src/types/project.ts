import { AntennaElement, Material, UnitSystem } from './antenna';
import { FrequencySweepParams, SimulationResult } from './simulation';

export interface ProjectMetadata {
  name: string;
  version: string;
  createdAt: string;
  modifiedAt: string;
  author: string;
  description: string;
}

export interface ProjectFile {
  metadata: ProjectMetadata;
  antennaConfig: AntennaElement;
  simulationParams: FrequencySweepParams;
  results?: SimulationResult;
  materials: Material[];
  unitSystem: UnitSystem;
}

export interface ProjectSettings {
  theme: 'light' | 'dark';
  defaultUnits: UnitSystem;
  autoSave: boolean;
  aiPredictionEnabled: boolean;
  gpuAcceleration: boolean;
}

export interface RecentProject {
  path: string;
  name: string;
  lastOpened: string;
  thumbnail?: string;
}