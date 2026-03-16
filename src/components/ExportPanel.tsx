import React, { useState } from 'react';
import { exportResults, type AntennaResult } from '../lib/tauri';

interface ExportPanelProps {
  results: AntennaResult[];
  disabled?: boolean;
}

const ExportPanel: React.FC<ExportPanelProps> = ({ results, disabled = false }) => {
  const [exportFormat, setExportFormat] = useState<'csv' | 'json' | 'xml'>('csv');
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const handleExport = async () => {
    if (!results || results.length === 0) {
      setExportStatus('No results to export');
      return;
    }

    setIsExporting(true);
    setExportStatus(null);

    try {
      await exportResults(results, exportFormat);
      setExportStatus(`Successfully exported ${results.length} results as ${exportFormat.toUpperCase()}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Export failed';
      setExportStatus(`Export failed: ${errorMessage}`);
    } finally {
      setIsExporting(false);
    }
  };

  const hasResults = results && results.length > 0;

  return (
    <div className="export-panel">
      <h3>Export Results</h3>
      
      <div className="export-options">
        <div className="format-selection">
          <label>
            Export Format:
            <select 
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'csv' | 'json' | 'xml')}
              disabled={disabled || !hasResults}
            >
              <option value="csv">CSV</option>
              <option value="json">JSON</option>
              <option value="xml">XML</option>
            </select>
          </label>
        </div>

        <button
          onClick={handleExport}
          disabled={disabled || !hasResults || isExporting}
          className="export-btn"
        >
          {isExporting ? 'Exporting...' : `Export ${exportFormat.toUpperCase()}`}
        </button>
      </div>

      {exportStatus && (
        <div className={`export-status ${exportStatus.includes('failed') ? 'error' : 'success'}`}>
          {exportStatus}
        </div>
      )}

      <div className="export-info">
        <div className="info-item">
          <label>Results Count:</label>
          <span>{hasResults ? results.length : 0}</span>
        </div>
        
        {hasResults && (
          <>
            <div className="info-item">
              <label>Frequency Range:</label>
              <span>
                {(Math.min(...results.map(r => r.frequency)) / 1000000).toFixed(0)} - 
                {(Math.max(...results.map(r => r.frequency)) / 1000000).toFixed(0)} MHz
              </span>
            </div>
            
            <div className="info-item">
              <label>Data Points:</label>
              <span>Frequency, Gain, VSWR, Impedance, Efficiency</span>
            </div>
          </>
        )}
      </div>

      {!hasResults && (
        <div className="no-results-message">
          <p>Run a simulation first to generate results for export.</p>
        </div>
      )}
    </div>
  );
};

export default ExportPanel;