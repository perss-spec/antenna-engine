import React, { useState, useEffect, useCallback } from 'react';
import './SolverPanel.css';

declare global {
  interface Window {
    bridge?: {
      sendMessage: (message: unknown) => void;
    };
  }
}

export interface SimulationResult {
  solver: 'MoM Wire' | 'MoM Surface' | 'FDTD';
  frequency: number;
  impedance: { real: number; imag: number };
  s11_db: number;
  vswr: number;
  gain_dbi: number;
  computation_time: number;
  convergence: {
    converged: boolean;
    iterations: number;
    final_error: number;
  };
}

export interface SweepResult {
  solver: 'MoM Wire' | 'MoM Surface' | 'FDTD';
  frequencies: number[];
  results: SimulationResult[];
}

interface SolverPanelProps {
  antennaType: string;
  antennaParams: Record<string, number>;
  onSolveComplete: (result: SimulationResult) => void;
  onSweepComplete: (result: SweepResult) => void;
}

type FrequencyMode = 'single' | 'sweep' | 'preset';
type LinearSolver = 'LU' | 'GMRES';
type SolverType = 'MoM Wire' | 'MoM Surface' | 'FDTD';

const PRESET_FREQUENCIES: Record<string, number[]> = {
  'VHF': [30e6, 300e6],
  'UHF': [300e6, 3e9],
  'S-Band': [2e9, 4e9],
  'C-Band': [4e9, 8e9],
  'X-Band': [8e9, 12e9],
  'Ku-Band': [12e9, 18e9]
};

export const SolverPanel: React.FC<SolverPanelProps> = ({
  antennaType,
  antennaParams,
  onSolveComplete,
  onSweepComplete
}) => {
  // Solver configuration
  const [solverType, setSolverType] = useState<SolverType>('MoM Wire');
  const [meshResolution, setMeshResolution] = useState<number>(10);
  
  // Frequency settings
  const [frequencyMode, setFrequencyMode] = useState<FrequencyMode>('single');
  const [singleFreq, setSingleFreq] = useState<number>(2.4e9);
  const [freqStart, setFreqStart] = useState<number>(2e9);
  const [freqEnd, setFreqEnd] = useState<number>(3e9);
  const [freqPoints, setFreqPoints] = useState<number>(21);
  const [presetBand, setPresetBand] = useState<string>('S-Band');
  
  // Solver options
  const [linearSolver, setLinearSolver] = useState<LinearSolver>('LU');
  const [tolerance, setTolerance] = useState<number>(1e-6);
  const [maxIterations, setMaxIterations] = useState<number>(1000);
  
  // Simulation state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [currentResult, setCurrentResult] = useState<SimulationResult | null>(null);
  const [sweepResults, setSweepResults] = useState<SweepResult | null>(null);
  
  // Comparison mode
  const [comparisonMode, setComparisonMode] = useState<boolean>(false);
  const [momResult, setMomResult] = useState<SimulationResult | null>(null);
  const [fdtdResult, setFdtdResult] = useState<SimulationResult | null>(null);

  // Bridge communication
  const sendMessage = useCallback((message: any) => {
    if (window.bridge) {
      window.bridge.sendMessage(message);
    }
  }, []);

  useEffect(() => {
    const handleMessage = (event: any) => {
      const { type, data } = event.detail;
      
      switch (type) {
        case 'solver_progress':
          setProgress(data.progress);
          break;
          
        case 'solve_complete':
          setIsRunning(false);
          setProgress(100);
          const result: SimulationResult = {
            solver: data.solver,
            frequency: data.frequency,
            impedance: data.impedance,
            s11_db: data.s11_db,
            vswr: data.vswr,
            gain_dbi: data.gain_dbi,
            computation_time: data.computation_time,
            convergence: data.convergence
          };
          setCurrentResult(result);
          onSolveComplete(result);
          
          if (comparisonMode) {
            if (data.solver.includes('MoM')) {
              setMomResult(result);
            } else {
              setFdtdResult(result);
            }
          }
          break;
          
        case 'sweep_complete':
          setIsRunning(false);
          setProgress(100);
          const sweepResult: SweepResult = {
            solver: data.solver,
            frequencies: data.frequencies,
            results: data.results
          };
          setSweepResults(sweepResult);
          onSweepComplete(sweepResult);
          break;
          
        case 'solver_error':
          setIsRunning(false);
          setProgress(0);
          alert(`Solver error: ${data.message}`);
          break;
      }
    };

    window.addEventListener('bridge_message', handleMessage);
    return () => window.removeEventListener('bridge_message', handleMessage);
  }, [onSolveComplete, onSweepComplete, comparisonMode]);

  const handleRun = () => {
    if (isRunning) return;
    
    setIsRunning(true);
    setProgress(0);
    setCurrentResult(null);
    setSweepResults(null);
    setMomResult(null);
    setFdtdResult(null);
    
    const config = {
      antenna_type: antennaType,
      antenna_params: antennaParams,
      mesh_resolution: meshResolution,
      linear_solver: linearSolver,
      tolerance: tolerance,
      max_iterations: maxIterations
    };
    
    if (comparisonMode) {
      // Run both MoM and FDTD
      const frequency = frequencyMode === 'single' ? singleFreq : 
                       frequencyMode === 'preset' ? (PRESET_FREQUENCIES[presetBand][0] + PRESET_FREQUENCIES[presetBand][1]) / 2 :
                       (freqStart + freqEnd) / 2;
      
      sendMessage({
        type: 'run_comparison',
        data: {
          ...config,
          frequency
        }
      });
    } else if (frequencyMode === 'single') {
      sendMessage({
        type: 'run_solver',
        data: {
          ...config,
          solver: solverType,
          frequency: singleFreq
        }
      });
    } else {
      let frequencies: number[];
      
      if (frequencyMode === 'sweep') {
        frequencies = Array.from({length: freqPoints}, (_, i) => 
          freqStart + (freqEnd - freqStart) * i / (freqPoints - 1)
        );
      } else {
        const [start, end] = PRESET_FREQUENCIES[presetBand];
        frequencies = Array.from({length: freqPoints}, (_, i) => 
          start + (end - start) * i / (freqPoints - 1)
        );
      }
      
      sendMessage({
        type: 'run_sweep',
        data: {
          ...config,
          solver: solverType,
          frequencies
        }
      });
    }
  };

  const handleCancel = () => {
    setIsRunning(false);
    setProgress(0);
    sendMessage({ type: 'cancel_solver', data: {} });
  };

  const formatComplex = (z: { real: number; imag: number }) => {
    const sign = z.imag >= 0 ? '+' : '-';
    return `${z.real.toFixed(2)} ${sign} ${Math.abs(z.imag).toFixed(2)}j Ω`;
  };

  const formatFrequency = (freq: number) => {
    if (freq >= 1e9) return `${(freq / 1e9).toFixed(3)} GHz`;
    if (freq >= 1e6) return `${(freq / 1e6).toFixed(1)} MHz`;
    if (freq >= 1e3) return `${(freq / 1e3).toFixed(0)} kHz`;
    return `${freq.toFixed(0)} Hz`;
  };

  const renderResultCard = (result: SimulationResult, title: string) => (
    <div className="result-card">
      <h4>{title}</h4>
      <div className="result-grid">
        <div className="result-item">
          <span className="label">Z_in:</span>
          <span className="value">{formatComplex(result.impedance)}</span>
        </div>
        <div className="result-item">
          <span className="label">S11:</span>
          <span className="value">{result.s11_db.toFixed(2)} dB</span>
        </div>
        <div className="result-item">
          <span className="label">VSWR:</span>
          <span className="value">{result.vswr.toFixed(2)}</span>
        </div>
        <div className="result-item">
          <span className="label">Gain:</span>
          <span className="value">{result.gain_dbi.toFixed(2)} dBi</span>
        </div>
        <div className="result-item">
          <span className="label">Time:</span>
          <span className="value">{result.computation_time.toFixed(3)} s</span>
        </div>
        <div className="result-item">
          <span className="label">Converged:</span>
          <span className="value">
            {result.convergence.converged ? 'Yes' : 'No'} 
            ({result.convergence.iterations} iter)
          </span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="solver-panel">
      <div className="panel-header">
        <h3>Solver Configuration</h3>
      </div>
      
      <div className="config-sections">
        {/* Solver Type */}
        <div className="config-section">
          <h4>Solver Type</h4>
          <div className="radio-group">
            {['MoM Wire', 'MoM Surface', 'FDTD'].map((type) => (
              <label key={type}>
                <input
                  type="radio"
                  value={type}
                  checked={solverType === type}
                  onChange={(e) => setSolverType(e.target.value as SolverType)}
                  disabled={isRunning}
                />
                {type}
              </label>
            ))}
          </div>
        </div>
        
        {/* Mesh Resolution */}
        <div className="config-section">
          <h4>Mesh Resolution</h4>
          <div className="slider-container">
            <label>Elements per wavelength: {meshResolution}</label>
            <input
              type="range"
              min="5"
              max="30"
              value={meshResolution}
              onChange={(e) => setMeshResolution(Number(e.target.value))}
              disabled={isRunning}
              className="slider"
            />
            <div className="slider-labels">
              <span>5</span>
              <span>30</span>
            </div>
          </div>
        </div>
        
        {/* Frequency Settings */}
        <div className="config-section">
          <h4>Frequency</h4>
          <div className="radio-group">
            {[
              { value: 'single', label: 'Single Frequency' },
              { value: 'sweep', label: 'Frequency Sweep' },
              { value: 'preset', label: 'Preset Band' }
            ].map(({ value, label }) => (
              <label key={value}>
                <input
                  type="radio"
                  value={value}
                  checked={frequencyMode === value}
                  onChange={(e) => setFrequencyMode(e.target.value as FrequencyMode)}
                  disabled={isRunning}
                />
                {label}
              </label>
            ))}
          </div>
          
          {frequencyMode === 'single' && (
            <div className="freq-input">
              <label>
                Frequency (Hz):
                <input
                  type="number"
                  value={singleFreq}
                  onChange={(e) => setSingleFreq(Number(e.target.value))}
                  disabled={isRunning}
                  step="1000000"
                />
              </label>
            </div>
          )}
          
          {frequencyMode === 'sweep' && (
            <div className="freq-sweep">
              <div className="freq-row">
                <label>
                  Start (Hz):
                  <input
                    type="number"
                    value={freqStart}
                    onChange={(e) => setFreqStart(Number(e.target.value))}
                    disabled={isRunning}
                    step="1000000"
                  />
                </label>
                <label>
                  End (Hz):
                  <input
                    type="number"
                    value={freqEnd}
                    onChange={(e) => setFreqEnd(Number(e.target.value))}
                    disabled={isRunning}
                    step="1000000"
                  />
                </label>
              </div>
              <label>
                Points:
                <input
                  type="number"
                  value={freqPoints}
                  onChange={(e) => setFreqPoints(Number(e.target.value))}
                  disabled={isRunning}
                  min="2"
                  max="1000"
                />
              </label>
            </div>
          )}
          
          {frequencyMode === 'preset' && (
            <div className="freq-preset">
              <label>
                Band:
                <select
                  value={presetBand}
                  onChange={(e) => setPresetBand(e.target.value)}
                  disabled={isRunning}
                >
                  {Object.entries(PRESET_FREQUENCIES).map(([band, range]) => (
                    <option key={band} value={band}>
                      {band} ({formatFrequency(range[0])} - {formatFrequency(range[1])})
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}
        </div>
        
        {/* Solver Options */}
        <div className="config-section">
          <h4>Solver Options</h4>
          <div className="solver-options">
            <label>
              Linear Solver:
              <select
                value={linearSolver}
                onChange={(e) => setLinearSolver(e.target.value as LinearSolver)}
                disabled={isRunning}
              >
                <option value="LU">LU Decomposition</option>
                <option value="GMRES">GMRES</option>
              </select>
            </label>
            
            {linearSolver === 'GMRES' && (
              <>
                <label>
                  Tolerance:
                  <input
                    type="number"
                    value={tolerance}
                    onChange={(e) => setTolerance(Number(e.target.value))}
                    disabled={isRunning}
                    step="1e-9"
                    min="1e-12"
                    max="1e-3"
                  />
                </label>
                <label>
                  Max Iterations:
                  <input
                    type="number"
                    value={maxIterations}
                    onChange={(e) => setMaxIterations(Number(e.target.value))}
                    disabled={isRunning}
                    min="100"
                    max="10000"
                    step="100"
                  />
                </label>
              </>
            )}
          </div>
        </div>
        
        {/* Comparison Mode */}
        <div className="config-section">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={comparisonMode}
              onChange={(e) => setComparisonMode(e.target.checked)}
              disabled={isRunning}
            />
            Comparison Mode (MoM vs FDTD)
          </label>
        </div>
      </div>
      
      {/* Control Buttons */}
      <div className="control-buttons">
        <button
          onClick={handleRun}
          disabled={isRunning}
          className="run-button"
        >
          {isRunning ? 'Running...' : 'Run Solver'}
        </button>
        
        {isRunning && (
          <button onClick={handleCancel} className="cancel-button">
            Cancel
          </button>
        )}
      </div>
      
      {/* Progress Bar */}
      {isRunning && (
        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="progress-text">{progress.toFixed(0)}%</span>
        </div>
      )}
      
      {/* Results */}
      <div className="results-section">
        {comparisonMode && (momResult || fdtdResult) && (
          <div className="comparison-results">
            <h3>Comparison Results</h3>
            <div className="comparison-grid">
              {momResult && renderResultCard(momResult, `MoM @ ${formatFrequency(momResult.frequency)}`)}
              {fdtdResult && renderResultCard(fdtdResult, `FDTD @ ${formatFrequency(fdtdResult.frequency)}`)}
            </div>
          </div>
        )}
        
        {!comparisonMode && currentResult && (
          <div className="single-results">
            <h3>Simulation Results</h3>
            {renderResultCard(currentResult, `${currentResult.solver} @ ${formatFrequency(currentResult.frequency)}`)}
          </div>
        )}
        
        {sweepResults && (
          <div className="sweep-summary">
            <h3>Sweep Summary</h3>
            <p>{sweepResults.results.length} frequency points computed</p>
            <p>Range: {formatFrequency(sweepResults.frequencies[0])} - {formatFrequency(sweepResults.frequencies[sweepResults.frequencies.length - 1])}</p>
            <p>Total time: {sweepResults.results.reduce((sum, r) => sum + r.computation_time, 0).toFixed(2)} s</p>
          </div>
        )}
      </div>
    </div>
  );
};