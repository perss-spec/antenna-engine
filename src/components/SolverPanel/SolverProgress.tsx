import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';

interface SimulationStatus {
  stage: 'Meshing' | 'Building Z-matrix' | 'Solving' | 'Post-processing';
  progress: number; // 0-100
  eta_seconds: number;
  memory_mb: number;
  is_running: boolean;
}

interface SolverProgressProps {
  onCancel: () => void;
  onComplete: () => void;
}

const SolverProgress: React.FC<SolverProgressProps> = ({ onCancel, onComplete }) => {
  const [status, setStatus] = useState<SimulationStatus>({
    stage: 'Meshing',
    progress: 0,
    eta_seconds: 0,
    memory_mb: 0,
    is_running: true
  });

  useEffect(() => {
    const pollStatus = async () => {
      try {
        const result = await invoke<SimulationStatus>('get_simulation_status');
        setStatus(result);
        
        if (!result.is_running && result.progress === 100) {
          onComplete();
        }
      } catch (error) {
        console.error('Failed to get simulation status:', error);
      }
    };

    const interval = setInterval(pollStatus, 1000); // Poll every second
    pollStatus(); // Initial poll

    return () => clearInterval(interval);
  }, [onComplete]);

  const formatETA = (seconds: number): string => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  };

  const formatMemory = (mb: number): string => {
    if (mb < 1024) return `${mb} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
  };

  const getStageIndex = (stage: string): number => {
    const stages = ['Meshing', 'Building Z-matrix', 'Solving', 'Post-processing'];
    return stages.indexOf(stage);
  };

  const handleCancel = async () => {
    try {
      await invoke('cancel_simulation');
      onCancel();
    } catch (error) {
      console.error('Failed to cancel simulation:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Simulation Progress</h3>
        <button
          onClick={handleCancel}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Stage Indicator */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm font-medium text-gray-700">
          {['Meshing', 'Building Z-matrix', 'Solving', 'Post-processing'].map((stage, index) => (
            <span
              key={stage}
              className={`${
                index <= getStageIndex(status.stage)
                  ? 'text-blue-600'
                  : 'text-gray-400'
              }`}
            >
              {stage}
            </span>
          ))}
        </div>
        <div className="flex space-x-1">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className={`flex-1 h-2 rounded ${
                index < getStageIndex(status.stage)
                  ? 'bg-blue-600'
                  : index === getStageIndex(status.stage)
                  ? 'bg-blue-400'
                  : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="font-medium text-gray-700">Current Stage: {status.stage}</span>
          <span className="text-gray-600">{status.progress.toFixed(1)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${status.progress}%` }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-gray-600">ETA</div>
          <div className="font-semibold text-gray-900">
            {status.eta_seconds > 0 ? formatETA(status.eta_seconds) : 'Calculating...'}
          </div>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="text-gray-600">Memory Usage</div>
          <div className="font-semibold text-gray-900">
            {formatMemory(status.memory_mb)}
          </div>
        </div>
      </div>

      {/* Status Message */}
      <div className="text-center text-gray-600">
        <div className="inline-flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
          Running simulation...
        </div>
      </div>
    </div>
  );
};

export default SolverProgress;