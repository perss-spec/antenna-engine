import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { Activity, Radio, Zap, Signal, ChevronDown } from 'lucide-react';
import { Group as PanelGroup, Panel, Separator as PanelResizeHandle } from 'react-resizable-panels';
import AntennaForm from './components/AntennaForm/AntennaForm';
import type { AntennaParameters } from './components/AntennaForm/AntennaForm';
import { getCategoryForId } from '@/lib/antennaKB';
import S11Chart from './components/S11Chart/S11Chart';
import SmithChart from './components/SmithChart/SmithChart';
import VswrChart from './components/VswrChart/VswrChart';
import ImpedanceChart from './components/ImpedanceChart/ImpedanceChart';
import OptimizationPanel from './components/OptimizationPanel/OptimizationPanel';
import FrequencyPresets from './components/FrequencyPresets/FrequencyPresets';
import SimulationHistory from './components/SimulationHistory/SimulationHistory';
import type { HistoryItem } from './components/SimulationHistory/SimulationHistory';
import AntennaViewport from './viewport/AntennaViewport';
import { RadiationPatternView } from './components/RadiationPatternView';
import ExportPanel from './components/ExportPanel/ExportPanel';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select } from '@/components/ui/select';
import { LandingPage } from '@/components/landing/LandingPage';
import FileImport from './components/FileImport/FileImport';
import { SolverPanel } from './components/SolverPanel/SolverPanel';
import { MeshViewer } from './viewport/MeshViewer';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { solveByCategory } from '@/lib/impedanceSolver';
import { api } from '@/lib/api';
import {
  fromSimulateResponse,
  fromSingleSolve,
  fromSweepResult,
  toS11ChartData,
  toSmithData,
  toVswrData,
  toImpedanceChartData,
  type UnifiedSimResults,
} from '@/lib/unifiedResults';
import {
  applyTheme,
  persistTheme,
  readStoredTheme,
  watchSystemTheme,
  type ThemePreference,
} from '@/lib/theme';
import { useT, type Locale } from '@/lib/i18n';

const isTauri = '__TAURI_INTERNALS__' in window;

// Check server once at startup, cache result
let _serverChecked = false;
let _serverOk = false;
async function checkServer() {
  if (_serverChecked) return _serverOk;
  _serverChecked = true;
  _serverOk = await api.isServerAvailable();
  if (_serverOk) console.log('[PROMIN] Server connected:', api);
  else console.log('[PROMIN] Server unavailable, using local JS solver');
  return _serverOk;
}

// Server-first sweep: try Axum API, fallback to local JS
async function serverSweep(antennaType: string, fStart: number, fStop: number, n: number, ap: Record<string, number>): Promise<SimulateResponse> {
  const hasServer = await checkServer();
  if (!hasServer) return localSweep(antennaType, fStart, fStop, n, ap);

  try {
    const resp = await api.sweep({
      antenna_type: antennaType,
      freq_start: fStart,
      freq_stop: fStop,
      freq_points: n,
      parameters: ap,
    });
    const minIdx = resp.s11_db.indexOf(Math.min(...resp.s11_db));
    const bwIndices = resp.s11_db.map((v: number, i: number) => v <= -10 ? i : -1).filter((i: number) => i >= 0);
    const bandwidth = bwIndices.length >= 2
      ? resp.frequencies[bwIndices[bwIndices.length - 1]] - resp.frequencies[bwIndices[0]]
      : 0;
    return {
      frequencies: resp.frequencies,
      s11Db: resp.s11_db,
      s11Real: resp.s11_real,
      s11Imag: resp.s11_imag,
      impedanceReal: resp.impedance_real,
      impedanceImag: resp.impedance_imag,
      resonantFreq: resp.frequencies[minIdx],
      minS11: resp.s11_db[minIdx],
      bandwidth,
    };
  } catch {
    // Server error — fallback to local JS solver
    _serverChecked = false; // retry next time
    return localSweep(antennaType, fStart, fStop, n, ap);
  }
}

function localSweep(antennaType: string, fStart: number, fStop: number, n: number, ap: Record<string, number>): SimulateResponse {
  const C0 = 299792458;
  const category = getCategoryForId(antennaType);
  const frequencies: number[] = [];
  const s11Db: number[] = [];
  const s11Real: number[] = [];
  const s11Imag: number[] = [];
  const impedanceReal: number[] = [];
  const impedanceImag: number[] = [];

  for (let i = 0; i < n; i++) {
    const f = fStart + (fStop - fStart) * i / (n - 1);
    const lambda = C0 / f;
    const k = 2 * Math.PI / lambda;
    frequencies.push(f);

    const [zr, zi] = solveByCategory(category, antennaType, ap, f, lambda, k);
    impedanceReal.push(zr);
    impedanceImag.push(zi);

    const dr = zr + 50, di = zi;
    const dMag2 = dr * dr + di * di;
    const gr = ((zr - 50) * dr + zi * di) / dMag2;
    const gi = (zi * dr - (zr - 50) * di) / dMag2;
    const gMag2 = gr * gr + gi * gi;
    s11Db.push(10 * Math.log10(gMag2 || 1e-20));
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
}

const invoke = isTauri
  ? (await import('@tauri-apps/api/core')).invoke
  : async (_cmd: string, args: any): Promise<any> => {
      if (_cmd === 'get_antenna_templates') {
        const { ANTENNA_PRESETS: presets } = await import('@/lib/antennaKB');
        return presets.map((p: any) => ({
          id: p.id, name: p.name, type: p.category, default_frequency: p.frequency * 1e6,
        }));
      }
      const a = args as any;
      return serverSweep(
        a.antenna_type || 'dipole',
        a.freq_start || a.freqStart,
        a.freq_stop || a.freqStop,
        a.freq_points || a.freqPoints || 101,
        a.antenna_params || {},
      );
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
  method: 'gradient' | 'random' | 'nelder_mead';
}

function SidebarSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-[11px] font-semibold uppercase tracking-widest text-text-dim hover:text-text-muted transition-colors"
      >
        {title}
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="pb-4" style={{ animation: 'fadeIn 0.15s ease-out' }}>{children}</div>}
    </div>
  );
}

function App() {
  const { t, locale, setLocale } = useT();
  const [showLanding, setShowLanding] = useState(true);
  const [themePreference, setThemePreference] = useState<ThemePreference>(() => readStoredTheme());
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [simTime, setSimTime] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('s-parameters');

  // Unified results (single source of truth)
  const [results, setResults] = useState<UnifiedSimResults | null>(null);
  const [comparisonResults, setComparisonResults] = useState<UnifiedSimResults | null>(null);

  // Derived data via useMemo
  const chartData = useMemo(() => results ? toS11ChartData(results) : [], [results]);
  const smithData = useMemo(() => results ? toSmithData(results) : [], [results]);
  const vswrData = useMemo(() => results ? toVswrData(results) : [], [results]);
  const impedanceChartData = useMemo(() => results ? toImpedanceChartData(results) : [], [results]);
  const compChartData = useMemo(() => comparisonResults ? toS11ChartData(comparisonResults) : undefined, [comparisonResults]);
  const compVswrData = useMemo(() => comparisonResults ? toVswrData(comparisonResults) : undefined, [comparisonResults]);
  const compImpedanceData = useMemo(() => comparisonResults ? toImpedanceChartData(comparisonResults) : undefined, [comparisonResults]);
  const summary = useMemo(() => results ? { resonantFreq: results.resonantFreq, minS11: results.minS11, bandwidth: results.bandwidth } : null, [results]);

  // Backward-compatible accessors for ExportPanel
  const impedanceData = useMemo(() => results ? { real: results.impedanceReal, imag: results.impedanceImag, freq: results.frequencies } : { real: [], imag: [], freq: [] }, [results]);
  const s11Data = useMemo(() => results ? { real: results.s11Real, imag: results.s11Imag } : { real: [], imag: [] }, [results]);

  // Mesh import state
  const [importedMesh, setImportedMesh] = useState<{
    vertices: number; triangles: number; segments: number;
    file_path: string; file_name: string; file_size: number; format: string;
  } | null>(null);
  const [meshViewMode, setMeshViewMode] = useState<'wireframe' | 'solid' | 'transparent'>('solid');

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState(0);
  const [optimizationResults, setOptimizationResults] = useState<OptimizationResult[]>([]);
  const optimizationAbortRef = useRef(false);

  const defaultParams: AntennaParameters = {
    antennaType: 'half_wave_dipole',
    frequency: 145,
    length: 1034,
    radius: 1,
    height: 0,
    material: 'copper',
    extraParams: {},
  };

  const [params, setParams] = useState(defaultParams);

  useEffect(() => {
    applyTheme(themePreference);
    persistTheme(themePreference);
  }, [themePreference]);

  useEffect(() => {
    if (themePreference !== 'system') return;
    return watchSystemTheme(() => applyTheme('system'));
  }, [themePreference]);

  const runSweep = useCallback(async (formParams: AntennaParameters): Promise<SimulateResponse> => {
    const centerFreqHz = formParams.frequency * 1e6;
    const freqStart = centerFreqHz * 0.5;
    const freqStop = centerFreqHz * 1.5;

    // Build antenna_params with physical dimensions in meters
    const lengthM = formParams.length / 1000;
    const radiusM = formParams.radius / 1000;
    const heightM = formParams.height > 0 ? formParams.height / 1000 : lengthM;

    const cat = getCategoryForId(formParams.antennaType);
    const antennaParams: Record<string, number> = {
      length_m: lengthM,
      radius_m: radiusM,
      height_m: cat === 'wire' && formParams.antennaType.includes('monopole') ? lengthM : heightM,
    };

    // Microstrip params
    if (cat === 'microstrip') {
      antennaParams.substrate_er = formParams.substrateEr || 4.4;
      antennaParams.substrate_height_m = (formParams.substrateHeight || 1.6) / 1000;
      if (formParams.patchWidth) antennaParams.width_m = formParams.patchWidth / 1000;
    }

    // Extra KB params
    if (formParams.extraParams) {
      for (const [key, val] of Object.entries(formParams.extraParams)) {
        if (val !== 0) antennaParams[key] = val;
      }
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
    setResults(null);
    setComparisonResults(null);
    const t0 = performance.now();

    try {
      const result = await runSweep(formParams);
      setSimTime(Math.round(performance.now() - t0));
      setResults(fromSimulateResponse(result));

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

    const totalSteps = 25;
    let curLength = params.length;
    let curRadius = params.radius;
    let curS11 = 0;
    const results: OptimizationResult[] = [];
    let convergedCount = 0;

    const evaluate = async (len: number, rad: number) => {
      return runSweep({ ...params, frequency: optParams.targetFrequency, length: len, radius: rad });
    };

    const updateBest = (result: SimulateResponse, len: number, rad: number) => {
      curS11 = result.minS11;
      curLength = len;
      curRadius = rad;
      setResults(fromSimulateResponse(result));
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
        // 2D gradient with backtracking line search
        const eps = curLength * 0.005;
        try {
          const rPlusL = await evaluate(curLength + eps, curRadius);
          const rMinusL = await evaluate(curLength - eps, curRadius);
          const gradL = (rPlusL.minS11 - rMinusL.minS11) / (2 * eps);
          const epsR = curRadius * 0.01;
          const rPlusR = await evaluate(curLength, curRadius + epsR);
          const rMinusR = await evaluate(curLength, curRadius - epsR);
          const gradR = (rPlusR.minS11 - rMinusR.minS11) / (2 * epsR);
          // Backtracking line search (Armijo)
          let alpha = 0.05 * curLength;
          const gradNorm = Math.sqrt(gradL * gradL + gradR * gradR) || 1e-10;
          for (let ls = 0; ls < 8; ls++) {
            const tL = curLength - alpha * gradL / gradNorm * curLength * 0.02;
            const tR = curRadius - alpha * gradR / gradNorm * curRadius * 0.02;
            const trial = await evaluate(Math.max(tL, 1), Math.max(tR, 0.01));
            if (trial.minS11 < curS11 - 1e-4 * alpha * gradNorm) {
              trialLength = tL;
              trialRadius = tR;
              break;
            }
            alpha *= 0.5;
          }
          trialLength = trialLength! ?? curLength * (1 + (Math.random() - 0.5) * 0.03);
          trialRadius = trialRadius! ?? curRadius;
        } catch {
          trialLength = curLength * (1 + (Math.random() - 0.5) * 0.05);
          trialRadius = curRadius;
        }
      } else if (optParams.method === 'nelder_mead') {
        // Nelder-Mead simplex for 2D (length, radius)
        if (step === 0) {
          // Initialize simplex: 3 vertices
          const p0 = [curLength, curRadius];
          const p1 = [curLength * 1.05, curRadius];
          const p2 = [curLength, curRadius * 1.05];
          const vertices = [p0, p1, p2];
          const values = await Promise.all(vertices.map(v => evaluate(v[0], v[1]).then(r => r.minS11).catch(() => 0)));

          // Sort by objective value
          const indexed = vertices.map((v, idx) => ({ v, val: values[idx] })).sort((a, b) => a.val - b.val);
          // Centroid of best 2
          const cx = (indexed[0].v[0] + indexed[1].v[0]) / 2;
          const cr = (indexed[0].v[1] + indexed[1].v[1]) / 2;
          // Reflection
          trialLength = 2 * cx - indexed[2].v[0];
          trialRadius = 2 * cr - indexed[2].v[1];
          if (trialLength < 1) trialLength = 1;
          if (trialRadius < 0.01) trialRadius = 0.01;
        } else {
          // Subsequent steps: perturbation with shrinking scale
          const scale = 0.12 * Math.pow(0.75, step);
          const bestResult = results.length > 0 ? results.reduce((a, b) => a.s11 < b.s11 ? a : b) : null;
          const refLen = bestResult ? bestResult.length * 1000 : curLength;
          const refRad = bestResult ? bestResult.radius * 1000 : curRadius;
          trialLength = refLen * (1 + (Math.random() - 0.5) * scale);
          trialRadius = refRad * (1 + (Math.random() - 0.5) * scale);
        }
      } else {
        // Random search
        trialLength = curLength * (1 + (Math.random() - 0.5) * 0.15);
        trialRadius = curRadius * (1 + (Math.random() - 0.5) * 0.15);
      }

      try {
        const result = await evaluate(trialLength, trialRadius);
        const prevS11 = curS11;

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

        if (result.minS11 < curS11) {
          updateBest(result, trialLength, trialRadius);
        }

        // Convergence check: |ΔS11| < 0.01 dB for 3 consecutive steps
        if (Math.abs(result.minS11 - prevS11) < 0.01) {
          convergedCount++;
          if (convergedCount >= 3) break;
        } else {
          convergedCount = 0;
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

  const vswrValue = summary ? (() => {
    const s11lin = Math.pow(10, summary.minS11 / 20);
    return (1 + s11lin) / (1 - s11lin);
  })() : null;
  const vswr = vswrValue !== null ? vswrValue.toFixed(2) : null;
  const designHealth = useMemo(() => {
    if (!summary || vswrValue === null) return null;
    let score = 0;
    if (summary.minS11 <= -20) score += 2;
    else if (summary.minS11 <= -12) score += 1;
    if (vswrValue <= 1.5) score += 2;
    else if (vswrValue <= 2) score += 1;
    if (summary.bandwidth >= summary.resonantFreq * 0.08) score += 1;

    if (score >= 5) {
      return {
        label: 'Excellent match',
        hint: 'Ready for export and fabrication review.',
        color: 'text-success',
        bg: 'bg-success/10',
      };
    }
    if (score >= 3) {
      return {
        label: 'Good baseline',
        hint: 'Consider optimization to improve S11 or bandwidth.',
        color: 'text-info',
        bg: 'bg-info/10',
      };
    }
    return {
      label: 'Needs tuning',
      hint: 'Run optimization or adjust dimensions and re-simulate.',
      color: 'text-warning',
      bg: 'bg-warning/10',
    };
  }, [summary, vswrValue]);
  const workflowState = isOptimizing
    ? t('header.workflow.optimizing')
    : isSimulating
      ? t('header.workflow.simulating')
      : summary
        ? t('header.workflow.review')
        : t('header.workflow.configure');

  if (showLanding) {
    return <LandingPage onLaunch={() => setShowLanding(false)} />;
  }

  return (
    <div className="h-screen bg-base text-text-primary overflow-hidden flex flex-col">
      <div className="h-15 bg-surface border-b border-border flex items-center justify-between px-5 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-accent rounded-xl flex items-center justify-center text-sm font-bold text-white shadow-sm">
            P
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-[15px] font-bold tracking-tight">PROMIN Antenna Studio</span>
            <span className="text-[11px] text-text-dim">{workflowState}</span>
          </div>
          <span className="text-[11px] font-medium text-text-dim px-2 py-0.5 rounded bg-elevated border border-border ml-2">
            {isTauri ? 'Native' : 'v0.3'}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {isSimulating && (
            <Badge variant="warning">
              <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
              {t('header.running')}
            </Badge>
          )}
          {isOptimizing && (
            <Badge variant="purple">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              {t('header.optimizing')}
            </Badge>
          )}
          {summary && !isSimulating && !isOptimizing && <Badge variant="success">{t('header.done')}</Badge>}
          <div className="flex gap-3 items-center text-[12px] text-text-dim border-l border-border pl-3">
            {simTime && <span className="tabular-nums font-medium">{simTime}ms</span>}
            {chartData.length > 0 && <span className="tabular-nums">{chartData.length} pts</span>}
          </div>
          <Select
            size="sm"
            value={locale}
            onChange={(e) => setLocale(e.target.value as Locale)}
            className="w-[80px] h-8 text-[11px] bg-elevated border-border"
            aria-label="Language"
          >
            <option value="en">EN</option>
            <option value="uk">UK</option>
          </Select>
          <Select
            size="sm"
            value={themePreference}
            onChange={(e) => setThemePreference(e.target.value as ThemePreference)}
            className="w-[132px] h-8 text-[11px] bg-elevated border-border"
            aria-label="Theme"
          >
            <option value="light">{t('theme.light')}</option>
            <option value="dark">{t('theme.dark')}</option>
            <option value="system">{t('theme.system')}</option>
          </Select>
        </div>
      </div>

      <PanelGroup orientation="horizontal" className="flex-1">
        <Panel defaultSize="24%" minSize="19%" maxSize="34%">
          <div className="h-full bg-surface flex flex-col overflow-hidden border-r border-border">
            <div className="px-5 py-3.5 border-b border-border">
              <div className="text-[11px] uppercase tracking-wider text-text-dim">{t('sidebar.inputs')}</div>
              <div className="text-[12px] text-text-muted mt-1">Step 1: Configure, then run simulation</div>
            </div>
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
              <AntennaForm
                parameters={params}
                onParametersChange={setParams}
                onSubmit={handleSubmit}
                isSimulating={isSimulating}
              />

              <SidebarSection title={t('sidebar.presets')} defaultOpen>
                <div className="px-5">
                  <FrequencyPresets
                    onSelect={(freq) => setParams((p) => ({ ...p, frequency: freq }))}
                    disabled={isSimulating || isOptimizing}
                  />
                </div>
              </SidebarSection>

              <SidebarSection title={t('sidebar.solver')}>
                <div className="px-5">
                  <SolverPanel
                    antennaType={params.antennaType}
                    antennaParams={{ length_m: params.length / 1000, radius_m: params.radius / 1000 }}
                    frequency={params.frequency}
                    onSolveComplete={(r) =>
                      setResults(
                        fromSingleSolve(r, params.antennaType, {
                          length_m: params.length / 1000,
                          radius_m: params.radius / 1000,
                        })
                      )
                    }
                    onSweepComplete={(sweep) => setResults(fromSweepResult(sweep))}
                    onComparisonComplete={(a, b) => {
                      setResults(fromSweepResult(a));
                      setComparisonResults(fromSweepResult(b));
                    }}
                  />
                </div>
              </SidebarSection>

              <SidebarSection title={t('sidebar.optimization')}>
                <OptimizationPanel
                  onStartOptimization={handleStartOptimization}
                  onStopOptimization={handleStopOptimization}
                  isOptimizing={isOptimizing}
                  progress={optimizationProgress}
                  results={optimizationResults}
                />
              </SidebarSection>

              <SidebarSection title={t('sidebar.importCad')}>
                <div className="px-5">
                  <FileImport
                    onMeshImported={(mesh) => {
                      setImportedMesh(mesh);
                      setActiveTab('mesh');
                    }}
                    onError={(err) => setError(err)}
                  />
                </div>
              </SidebarSection>
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-1 bg-border hover:bg-accent active:bg-accent transition-colors duration-150 cursor-col-resize relative z-20 before:content-[''] before:absolute before:inset-y-0 before:-left-1.5 before:-right-1.5" />

        <Panel minSize="42%">
          <div className="h-full flex flex-col overflow-hidden">
            <div className="flex-1 p-4 xl:p-5 flex flex-col gap-4 min-h-0">
              {error && (
                <div className="px-4 py-3 bg-error/8 border border-error/20 rounded-xl text-error text-[13px] flex items-center gap-3">
                  <span className="w-2 h-2 rounded-full bg-error shrink-0" />
                  {error}
                </div>
              )}

              {summary ? (
                <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <div className="flex flex-col xl:flex-row gap-3 xl:items-start">
                    <div className="flex-1 flex flex-col gap-2">
                      <TabsList className="shrink-0 flex-wrap">
                        <TabsTrigger value="s-parameters">{t('tab.sParams')}</TabsTrigger>
                        <TabsTrigger value="vswr">{t('tab.vswr')}</TabsTrigger>
                        <TabsTrigger value="z-freq">{t('tab.zFreq')}</TabsTrigger>
                        <TabsTrigger value="impedance">{t('tab.impedance')}</TabsTrigger>
                        <TabsTrigger value="3d-view">{t('tab.3d')}</TabsTrigger>
                        <TabsTrigger value="radiation">{t('tab.radiation')}</TabsTrigger>
                        <TabsTrigger value="history">{t('tab.history')}</TabsTrigger>
                        {importedMesh && <TabsTrigger value="mesh">{t('tab.mesh')}</TabsTrigger>}
                      </TabsList>
                      {designHealth && (
                        <div className={`rounded-xl border border-border px-3 py-2 text-xs ${designHealth.bg}`}>
                          <span className={`font-semibold ${designHealth.color}`}>{designHealth.label}</span>
                          <span className="text-text-muted"> - {designHealth.hint}</span>
                        </div>
                      )}
                    </div>
                    {chartData.length > 0 && (
                      <div className="xl:w-[340px] w-full bg-surface border border-border rounded-xl p-3">
                        <div className="text-[11px] uppercase tracking-wider text-text-dim mb-2">Export</div>
                        <ExportPanel
                          frequencies={impedanceData.freq}
                          s11Db={chartData.map((d) => d.s11_db)}
                          s11Real={s11Data.real}
                          s11Imag={s11Data.imag}
                          impedanceReal={impedanceData.real}
                          impedanceImag={impedanceData.imag}
                          disabled={isSimulating}
                        />
                      </div>
                    )}
                  </div>

                  <TabsContent value="s-parameters" className="flex-1 flex flex-col gap-4 overflow-y-auto min-h-0">
                    <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                      {[
                        { icon: Radio, label: t('stat.resonantFreq'), value: formatFreq(summary.resonantFreq), iconBg: 'bg-accent/10', iconColor: 'text-accent', valueColor: 'text-accent' },
                        { icon: Activity, label: t('stat.minS11'), value: `${summary.minS11.toFixed(1)} dB`, iconBg: 'bg-success/10', iconColor: 'text-success', valueColor: 'text-success' },
                        { icon: Zap, label: t('stat.vswr'), value: `${vswr}:1`, iconBg: 'bg-warning/10', iconColor: 'text-warning', valueColor: 'text-warning' },
                        { icon: Signal, label: t('stat.bw'), value: formatFreq(summary.bandwidth), iconBg: 'bg-info/10', iconColor: 'text-info', valueColor: 'text-info' },
                      ].map(({ icon: Icon, label, value, iconBg, iconColor, valueColor }) => (
                        <div key={label} className="flex items-center gap-3.5 rounded-xl border border-border bg-surface px-4 py-4">
                          <div className={`w-10 h-10 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                            <Icon className={`w-[18px] h-[18px] ${iconColor}`} />
                          </div>
                          <div>
                            <div className="text-[11px] text-text-dim mb-0.5">{label}</div>
                            <div className={`text-[15px] font-semibold ${valueColor} tabular-nums leading-tight`}>{value}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="bg-surface border border-border rounded-xl p-4 flex-1 min-h-[300px] flex flex-col">
                      <S11Chart data={chartData} simulationData={compChartData} />
                    </div>
                  </TabsContent>

                  <TabsContent value="impedance" className="flex-1 flex flex-col overflow-y-auto min-h-0">
                    <div className="bg-surface border border-border rounded-xl p-4 flex-1 flex items-center justify-center">
                      <SmithChart impedancePoints={smithData} />
                    </div>
                  </TabsContent>

                  <TabsContent value="vswr" className="flex-1 flex flex-col overflow-y-auto min-h-0">
                    <div className="bg-surface border border-border rounded-xl p-4 flex-1 min-h-[300px] flex flex-col">
                      <VswrChart data={vswrData} comparisonData={compVswrData} />
                    </div>
                  </TabsContent>

                  <TabsContent value="z-freq" className="flex-1 flex flex-col overflow-y-auto min-h-0">
                    <div className="bg-surface border border-border rounded-xl p-4 flex-1 min-h-[300px] flex flex-col">
                      <ImpedanceChart data={impedanceChartData} comparisonData={compImpedanceData} />
                    </div>
                  </TabsContent>

                  <TabsContent value="3d-view" className="flex-1 flex flex-col overflow-y-auto min-h-0">
                    <div className="bg-surface border border-border rounded-xl flex-1 min-h-[300px] overflow-hidden">
                      <AntennaViewport
                        antennaType={params.antennaType}
                        length={params.length / 1000}
                        frequency={params.frequency * 1e6}
                        radius={params.radius / 1000}
                        className="h-full"
                      />
                    </div>
                  </TabsContent>

                  <TabsContent value="radiation" className="flex-1 flex flex-col overflow-y-auto min-h-0">
                    <RadiationPatternView
                      antennaType={params.antennaType}
                      frequency={params.frequency * 1e6}
                      patternData={results?.pattern}
                    />
                  </TabsContent>

                  <TabsContent value="history" className="flex-1 flex flex-col overflow-y-auto min-h-0">
                    <SimulationHistory
                      onLoadHistory={(item: HistoryItem) => {
                        setParams(item.parameters);
                        handleSubmit(item.parameters);
                      }}
                      className="flex-1"
                    />
                  </TabsContent>

                  {importedMesh && (
                    <TabsContent value="mesh" className="flex-1 flex flex-col overflow-y-auto min-h-0">
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-[13px] text-text-muted">{importedMesh.file_name}</span>
                        <Badge variant="default">{importedMesh.format}</Badge>
                        <span className="text-[12px] text-text-dim tabular-nums">
                          {importedMesh.vertices.toLocaleString()} verts, {importedMesh.triangles.toLocaleString()} tris
                        </span>
                        <div className="ml-auto flex gap-1">
                          {(['wireframe', 'solid', 'transparent'] as const).map((m) => (
                            <button
                              key={m}
                              onClick={() => setMeshViewMode(m)}
                              className={`px-2 py-1 text-[11px] rounded ${meshViewMode === m ? 'bg-accent text-white' : 'bg-elevated text-text-dim hover:text-text-muted'}`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="bg-surface border border-border rounded-xl flex-1 min-h-[400px] overflow-hidden">
                        <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
                          <MeshViewer mesh={null} mode={meshViewMode} showQuality={false} />
                          <OrbitControls />
                        </Canvas>
                      </div>
                    </TabsContent>
                  )}
                </Tabs>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-full max-w-[640px] bg-surface border border-border rounded-2xl p-7">
                    <div className="text-lg font-semibold text-text-muted mb-2">{t('empty.title')}</div>
                    <div className="text-[13px] text-text-dim leading-relaxed mb-5">{t('empty.text')}</div>
                    <div className="grid md:grid-cols-3 gap-3">
                      {[
                        { title: '1. Select antenna', text: 'Choose antenna type and set the center frequency.' },
                        { title: '2. Tune geometry', text: 'Adjust dimensions and material in the left panel.' },
                        { title: '3. Run + review', text: 'Run simulation, then inspect S11, VSWR and 3D tabs.' },
                      ].map((step) => (
                        <div key={step.title} className="rounded-xl border border-border bg-base px-4 py-3">
                          <div className="text-xs font-semibold text-text-secondary mb-1">{step.title}</div>
                          <div className="text-xs text-text-dim leading-relaxed">{step.text}</div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 text-[12px] text-text-dim/60 mt-5">
                      <span className="w-10 h-px bg-border" />
                      <span>{t('empty.types')}</span>
                      <span className="w-10 h-px bg-border" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

export default App;