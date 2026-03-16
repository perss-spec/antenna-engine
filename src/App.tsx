import React, { useState } from 'react';
import AntennaDesigner from './components/AntennaDesigner';
import ResultsViewer from './components/ResultsViewer';
import ExportPanel from './components/ExportPanel';
import type { AntennaResult } from './lib/tauri';
import './App.css';

type ActiveTab = 'design' | 'results' | 'export';
type ChartType = 'gain' | 'vswr' | 'impedance' | 'efficiency';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('design');
  const [activeChart, setActiveChart] = useState<ChartType>('gain');
  const [results, setResults] = useState<AntennaResult[]>([]);

  const handleResultsUpdate = (newResults: AntennaResult[]) => {
    setResults(newResults);
    // Automatically switch to results tab after simulation
    if (newResults.length > 0) {
      setActiveTab('results');
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'design':
        return <AntennaDesigner onResultsUpdate={handleResultsUpdate} />;
      
      case 'results':
        return <ResultsViewer results={results} activeChart={activeChart} />;
      
      case 'export':
        return <ExportPanel results={results} />;
      
      default:
        return <AntennaDesigner onResultsUpdate={handleResultsUpdate} />;
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-content">
          <h1>PROMIN Antenna Studio</h1>
          <p>Professional Antenna Design and Simulation Tool</p>
        </div>
      </header>

      <nav className="app-nav">
        <div className="nav-tabs">
          <button
            className={`nav-tab ${activeTab === 'design' ? 'active' : ''}`}
            onClick={() => setActiveTab('design')}
          >
            Design
          </button>
          <button
            className={`nav-tab ${activeTab === 'results' ? 'active' : ''}`}
            onClick={() => setActiveTab('results')}
            disabled={results.length === 0}
          >
            Results
          </button>
          <button
            className={`nav-tab ${activeTab === 'export' ? 'active' : ''}`}
            onClick={() => setActiveTab('export')}
            disabled={results.length === 0}
          >
            Export
          </button>
        </div>

        {activeTab === 'results' && results.length > 0 && (
          <div className="chart-selector">
            <label>Chart Type:</label>
            <select
              value={activeChart}
              onChange={(e) => setActiveChart(e.target.value as ChartType)}
            >
              <option value="gain">Gain</option>
              <option value="vswr">VSWR</option>
              <option value="impedance">Impedance</option>
              <option value="efficiency">Efficiency</option>
            </select>
          </div>
        )}
      </nav>

      <main className="app-main">
        <div className="main-content">
          {renderTabContent()}
        </div>
      </main>

      <footer className="app-footer">
        <div className="footer-content">
          <p>&copy; 2024 PROMIN Antenna Studio. Professional antenna design and simulation.</p>
          {results.length > 0 && (
            <div className="status-info">
              <span>Results: {results.length} points</span>
              <span>|</span>
              <span>
                Range: {(Math.min(...results.map(r => r.frequency)) / 1000000).toFixed(0)}-
                {(Math.max(...results.map(r => r.frequency)) / 1000000).toFixed(0)} MHz
              </span>
            </div>
          )}
        </div>
      </footer>
    </div>
  );
};

export default App;