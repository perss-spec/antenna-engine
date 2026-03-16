import React, { useState } from 'react';
import { simulateAntenna, type SimulationParams, type AntennaResult } from '../lib/tauri';

interface AntennaDesignerProps {
  onResultsUpdate?: (results: AntennaResult[]) => void;
}

const AntennaDesigner: React.FC<AntennaDesignerProps> = ({ onResultsUpdate }) => {
  const [params, setParams] = useState<SimulationParams>({
    frequency_start: 2400,
    frequency_end: 2500,
    frequency_steps: 100,
    antenna_type: 'dipole',
    dimensions: {
      length: 0.062,
      diameter: 0.001
    }
  });
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [results, setResults] = useState<AntennaResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleParamChange = (key: keyof SimulationParams, value: any) => {
    if (key === 'dimensions') {
      setParams(prev => ({
        ...prev,
        dimensions: { ...prev.dimensions, ...value }
      }));
    } else {
      setParams(prev => ({
        ...prev,
        [key]: value
      }));
    }
  };

  const handleDimensionChange = (dimKey: string, value: number) => {
    setParams(prev => ({
      ...prev,
      dimensions: {
        ...prev.dimensions,
        [dimKey]: value
      }
    }));
  };

  const runSimulation = async () => {
    setIsSimulating(true);
    setError(null);
    
    try {
      const simulationResults = await simulateAntenna(params);
      setResults(simulationResults);
      onResultsUpdate?.(simulationResults);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="antenna-designer">
      <div className="designer-panel">
        <h3>Antenna Parameters</h3>
        
        <div className="parameter-group">
          <label>
            Antenna Type:
            <select 
              value={params.antenna_type}
              onChange={(e) => handleParamChange('antenna_type', e.target.value)}
            >
              <option value="dipole">Dipole</option>
              <option value="monopole">Monopole</option>
              <option value="patch">Patch</option>
              <option value="yagi">Yagi</option>
            </select>
          </label>
        </div>

        <div className="parameter-group">
          <label>
            Start Frequency (MHz):
            <input
              type="number"
              value={params.frequency_start}
              onChange={(e) => handleParamChange('frequency_start', parseFloat(e.target.value))}
              min="1"
              max="30000"
            />
          </label>
        </div>

        <div className="parameter-group">
          <label>
            End Frequency (MHz):
            <input
              type="number"
              value={params.frequency_end}
              onChange={(e) => handleParamChange('frequency_end', parseFloat(e.target.value))}
              min="1"
              max="30000"
            />
          </label>
        </div>

        <div className="parameter-group">
          <label>
            Frequency Steps:
            <input
              type="number"
              value={params.frequency_steps}
              onChange={(e) => handleParamChange('frequency_steps', parseInt(e.target.value))}
              min="10"
              max="1000"
            />
          </label>
        </div>

        <div className="dimensions-group">
          <h4>Dimensions</h4>
          <label>
            Length (m):
            <input
              type="number"
              value={params.dimensions.length || 0.062}
              onChange={(e) => handleDimensionChange('length', parseFloat(e.target.value))}
              step="0.001"
              min="0.001"
            />
          </label>
          
          <label>
            Diameter (m):
            <input
              type="number"
              value={params.dimensions.diameter || 0.001}
              onChange={(e) => handleDimensionChange('diameter', parseFloat(e.target.value))}
              step="0.0001"
              min="0.0001"
            />
          </label>
        </div>

        <button 
          onClick={runSimulation}
          disabled={isSimulating}
          className="simulate-btn"
        >
          {isSimulating ? 'Simulating...' : 'Run Simulation'}
        </button>

        {error && (
          <div className="error-message">
            Error: {error}
          </div>
        )}
      </div>

      {results.length > 0 && (
        <div className="results-preview">
          <h4>Simulation Results</h4>
          <p>Generated {results.length} frequency points</p>
          <div className="results-summary">
            <div>
              Max Gain: {Math.max(...results.map(r => r.gain)).toFixed(2)} dBi
            </div>
            <div>
              Min VSWR: {Math.min(...results.map(r => r.vswr)).toFixed(2)}
            </div>
            <div>
              Max Efficiency: {(Math.max(...results.map(r => r.efficiency)) * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AntennaDesigner;