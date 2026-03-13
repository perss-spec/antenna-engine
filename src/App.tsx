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
import { RadiationPatternView } from './components/RadiationPatternView';
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

      // simulate_sweep mock — parametrized by antenna dimensions
      const C0 = 299792458;
      const antennaType = a.antenna_type || a.antennaType || 'dipole';
      const fStart = a.freq_start || a.freqStart;
      const fStop = a.freq_stop || a.freqStop;
      const n = a.freq_points || a.freqPoints || 101;
      const ap = a.antenna_params || {};

      // Compute resonant frequency from physical dimensions
      const getResonance = (): { fRes: number; zrBase: number; ziScale: number; zrScale: number } => {
        switch (antennaType) {
          case 'monopole': {
            const h = ap.height_m || C0 / ((fStart + fStop) / 2) / 4;
            return { fRes: C0 / (4 * h), zrBase: 36.5, ziScale: 21.25, zrScale: 20.0 };
          }
          case 'patch': {
            const er = ap.substrate_er || 4.4;
            const h = ap.substrate_height_m || 0.0016;
            const w = ap.width_m || C0 / (2 * ((fStart + fStop) / 2)) * Math.sqrt(2 / (er + 1));
            const erEff = (er + 1) / 2 + (er - 1) / 2 * Math.pow(1 + 12 * h / w, -0.5);
            const pLen = ap.length_m || C0 / (2 * ((fStart + fStop) / 2) * Math.sqrt(erEff));
            const fRes = C0 / (2 * pLen * Math.sqrt(erEff));
            return { fRes, zrBase: 200, ziScale: 0, zrScale: 0 }; // patch uses Q model below
          }
          case 'qfh': {
            const h = ap.height_m || C0 / ((fStart + fStop) / 2) * 0.26;
            return { fRes: C0 / (4 * h), zrBase: 50.0, ziScale: 25.0, zrScale: 15.0 };
          }
          case 'yagi': {
            const dl = ap.length_m || C0 / ((fStart + fStop) / 2) / 2;
            return { fRes: C0 / (2 * dl), zrBase: 25.0, ziScale: 10.0, zrScale: 15.0 };
          }
          default: { // dipole
            const l = ap.length_m || C0 / ((fStart + fStop) / 2) / 2;
            return { fRes: C0 / (2 * l), zrBase: 73.0, ziScale: 42.5, zrScale: 40.0 };
          }
        }
      };

      const { fRes, zrBase, ziScale, zrScale } = getResonance();
      const isPatch = antennaType === 'patch';

      const frequencies: number[] = [];
      const s11Db: number[] = [];
      const s11Real: number[] = [];
      const s11Imag: number[] = [];
      const impedanceReal: number[] = [];
      const impedanceImag: number[] = [];

      for (let i = 0; i < n; i++) {
        const f = fStart + (fStop - fStart) * i / (n - 1);
        const ratio = f / fRes;
        frequencies.push(f);

        let zr: number, zi: number;
        if (isPatch) {
          const er = ap.substrate_er || 4.4;
          const h = ap.substrate_height_m || 0.0016;
          const w = ap.width_m || C0 / (2 * f) * Math.sqrt(2 / (er + 1));
          const erEff = (er + 1) / 2 + (er - 1) / 2 * Math.pow(1 + 12 * h / w, -0.5);
          const Q = C0 / (4 * f * h * Math.sqrt(erEff));
          const detuning = ratio - 1 / ratio;
          zr = 200 / (1 + Q * Q * detuning * detuning);
          zi = zr * Q * detuning;
        } else {
          zr = zrBase + zrScale * Math.pow(ratio - 1, 2);
          zi = ziScale * (ratio - 1) * ratio;
        }

        impedanceReal.push(zr);
        impedanceImag.push(zi);

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
  const [s11Data, setS11Data] = useState<{ real: number[]; imag: number[] }>({ real: [], imag: [] });
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

    // Build antenna_params with physical dimensions in meters
    const lengthM = formParams.length / 1000;
    const radiusM = formParams.radius / 1000;
    const heightM = formParams.height > 0 ? formParams.height / 1000 : lengthM;

    const antennaParams: Record<string, number> = {
      length_m: lengthM,
      radius_m: radiusM,
      height_m: formParams.antennaType === 'monopole' ? lengthM : heightM,
    };

    // Patch-specific params from form
    if (formParams.antennaType === 'patch') {
      antennaParams.substrate_er = formParams.substrateEr || 4.4;
      antennaParams.substrate_height_m = (formParams.substrateHeight || 1.6) / 1000;
      if (formParams.patchWidth) antennaParams.width_m = formParams.patchWidth / 1000;
    }

    return invoke<SimulateResponse>('simulate_sweep', {
      antenna_type: formParams.antennaType,
      freq_start: freqStart,
      freq_stop: freqStop,
      freq_points: 101,
      antenna_params: antennaParams,
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
      setS11Data({ real: result.s11Real, imag: result.s11Imag });
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

      // Save to history
      const historyItem: HistoryItem = {
        id: new Date().toISOString(),
        timestamp: Date.now(),
        parameters: formParams,
        result: { minS11: result.minS11, resonantFrequency: result.resonantFreq },
      };
      try {
        const existing: HistoryItem[] = JSON.parse(localStorage.getItem('promin_simulation_history') || '[]');
        existing.push(historyItem);
        localStorage.setItem('promin_simulation_history', JSON.stringify(existing.slice(-50)));
      } catch { /* localStorage full or unavailable */ }
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

    const totalSteps = 15;
    let curLength = params.length;
    let curRadius = params.radius;
    let curS11 = 0;
    const results: OptimizationResult[] = [];

    const evaluate = async (len: number, rad: number) => {
      return runSweep({ ...params, frequency: optParams.targetFrequency, length: len, radius: rad });
    };

    // Initial evaluation
    try {
      const init = await evaluate(curLength, curRadius);
      curS11 = init.minS11;
    } catch { /* use 0 */ }

    for (let step = 0; step < totalSteps; step++) {
      if (optimizationAbortRef.current) break;

      let trialLength: number, trialRadius: number;

      if (optParams.method === 'gradient') {
        // Finite-difference gradient descent
        const eps = curLength * 0.005; // 0.5% perturbation for gradient
        const stepSize = curLength * 0.02; // 2% step
        try {
          const rPlus = await evaluate(curLength + eps, curRadius);
          const rMinus = await evaluate(curLength - eps, curRadius);
          const grad = (rPlus.minS11 - rMinus.minS11) / (2 * eps); // want to minimize S11
          trialLength = curLength - stepSize * Math.sign(grad);
          trialRadius = curRadius;
        } catch {
          trialLength = curLength * (1 + (Math.random() - 0.5) * 0.05);
          trialRadius = curRadius;
        }
      } else if (optParams.method === 'bayesian') {
        // Narrowing search: start wide, converge
        const scale = 0.15 * Math.pow(0.7, step); // shrink each iteration
        const bestResult = results.length > 0
          ? results.reduce((a, b) => a.s11 < b.s11 ? a : b)
          : null;
        const refLen = bestResult ? bestResult.length * 1000 : curLength;
        const refRad = bestResult ? bestResult.radius * 1000 : curRadius;
        trialLength = refLen * (1 + (Math.random() - 0.5) * scale);
        trialRadius = refRad * (1 + (Math.random() - 0.5) * scale);
      } else {
        // Random search
        trialLength = curLength * (1 + (Math.random() - 0.5) * 0.15);
        trialRadius = curRadius * (1 + (Math.random() - 0.5) * 0.15);
      }

      try {
        const result = await evaluate(trialLength, trialRadius);

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

        // Update current best for gradient descent
        if (result.minS11 < curS11) {
          curS11 = result.minS11;
          curLength = trialLength;
          curRadius = trialRadius;

          const data: S11DataPoint[] = result.frequencies.map((f: number, i: number) => ({
            frequency: f / 1e6,
            s11_db: result.s11Db[i],
          }));
          setChartData(data);
          setS11Data({ real: result.s11Real, imag: result.s11Imag });
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
            <div className="text-[11px] text-text-dim mt-0.5">Antenna Studio v0.3</div>
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
        <div className="px-6 py-3 border-b border-border flex items-center justify-between bg-background">
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
            {!isTauri && (
              <span className="text-warning">Browser Preview</span>
            )}
            {simTime && <span>Time: {simTime}ms</span>}
            <span>Points: {chartData.length || '-'}</span>
            {chartData.length > 0 && (
              <ExportPanel
                frequencies={impedanceData.freq}
                s11Db={chartData.map(d => d.s11_db)}
                s11Real={s11Data.real}
                s11Imag={s11Data.imag}
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
                <TabsTrigger value="radiation">Radiation</TabsTrigger>
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

              <TabsContent value="radiation" className="flex-1 flex flex-col">
                <RadiationPatternView
                  antennaType={params.antennaType}
                  frequency={params.frequency * 1e6}
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
