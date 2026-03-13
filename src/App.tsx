import { useState, useCallback, useRef } from 'react';
import { Activity, Radio, Zap, Signal } from 'lucide-react';
import AntennaForm from './components/AntennaForm/AntennaForm';
import type { AntennaParameters } from './components/AntennaForm/AntennaForm';
import S11Chart from './components/S11Chart/S11Chart';
import SmithChart from './components/SmithChart/SmithChart';
import OptimizationPanel from './components/OptimizationPanel/OptimizationPanel';
import FrequencyPresets from './components/FrequencyPresets/FrequencyPresets';
import SimulationHistory from './components/SimulationHistory/SimulationHistory';
import type { HistoryItem } from './components/SimulationHistory/SimulationHistory';
import AntennaViewport from './viewport/AntennaViewport';
import ExportPanel from './components/ExportPanel/ExportPanel';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LandingPage } from '@/components/landing/LandingPage';

const isTauri = '__TAURI_INTERNALS__' in window;
const invoke = isTauri
  ? (await import('@tauri-apps/api/core')).invoke
  : async (_cmd: string, args: any): Promise<any> => {
      await new Promise(r => setTimeout(r, 400));
      const a = args as any;

      if (_cmd === 'get_antenna_templates') {
        return [
          { id: 'dipole', name: 'Half-Wave Dipole', type: 'Dipole', default_frequency: 145e6 },
          { id: 'monopole', name: 'Quarter-Wave Monopole', type: 'Monopole', default_frequency: 433e6 },
          { id: 'patch', name: 'Rectangular Patch', type: 'Patch', default_frequency: 2.4e9 },
          { id: 'qfh', name: 'QFH', type: 'Qfh', default_frequency: 137.5e6 },
          { id: 'yagi', name: '3-Element Yagi', type: 'Yagi', default_frequency: 145e6 },
        ];
      }

      // simulate_sweep mock
      const antennaType = a.antenna_type || a.antennaType || 'dipole';
      const fStart = a.freq_start || a.freqStart;
      const fStop = a.freq_stop || a.freqStop;
      const n = a.freq_points || a.freqPoints || 101;
      const fCenter = (fStart + fStop) / 2;

      // Impedance models per antenna type
      const models: Record<string, { zr: number; zi_scale: number; gain: number }> = {
        dipole:   { zr: 73,    zi_scale: 42.5,  gain: 2.15 },
        monopole: { zr: 36.5,  zi_scale: 21.25, gain: 5.15 },
        patch:    { zr: 200,   zi_scale: 0,     gain: 6.0 },
        qfh:     { zr: 50,    zi_scale: 5.0,   gain: 3.0 },
        yagi:     { zr: 25,    zi_scale: 10.0,  gain: 7.1 },
      };
      const m = models[antennaType] || models.dipole;

      const frequencies: number[] = [];
      const s11Db: number[] = [];
      const s11Real: number[] = [];
      const s11Imag: number[] = [];
      const impedanceReal: number[] = [];
      const impedanceImag: number[] = [];

      for (let i = 0; i < n; i++) {
        const f = fStart + (fStop - fStart) * i / (n - 1);
        const delta = (f - fCenter) / fCenter;
        frequencies.push(f);

        const zr = m.zr;
        const zi = m.zi_scale * delta * 10;
        impedanceReal.push(zr);
        impedanceImag.push(zi);

        // Gamma = (Z - 50) / (Z + 50)
        const dr = zr + 50, di = zi;
        const dMag2 = dr * dr + di * di;
        const gr = ((zr - 50) * dr + zi * di) / dMag2;
        const gi = (zi * dr - (zr - 50) * di) / dMag2;
        const gMag2 = gr * gr + gi * gi;
        const s11db = 10 * Math.log10(gMag2 || 1e-20);

        s11Db.push(s11db);
        s11Real.push(gr);
        s11Imag.push(gi);
      }

      const minIdx = s11Db.indexOf(Math.min(...s11Db));
      const bwIndices = s11Db.map((v, i) => v <= -10 ? i : -1).filter(i => i >= 0);
      const bandwidth = bwIndices.length >= 2
        ? frequencies[bwIndices[bwIndices.length - 1]] - frequencies[bwIndices[0]]
        : 0;

      return {
        frequencies, s11Db, s11Real, s11Imag, impedanceReal, impedanceImag,
        resonantFreq: frequencies[minIdx],
        minS11: s11Db[minIdx],
        bandwidth,
      };
    };

interface SimulateResponse {
  frequencies: number[];
  s11Db: number[];
  s11Real: number[];
  s11Imag: number[];
  impedanceReal: number[];
  impedanceImag: number[];
  resonantFreq: number;
  minS11: number;
  bandwidth: number;
}

interface S11DataPoint {
  frequency: number;
  s11_db: number;
}

interface OptimizationResult {
  iteration: number;
  frequency: number;
  length: number;
  radius: number;
  s11: number;
  timestamp: Date;
}

interface OptimizationParams {
  targetFrequency: number;
  targetS11: number;
  method: 'gradient' | 'random' | 'bayesian';
}

function App() {
  const [showLanding, setShowLanding] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [chartData, setChartData] = useState<S11DataPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ resonantFreq: number; minS11: number; bandwidth: number } | null>(null);
  const [simTime, setSimTime] = useState<number | null>(null);
  const [impedanceData, setImpedanceData] = useState<{ real: number[]; imag: number[]; freq: number[] }>({ real: [], imag: [], freq: [] });
  const [activeTab, setActiveTab] = useState('s-parameters');

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState(0);
  const [optimizationResults, setOptimizationResults] = useState<OptimizationResult[]>([]);
  const optimizationAbortRef = useRef(false);

  const defaultParams: AntennaParameters = {
    antennaType: 'dipole',
    frequency: 145,
    length: 1034,
    radius: 1,
    height: 0,
    material: 'copper',
  };

  const [params, setParams] = useState(defaultParams);

  const runSweep = useCallback(async (formParams: AntennaParameters): Promise<SimulateResponse> => {
    const centerFreqHz = formParams.frequency * 1e6;
    const freqStart = centerFreqHz * 0.5;
    const freqStop = centerFreqHz * 1.5;

    return invoke<SimulateResponse>('simulate_sweep', {
      antenna_type: formParams.antennaType,
      freq_start: freqStart,
      freq_stop: freqStop,
      freq_points: 101,
    });
  }, []);

  const handleSubmit = useCallback(async (formParams: AntennaParameters) => {
    setIsSimulating(true);
    setError(null);
    setSummary(null);
    const t0 = performance.now();

    try {
      const result = await runSweep(formParams);

      setSimTime(Math.round(performance.now() - t0));

      const data: S11DataPoint[] = result.frequencies.map((f: number, i: number) => ({
        frequency: f / 1e6,
        s11_db: result.s11Db[i],
      }));

      setChartData(data);
      setImpedanceData({
        real: result.impedanceReal,
        imag: result.impedanceImag,
        freq: result.frequencies,
      });
      setSummary({
        resonantFreq: result.resonantFreq,
        minS11: result.minS11,
        bandwidth: result.bandwidth,
      });
    } catch (e: any) {
      setError(typeof e === 'string' ? e : e.message || 'Simulation failed');
    } finally {
      setIsSimulating(false);
    }
  }, [runSweep]);

  const handleStartOptimization = useCallback(async (optParams: OptimizationParams) => {
    setIsOptimizing(true);
    setOptimizationProgress(0);
    setOptimizationResults([]);
    optimizationAbortRef.current = false;

    const totalSteps = 10;
    const baseLength = params.length;
    const baseRadius = params.radius;
    const results: OptimizationResult[] = [];

    for (let step = 0; step < totalSteps; step++) {
      if (optimizationAbortRef.current) break;

      const bestS11SoFar = results.length > 0
        ? Math.min(...results.map(r => r.s11))
        : 0;
      const bestIdx = results.findIndex(r => r.s11 === bestS11SoFar);
      const refLength = bestIdx >= 0 ? results[bestIdx].length * 1000 : baseLength;
      const refRadius = bestIdx >= 0 ? results[bestIdx].radius * 1000 : baseRadius;

      const perturbScale = optParams.method === 'random' ? 0.15 : 0.05;
      const trialLength = refLength * (1 + (Math.random() - 0.5) * perturbScale);
      const trialRadius = refRadius * (1 + (Math.random() - 0.5) * perturbScale);

      try {
        const result = await runSweep({
          ...params,
          frequency: optParams.targetFrequency,
          length: trialLength,
          radius: trialRadius,
        });

        const optResult: OptimizationResult = {
          iteration: step + 1,
          frequency: optParams.targetFrequency,
          length: trialLength / 1000,
          radius: trialRadius / 1000,
          s11: result.minS11,
          timestamp: new Date(),
        };

        results.push(optResult);
        setOptimizationResults([...results]);
        setOptimizationProgress(((step + 1) / totalSteps) * 100);

        const best = results.reduce((a, b) => a.s11 < b.s11 ? a : b);
        if (optResult === best) {
          const data: S11DataPoint[] = result.frequencies.map((f: number, i: number) => ({
            frequency: f / 1e6,
            s11_db: result.s11Db[i],
          }));
          setChartData(data);
          setImpedanceData({
            real: result.impedanceReal,
            imag: result.impedanceImag,
            freq: result.frequencies,
          });
          setSummary({
            resonantFreq: result.resonantFreq,
            minS11: result.minS11,
            bandwidth: result.bandwidth,
          });
        }
      } catch {
        // skip failed iteration
      }
    }

    setIsOptimizing(false);
  }, [params, runSweep]);

  const handleStopOptimization = useCallback(() => {
    optimizationAbortRef.current = true;
    setIsOptimizing(false);
  }, []);

  const formatFreq = (hz: number) => {
    if (hz >= 1e9) return `${(hz / 1e9).toFixed(2)} GHz`;
    if (hz >= 1e6) return `${(hz / 1e6).toFixed(2)} MHz`;
    return `${(hz / 1e3).toFixed(1)} kHz`;
  };

  const vswr = summary ? (() => {
    const s11lin = Math.pow(10, summary.minS11 / 20);
    return ((1 + s11lin) / (1 - s11lin)).toFixed(2);
  })() : null;

  if (showLanding) {
    return <LandingPage onLaunch={() => setShowLanding(false)} />;
  }

  return (
    <div className="flex h-screen bg-background text-text overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-surface border-r border-border flex flex-col overflow-auto">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-border flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-accent to-accent-hover rounded-lg flex items-center justify-center text-lg font-bold text-white">
            P
          </div>
          <div>
            <div className="text-base font-bold text-white tracking-tight">PROMIN</div>
            <div className="text-[11px] text-text-dim mt-0.5">Antenna Studio v0.2</div>
          </div>
        </div>

        {/* Antenna Form */}
        <AntennaForm
          parameters={params}
          onParametersChange={setParams}
          onSubmit={handleSubmit}
          isSimulating={isSimulating}
        />

        {/* Frequency Presets */}
        <div className="px-6 py-3 border-t border-border">
          <FrequencyPresets
            onSelect={(freq) => setParams(p => ({ ...p, frequency: freq }))}
            disabled={isSimulating || isOptimizing}
          />
        </div>

        {/* Optimization Panel */}
        <div className="border-t border-border">
          <OptimizationPanel
            onStartOptimization={handleStartOptimization}
            onStopOptimization={handleStopOptimization}
            isOptimizing={isOptimizing}
            progress={optimizationProgress}
            results={optimizationResults}
          />
        </div>

        {/* Solver Info */}
        <div className="px-6 py-4 border-t border-border mt-auto">
          <div className="text-[11px] text-text-dim leading-relaxed">
            Solver: Method of Moments (MoM)
            <br />Engine: Rust + rayon parallel
            <br />{isTauri ? 'Mode: Native (Tauri)' : 'Mode: Browser Preview'}
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-auto">
        {/* Top Bar */}
        <div className="px-6 py-3 border-b border-border flex items-center justify-between bg-[#0e0e15]">
          <div className="flex gap-2 items-center">
            <span className="text-sm font-semibold">Simulation Results</span>
            {isSimulating && (
              <Badge variant="warning">
                <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                Running...
              </Badge>
            )}
            {isOptimizing && (
              <Badge variant="purple">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                Optimizing...
              </Badge>
            )}
            {summary && !isSimulating && !isOptimizing && (
              <Badge variant="success">Complete</Badge>
            )}
          </div>
          <div className="flex gap-3 items-center text-xs text-text-dim">
            {simTime && <span>Time: {simTime}ms</span>}
            <span>Points: {chartData.length || '-'}</span>
            {chartData.length > 0 && (
              <ExportPanel
                frequencies={impedanceData.freq}
                s11Db={chartData.map(d => d.s11_db)}
                s11Real={impedanceData.real.map((_, i) => {
                  const s11lin = Math.pow(10, chartData[i]?.s11_db / 20);
                  return s11lin * Math.cos(0);
                })}
                s11Imag={impedanceData.real.map((_, i) => {
                  const s11lin = Math.pow(10, chartData[i]?.s11_db / 20);
                  return s11lin * Math.sin(0);
                })}
                impedanceReal={impedanceData.real}
                impedanceImag={impedanceData.imag}
                disabled={isSimulating}
              />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 flex flex-col gap-5">
          {error && (
            <div className="px-4 py-3 bg-error/10 border border-error/30 rounded-lg text-error text-[13px]">
              {error}
            </div>
          )}

          {summary ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList>
                <TabsTrigger value="s-parameters">S-Parameters</TabsTrigger>
                <TabsTrigger value="impedance">Impedance</TabsTrigger>
                <TabsTrigger value="3d-view">3D View</TabsTrigger>
                <TabsTrigger value="optimization">Optimization</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="s-parameters" className="flex-1 flex flex-col gap-5">
                {/* Stats Cards */}
                <div className="grid grid-cols-4 gap-3">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-1.5">
                        <Radio className="w-3.5 h-3.5 text-accent" />
                        Resonant Freq
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-accent tabular-nums">
                        {formatFreq(summary.resonantFreq)}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-1.5">
                        <Activity className="w-3.5 h-3.5 text-success" />
                        Min S11
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-success tabular-nums">
                        {summary.minS11.toFixed(1)} dB
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-warning" />
                        VSWR
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-warning tabular-nums">
                        {vswr}:1
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-1.5">
                        <Signal className="w-3.5 h-3.5 text-info" />
                        BW (-10dB)
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold text-info tabular-nums">
                        {formatFreq(summary.bandwidth)}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* S11 Chart */}
                <div className="bg-surface border border-border rounded-lg p-5 flex-1 min-h-[400px] flex flex-col">
                  <S11Chart data={chartData} />
                </div>
              </TabsContent>

              <TabsContent value="impedance" className="flex-1 flex flex-col">
                <div className="bg-surface border border-border rounded-lg p-5 flex-1 flex items-center justify-center">
                  <SmithChart
                    impedancePoints={impedanceData.real.map((re, i) => ({
                      re,
                      im: impedanceData.imag[i],
                      freq: impedanceData.freq[i],
                    }))}
                  />
                </div>
              </TabsContent>

              <TabsContent value="3d-view" className="flex-1 flex flex-col">
                <div className="bg-surface border border-border rounded-lg flex-1 min-h-[400px] overflow-hidden">
                  <AntennaViewport
                    antennaType={params.antennaType}
                    length={params.length / 1000}
                    frequency={params.frequency * 1e6}
                    radius={params.radius / 1000}
                    className="h-full"
                  />
                </div>
              </TabsContent>

              <TabsContent value="optimization" className="flex-1 flex flex-col">
                <OptimizationPanel
                  onStartOptimization={handleStartOptimization}
                  onStopOptimization={handleStopOptimization}
                  isOptimizing={isOptimizing}
                  progress={optimizationProgress}
                  results={optimizationResults}
                />
              </TabsContent>

              <TabsContent value="history" className="flex-1 flex flex-col">
                <SimulationHistory
                  onLoadHistory={(item: HistoryItem) => {
                    setParams(item.parameters);
                    handleSubmit(item.parameters);
                  }}
                  className="flex-1"
                />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-text-dim">
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <rect x="8" y="40" width="4" height="16" rx="2" fill="#1e1e2e" />
                <rect x="16" y="28" width="4" height="28" rx="2" fill="#1e1e2e" />
                <rect x="24" y="20" width="4" height="36" rx="2" fill="#2a2a3e" />
                <rect x="32" y="8" width="4" height="48" rx="2" fill="#6366f1" opacity="0.5" />
                <rect x="40" y="20" width="4" height="36" rx="2" fill="#2a2a3e" />
                <rect x="48" y="28" width="4" height="28" rx="2" fill="#1e1e2e" />
                <rect x="56" y="40" width="4" height="16" rx="2" fill="#1e1e2e" />
              </svg>
              <div className="text-base font-semibold text-text-dim">No Simulation Data</div>
              <div className="text-[13px] max-w-[300px] text-center leading-relaxed">
                Select an antenna type, configure parameters, and click "Run Simulation" to analyze S-parameters.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
