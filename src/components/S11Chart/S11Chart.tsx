import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';
import type { FC } from 'react';
import { useMemo } from 'react';

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
  const minPoint = useMemo(() => {
    if (data.length === 0) return null;
    return data.reduce((min, p) => p.s11_db < min.s11_db ? p : min, data[0]);
  }, [data]);

  const formatTooltip = (value: number, name: string) => {
    if (name.includes('s11')) {
      return [`${value.toFixed(2)} dB`, name];
    }
    return [value, name];
  };

  const formatXAxis = (tickItem: number) => {
    if (tickItem >= 1000) return `${(tickItem / 1000).toFixed(1)}G`;
    return `${tickItem}M`;
  };

  return (
    <div className={`flex flex-col flex-1 ${className || ''}`}>
      <h3 className="text-sm font-semibold text-text mb-3">S11 Return Loss</h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
          <XAxis
            dataKey="frequency"
            type="number"
            scale="linear"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatXAxis}
            stroke="#555"
            tick={{ fill: '#666', fontSize: 11 }}
            label={{ value: 'Frequency (MHz)', position: 'insideBottom', offset: -10, fill: '#666', fontSize: 11 }}
          />
          <YAxis
            domain={[-40, 0]}
            label={{ value: 'S11 (dB)', angle: -90, position: 'insideLeft', fill: '#666' }}
            stroke="#555"
            tick={{ fill: '#666', fontSize: 11 }}
          />
          <Tooltip
            formatter={formatTooltip}
            labelFormatter={(value) => `${formatXAxis(Number(value))}Hz`}
            contentStyle={{
              background: '#1a1a28',
              border: '1px solid #2a2a3e',
              borderRadius: '6px',
              color: '#e0e0e0',
              fontSize: '12px',
            }}
          />
          <Legend wrapperStyle={{ color: '#888', fontSize: '12px' }} />

          <ReferenceLine
            y={-10}
            stroke="#ef4444"
            strokeDasharray="6 3"
            strokeWidth={1}
            label={{ value: '-10 dB', position: 'right', fill: '#ef4444', fontSize: 10 }}
          />

          {minPoint && (
            <ReferenceDot
              x={minPoint.frequency}
              y={minPoint.s11_db}
              r={5}
              fill="#6366f1"
              stroke="#fff"
              strokeWidth={2}
            />
          )}

          {data.length > 0 && (
            <Line
              data={data}
              type="monotone"
              dataKey="s11_db"
              stroke="#6366f1"
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
              stroke="#22c55e"
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
              stroke="#f59e0b"
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
