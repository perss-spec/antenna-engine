import { useEffect, useRef, useState } from 'react';
import type { AntennaPattern, SimulationResult } from '../types';

interface PatternVisualizationProps {
  pattern: AntennaPattern;
  simulationResult?: SimulationResult;
  className?: string;
}

interface PlotData {
  x: number[];
  y: number[];
  type: 'scatter' | 'polar';
  mode?: string;
  name?: string;
}

interface PlotLayout {
  title?: string;
  xaxis?: { title: string };
  yaxis?: { title: string };
  polar?: {
    radialaxis?: { title: string; range?: number[] };
    angularaxis?: { direction: string };
  };
}

declare global {
  interface Window {
    Plotly?: {
      newPlot: (div: HTMLElement, data: PlotData[], layout: PlotLayout) => void;
      redraw: (div: HTMLElement) => void;
    };
  }
}

export function PatternVisualization({ pattern, simulationResult, className = '' }: PatternVisualizationProps) {
  const plotRef = useRef<HTMLDivElement>(null);
  const [plotLoaded, setPlotLoaded] = useState(false);

  useEffect(() => {
    // Load Plotly.js if not already loaded
    if (!window.Plotly) {
      const script = document.createElement('script');
      script.src = 'https://cdn.plot.ly/plotly-latest.min.js';
      script.onload = () => setPlotLoaded(true);
      document.head.appendChild(script);
    } else {
      setPlotLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (plotLoaded && plotRef.current && window.Plotly) {
      createPlot();
    }
  }, [plotLoaded, pattern, simulationResult]);

  const createPlot = () => {
    if (!plotRef.current || !window.Plotly) return;

    let data: PlotData[];
    let layout: PlotLayout;

    if (simulationResult) {
      // Create polar plot from simulation data
      const gainData = simulationResult.gain_data;
      
      if (gainData && gainData.length > 0) {
        const angles = gainData.map((_, index) => index * (360 / gainData.length));
        const gains = gainData.map(row => Math.max(...row));

        data = [
          {
            x: angles,
            y: gains,
            type: 'scatter',
            mode: 'lines',
            name: 'Gain Pattern'
          }
        ];

        layout = {
          title: `${pattern.name} - Radiation Pattern`,
          polar: {
            radialaxis: {
              title: 'Gain (dB)',
              range: [Math.min(...gains) - 5, Math.max(...gains) + 5]
            },
            angularaxis: {
              direction: 'clockwise'
            }
          }
        };
      } else {
        // Fallback to basic pattern
        data = createBasicPattern();
        layout = createBasicLayout();
      }
    } else {
      // Create basic theoretical pattern
      data = createBasicPattern();
      layout = createBasicLayout();
    }

    window.Plotly.newPlot(plotRef.current, data, layout);
  };

  const createBasicPattern = (): PlotData[] => {
    // Generate theoretical radiation pattern based on pattern properties
    const angles = Array.from({ length: 360 }, (_, i) => i);
    const gains = angles.map(angle => {
      const radians = (angle * Math.PI) / 180;
      const beamwidthRad = (pattern.beamwidth * Math.PI) / 180;
      
      // Simple cosine pattern approximation
      let gain = pattern.gain * Math.cos(radians / 2) ** (2 / (beamwidthRad / (Math.PI / 2)));
      
      // Apply beamwidth constraints
      if (Math.abs(angle - 180) > pattern.beamwidth / 2 && Math.abs(angle + 180) > pattern.beamwidth / 2) {
        gain = Math.max(gain, pattern.gain - 20); // Side lobe suppression
      }
      
      return Math.max(gain, pattern.gain - 40); // Noise floor
    });

    return [
      {
        x: angles,
        y: gains,
        type: 'scatter',
        mode: 'lines',
        name: 'Theoretical Pattern'
      }
    ];
  };

  const createBasicLayout = (): PlotLayout => ({
    title: `${pattern.name} - Theoretical Pattern`,
    polar: {
      radialaxis: {
        title: 'Gain (dB)',
        range: [pattern.gain - 40, pattern.gain + 5]
      },
      angularaxis: {
        direction: 'clockwise'
      }
    }
  });

  if (!plotLoaded) {
    return (
      <div className={`pattern-visualization loading ${className}`}>
        <div className="loading-spinner">Loading visualization...</div>
      </div>
    );
  }

  return (
    <div className={`pattern-visualization ${className}`}>
      <div className="visualization-header">
        <h3>Radiation Pattern</h3>
        <div className="pattern-info">
          <span className="info-item">
            <strong>Frequency:</strong> {pattern.frequency} MHz
          </span>
          <span className="info-item">
            <strong>Gain:</strong> {pattern.gain.toFixed(2)} dB
          </span>
          <span className="info-item">
            <strong>Beamwidth:</strong> {pattern.beamwidth}°
          </span>
        </div>
      </div>
      <div ref={plotRef} className="plot-container"></div>
    </div>
  );
}