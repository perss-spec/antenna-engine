import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine, ReferenceDot, ReferenceArea, Label } from 'recharts';
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

const CustomTriangleDot = (props: any) => {
  const { cx, cy } = props;
  return (
    <polygon
      points={`${cx},${cy + 6} ${cx - 5},${cy - 4} ${cx + 5},${cy - 4}`}
      fill="#0ea5e9" /* --color-accent */
      stroke="#f0f0f2" /* --color-text-primary */
      strokeWidth={2}
    />
  );
};

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

  const bandwidthData = useMemo(() => {
    if (data.length === 0) return null;

    // Find -10dB crossover points
    const crossovers: number[] = [];
    for (let i = 0; i < data.length - 1; i++) {
      const p1 = data[i];
      const p2 = data[i + 1];
      
      // Check if line crosses -10dB threshold
      if ((p1.s11_db > -10 && p2.s11_db <= -10) || (p1.s11_db <= -10 && p2.s11_db > -10)) {
        // Linear interpolation to find exact crossover frequency
        const ratio = (-10 - p1.s11_db) / (p2.s11_db - p1.s11_db);
        const crossoverFreq = p1.frequency + ratio * (p2.frequency - p1.frequency);
        crossovers.push(crossoverFreq);
      }
    }

    if (crossovers.length < 2) return null;

    // Take first and last crossover points for bandwidth calculation
    const f1 = Math.min(...crossovers);
    const f2 = Math.max(...crossovers);
    const bandwidth = f2 - f1;
    const centerFreq = (f1 + f2) / 2;

    return {
      f1,
      f2,
      bandwidth,
      centerFreq,
      bandwidthLabel: bandwidth >= 1000 ? `${(bandwidth / 1000).toFixed(2)} GHz` : `${bandwidth.toFixed(1)} MHz`
    };
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
                  color: isVisible ? '#8e8e9a' : '#5c5c68' /* --color-text-muted / --color-text-dim */
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
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" opacity={0.3} /> {/* --color-border */}
          <XAxis
            dataKey="frequency"
            type="number"
            scale="linear"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatXAxis}
            stroke="#5c5c68" /* --color-text-dim */
            tick={{ fill: '#8e8e9a', fontSize: 11 }} /* --color-text-muted */
            label={{ value: 'Frequency (MHz)', position: 'insideBottom', offset: -10, fill: '#8e8e9a', fontSize: 11 }} /* --color-text-muted */
          />
          <YAxis
            domain={yAxisDomain}
            label={{ value: 'S11 (dB)', angle: -90, position: 'insideLeft', fill: '#8e8e9a' }} /* --color-text-muted */
            stroke="#5c5c68" /* --color-text-dim */
            tick={{ fill: '#8e8e9a', fontSize: 11 }} /* --color-text-muted */
          />
          <Tooltip
            formatter={formatTooltip}
            labelFormatter={(value) => `${formatXAxis(Number(value))}Hz`}
            contentStyle={{
              background: '#151518', /* --color-surface */
              border: '1px solid #2a2a32', /* --color-border */
              borderRadius: '6px',
              color: '#f0f0f2', /* --color-text-primary */
              fontSize: '12px',
            }}
          />
          <Legend content={customLegend} />

          {bandwidthData && (
            <ReferenceArea
              x1={bandwidthData.f1}
              x2={bandwidthData.f2}
              fill="#22c55e" /* --color-chart-2 */
              fillOpacity={0.05}
            />
          )}

          <ReferenceLine
            y={-10}
            stroke="#ef4444" /* --color-chart-4 (error) */
            strokeDasharray="6 3"
            strokeWidth={1}
            label={{ value: '-10 dB', position: 'right', fill: '#ef4444', fontSize: 10 }} /* --color-chart-4 */
          />

          {bandwidthData && (
            <>
              <ReferenceLine
                x={bandwidthData.f1}
                stroke="#22c55e" /* --color-chart-2 */
                strokeDasharray="4 2"
                strokeWidth={1}
              />
              <ReferenceLine
                x={bandwidthData.f2}
                stroke="#22c55e" /* --color-chart-2 */
                strokeDasharray="4 2"
                strokeWidth={1}
              />
              <ReferenceDot
                x={bandwidthData.centerFreq}
                y={-5}
                r={0}
                fill="transparent"
              >
                <Label
                  value={`BW: ${bandwidthData.bandwidthLabel}`}
                  position="top"
                  fill="#22c55e" /* --color-chart-2 */
                  fontSize={10}
                  fontWeight="bold"
                />
              </ReferenceDot>
            </>
          )}

          {minPoint && (
            <>
              <ReferenceDot
                x={minPoint.frequency}
                y={minPoint.s11_db}
                r={0}
                fill="transparent"
                shape={<CustomTriangleDot />}
              />
              <ReferenceDot
                x={minPoint.frequency}
                y={minPoint.s11_db + 3}
                r={0}
                fill="transparent"
              >
                <Label
                  value={`${formatXAxis(minPoint.frequency)}Hz`}
                  position="top"
                  fill="#0ea5e9" /* --color-accent */
                  fontSize={9}
                  fontWeight="bold"
                />
              </ReferenceDot>
            </>
          )}

          {data.length > 0 && visibleLines.current && (
            <Line
              data={data}
              type="monotone"
              dataKey="s11_db"
              stroke="#0ea5e9" /* --color-chart-1 (accent) */
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
              stroke="#22c55e" /* --color-chart-2 */
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
              stroke="#eab308" /* --color-chart-3 (warning) */
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