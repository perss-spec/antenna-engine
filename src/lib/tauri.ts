import { invoke } from '@tauri-apps/api/tauri';
import type { AntennaPattern, SimulationParams, SimulationResult, AntennaGeometry } from '../types/antenna';

export interface TauriResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export async function loadAntennaPattern(id: string): Promise<TauriResponse<AntennaPattern>> {
  try {
    const result = await invoke<AntennaPattern>('load_antenna_pattern', { id });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function saveAntennaPattern(pattern: Omit<AntennaPattern, 'id' | 'created_at' | 'updated_at'>): Promise<TauriResponse<AntennaPattern>> {
  try {
    const result = await invoke<AntennaPattern>('save_antenna_pattern', { pattern });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function runSimulation(patternId: string, params: SimulationParams): Promise<TauriResponse<SimulationResult>> {
  try {
    const result = await invoke<SimulationResult>('run_simulation', { patternId, params });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function generatePattern(geometry: AntennaGeometry, frequency: number): Promise<TauriResponse<AntennaPattern>> {
  try {
    const result = await invoke<AntennaPattern>('generate_pattern', { geometry, frequency });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function listPatterns(): Promise<TauriResponse<AntennaPattern[]>> {
  try {
    const result = await invoke<AntennaPattern[]>('list_patterns');
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function deletePattern(id: string): Promise<TauriResponse<void>> {
  try {
    await invoke<void>('delete_pattern', { id });
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}