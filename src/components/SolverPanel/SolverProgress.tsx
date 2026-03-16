import React, { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Play, Square, Clock, MemoryStick } from 'lucide-react';

interface SimulationStatus {
  is_running: boolean;
  stage: 'Meshing' | 'Building Z-matrix' | 'Solving' | 'Post-processing';
  progress: number; // 0-100
  eta_seconds: number | null;
  memory_usage_mb: number;
  mesh_elements: number;
  matrix_size: number;
}

interface SolverProgressProps {
  isVisible: boolean;
  onComplete: () => void;
  onCancel: () => void;
}

const SolverProgress: React.FC<SolverProgressProps> = ({
  isVisible,
  onComplete,
  onCancel
}) => {
  const [status, setStatus] = useState<SimulationStatus>({
    is_running: false,
    stage: 'Meshing',
    progress: 0,
    eta_seconds: null,
    memory_usage_mb: 0,
    mesh_elements: 0,
    matrix_size: 0
  });

  const pollStatus = useCallback(async () => {
    try {
      const response = await invoke<SimulationStatus>('get_simulation_status');
      setStatus(response);
      
      if (!response.is_running && response.progress === 100) {
        onComplete();
      }
    } catch (error) {
      console.error('Failed to get simulation status:', error);
    }
  }, [onComplete]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isVisible && status.is_running) {
      intervalId = setInterval(pollStatus, 1000); // Poll every second
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isVisible, status.is_running, pollStatus]);

  const handleCancel = async () => {
    try {
      await invoke('cancel_simulation');
      onCancel();
    } catch (error) {
      console.error('Failed to cancel simulation:', error);
    }
  };

  const formatETA = (seconds: number | null): string => {
    if (!seconds) return 'Calculating...';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  const formatMemory = (mb: number): string => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(0)} MB`;
  };

  const getStageProgress = () => {
    const stages = ['Meshing', 'Building Z-matrix', 'Solving', 'Post-processing'];
    const currentIndex = stages.indexOf(status.stage);
    return ((currentIndex * 25) + (status.progress * 0.25));
  };

  if (!isVisible) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-semibold text-gray-900">Simulation Progress</h3>
          <button
            onClick={handleCancel}
            className="flex items-center px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
          >
            <Square className="w-4 h-4 mr-1" />
            Cancel
          </button>
        </div>
        
        {/* Stage Indicator */}
        <div className="mb-4">
          <div className="text-sm font-medium text-gray-700 mb-2">
            Current Stage: {status.stage}
          </div>
          <div className="flex space-x-2">
            {['Meshing', 'Building Z-matrix', 'Solving', 'Post-processing'].map((stage, index) => (
              <div
                key={stage}
                className={`flex-1 h-2 rounded ${
                  status.stage === stage
                    ? 'bg-blue-500'
                    : index < ['Meshing', 'Building Z-matrix', 'Solving', 'Post-processing'].indexOf(status.stage)
                    ? 'bg-green-500'
                    : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Overall Progress</span>
            <span>{getStageProgress().toFixed(1)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="bg-blue-500 h-3 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${getStageProgress()}%` }}
            />
          </div>
        </div>

        {/* Status Information */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center">
            <Clock className="w-4 h-4 mr-2 text-gray-500" />
            <span className="text-gray-600">ETA: </span>
            <span className="font-medium ml-1">{formatETA(status.eta_seconds)}</span>
          </div>
          
          <div className="flex items-center">
            <MemoryStick className="w-4 h-4 mr-2 text-gray-500" />
            <span className="text-gray-600">Memory: </span>
            <span className="font-medium ml-1">{formatMemory(status.memory_usage_mb)}</span>
          </div>
          
          <div className="flex items-center">
            <div className="w-4 h-4 mr-2 bg-gray-300 rounded" />
            <span className="text-gray-600">Mesh Elements: </span>
            <span className="font-medium ml-1">{status.mesh_elements.toLocaleString()}</span>
          </div>
          
          <div className="flex items-center">
            <div className="w-4 h-4 mr-2 bg-gray-300 rounded" />
            <span className="text-gray-600">Matrix Size: </span>
            <span className="font-medium ml-1">{status.matrix_size.toLocaleString()}</span>
          </div>
        </div>

        {/* Stage-specific details */}
        {status.stage === 'Meshing' && (
          <div className="mt-4 p-3 bg-blue-50 rounded">
            <div className="text-sm text-blue-800">
              Generating mesh for geometry analysis...
            </div>
          </div>
        )}

        {status.stage === 'Building Z-matrix' && (
          <div className="mt-4 p-3 bg-yellow-50 rounded">
            <div className="text-sm text-yellow-800">
              Computing impedance matrix ({status.matrix_size}×{status.matrix_size})...
            </div>
          </div>
        )}

        {status.stage === 'Solving' && (
          <div className="mt-4 p-3 bg-green-50 rounded">
            <div className="text-sm text-green-800">
              Solving electromagnetic field equations...
            </div>
          </div>
        )}

        {status.stage === 'Post-processing' && (
          <div className="mt-4 p-3 bg-purple-50 rounded">
            <div className="text-sm text-purple-800">
              Computing radiation patterns and parameters...
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SolverProgress;