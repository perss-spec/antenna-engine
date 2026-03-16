import { invoke } from '@tauri-apps/api/core';
import type { AntennaPattern, SimulationParams as CoreSimulationParams, SimulationResult, AntennaGeometry } from '../types/antenna';

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

export async function runSimulation(patternId: string, params: CoreSimulationParams): Promise<TauriResponse<SimulationResult>> {
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

// Types and functions used by App.tsx, AntennaDesigner.tsx, ExportPanel.tsx, ResultsViewer.tsx

export interface SimulationParams {
  frequency_start: number;
  frequency_end: number;
  frequency_steps: number;
  antenna_type: string;
  dimensions: Record<string, number>;
}

export interface AntennaResult {
  frequency: number;
  gain: number;
  vswr: number;
  impedance: { real: number; imaginary: number };
  efficiency: number;
}

export async function simulateAntenna(params: SimulationParams): Promise<AntennaResult[]> {
  try {
    const result = await invoke<AntennaResult[]>('simulate_antenna', { params });
    return result;
  } catch (error) {
    throw new Error(String(error));
  }
}

export async function exportResults(results: AntennaResult[], format: string): Promise<void> {
  try {
    await invoke<void>('export_results', { results, format });
  } catch (error) {
    throw new Error(String(error));
  }
}

export async function createPattern(data: object): Promise<TauriResponse<AntennaPattern>> {
  try {
    const result = await invoke<AntennaPattern>('create_pattern', { data });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

export async function updatePattern(id: string, data: object): Promise<TauriResponse<AntennaPattern>> {
  try {
    const result = await invoke<AntennaPattern>('update_pattern', { id, data });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}