import type { FC } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SimResult {
  frequencies: number[];
  s11_db: number[];
  impedanceReal: number[];
  impedanceImag: number[];
  label?: string;
}

interface ComparisonPanelProps {
  resultA: SimResult;
  resultB: SimResult;
  className?: string;
}

interface ComparisonMetrics {
  resonantFreq: number;
  minS11: number;
  bandwidth: number;
  vswr: number;
}

const calculateMetrics = (result: SimResult): ComparisonMetrics => {
  const { frequencies, s11_db } = result;
  
  // Find minimum S11 and resonant frequency
  const minS11Index = s11_db.reduce((minIdx, current, idx) => 
    current < s11_db[minIdx] ? idx : minIdx, 0
  );
  const minS11 = s11_db[minS11Index];
  const resonantFreq = frequencies[minS11Index] / 1e6; // Convert to MHz
  
  // Calculate -10dB bandwidth
  const s11Threshold = -10;
  const belowThreshold = s11_db.map((s11, idx) => ({ s11, freq: frequencies[idx] / 1e6, idx }))
    .filter(point => point.s11 < s11Threshold);
  
  let bandwidth = 0;
  if (belowThreshold.length > 1) {
    const minFreq = Math.min(...belowThreshold.map(p => p.freq));
    const maxFreq = Math.max(...belowThreshold.map(p => p.freq));
    bandwidth = maxFreq - minFreq;
  }
  
  // Calculate VSWR at resonant frequency
  const gamma = Math.pow(10, minS11 / 20);
  const vswr = gamma >= 1 ? Infinity : (1 + gamma) / (1 - gamma);
  
  return { resonantFreq, minS11, bandwidth, vswr };
};

const formatFrequency = (freq: number): string => {
  if (freq >= 1000) return `${(freq / 1000).toFixed(2)} GHz`;
  return `${freq.toFixed(1)} MHz`;
};

const formatS11 = (s11: number): string => `${s11.toFixed(1)} dB`;

const formatVswr = (vswr: number): string => {
  if (!isFinite(vswr)) return '∞';
  return vswr.toFixed(2);
};

const getS11Badge = (s11: number): 'success' | 'warning' | 'error' => {
  if (s11 < -15) return 'success';
  if (s11 < -10) return 'warning';
  return 'error';
};

const getVswrBadge = (vswr: number): 'success' | 'warning' | 'error' => {
  if (!isFinite(vswr)) return 'error';
  if (vswr < 1.5) return 'success';
  if (vswr < 2.0) return 'warning';
  return 'error';
};

const ComparisonPanel: FC<ComparisonPanelProps> = ({
  resultA,
  resultB,
  className
}) => {
  const metricsA = calculateMetrics(resultA);
  const metricsB = calculateMetrics(resultB);
  
  // Prepare chart data
  const chartData = resultA.frequencies.map((freq, idx) => ({
    frequency: freq / 1e6, // Convert to MHz
    s11_a: resultA.s11_db[idx],
    s11_b: resultB.s11_db[idx] ?? 0
  }));
  
  // Add resultB data if frequencies don't match
  resultB.frequencies.forEach((freq, idx) => {
    const freqMhz = freq / 1e6;
    const existingPoint = chartData.find(point => Math.abs(point.frequency - freqMhz) < 0.1);
    if (!existingPoint) {
      chartData.push({
        frequency: freqMhz,
        s11_a: 0,
        s11_b: resultB.s11_db[idx] ?? 0
      });
    }
  });
  
  // Sort by frequency
  chartData.sort((a, b) => a.frequency - b.frequency);
  
  const formatTooltip = (value: unknown, name: string): [string, string] => {
    const numValue = typeof value === 'number' ? value : 0;
    if (name.includes('s11')) {
      return [`${numValue.toFixed(2)} dB`, name];
    }
    return [String(value), name];
  };

  const formatXAxis = (tickItem: number): string => {
    if (tickItem >= 1000) return `${(tickItem / 1000).toFixed(1)}G`;
    return `${tickItem}M`;
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* S11 Comparison Chart */}
      <Card>
        <CardHeader>
          <CardTitle>S11 Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
              <XAxis
                dataKey="frequency"
                type="number"
                scale="linear"
                domain={['dataMin', 'dataMax']}
                tickFormatter={formatXAxis}
                stroke="#555"
                tick={{ fill: '#666', fontSize: 11 }}
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
              
              <Line
                type="monotone"
                dataKey="s11_a"
                stroke="#6366f1"
                strokeWidth={2}
                dot={false}
                name={resultA.label || 'Result A'}
              />
              <Line
                type="monotone"
                dataKey="s11_b"
                stroke="#22c55e"
                strokeWidth={2}
                dot={false}
                name={resultB.label || 'Result B'}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Metrics Comparison Table */}
      <Card>
        <CardHeader>
          <CardTitle>Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-text-muted uppercase tracking-wider border-b border-border">
                <tr>
                  <th className="py-2 px-3 text-left">Metric</th>
                  <th className="py-2 px-3 text-left">{resultA.label || 'Result A'}</th>
                  <th className="py-2 px-3 text-left">{resultB.label || 'Result B'}</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-3 font-medium text-text">Resonant Frequency</td>
                  <td className="py-2 px-3 text-text">{formatFrequency(metricsA.resonantFreq)}</td>
                  <td className="py-2 px-3 text-text">{formatFrequency(metricsB.resonantFreq)}</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-3 font-medium text-text">Min S11</td>
                  <td className="py-2 px-3">
                    <Badge variant={getS11Badge(metricsA.minS11)}>
                      {formatS11(metricsA.minS11)}
                    </Badge>
                  </td>
                  <td className="py-2 px-3">
                    <Badge variant={getS11Badge(metricsB.minS11)}>
                      {formatS11(metricsB.minS11)}
                    </Badge>
                  </td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-2 px-3 font-medium text-text">-10dB Bandwidth</td>
                  <td className="py-2 px-3 text-text">{formatFrequency(metricsA.bandwidth)}</td>
                  <td className="py-2 px-3 text-text">{formatFrequency(metricsB.bandwidth)}</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-medium text-text">VSWR</td>
                  <td className="py-2 px-3">
                    <Badge variant={getVswrBadge(metricsA.vswr)}>
                      {formatVswr(metricsA.vswr)}
                    </Badge>
                  </td>
                  <td className="py-2 px-3">
                    <Badge variant={getVswrBadge(metricsB.vswr)}>
                      {formatVswr(metricsB.vswr)}
                    </Badge>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default ComparisonPanel;