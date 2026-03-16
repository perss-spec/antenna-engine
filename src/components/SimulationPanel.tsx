import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { SimulationConfig, SimulationResult, AntennaPattern, TauriResponse } from '../types/antenna';

interface SimulationPanelProps {
  pattern: AntennaPattern | null;
  onSimulationComplete: (result: SimulationResult) => void;
  className?: string;
}

const SimulationPanel: React.FC<SimulationPanelProps> = ({ 
  pattern, 
  onSimulationComplete,
  className = '' 
}) => {
  const [config, setConfig] = useState<SimulationConfig>({
    frequency_range: [2400, 2500],
    resolution: 10,
    ground_plane: true,
    environment: 'free_space'
  });
  
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfigChange = <K extends keyof SimulationConfig>(
    field: K,
    value: SimulationConfig[K]
  ) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFrequencyChange = (index: 0 | 1, value: number) => {
    const newRange: [number, number] = [...config.frequency_range];
    newRange[index] = value;
    handleConfigChange('frequency_range', newRange);
  };

  const runSimulation = async () => {
    if (!pattern) {
      setError('No pattern selected');
      return;
    }

    try {
      setIsSimulating(true);
      setError(null);

      const response = await invoke<TauriResponse<SimulationResult>>('run_simulation', {
        patternId: pattern.id,
        config: config
      });

      if (response.success && response.data) {
        onSimulationComplete(response.data);
      } else {
        setError(response.error || 'Simulation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className={`simulation-panel ${className}`}>
      <div className="panel-header">
        <h3>Simulation Settings</h3>
      </div>

      <div className="simulation-form">
        <div className="form-group">
          <label htmlFor="freq-min">Frequency Range (MHz)</label>
          <div className="frequency-range">
            <input
              id="freq-min"
              type="number"
              value={config.frequency_range[0]}
              onChange={(e) => handleFrequencyChange(0, parseFloat(e.target.value))}
              disabled={isSimulating}
              min="1"
              max="10000"
              step="0.1"
            />
            <span className="range-separator">to</span>
            <input
              id="freq-max"
              type="number"
              value={config.frequency_range[1]}
              onChange={(e) => handleFrequencyChange(1, parseFloat(e.target.value))}
              disabled={isSimulating}
              min="1"
              max="10000"
              step="0.1"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="resolution">Resolution (degrees)</label>
          <input
            id="resolution"
            type="number"
            value={config.resolution}
            onChange={(e) => handleConfigChange('resolution', parseInt(e.target.value))}
            disabled={isSimulating}
            min="1"
            max="45"
            step="1"
          />
        </div>

        <div className="form-group">
          <label htmlFor="environment">Environment</label>
          <select
            id="environment"
            value={config.environment}
            onChange={(e) => handleConfigChange('environment', e.target.value as SimulationConfig['environment'])}
            disabled={isSimulating}
          >
            <option value="free_space">Free Space</option>
            <option value="ground">Over Ground</option>
            <option value="urban">Urban Environment</option>
          </select>
        </div>

        <div className="form-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={config.ground_plane}
              onChange={(e) => handleConfigChange('ground_plane', e.target.checked)}
              disabled={isSimulating}
            />
            <span className="checkbox-text">Include Ground Plane</span>
          </label>
        </div>

        {error && (
          <div className="error-message">
            <p>{error}</p>
          </div>
        )}

        <div className="form-actions">
          <button
            onClick={runSimulation}
            disabled={!pattern || isSimulating}
            className="run-simulation-button"
          >
            {isSimulating ? (
              <>
                <span className="loading-spinner small"></span>
                Running Simulation...
              </>
            ) : (
              'Run Simulation'
            )}
          </button>
        </div>

        {!pattern && (
          <div className="no-pattern-message">
            <p>Select an antenna pattern to run simulation</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimulationPanel;