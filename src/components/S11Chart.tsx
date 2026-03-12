import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { FC } from 'react';
import './S11Chart.css';

interface S11DataPoint {
  frequency: number;
  s11_db: number;
  phase?: number;
}

interface S11Trace {
  id: string;
  name: string;
  data: S11DataPoint[];
  color: string;
  type: 'simulation' | 'touchstone';
}

interface S11ChartProps {
  traces: S11Trace[];
  frequencyUnit: 'MHz' | 'GHz';
  showPhase?: boolean;
  markers?: {
    resonantFreq?: number;
    bandwidth?: { start: number; end: number };
  };
  onFrequencyClick?: (frequency: number) => void;
}

const S11Chart: FC<S11ChartProps> = ({
  traces,
  frequencyUnit,
  showPhase = false,
  markers,
  onFrequencyClick
}) => {
  // Combine all trace data for unified chart
  const chartData = traces.reduce((acc, trace) => {
    trace.data.forEach(point => {
      const existingPoint = acc.find(p => p.frequency === point.frequency);
      if (existingPoint) {
        existingPoint[`${trace.id}_s11`] = point.s11_db;
        if (showPhase && point.phase !== undefined) {
          existingPoint[`${trace.id}_phase`] = point.phase;
        }
      } else {
        const newPoint: any = {
          frequency: point.frequency,
          [`${trace.id}_s11`]: point.s11_db
        };
        if (showPhase && point.phase !== undefined) {
          newPoint[`${trace.id}_phase`] = point.phase;
        }
        acc.push(newPoint);
      }
    });
    return acc;
  }, [] as any[]);

  // Sort by frequency
  chartData.sort((a, b) => a.frequency - b.frequency);

  const formatFrequency = (value: number) => {
    if (frequencyUnit === 'GHz') {
      return `${(value / 1e9).toFixed(2)} GHz`;
    }
    return `${(value / 1e6).toFixed(0)} MHz`;
  };

  const handleChartClick = (data: any) => {
    if (data?.activeLabel && onFrequencyClick) {
      onFrequencyClick(data.activeLabel);
    }
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="s11-tooltip">
          <p className="tooltip-label">{formatFrequency(label)}</p>
          {payload.map((entry: any, index: number) => {
            const isPhase = entry.dataKey.includes('_phase');
            const unit = isPhase ? '°' : 'dB';
            const value = isPhase ? entry.value.toFixed(1) : entry.value.toFixed(2);
            return (
              <p key={index} style={{ color: entry.color }}>
                {`${entry.name}: ${value} ${unit}`}
              </p>
            );
          })}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="s11-chart-container">
      <div className="s11-chart-header">
        <h3>S11 Return Loss</h3>
        <div className="chart-controls">
          {traces.length > 0 && (
            <div className="trace-legend">
              {traces.map(trace => (
                <div key={trace.id} className="trace-item">
                  <div 
                    className="trace-color" 
                    style={{ backgroundColor: trace.color }}
                  />
                  <span className="trace-name">{trace.name}</span>
                  <span className="trace-type">({trace.type})</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      
      <div className="chart-wrapper">
        <ResponsiveContainer width="100%" height={400}>
          <LineChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
            onClick={handleChartClick}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis 
              dataKey="frequency"
              tickFormatter={formatFrequency}
              angle={-45}
              textAnchor="end"
              height={80}
              stroke="#666"
            />
            <YAxis 
              label={{ value: 'S11 (dB)', angle: -90, position: 'insideLeft' }}
              domain={[-40, 0]}
              stroke="#666"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              wrapperStyle={{ paddingTop: '20px' }}
            />
            
            {/* S11 magnitude lines */}
            {traces.map(trace => (
              <Line
                key={`${trace.id}_s11`}
                type="monotone"
                dataKey={`${trace.id}_s11`}
                stroke={trace.color}
                strokeWidth={2}
                dot={false}
                name={`${trace.name} S11`}
                connectNulls={false}
              />
            ))}
            
            {/* Phase lines (if enabled) */}
            {showPhase && traces.map(trace => (
              <Line
                key={`${trace.id}_phase`}
                type="monotone"
                dataKey={`${trace.id}_phase`}
                stroke={trace.color}
                strokeWidth={1}
                strokeDasharray="5 5"
                dot={false}
                name={`${trace.name} Phase`}
                yAxisId="phase"
                connectNulls={false}
              />
            ))}
            
            {/* Resonant frequency marker */}
            {markers?.resonantFreq && (
              <ReferenceLine 
                x={markers.resonantFreq} 
                stroke="#ff4444" 
                strokeWidth={2}
                strokeDasharray="8 4"
                label={{ value: "Resonant", position: "top" }}
              />
            )}
            
            {/* Bandwidth markers */}
            {markers?.bandwidth && (
              <>
                <ReferenceLine 
                  x={markers.bandwidth.start} 
                  stroke="#44ff44" 
                  strokeDasharray="4 4"
                  label={{ value: "BW Start", position: "top" }}
                />
                <ReferenceLine 
                  x={markers.bandwidth.end} 
                  stroke="#44ff44" 
                  strokeDasharray="4 4"
                  label={{ value: "BW End", position: "top" }}
                />
              </>
            )}
            
            {/* -10dB reference line */}
            <ReferenceLine 
              y={-10} 
              stroke="#888" 
              strokeDasharray="2 2"
              label={{ value: "-10dB", position: "right" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      
      {traces.length === 0 && (
        <div className="empty-chart">
          <p>No simulation data available</p>
          <p>Run a simulation or import Touchstone data to view S11 response</p>
        </div>
      )}
    </div>
  );
};

export default S11Chart;
export type { S11DataPoint, S11Trace, S11ChartProps };