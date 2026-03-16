import React, { useState } from 'react';
import type { SimulationParams, SimulationResult } from '../types/antenna';
import { runSimulation } from '../lib/tauri';

interface SimulationPanelProps {
  patternId: string | null;
  onSimulationComplete?: (result: SimulationResult) => void;
  className?: string;
}

export const SimulationPanel: React.FC<SimulationPanelProps> = ({
  patternId,
  onSimulationComplete,
  className = ''
}) => {
  const [params, setParams] = useState<SimulationParams>({
    frequency: 2400,
    power: 10,
    impedance: 50,
    ground_type: 'perfect',
    height: 10
  });
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [lastResult, setLastResult] = useState<SimulationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleParamChange = (key: keyof SimulationParams, value: any) => {
    setParams(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleRunSimulation = async () => {
    if (!patternId) {
      setError('No pattern selected');
      return;
    }

    setIsSimulating(true);
    setError(null);

    try {
      const response = await runSimulation(patternId, params);
      
      if (response.success && response.data) {
        setLastResult(response.data);
        onSimulationComplete?.(response.data);
      } else {
        setError(response.error || 'Simulation failed');
      }
    } catch (err) {
      setError(`Simulation error: ${err}`);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <h3 className="text-lg font-semibold mb-4">Simulation Parameters</h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Frequency (MHz)
          </label>
          <input
            type="number"
            value={params.frequency}
            onChange={(e) => handleParamChange('frequency', parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="1"
            max="100000"
            step="0.1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Power (W)
          </label>
          <input
            type="number"
            value={params.power}
            onChange={(e) => handleParamChange('power', parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="0.1"
            max="1000"
            step="0.1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Impedance (Ω)
          </label>
          <input
            type="number"
            value={params.impedance}
            onChange={(e) => handleParamChange('impedance', parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="1"
            max="1000"
            step="0.1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Ground Type
          </label>
          <select
            value={params.ground_type}
            onChange={(e) => handleParamChange('ground_type', e.target.value as SimulationParams['ground_type'])}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="perfect">Perfect Ground</option>
            <option value="real">Real Ground</option>
            <option value="seawater">Seawater</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Height (m)
          </label>
          <input
            type="number"
            value={params.height}
            onChange={(e) => handleParamChange('height', parseFloat(e.target.value) || 0)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            min="0.1"
            max="1000"
            step="0.1"
          />
        </div>

        <button
          onClick={handleRunSimulation}
          disabled={!patternId || isSimulating}
          className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isSimulating ? (
            <span className="flex items-center justify-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Running Simulation...
            </span>
          ) : (
            'Run Simulation'
          )}
        </button>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {lastResult && (
          <div className="mt-6">
            <h4 className="text-md font-semibold mb-3">Simulation Results</h4>
            <div className="bg-gray-50 p-4 rounded-md space-y-2">
              <div className="flex justify-between">
                <span className="font-medium">SWR:</span>
                <span>{lastResult.results.swr.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Efficiency:</span>
                <span>{(lastResult.results.efficiency * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Bandwidth:</span>
                <span>{lastResult.results.bandwidth.toFixed(1)} MHz</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Resonant Frequency:</span>
                <span>{lastResult.results.resonant_frequency.toFixed(1)} MHz</span>
              </div>
              <div className="text-xs text-gray-500 mt-2">
                Simulated: {new Date(lastResult.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};