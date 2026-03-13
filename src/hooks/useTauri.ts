import { invoke } from '@tauri-apps/api/tauri';
import { listen } from '@tauri-apps/api/event';
import { useCallback, useEffect, useState } from 'react';
import type { 
  SimulationResult, 
  SimulationProgress, 
  ProjectData,
  GPUCapabilities,
  BenchmarkResult,
  ModelPrediction,
  OptimizationResult
} from '../types/simulation';
import type { AntennaElement } from '../types/antenna';

export const useTauri = () => {
  const [simulationProgress, setSimulationProgress] = useState<SimulationProgress | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

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

  const createAntenna = useCallback(async (params: AntennaElement): Promise<string> => {
    return await invoke<string>('create_antenna', { params });
  }, []);

  const runSimulation = useCallback(async (config: any): Promise<SimulationResult> => {
    setIsSimulating(true);
    const result = await invoke<string>('run_simulation', { config });
    return JSON.parse(result);
  }, []);

  const loadTouchstone = useCallback(async (path: string): Promise<any> => {
    const result = await invoke<string>('load_touchstone', { path });
    return JSON.parse(result);
  }, []);

  const saveProject = useCallback(async (path: string, data: ProjectData): Promise<void> => {
    await invoke<string>('save_project', { path, data });
  }, []);

  const loadProject = useCallback(async (path: string): Promise<ProjectData> => {
    const result = await invoke<string>('load_project', { path });
    return JSON.parse(result);
  }, []);

  const getGpuCapabilities = useCallback(async (): Promise<GPUCapabilities> => {
    const result = await invoke<string>('get_gpu_capabilities');
    return JSON.parse(result);
  }, []);

  const runBenchmark = useCallback(async (matrixSizes: number[]): Promise<BenchmarkResult[]> => {
    const result = await invoke<string>('run_benchmark', { matrixSizes });
    return JSON.parse(result);
  }, []);

  const predictWithAi = useCallback(async (params: any): Promise<ModelPrediction> => {
    const result = await invoke<string>('predict_with_ai', { params });
    return JSON.parse(result);
  }, []);

  const optimizeAntenna = useCallback(async (config: any): Promise<OptimizationResult> => {
    const result = await invoke<string>('optimize_antenna', { config });
    return JSON.parse(result);
  }, []);

  const exportTouchstone = useCallback(async (results: any, path: string): Promise<void> => {
    await invoke<string>('export_touchstone', { results, path });
  }, []);

  const generateReport = useCallback(async (projectData: ProjectData, path: string): Promise<void> => {
    await invoke<string>('generate_report', { projectData, path });
  }, []);

  return {
    createAntenna,
    runSimulation,
    loadTouchstone,
    saveProject,
    loadProject,
    getGpuCapabilities,
    runBenchmark,
    predictWithAi,
    optimizeAntenna,
    exportTouchstone,
    generateReport,
    simulationProgress,
    isSimulating
  };
};