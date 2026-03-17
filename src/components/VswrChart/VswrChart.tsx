import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { FC } from 'react';

interface VswrDataPoint {
  frequency: number;
  vswr: number;
}

interface VswrChartProps {
  data: VswrDataPoint[];
  comparisonData?: VswrDataPoint[];
  className?: string;
}

const formatXAxis = (tickItem: number) => {
  if (tickItem >= 1000) return `${(tickItem / 1000).toFixed(1)}G`;
  return `${tickItem}M`;
};

const VswrChart: FC<VswrChartProps> = ({ data, comparisonData, className }) => {
  return (
    <div className={`flex flex-col flex-1 ${className || ''}`}>
      <h3 className="text-sm font-semibold text-text mb-3">VSWR</h3>
      <ResponsiveContainer width="100%" height="100%" minHeight={300}>
        <LineChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" opacity={0.3} />
          <XAxis
            dataKey="frequency"
            type="number"
            scale="linear"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatXAxis}
            stroke="#5c5c68"
            tick={{ fill: '#8e8e9a', fontSize: 11 }}
            label={{ value: 'Frequency (MHz)', position: 'insideBottom', offset: -10, fill: '#8e8e9a', fontSize: 11 }}
          />
          <YAxis
            domain={[1, 'auto']}
            label={{ value: 'VSWR', angle: -90, position: 'insideLeft', fill: '#8e8e9a' }}
            stroke="#5c5c68"
            tick={{ fill: '#8e8e9a', fontSize: 11 }}
          />
          <Tooltip
            formatter={(value: number) => [value.toFixed(2), 'VSWR']}
            labelFormatter={(value) => `${formatXAxis(Number(value))}Hz`}
            contentStyle={{
              background: '#151518',
              border: '1px solid #2a2a32',
              borderRadius: '6px',
              color: '#f0f0f2',
              fontSize: '12px',
            }}
          />

          <ReferenceLine
            y={2}
            stroke="#22c55e"
            strokeDasharray="6 3"
            strokeWidth={1}
            label={{ value: 'Good match', position: 'right', fill: '#22c55e', fontSize: 10 }}
          />
          <ReferenceLine
            y={3}
            stroke="#eab308"
            strokeDasharray="6 3"
            strokeWidth={1}
            label={{ value: 'Acceptable', position: 'right', fill: '#eab308', fontSize: 10 }}
          />

          {data.length > 0 && (
            <Line
              data={data}
              type="monotone"
              dataKey="vswr"
              stroke="#0ea5e9"
              strokeWidth={2}
              dot={false}
              name="VSWR"
            />
          )}

          {comparisonData && comparisonData.length > 0 && (
            <Line
              data={comparisonData}
              type="monotone"
              dataKey="vswr"
              stroke="#22c55e"
              strokeWidth={2}
              dot={false}
              name="Comparison"
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default VswrChart;
