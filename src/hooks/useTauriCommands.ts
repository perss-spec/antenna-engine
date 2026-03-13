import { useCallback, useEffect, useState } from 'react';
import {
  AntennaElement,
  AntennaTemplate,
  Material,
} from '../types/antenna';
import {
  FrequencySweepParams,
  SimulationResult,
  SimulationProgress,
  BatchSimulationParams,
  TouchstoneData
} from '../types/simulation';

// Local types for Tauri commands not in core types
interface ProjectFile {
  version: string;
  antenna: AntennaElement;
  simulationParams?: FrequencySweepParams;
  results?: SimulationResult;
}

interface AIPredictionRequest {
  antennaType: string;
  targetFrequency: number;
  constraints?: Record<string, number>;
}

interface AIPredictionResponse {
  suggestedParams: Record<string, number>;
  confidence: number;
  explanation: string;
}

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri) {
    throw new Error('Tauri is not available');
  }
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<T>(cmd, args);
}

async function tauriListen<T>(event: string, handler: (payload: T) => void): Promise<() => void> {
  if (!isTauri) {
    return () => {};
  }
  const { listen } = await import('@tauri-apps/api/event');
  const unlisten = await listen<T>(event, (ev) => handler(ev.payload));
  return unlisten;
}

export const useTauriCommands = () => {
  const [simulationProgress, setSimulationProgress] = useState<SimulationProgress | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  useEffect(() => {
    let unlistenProgress: (() => void) | null = null;
    let unlistenComplete: (() => void) | null = null;
    let unlistenError: (() => void) | null = null;

    (async () => {
      unlistenProgress = await tauriListen<SimulationProgress>('simulation_progress', (payload) => {
        setSimulationProgress(payload);
      });

      unlistenComplete = await tauriListen<SimulationResult>('simulation_complete', (_payload) => {
        setIsSimulating(false);
        setSimulationProgress(null);
      });

      unlistenError = await tauriListen<string>('simulation_error', (payload) => {
        setIsSimulating(false);
        setSimulationProgress(null);
        console.error('Simulation error:', payload);
      });
    })();

    return () => {
      unlistenProgress?.();
      unlistenComplete?.();
      unlistenError?.();
    };
  }, []);

  const createAntenna = useCallback(async (element: AntennaElement): Promise<string> => {
    try {
      const result = await tauriInvoke<string>('create_antenna', { params: element });
      return result;
    } catch (error) {
      throw new Error(`Failed to create antenna: ${error}`);
    }
  }, []);

  const runSimulation = useCallback(async (params: FrequencySweepParams): Promise<SimulationResult> => {
    try {
      setIsSimulating(true);
      const result = await tauriInvoke<string>('run_simulation', { config: params });
      return JSON.parse(result) as SimulationResult;
    } catch (error) {
      setIsSimulating(false);
      throw new Error(`Simulation failed: ${error}`);
    }
  }, []);

  const getSimulationStatus = useCallback(async (): Promise<SimulationProgress> => {
    try {
      const result = await tauriInvoke<string>('get_simulation_status');
      return JSON.parse(result) as SimulationProgress;
    } catch (error) {
      throw new Error(`Failed to get simulation status: ${error}`);
    }
  }, []);

  const loadTouchstone = useCallback(async (path: string): Promise<TouchstoneData> => {
    try {
      const result = await tauriInvoke<string>('load_touchstone', { path });
      return JSON.parse(result) as TouchstoneData;
    } catch (error) {
      throw new Error(`Failed to load Touchstone file: ${error}`);
    }
  }, []);

  const saveProject = useCallback(async (path: string, project: ProjectFile): Promise<void> => {
    try {
      await tauriInvoke<string>('save_project', { path, data: project });
    } catch (error) {
      throw new Error(`Failed to save project: ${error}`);
    }
  }, []);

  const loadProject = useCallback(async (path: string): Promise<ProjectFile> => {
    try {
      const result = await tauriInvoke<string>('load_project', { path });
      return JSON.parse(result) as ProjectFile;
    } catch (error) {
      throw new Error(`Failed to load project: ${error}`);
    }
  }, []);

  const getAntennaTemplates = useCallback(async (): Promise<AntennaTemplate[]> => {
    try {
      const result = await tauriInvoke<string>('get_antenna_templates');
      return JSON.parse(result) as AntennaTemplate[];
    } catch (error) {
      throw new Error(`Failed to get antenna templates: ${error}`);
    }
  }, []);

  const predictAntenna = useCallback(async (request: AIPredictionRequest): Promise<AIPredictionResponse> => {
    try {
      const result = await tauriInvoke<string>('predict_antenna', { params: request });
      return JSON.parse(result) as AIPredictionResponse;
    } catch (error) {
      throw new Error(`AI prediction failed: ${error}`);
    }
  }, []);

  const exportTouchstone = useCallback(async (path: string, data: SimulationResult): Promise<void> => {
    try {
      await tauriInvoke<string>('export_touchstone', { path, data });
    } catch (error) {
      throw new Error(`Failed to export Touchstone: ${error}`);
    }
  }, []);

  const startBatchSimulation = useCallback(async (params: BatchSimulationParams): Promise<string> => {
    try {
      const result = await tauriInvoke<string>('start_batch_simulation', { params });
      return result;
    } catch (error) {
      throw new Error(`Failed to start batch simulation: ${error}`);
    }
  }, []);

  const getMaterials = useCallback(async (): Promise<Material[]> => {
    try {
      const result = await tauriInvoke<string>('get_materials');
      return JSON.parse(result) as Material[];
    } catch (error) {
      throw new Error(`Failed to get materials: ${error}`);
    }
  }, []);

  return {
    createAntenna,
    runSimulation,
    getSimulationStatus,
    loadTouchstone,
    saveProject,
    loadProject,
    getAntennaTemplates,
    predictAntenna,
    exportTouchstone,
    startBatchSimulation,
    getMaterials,
    simulationProgress,
    isSimulating
  };
};
