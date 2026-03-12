import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import type { FC } from 'react';
import './S11Chart.css';

interface S11DataPoint {
  frequency: number;
  s11_db: number;
}

interface S11ChartProps {
  data: S11DataPoint[];
  width?: number;
  height?: number;
  showGrid?: boolean;
  title?: string;
  referenceLines?: {
    frequency?: number;
    s11?: number;
    label?: string;
  }[];
}

const S11Chart: FC<S11ChartProps> = ({
  data,
  width,
  height = 400,
  showGrid = true,
  title = 'S11 Return Loss',
  referenceLines = []
}) => {
  const formatFrequency = (value: number) => {
    if (value >= 1e9) {
      return `${(value / 1e9).toFixed(1)}G`;
    } else if (value >= 1e6) {
      return `${(value / 1e6).toFixed(0)}M`;
    } else if (value >= 1e3) {
      return `${(value / 1e3).toFixed(0)}k`;
    }
    return `${value}`;
  };

  const formatS11 = (value: number) => {
    return `${value.toFixed(1)} dB`;
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="s11-tooltip">
          <p className="tooltip-label">{`Frequency: ${formatFrequency(label)}Hz`}</p>
          <p className="tooltip-value">
            <span className="tooltip-color" style={{ color: payload[0].color }}>●</span>
            {`S11: ${formatS11(payload[0].value)}`}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="s11-chart-container">
      {title && <h3 className="chart-title">{title}</h3>}
      <ResponsiveContainer width={width || '100%'} height={height}>
        <LineChart
          data={data}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 20,
          }}
        >
          {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />}
          <XAxis
            dataKey="frequency"
            tickFormatter={formatFrequency}
            stroke="#666"
            fontSize={12}
          />
          <YAxis
            domain={['dataMin - 5', 'dataMax + 5']}
            tickFormatter={(value) => `${value}`}
            label={{ value: 'S11 (dB)', angle: -90, position: 'insideLeft' }}
            stroke="#666"
            fontSize={12}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />
          
          {/* Reference lines */}
          {referenceLines.map((refLine, index) => {
            if (refLine.frequency) {
              return (
                <ReferenceLine
                  key={`freq-${index}`}
                  x={refLine.frequency}
                  stroke="#ff6b6b"
                  strokeDasharray="5 5"
                  label={{
                    value: refLine.label || `${formatFrequency(refLine.frequency)}Hz`,
                    position: 'top'
                  }}
                />
              );
            }
            if (refLine.s11) {
              return (
                <ReferenceLine
                  key={`s11-${index}`}
                  y={refLine.s11}
                  stroke="#4ecdc4"
                  strokeDasharray="5 5"
                  label={{
                    value: refLine.label || `${refLine.s11} dB`,
                    position: 'right'
                  }}
                />
              );
            }
            return null;
          })}
          
          <Line
            type="monotone"
            dataKey="s11_db"
            stroke="#2196f3"
            strokeWidth={2}
            dot={false}
            name="S11 (dB)"
            connectNulls={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default S11Chart;