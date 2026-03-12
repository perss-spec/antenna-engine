import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { FC } from 'react';
import './S11Chart.css';

interface S11DataPoint {
  frequency: number;
  s11_db: number;
}

interface S11ChartProps {
  data: S11DataPoint[];
  touchstoneData?: S11DataPoint[];
  title?: string;
  className?: string;
}

const S11Chart: FC<S11ChartProps> = ({ 
  data, 
  touchstoneData, 
  title = 'S11 Return Loss', 
  className = '' 
}) => {
  const formatTooltip = (value: number, name: string) => {
    if (name === 's11_db') {
      return [`${value.toFixed(2)} dB`, 'S11'];
    }
    return [value, name];
  };

  const formatXAxisLabel = (value: number) => {
    return `${(value / 1e6).toFixed(1)} MHz`;
  };

  return (
    <div className={`s11-chart ${className}`}>
      <h3 className="s11-chart__title">{title}</h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 60,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis 
            dataKey="frequency"
            tickFormatter={formatXAxisLabel}
            stroke="#666"
            fontSize={12}
            label={{ value: 'Frequency (MHz)', position: 'insideBottom', offset: -10 }}
          />
          <YAxis 
            stroke="#666"
            fontSize={12}
            label={{ value: 'S11 (dB)', angle: -90, position: 'insideLeft' }}
            domain={[-40, 0]}
          />
          <Tooltip 
            formatter={formatTooltip}
            labelFormatter={(value) => `Frequency: ${formatXAxisLabel(Number(value))}`}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #ccc',
              borderRadius: '4px',
              fontSize: '12px'
            }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="s11_db" 
            stroke="#2563eb" 
            strokeWidth={2}
            dot={false}
            name="Simulation"
          />
          {touchstoneData && (
            <Line 
              type="monotone" 
              dataKey="s11_db" 
              data={touchstoneData}
              stroke="#dc2626" 
              strokeWidth={2}
              strokeDasharray="5 5"
              dot={false}
              name="Touchstone"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default S11Chart;