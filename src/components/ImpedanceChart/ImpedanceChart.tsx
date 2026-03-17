import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ImpedanceChartPoint {
  frequency: number;
  real: number;
  imag: number;
}

interface ImpedanceChartProps {
  data: ImpedanceChartPoint[];
  comparisonData?: ImpedanceChartPoint[];
  className?: string;
}

function formatXAxis(value: number): string {
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}G`;
  }
  return `${Math.round(value)}M`;
}

function formatFrequency(freq: number): string {
  if (freq >= 1000) {
    return `${(freq / 1000).toFixed(3)} GHz`;
  }
  return `${freq.toFixed(1)} MHz`;
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div
      style={{
        backgroundColor: "#151518",
        border: "1px solid #2a2a32",
        borderRadius: 6,
        padding: "8px 12px",
        color: "#f0f0f2",
        fontSize: 12,
      }}
    >
      <p style={{ margin: "0 0 4px", fontWeight: 600 }}>
        {formatFrequency(label)}
      </p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ margin: 0, color: entry.color }}>
          {entry.name}: {entry.value.toFixed(2)} &Omega;
        </p>
      ))}
    </div>
  );
}

function mergeData(
  data: ImpedanceChartPoint[],
  comparisonData?: ImpedanceChartPoint[]
) {
  const merged = data.map((p) => ({
    frequency: p.frequency,
    real: p.real,
    imag: p.imag,
    compReal: undefined as number | undefined,
    compImag: undefined as number | undefined,
  }));

  if (!comparisonData) return merged;

  const freqMap = new Map(merged.map((p, i) => [p.frequency, i]));

  for (const cp of comparisonData) {
    const idx = freqMap.get(cp.frequency);
    if (idx !== undefined) {
      merged[idx].compReal = cp.real;
      merged[idx].compImag = cp.imag;
    } else {
      merged.push({
        frequency: cp.frequency,
        real: undefined as any,
        imag: undefined as any,
        compReal: cp.real,
        compImag: cp.imag,
      });
    }
  }

  merged.sort((a, b) => a.frequency - b.frequency);
  return merged;
}

function ImpedanceChart({ data, comparisonData, className }: ImpedanceChartProps) {
  const chartData = mergeData(data, comparisonData);

  return (
    <div className={className}>
      <h3 className="text-sm font-semibold text-text mb-3">Impedance Z(f)</h3>
      <ResponsiveContainer width="100%" height={400}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2a2a32" opacity={0.3} />
          <XAxis
            dataKey="frequency"
            tickFormatter={formatXAxis}
            stroke="#5c5c68"
            tick={{ fill: "#8e8e9a", fontSize: 11 }}
          />
          <YAxis
            stroke="#5c5c68"
            tick={{ fill: "#8e8e9a", fontSize: 11 }}
            label={{
              value: "Impedance (\u03A9)",
              angle: -90,
              position: "insideLeft",
              style: { fill: "#8e8e9a", fontSize: 11 },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend />

          <ReferenceLine
            y={50}
            stroke="#22c55e"
            strokeDasharray="6 3"
            label={{
              value: "Z\u2080 = 50 \u03A9",
              position: "right",
              fill: "#22c55e",
              fontSize: 11,
            }}
          />
          <ReferenceLine y={0} stroke="#5c5c68" strokeDasharray="6 3" />

          <Line
            type="monotone"
            dataKey="real"
            stroke="#0ea5e9"
            strokeWidth={2}
            dot={false}
            name="Z real (\u03A9)"
            connectNulls
          />
          <Line
            type="monotone"
            dataKey="imag"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
            name="Z imag (\u03A9)"
            connectNulls
          />

          {comparisonData && (
            <Line
              type="monotone"
              dataKey="compReal"
              stroke="#22c55e"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
              name="Z real comp"
              connectNulls
            />
          )}
          {comparisonData && (
            <Line
              type="monotone"
              dataKey="compImag"
              stroke="#eab308"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
              name="Z imag comp"
              connectNulls
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default ImpedanceChart;
