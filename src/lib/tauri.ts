import { invoke } from '@tauri-apps/api/tauri';

export interface AntennaResult {
  frequency: number;
  gain: number;
  vswr: number;
  impedance: { real: number; imaginary: number };
  efficiency: number;
}

export interface SimulationParams {
  frequency_start: number;
  frequency_end: number;
  frequency_steps: number;
  antenna_type: string;
  dimensions: Record<string, number>;
}

export async function simulateAntenna(params: SimulationParams): Promise<AntennaResult[]> {
  try {
    const result = await invoke<AntennaResult[]>('simulate_antenna', { params });
    return result;
  } catch (error) {
    console.error('Simulation error:', error);
    throw new Error(`Simulation failed: ${error}`);
  }
}

export async function exportResults(results: AntennaResult[], format: string): Promise<void> {
  try {
    await invoke('export_results', { results, format });
  } catch (error) {
    console.error('Export error:', error);
    throw new Error(`Export failed: ${error}`);
  }
}

export async function loadAntennaModel(path: string): Promise<void> {
  try {
    await invoke('load_antenna_model', { path });
  } catch (error) {
    console.error('Load model error:', error);
    throw new Error(`Failed to load model: ${error}`);
  }
}