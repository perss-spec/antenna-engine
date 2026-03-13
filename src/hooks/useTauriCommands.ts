import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useState } from 'react';
import {
  AntennaElement,
  AntennaTemplate,
  Material,
  ProjectFile
} from '../types/antenna';
import {
  FrequencySweepParams,
  SimulationResult,
  SimulationProgress,
  BatchSimulationParams,
  TouchstoneData
} from '../types/simulation';
import { AIPredictionRequest, AIPredictionResponse } from '../types/ai';

export const useTauriCommands = () => {
  const [simulationProgress, setSimulationProgress] = useState<SimulationProgress | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Listen to Tauri events
  useEffect(() => {
    const unlistenProgress = listen<SimulationProgress>('simulation_progress', (event) => {
      setSimulationProgress(event.payload);
    });

    const unlistenComplete = listen<SimulationResult>('simulation_complete', (event) => {
      setIsSimulating(false);
      setSimulationProgress(null);
    });

    const unlistenError = listen<string>('simulation_error', (event) => {
      setIsSimulating(false);
      setSimulationProgress(null);
      console.error('Simulation error:', event.payload);
    });

    return () => {
      unlistenProgress.then(fn => fn());
      unlistenComplete.then(fn => fn());
      unlistenError.then(fn => fn());
    };
  }, []);

  const createAntenna = useCallback(async (element: AntennaElement): Promise<string> => {
    try {
      const result = await invoke<string>('create_antenna', { params: element });
      return result;
    } catch (error) {
      throw new Error(`Failed to create antenna: ${error}`);
    }
  }, []);

  const runSimulation = useCallback(async (params: FrequencySweepParams): Promise<SimulationResult> => {
    try {
      setIsSimulating(true);
      const result = await invoke<string>('run_simulation', { config: params });
      return JSON.parse(result) as SimulationResult;
    } catch (error) {
      setIsSimulating(false);
      throw new Error(`Simulation failed: ${error}`);
    }
  }, []);

  const getSimulationStatus = useCallback(async (): Promise<SimulationProgress> => {
    try {
      const result = await invoke<string>('get_simulation_status');
      return JSON.parse(result) as SimulationProgress;
    } catch (error) {
      throw new Error(`Failed to get simulation status: ${error}`);
    }
  }, []);

  const loadTouchstone = useCallback(async (path: string): Promise<TouchstoneData> => {
    try {
      const result = await invoke<string>('load_touchstone', { path });
      return JSON.parse(result) as TouchstoneData;
    } catch (error) {
      throw new Error(`Failed to load Touchstone file: ${error}`);
    }
  }, []);

  const saveProject = useCallback(async (path: string, project: ProjectFile): Promise<void> => {
    try {
      await invoke<string>('save_project', { path, data: project });
    } catch (error) {
      throw new Error(`Failed to save project: ${error}`);
    }
  }, []);

  const loadProject = useCallback(async (path: string): Promise<ProjectFile> => {
    try {
      const result = await invoke<string>('load_project', { path });
      return JSON.parse(result) as ProjectFile;
    } catch (error) {
      throw new Error(`Failed to load project: ${error}`);
    }
  }, []);

  const getAntennaTemplates = useCallback(async (): Promise<AntennaTemplate[]> => {
    try {
      const result = await invoke<string>('get_antenna_templates');
      return JSON.parse(result) as AntennaTemplate[];
    } catch (error) {
      throw new Error(`Failed to get antenna templates: ${error}`);
    }
  }, []);

  const predictAntenna = useCallback(async (request: AIPredictionRequest): Promise<AIPredictionResponse> => {
    try {
      const result = await invoke<string>('predict_antenna', { params: request });
      return JSON.parse(result) as AIPredictionResponse;
    } catch (error) {
      throw new Error(`AI prediction failed: ${error}`);
    }
  }, []);

  const exportTouchstone = useCallback(async (path: string, data: SimulationResult): Promise<void> => {
    try {
      await invoke<string>('export_touchstone', { path, data });
    } catch (error) {
      throw new Error(`Failed to export Touchstone: ${error}`);
    }
  }, []);

  const startBatchSimulation = useCallback(async (params: BatchSimulationParams): Promise<string> => {
    try {
      const result = await invoke<string>('start_batch_simulation', { params });
      return result;
    } catch (error) {
      throw new Error(`Failed to start batch simulation: ${error}`);
    }
  }, []);

  const getMaterials = useCallback(async (): Promise<Material[]> => {
    try {
      const result = await invoke<string>('get_materials');
      return JSON.parse(result) as Material[];
    } catch (error) {
      throw new Error(`Failed to get materials: ${error}`);
    }
  }, []);

  return {
    // Commands
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
    
    // State
    simulationProgress,
    isSimulating
  };
};