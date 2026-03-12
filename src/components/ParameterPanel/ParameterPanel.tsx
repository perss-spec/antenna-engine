import { useState } from 'react';
import type { ReactNode } from 'react';
import './ParameterPanel.css';

interface ParameterPanelProps {
  className?: string;
  children?: ReactNode;
}

export default function ParameterPanel({ className = '', children }: ParameterPanelProps) {
  const [frequency, setFrequency] = useState(2.4);
  const [power, setPower] = useState(10);
  const [gain, setGain] = useState(5);
  const [enableFreqSweep, setEnableFreqSweep] = useState(false);
  const [sweepStart, setSweepStart] = useState(2.0);
  const [sweepEnd, setSweepEnd] = useState(3.0);

  const handleRunSimulation = () => {
    console.log('Running simulation with parameters:', {
      frequency,
      power,
      gain,
      enableFreqSweep,
      sweepStart,
      sweepEnd
    });
  };

  const handleResetParameters = () => {
    setFrequency(2.4);
    setPower(10);
    setGain(5);
    setEnableFreqSweep(false);
    setSweepStart(2.0);
    setSweepEnd(3.0);
  };

  return (
    <div className={`parameter-panel ${className}`}>
      <div className="parameter-panel-header">
        <h2>Antenna Parameters</h2>
      </div>
      
      <div className="parameter-panel-content">
        <div className="parameter-group">
          <h3>Basic Parameters</h3>
          
          <div className="parameter-field">
            <label htmlFor="frequency-input">Frequency (GHz)</label>
            <input
              id="frequency-input"
              type="number"
              value={frequency}
              onChange={(e) => setFrequency(parseFloat(e.target.value) || 0)}
              min="0.1"
              max="10"
              step="0.1"
              className="parameter-input"
            />
          </div>
          
          <div className="parameter-field">
            <label htmlFor="power-input">Power (dBm)</label>
            <input
              id="power-input"
              type="number"
              value={power}
              onChange={(e) => setPower(parseFloat(e.target.value) || 0)}
              min="-30"
              max="30"
              step="1"
              className="parameter-input"
            />
          </div>
          
          <div className="parameter-field">
            <label htmlFor="gain-input">Gain (dBi)</label>
            <input
              id="gain-input"
              type="number"
              value={gain}
              onChange={(e) => setGain(parseFloat(e.target.value) || 0)}
              min="-10"
              max="20"
              step="0.5"
              className="parameter-input"
            />
          </div>
        </div>
        
        <div className="parameter-group">
          <h3>Frequency Sweep</h3>
          
          <div className="parameter-field">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={enableFreqSweep}
                onChange={(e) => setEnableFreqSweep(e.target.checked)}
                aria-label="Enable frequency sweep"
              />
              <span>Enable Frequency Sweep</span>
            </label>
          </div>
          
          {enableFreqSweep && (
            <>
              <div className="parameter-field">
                <label htmlFor="sweep-start-input">Start Frequency (GHz)</label>
                <input
                  id="sweep-start-input"
                  type="number"
                  value={sweepStart}
                  onChange={(e) => setSweepStart(parseFloat(e.target.value) || 0)}
                  min="0.1"
                  max="10"
                  step="0.1"
                  className="parameter-input"
                />
              </div>
              
              <div className="parameter-field">
                <label htmlFor="sweep-end-input">End Frequency (GHz)</label>
                <input
                  id="sweep-end-input"
                  type="number"
                  value={sweepEnd}
                  onChange={(e) => setSweepEnd(parseFloat(e.target.value) || 0)}
                  min="0.1"
                  max="10"
                  step="0.1"
                  className="parameter-input"
                />
              </div>
            </>
          )}
        </div>
        
        <div className="parameter-actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={handleRunSimulation}
          >
            Run Simulation
          </button>
          <button
            className="btn btn-secondary"
            type="button"
            onClick={handleResetParameters}
          >
            Reset Parameters
          </button>
        </div>
      </div>
      
      {children}
    </div>
  );
}