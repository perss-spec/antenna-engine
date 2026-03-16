import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Play, Square, Clock, MemoryStick } from 'lucide-react';

interface SimulationStatus {
  stage: string;
  progress: number;
  eta_seconds?: number;
  memory_mb?: number;
  is_running: boolean;
  is_complete: boolean;
  error?: string;
}

interface SolverProgressProps {
  isVisible: boolean;
  onComplete: () => void;
  onCancel: () => void;
}

const STAGES = [
  { key: 'meshing', label: 'Meshing' },
  { key: 'zmatrix', label: 'Building Z-matrix' },
  { key: 'solving', label: 'Solving' },
  { key: 'postprocess', label: 'Post-processing' }
];

export const SolverProgress: React.FC<SolverProgressProps> = ({
  isVisible,
  onComplete,
  onCancel
}) => {
  const [status, setStatus] = useState<SimulationStatus>({
    stage: 'meshing',
    progress: 0,
    is_running: false,
    is_complete: false
  });

  const [pollInterval, setPollInterval] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isVisible && !status.is_complete) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => stopPolling();
  }, [isVisible, status.is_complete]);

  const startPolling = () => {
    const interval = setInterval(async () => {
      try {
        const newStatus = await invoke<SimulationStatus>('get_simulation_status');
        setStatus(newStatus);

        if (newStatus.is_complete || newStatus.error) {
          stopPolling();
          if (newStatus.is_complete && !newStatus.error) {
            onComplete();
          }
        }
      } catch (error) {
        console.error('Failed to get simulation status:', error);
        setStatus(prev => ({ ...prev, error: 'Failed to get status' }));
      }
    }, 500);

    setPollInterval(interval);
  };

  const stopPolling = () => {
    if (pollInterval) {
      clearInterval(pollInterval);
      setPollInterval(null);
    }
  };

  const handleCancel = async () => {
    try {
      await invoke('cancel_simulation');
      stopPolling();
      onCancel();
    } catch (error) {
      console.error('Failed to cancel simulation:', error);
    }
  };

  const formatETA = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.round(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`;
  };

  const formatMemory = (mb: number): string => {
    if (mb < 1024) return `${Math.round(mb)} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
  };

  const getCurrentStageIndex = () => {
    return STAGES.findIndex(stage => stage.key === status.stage);
  };

  if (!isVisible) return null;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Play className="h-5 w-5 text-blue-600" />
          Simulation Progress
        </h3>
        <button
          onClick={handleCancel}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-300 rounded-md hover:bg-red-100 transition-colors"
        >
          <Square className="h-4 w-4" />
          Cancel
        </button>
      </div>

      {/* Stage Indicator */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">Current Stage</span>
          <span className="text-gray-500">
            {getCurrentStageIndex() + 1} of {STAGES.length}
          </span>
        </div>
        <div className="flex items-center space-x-4">
          {STAGES.map((stage, index) => {
            const currentIndex = getCurrentStageIndex();
            const isActive = index === currentIndex;
            const isComplete = index < currentIndex;
            
            return (
              <div key={stage.key} className="flex items-center flex-1">
                <div className="flex items-center space-x-2">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    isComplete ? 'bg-green-500' : 
                    isActive ? 'bg-blue-500' : 
                    'bg-gray-300'
                  }`} />
                  <span className={`text-sm font-medium ${
                    isActive ? 'text-blue-700' : 
                    isComplete ? 'text-green-700' : 
                    'text-gray-500'
                  }`}>
                    {stage.label}
                  </span>
                </div>
                {index < STAGES.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-4 ${
                    isComplete ? 'bg-green-500' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">Overall Progress</span>
          <span className="text-gray-500">{Math.round(status.progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className="bg-blue-600 h-3 rounded-full transition-all duration-300 ease-out"
            style={{ width: `${status.progress}%` }}
          />
        </div>
      </div>

      {/* Status Information */}
      <div className="grid grid-cols-2 gap-4">
        {status.eta_seconds && (
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            <span>ETA: {formatETA(status.eta_seconds)}</span>
          </div>
        )}
        
        {status.memory_mb && (
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <MemoryStick className="h-4 w-4" />
            <span>Memory: {formatMemory(status.memory_mb)}</span>
          </div>
        )}
      </div>

      {/* Error Display */}
      {status.error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <div className="text-sm text-red-800">
            <strong>Error:</strong> {status.error}
          </div>
        </div>
      )}

      {/* Running Indicator */}
      {status.is_running && !status.error && (
        <div className="flex items-center justify-center space-x-2 text-sm text-gray-600">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
          <span>Simulation running...</span>
        </div>
      )}
    </div>
  );
};