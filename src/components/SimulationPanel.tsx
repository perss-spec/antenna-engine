import React, { useState, useEffect } from 'react';
import { runSimulation, getSimulationResults } from '../lib/tauri';
import type { AntennaPattern, SimulationConfig, SimulationResult } from '../types';

interface SimulationPanelProps {
  pattern: AntennaPattern;
  onSimulationComplete: (result: SimulationResult) => void;
}

export function SimulationPanel({ pattern, onSimulationComplete }: SimulationPanelProps) {
  const [config, setConfig] = useState<SimulationConfig>({
    frequency: pattern.frequency,
    power: 1,
    impedance: 50,
    environment: 'free_space',
    resolution: 1
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<SimulationResult[]>([]);

  useEffect(() => {
    loadResults();
  }, [pattern.id]);

  const loadResults = async () => {
    try {
      const response = await getSimulationResults(pattern.id);
      if (response.success && response.data) {
        setResults(response.data);
      }
    } catch (err) {
      console.error('Failed to load simulation results:', err);
    }
  };

  const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setConfig(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSimulate = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await runSimulation(pattern.id, config);
      
      if (response.success && response.data) {
        setResults(prev => [response.data!, ...prev]);
        onSimulationComplete(response.data);
      } else {
        setError(response.error || 'Simulation failed');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="simulation-panel">
      <div className="panel-header">
        <h3>Simulation</h3>
      </div>

      <div className="simulation-config">
        <h4>Configuration</h4>
        
        <div className="config-form">
          <div className="form-group">
            <label htmlFor="sim-frequency">Frequency (MHz)</label>
            <input
              type="number"
              id="sim-frequency"
              name="frequency"
              value={config.frequency}
              onChange={handleConfigChange}
              min="1"
              max="100000"
              step="0.1"
              disabled={loading}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label htmlFor="sim-power">Power (W)</label>
            <input
              type="number"
              id="sim-power"
              name="power"
              value={config.power}
              onChange={handleConfigChange}
              min="0.001"
              step="0.1"
              disabled={loading}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label htmlFor="sim-impedance">Impedance (Ω)</label>
            <input
              type="number"
              id="sim-impedance"
              name="impedance"
              value={config.impedance}
              onChange={handleConfigChange}
              min="1"
              step="1"
              disabled={loading}
              className="form-control"
            />
          </div>

          <div className="form-group">
            <label htmlFor="sim-environment">Environment</label>
            <select
              id="sim-environment"
              name="environment"
              value={config.environment}
              onChange={handleConfigChange}
              disabled={loading}
              className="form-control"
            >
              <option value="free_space">Free Space</option>
              <option value="ground_plane">Ground Plane</option>
              <option value="urban">Urban</option>
              <option value="rural">Rural</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="sim-resolution">Resolution (degrees)</label>
            <input
              type="number"
              id="sim-resolution"
              name="resolution"
              value={config.resolution}
              onChange={handleConfigChange}
              min="0.1"
              max="10"
              step="0.1"
              disabled={loading}
              className="form-control"
            />
          </div>
        </div>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <button
          className="btn btn-primary btn-simulate"
          onClick={handleSimulate}
          disabled={loading}
        >
          {loading ? 'Running Simulation...' : 'Run Simulation'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="simulation-results">
          <h4>Recent Results</h4>
          <div className="results-list">
            {results.slice(0, 5).map((result) => (
              <div key={result.id} className="result-item">
                <div className="result-header">
                  <span className="result-date">
                    {new Date(result.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="result-metrics">
                  <div className="metric">
                    <span className="metric-label">VSWR:</span>
                    <span className="metric-value">{result.vswr.toFixed(2)}</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Bandwidth:</span>
                    <span className="metric-value">{result.bandwidth.toFixed(1)} MHz</span>
                  </div>
                  <div className="metric">
                    <span className="metric-label">Efficiency:</span>
                    <span className="metric-value">{(result.efficiency * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}