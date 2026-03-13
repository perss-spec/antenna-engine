import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceDot } from 'recharts';
import type { FC } from 'react';
import { useMemo, useState } from 'react';

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
  const [visibleLines, setVisibleLines] = useState({
    current: true,
    previous: true,
    touchstone: true
  });

  const minPoint = useMemo(() => {
    if (data.length === 0) return null;
    return data.reduce((min, p) => p.s11_db < min.s11_db ? p : min, data[0]);
  }, [data]);

  const yAxisDomain = useMemo(() => {
    const allData = [
      ...(data || []),
      ...(simulationData || []),
      ...(touchstoneData || [])
    ];
    
    if (allData.length === 0) return [-40, 0];
    
    const minValue = Math.min(...allData.map(d => d.s11_db));
    const maxValue = Math.max(...allData.map(d => d.s11_db));
    
    return [minValue - 5, Math.max(maxValue + 2, 0)];
  }, [data, simulationData, touchstoneData]);

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

  const handleLegendClick = (dataKey: string) => {
    setVisibleLines(prev => ({
      ...prev,
      [dataKey]: !prev[dataKey as keyof typeof prev]
    }));
  };

  const customLegend = (props: any) => {
    const { payload } = props;
    if (!payload) return null;

    return (
      <div className="flex justify-center gap-4 mt-2">
        {payload.map((entry: any, index: number) => {
          const dataKey = entry.dataKey === 's11_db' ? 
            (entry.payload?.name === 'Current Simulation' ? 'current' :
             entry.payload?.name === 'Previous Simulation' ? 'previous' : 'touchstone') :
            'current';
          
          const isVisible = visibleLines[dataKey as keyof typeof visibleLines];
          
          return (
            <div
              key={`item-${index}`}
              className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => handleLegendClick(dataKey)}
            >
              <div
                className="w-3 h-0.5"
                style={{
                  backgroundColor: entry.color,
                  opacity: isVisible ? 1 : 0.3
                }}
              />
              <span
                className="text-xs"
                style={{
                  color: isVisible ? '#888' : '#555'
                }}
              >
                {entry.value}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={`flex flex-col flex-1 ${className || ''}`}>
      <h3 className="text-sm font-semibold text-text mb-3">S11 Return Loss</h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" opacity={0.3} />
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
            domain={yAxisDomain}
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
          <Legend content={customLegend} />

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

          {data.length > 0 && visibleLines.current && (
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

          {simulationData && simulationData.length > 0 && visibleLines.previous && (
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

          {touchstoneData && touchstoneData.length > 0 && visibleLines.touchstone && (
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