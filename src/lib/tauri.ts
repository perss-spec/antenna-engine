import { invoke } from '@tauri-apps/api/tauri';
import type { 
  AntennaPattern, 
  SimulationConfig, 
  SimulationResult, 
  OptimizationTarget, 
  OptimizationResult,
  TauriResponse,
  TauriInvokeArgs
} from '../types';

export async function createPattern(pattern: Omit<AntennaPattern, 'id' | 'created_at' | 'updated_at'>): Promise<TauriResponse<AntennaPattern>> {
  return await invoke<TauriResponse<AntennaPattern>>('create_pattern', { pattern });
}

export async function getPatterns(): Promise<TauriResponse<AntennaPattern[]>> {
  return await invoke<TauriResponse<AntennaPattern[]>>('get_patterns');
}

export async function getPattern(id: string): Promise<TauriResponse<AntennaPattern>> {
  return await invoke<TauriResponse<AntennaPattern>>('get_pattern', { id });
}

export async function updatePattern(id: string, pattern: Partial<AntennaPattern>): Promise<TauriResponse<AntennaPattern>> {
  return await invoke<TauriResponse<AntennaPattern>>('update_pattern', { id, pattern });
}

export async function deletePattern(id: string): Promise<TauriResponse<void>> {
  return await invoke<TauriResponse<void>>('delete_pattern', { id });
}

export async function runSimulation(patternId: string, config: SimulationConfig): Promise<TauriResponse<SimulationResult>> {
  return await invoke<TauriResponse<SimulationResult>>('run_simulation', { 
    pattern_id: patternId, 
    config 
  });
}

export async function getSimulationResults(patternId: string): Promise<TauriResponse<SimulationResult[]>> {
  return await invoke<TauriResponse<SimulationResult[]>>('get_simulation_results', { 
    pattern_id: patternId 
  });
}

export async function optimizePattern(
  patternId: string, 
  targets: OptimizationTarget[]
): Promise<TauriResponse<OptimizationResult>> {
  return await invoke<TauriResponse<OptimizationResult>>('optimize_pattern', { 
    pattern_id: patternId, 
    targets 
  });
}

export async function getOptimizationResults(patternId: string): Promise<TauriResponse<OptimizationResult[]>> {
  return await invoke<TauriResponse<OptimizationResult[]>>('get_optimization_results', { 
    pattern_id: patternId 
  });
}

export async function exportPattern(patternId: string, format: 'json' | 'csv' | 'touchstone'): Promise<TauriResponse<string>> {
  return await invoke<TauriResponse<string>>('export_pattern', { 
    pattern_id: patternId, 
    format 
  });
}

export async function importPattern(filePath: string): Promise<TauriResponse<AntennaPattern>> {
  return await invoke<TauriResponse<AntennaPattern>>('import_pattern', { 
    file_path: filePath 
  });
}