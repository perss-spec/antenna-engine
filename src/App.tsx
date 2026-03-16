import React, { useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import AntennaViewer from './components/AntennaViewer';
import PatternList from './components/PatternList';
import SimulationPanel from './components/SimulationPanel';
import { AntennaPattern, SimulationResult, TauriResponse } from './types/antenna';
import './App.css';

const App: React.FC = () => {
  const [selectedPattern, setSelectedPattern] = useState<AntennaPattern | null>(null);
  const [simulationResult, setSimulationResult] = useState<SimulationResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const handlePatternSelect = (pattern: AntennaPattern) => {
    setSelectedPattern(pattern);
    setSimulationResult(null); // Clear previous simulation when selecting new pattern
  };

  const handleSimulationComplete = (result: SimulationResult) => {
    setSimulationResult(result);
  };

  const importPattern = async () => {
    try {
      setIsImporting(true);
      setImportError(null);

      const response = await invoke<TauriResponse<string>>('import_antenna_file');
      
      if (response.success) {
        // Pattern imported successfully, refresh the pattern list
        // The PatternList component will handle the refresh via its own state
        console.log('Pattern imported successfully');
      } else {
        setImportError(response.error || 'Failed to import pattern');
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      setIsImporting(false);
    }
  };

  const exportResults = async () => {
    if (!simulationResult) return;

    try {
      const response = await invoke<TauriResponse<string>>('export_simulation_results', {
        resultId: simulationResult.id
      });

      if (response.success) {
        console.log('Results exported successfully');
      } else {
        console.error('Export failed:', response.error);
      }
    } catch (err) {
      console.error('Export failed:', err);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>PROMIN Antenna Studio</h1>
        <div className="header-actions">
          <button 
            onClick={importPattern}
            disabled={isImporting}
            className="import-button"
          >
            {isImporting ? 'Importing...' : 'Import Pattern'}
          </button>
          
          {simulationResult && (
            <button 
              onClick={exportResults}
              className="export-button"
            >
              Export Results
            </button>
          )}
        </div>
      </header>

      {importError && (
        <div className="import-error">
          <p>Import Error: {importError}</p>
          <button onClick={() => setImportError(null)}>×</button>
        </div>
      )}

      <main className="app-main">
        <aside className="sidebar">
          <PatternList
            onPatternSelect={handlePatternSelect}
            selectedPatternId={selectedPattern?.id}
            className="pattern-list-container"
          />
          
          <SimulationPanel
            pattern={selectedPattern}
            onSimulationComplete={handleSimulationComplete}
            className="simulation-panel-container"
          />
        </aside>

        <section className="main-content">
          {selectedPattern ? (
            <>
              <div className="pattern-info-header">
                <h2>{selectedPattern.name}</h2>
                <div className="pattern-stats">
                  <span>Frequency: {selectedPattern.frequency} MHz</span>
                  <span>Polarization: {selectedPattern.polarization}</span>
                  {simulationResult && (
                    <>
                      <span>Directivity: {simulationResult.directivity.toFixed(2)} dB</span>
                      <span>Efficiency: {(simulationResult.efficiency * 100).toFixed(1)}%</span>
                    </>
                  )}
                </div>
              </div>

              <AntennaViewer 
                pattern={selectedPattern} 
                className="main-viewer"
              />

              {simulationResult && (
                <div className="simulation-results">
                  <h3>Simulation Results</h3>
                  <div className="results-grid">
                    <div className="result-item">
                      <label>Directivity</label>
                      <span>{simulationResult.directivity.toFixed(2)} dB</span>
                    </div>
                    <div className="result-item">
                      <label>Efficiency</label>
                      <span>{(simulationResult.efficiency * 100).toFixed(1)}%</span>
                    </div>
                    <div className="result-item">
                      <label>Bandwidth</label>
                      <span>{simulationResult.bandwidth.toFixed(1)} MHz</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="empty-main-content">
              <div className="welcome-message">
                <h2>Welcome to PROMIN Antenna Studio</h2>
                <p>Select an antenna pattern from the sidebar to begin analysis.</p>
                <p>Import new patterns using the "Import Pattern" button above.</p>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default App;