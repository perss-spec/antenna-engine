import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Play, Square, Clock, MemoryStick, Zap } from 'lucide-react';

interface SimulationStatus {
  stage: 'meshing' | 'building_matrix' | 'solving' | 'post_processing';
  progress: number;
  eta_seconds: number;
  memory_mb: number;
  is_running: boolean;
  error?: string;
}

const SolverProgress: React.FC = () => {
  const [status, setStatus] = useState<SimulationStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);

  const stageLabels = {
    meshing: 'Meshing Geometry',
    building_matrix: 'Building Z-matrix',
    solving: 'Solving System',
    post_processing: 'Post-processing'
  };

  const stageIcons = {
    meshing: <Zap className="w-4 h-4" />,
    building_matrix: <MemoryStick className="w-4 h-4" />,
    solving: <Play className="w-4 h-4" />,
    post_processing: <Clock className="w-4 h-4" />
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    if (isPolling) {
      interval = setInterval(async () => {
        try {
          const statusData = await invoke<SimulationStatus>('get_simulation_status');
          setStatus(statusData);
          
          if (!statusData.is_running) {
            setIsPolling(false);
          }
        } catch (error) {
          console.error('Failed to fetch simulation status:', error);
          setIsPolling(false);
        }
      }, 500);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPolling]);

  const handleCancel = async () => {
    try {
      await invoke('cancel_simulation');
      setIsPolling(false);
      setStatus(null);
    } catch (error) {
      console.error('Failed to cancel simulation:', error);
    }
  };

  const formatETA = (seconds: number): string => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  };

  const formatMemory = (mb: number): string => {
    if (mb < 1024) return `${Math.round(mb)} MB`;
    return `${(mb / 1024).toFixed(1)} GB`;
  };

  if (!status || !isPolling) {
    return null;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Simulation Progress</h3>
        <button
          onClick={handleCancel}
          className="flex items-center space-x-2 px-3 py-1.5 text-red-600 hover:bg-red-50 rounded-md transition-colors"
        >
          <Square className="w-4 h-4" />
          <span>Cancel</span>
        </button>
      </div>

      {status.error ? (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="text-red-800 font-medium mb-1">Simulation Error</div>
          <div className="text-red-700 text-sm">{status.error}</div>
        </div>
      ) : (
        <>
          {/* Stage Indicator */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2 text-blue-600">
                {stageIcons[status.stage]}
                <span className="font-medium">{stageLabels[status.stage]}</span>
              </div>
              <span className="text-sm text-gray-500">{Math.round(status.progress)}%</span>
            </div>
            
            {/* Progress Bar */}
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${status.progress}%` }}
              />
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center space-x-2 text-gray-600">
              <Clock className="w-4 h-4" />
              <span>ETA: {formatETA(status.eta_seconds)}</span>
            </div>
            <div className="flex items-center space-x-2 text-gray-600">
              <MemoryStick className="w-4 h-4" />
              <span>Memory: {formatMemory(status.memory_mb)}</span>
            </div>
          </div>

          {/* Stage Progress */}
          <div className="mt-6">
            <div className="flex space-x-1">
              {Object.keys(stageLabels).map((stage, index) => (
                <div key={stage} className="flex-1">
                  <div
                    className={`h-1 rounded-full ${
                      index < Object.keys(stageLabels).indexOf(status.stage)
                        ? 'bg-green-500'
                        : index === Object.keys(stageLabels).indexOf(status.stage)
                        ? 'bg-blue-500'
                        : 'bg-gray-200'
                    }`}
                  />
                  <div className="text-xs text-gray-500 mt-1 truncate">
                    {stageLabels[stage as keyof typeof stageLabels]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SolverProgress;