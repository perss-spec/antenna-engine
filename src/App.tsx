import { useState, useCallback, useRef } from 'react';
import { Activity, Radio, Zap, Signal } from 'lucide-react';
import AntennaForm from './components/AntennaForm/AntennaForm';
import S11Chart from './components/S11Chart/S11Chart';
import SmithChart from './components/SmithChart/SmithChart';
import OptimizationPanel from './components/OptimizationPanel/OptimizationPanel';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

const isTauri = '__TAURI_INTERNALS__' in window;
const invoke = isTauri
  ? (await import('@tauri-apps/api/core')).invoke
  : async (_cmd: string, args: any): Promise<any> => {
      await new Promise(r => setTimeout(r, 800));
      const req = (args as any).request;
      const n = req.freqPoints || 101;
      const fStart = req.freqStart;
      const fStop = req.freqStop;
      const fCenter = (fStart + fStop) / 2;
      const frequencies: number[] = [];
      const s11Db: number[] = [];
      const s11Real: number[] = [];
      const s11Imag: number[] = [];
      const impedanceReal: number[] = [];
      const impedanceImag: number[] = [];
      for (let i = 0; i < n; i++) {
        const f = fStart + (fStop - fStart) * i / (n - 1);
        frequencies.push(f);
        const delta = (f - fCenter) / fCenter;
        const s11 = -25 * Math.exp(-200 * delta * delta) - 2;
        s11Db.push(s11);
        s11Real.push(Math.pow(10, s11 / 20) * Math.cos(delta * 10));
        s11Imag.push(Math.pow(10, s11 / 20) * Math.sin(delta * 10));
        impedanceReal.push(73 + 100 * delta);
        impedanceImag.push(42.5 * delta * 10);
      }
      const minIdx = s11Db.indexOf(Math.min(...s11Db));
      return {
        frequencies, s11Db, s11Real, s11Imag, impedanceReal, impedanceImag,
        resonantFreq: frequencies[minIdx],
        minS11: s11Db[minIdx],
        bandwidth: (fStop - fStart) * 0.15,
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

  const defaultParams = {
    frequency: 1000,
    length: 150,
    radius: 1,
    height: 0,
    material: 'copper',
  };

  const [params, setParams] = useState(defaultParams);

  const runSimulation = useCallback(async (formParams: typeof defaultParams): Promise<SimulateResponse> => {
    const centerFreqHz = formParams.frequency * 1e6;
    const freqStart = centerFreqHz * 0.5;
    const freqStop = centerFreqHz * 1.5;

    return invoke<SimulateResponse>('simulate_antenna', {
      request: {
        elementType: 'dipole',
        params: {
          length: formParams.length / 1000,
          radius: formParams.radius / 1000,
        },
        freqStart,
        freqStop,
        freqPoints: 101,
      },
    });
  }, []);

  const handleSubmit = useCallback(async (formParams: typeof defaultParams) => {
    setIsSimulating(true);
    setError(null);
    setSummary(null);
    const t0 = performance.now();

    try {
      const result = await runSimulation(formParams);

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
  }, [runSimulation]);

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
        const result = await runSimulation({
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
  }, [params, runSimulation]);

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
            <div className="text-[11px] text-text-dim mt-0.5">Antenna Studio v0.1</div>
          </div>
        </div>

        {/* Antenna Form */}
        <AntennaForm
          parameters={params}
          onParametersChange={setParams}
          onSubmit={handleSubmit}
          isSimulating={isSimulating}
        />

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
            <br />Engine: Rust + WebGPU
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
          <div className="flex gap-3 text-xs text-text-dim">
            {simTime && <span>Time: {simTime}ms</span>}
            <span>Points: {chartData.length || '-'}</span>
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
                <TabsTrigger value="optimization">Optimization</TabsTrigger>
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
                    impedanceReal={impedanceData.real}
                    impedanceImag={impedanceData.imag}
                    frequency={impedanceData.freq}
                    width={380}
                    height={380}
                    title="Smith Chart"
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
                Configure antenna parameters and click "Run Simulation" to see S11 return loss results.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
