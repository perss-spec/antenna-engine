import React, { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import type { AntennaResult } from '../lib/tauri';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface ResultsViewerProps {
  results: AntennaResult[];
  activeChart: 'gain' | 'vswr' | 'impedance' | 'efficiency';
}

const ResultsViewer: React.FC<ResultsViewerProps> = ({ results, activeChart }) => {
  const chartData = useMemo(() => {
    if (!results || results.length === 0) {
      return {
        labels: [],
        datasets: []
      };
    }

    const frequencies = results.map(r => r.frequency);
    
    const baseConfig = {
      labels: frequencies.map(f => (f / 1000000).toFixed(0)), // Convert to MHz
      datasets: []
    };

    switch (activeChart) {
      case 'gain':
        return {
          ...baseConfig,
          datasets: [{
            label: 'Gain (dBi)',
            data: results.map(r => r.gain),
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            tension: 0.1
          }]
        };

      case 'vswr':
        return {
          ...baseConfig,
          datasets: [{
            label: 'VSWR',
            data: results.map(r => r.vswr),
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            tension: 0.1
          }]
        };

      case 'impedance':
        return {
          ...baseConfig,
          datasets: [
            {
              label: 'Real (Ω)',
              data: results.map(r => r.impedance.real),
              borderColor: 'rgb(54, 162, 235)',
              backgroundColor: 'rgba(54, 162, 235, 0.2)',
              tension: 0.1
            },
            {
              label: 'Imaginary (Ω)',
              data: results.map(r => r.impedance.imaginary),
              borderColor: 'rgb(255, 206, 86)',
              backgroundColor: 'rgba(255, 206, 86, 0.2)',
              tension: 0.1
            }
          ]
        };

      case 'efficiency':
        return {
          ...baseConfig,
          datasets: [{
            label: 'Efficiency (%)',
            data: results.map(r => r.efficiency * 100),
            borderColor: 'rgb(153, 102, 255)',
            backgroundColor: 'rgba(153, 102, 255, 0.2)',
            tension: 0.1
          }]
        };

      default:
        return baseConfig;
    }
  }, [results, activeChart]);

  const chartOptions = useMemo(() => {
    const baseOptions = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top' as const,
        },
        title: {
          display: true,
          text: `Antenna ${activeChart.charAt(0).toUpperCase() + activeChart.slice(1)} vs Frequency`
        },
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: 'Frequency (MHz)'
          }
        },
        y: {
          display: true,
          title: {
            display: true,
            text: getYAxisLabel(activeChart)
          }
        }
      }
    };

    return baseOptions;
  }, [activeChart]);

  const getYAxisLabel = (chart: string): string => {
    switch (chart) {
      case 'gain':
        return 'Gain (dBi)';
      case 'vswr':
        return 'VSWR';
      case 'impedance':
        return 'Impedance (Ω)';
      case 'efficiency':
        return 'Efficiency (%)';
      default:
        return '';
    }
  };

  if (!results || results.length === 0) {
    return (
      <div className="results-viewer empty">
        <div className="empty-state">
          <h3>No Results</h3>
          <p>Run a simulation to view results here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="results-viewer">
      <div className="chart-container">
        <Line data={chartData} options={chartOptions} />
      </div>
      
      <div className="results-stats">
        <div className="stat-item">
          <label>Total Points:</label>
          <span>{results.length}</span>
        </div>
        
        <div className="stat-item">
          <label>Frequency Range:</label>
          <span>
            {(Math.min(...results.map(r => r.frequency)) / 1000000).toFixed(0)} - 
            {(Math.max(...results.map(r => r.frequency)) / 1000000).toFixed(0)} MHz
          </span>
        </div>

        {activeChart === 'gain' && (
          <>
            <div className="stat-item">
              <label>Max Gain:</label>
              <span>{Math.max(...results.map(r => r.gain)).toFixed(2)} dBi</span>
            </div>
            <div className="stat-item">
              <label>Min Gain:</label>
              <span>{Math.min(...results.map(r => r.gain)).toFixed(2)} dBi</span>
            </div>
          </>
        )}

        {activeChart === 'vswr' && (
          <>
            <div className="stat-item">
              <label>Min VSWR:</label>
              <span>{Math.min(...results.map(r => r.vswr)).toFixed(2)}</span>
            </div>
            <div className="stat-item">
              <label>Max VSWR:</label>
              <span>{Math.max(...results.map(r => r.vswr)).toFixed(2)}</span>
            </div>
          </>
        )}

        {activeChart === 'efficiency' && (
          <>
            <div className="stat-item">
              <label>Max Efficiency:</label>
              <span>{(Math.max(...results.map(r => r.efficiency)) * 100).toFixed(1)}%</span>
            </div>
            <div className="stat-item">
              <label>Min Efficiency:</label>
              <span>{(Math.min(...results.map(r => r.efficiency)) * 100).toFixed(1)}%</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ResultsViewer;