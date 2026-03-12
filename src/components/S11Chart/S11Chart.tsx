import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { FC } from 'react';
import './S11Chart.css';

interface S11DataPoint {
  frequency: number;
  s11_db: number;
}

interface S11ChartProps {
  data: S11DataPoint[];
  simulationData?: S11DataPoint[];
  touchstoneData?: S11DataPoint[];
  className?: string;
}

const S11Chart: FC<S11ChartProps> = ({ 
  data, 
  simulationData, 
  touchstoneData, 
  className 
}) => {
  const formatTooltip = (value: number, name: string) => {
    if (name.includes('s11')) {
      return [`${value.toFixed(2)} dB`, name];
    }
    return [value, name];
  };

  const formatXAxis = (tickItem: number) => {
    if (tickItem >= 1000) {
      return `${(tickItem / 1000).toFixed(1)}G`;
    }
    return `${tickItem}M`;
  };

  return (
    <div className={`s11-chart ${className || ''}`}>
      <div className="s11-chart-header">
        <h3>S11 Return Loss</h3>
      </div>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis 
            dataKey="frequency"
            type="number"
            scale="linear"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatXAxis}
            stroke="#666"
          />
          <YAxis 
            domain={[-40, 0]}
            label={{ value: 'S11 (dB)', angle: -90, position: 'insideLeft' }}
            stroke="#666"
          />
          <Tooltip 
            formatter={formatTooltip}
            labelFormatter={(value) => `${formatXAxis(Number(value))}Hz`}
          />
          <Legend />
          
          {data.length > 0 && (
            <Line
              data={data}
              type="monotone"
              dataKey="s11_db"
              stroke="#2196F3"
              strokeWidth={2}
              dot={false}
              name="Current Simulation"
            />
          )}
          
          {simulationData && simulationData.length > 0 && (
            <Line
              data={simulationData}
              type="monotone"
              dataKey="s11_db"
              stroke="#4CAF50"
              strokeWidth={2}
              dot={false}
              name="Previous Simulation"
            />
          )}
          
          {touchstoneData && touchstoneData.length > 0 && (
            <Line
              data={touchstoneData}
              type="monotone"
              dataKey="s11_db"
              stroke="#FF9800"
              strokeWidth={2}
              dot={false}
              name="Touchstone Import"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default S11Chart;