import { useState, useCallback, useRef } from 'react';
import { Activity, Radio, Zap, Signal, ChevronDown } from 'lucide-react';
import AntennaForm from './components/AntennaForm/AntennaForm';
import type { AntennaParameters } from './components/AntennaForm/AntennaForm';
import { getCategoryForId } from '@/lib/antennaKB';
import type { AntennaCategory } from '@/lib/antennaKB';
import S11Chart from './components/S11Chart/S11Chart';
import SmithChart from './components/SmithChart/SmithChart';
import OptimizationPanel from './components/OptimizationPanel/OptimizationPanel';
import FrequencyPresets from './components/FrequencyPresets/FrequencyPresets';
import SimulationHistory from './components/SimulationHistory/SimulationHistory';
import type { HistoryItem } from './components/SimulationHistory/SimulationHistory';
import AntennaViewport from './viewport/AntennaViewport';
import { RadiationPatternView } from './components/RadiationPatternView';
import ExportPanel from './components/ExportPanel/ExportPanel';
// Card components available if needed
// import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { LandingPage } from '@/components/landing/LandingPage';

// Category-based impedance solver
function solveByCategory(
  category: AntennaCategory,
  _antennaType: string,
  ap: Record<string, number>,
  f: number,
  lambda: number,
  k: number,
  conductorLoss: (length: number, radius: number, freq: number) => number,
  clampTan: (x: number) => number,
  C0: number,
): [number, number] {
  switch (category) {
    case 'wire': {
      // King's approximation — works for dipoles, monopoles, helical, loops, yagi, LPDA
      const L = ap.length_m || lambda / 2;
      const a = ap.radius_m || 0.001;
      const x = k * L - Math.PI;
      const zr = 73.13 * (1 + 0.014 * x * x) + conductorLoss(L, a, f);
      const zi = 42.5 * clampTan(x);
      return [zr, zi];
    }
    case 'microstrip': {
      // Cavity model (Hammerstad & Jensen) — patches, PIFAs, IFAs
      const er = ap.substrate_er || 4.4;
      const h = ap.substrate_height_m || 0.0016;
      const W = ap.width_m || C0 / (2 * f) * Math.sqrt(2 / (er + 1));
      const erEff = (er + 1) / 2 + (er - 1) / 2 * Math.pow(1 + 12 * h / W, -0.5);
      const deltaL = 0.412 * h * (erEff + 0.3) * (W / h + 0.264)
        / ((erEff - 0.258) * (W / h + 0.8));
      const pLen = ap.length_m || C0 / (2 * f * Math.sqrt(erEff));
      const Le = pLen + 2 * deltaL;
      const fRes = C0 / (2 * Le * Math.sqrt(erEff));
      const Zedge = Math.min(90 * er * er / (er - 1) * Math.pow(pLen / W, 2), 400);
      const Q = C0 / (4 * fRes * h * Math.sqrt(erEff));
      const detuning = f / fRes - fRes / f;
      const zr = Zedge / (1 + Q * Q * detuning * detuning);
      const zi = -zr * Q * detuning;
      return [zr, zi];
    }
    case 'broadband': {
      // Transmission line model — Vivaldi, bow-tie, spiral, discone, biconical
      const L = ap.length_m || lambda / 2;
      const a = ap.radius_m || 0.001;
      const Zchar = 120 * Math.log(L / Math.max(a, 1e-6));
      const fCenter = C0 / (2 * L);
      const ratio = f / fCenter;
      const bl = (Math.PI / 2) * ratio;
      const tanBl = Math.tan(Math.min(Math.max(bl, -1.5), 1.5));
      const ZL = 377; // free space impedance as load
      const denR = Zchar;
      const denI = ZL * tanBl;
      const denMag2 = denR * denR + denI * denI;
      let zr = Zchar * (ZL * denR + Zchar * tanBl * denI) / denMag2;
      const zi = Zchar * (Zchar * tanBl * denR - ZL * denI) / denMag2;
      // Broadband antennas have more stable impedance
      zr = zr * 0.7 + 50 * 0.3; // tendency toward 50 ohm
      return [Math.max(zr, 5) + conductorLoss(L, a, f), zi * 0.6];
    }
    case 'aperture': {
      // Waveguide model — horns, slots, open waveguide, reflector
      const aW = ap.aperture_width || lambda;
      const bW = ap.aperture_height || lambda * 0.7;
      const fCutoff = C0 / (2 * Math.max(aW, lambda * 0.5));
      const ratio = f / fCutoff;
      if (ratio < 1) {
        return [5, -500]; // below cutoff
      }
      const Zw = 377 / Math.sqrt(1 - Math.pow(fCutoff / f, 2));
      // Aperture impedance ≈ Zw modified by flare
      const flare = Math.sqrt(aW * bW) / lambda;
      const zr = Zw * (1 - 0.3 / (flare + 1));
      const zi = Zw * 0.1 * (1 - ratio) / ratio;
      return [Math.max(zr, 10), zi];
    }
    case 'array': {
      // Array factor model — ULA, planar, phased, Butler matrix
      const N = ap.num_elements || 4;
      const d = ap.element_spacing || lambda / 2;
      // Element impedance (dipole-like)
      const L = ap.length_m || lambda / 2;
      const x = k * L - Math.PI;
      const ze_r = 73.13 * (1 + 0.014 * x * x);
      const ze_i = 42.5 * clampTan(x);
      // Mutual coupling reduces input impedance
      const kd = k * d;
      const Z12 = 73 * (kd > 0.01 ? Math.sin(kd) / kd : 1);
      // Active element impedance
      const zr = ze_r - (N - 1) * Z12 * 0.15;
      const zi = ze_i + (N - 1) * Z12 * 0.05;
      return [Math.max(zr, 5), zi];
    }
    case 'special':
    default: {
      // Generic resonator model for fractal, DRA, metamaterial, reconfigurable
      const L = ap.length_m || lambda / 2;
      const a = ap.radius_m || 0.001;
      const fRes = C0 / (2 * L);
      const Q = 20; // moderate Q for special antennas
      const detuning = f / fRes - fRes / f;
      const Rrad = 73.13;
      const zr = Rrad / (1 + Q * Q * detuning * detuning) + conductorLoss(L, a, f);
      const zi = -Rrad * Q * detuning / (1 + Q * Q * detuning * detuning);
      return [Math.max(zr, 5), zi];
    }
  }
}

const isTauri = '__TAURI_INTERNALS__' in window;
const invoke = isTauri
  ? (await import('@tauri-apps/api/core')).invoke
  : async (_cmd: string, args: any): Promise<any> => {
      await new Promise(r => setTimeout(r, 400));
      const a = args as any;

      if (_cmd === 'get_antenna_templates') {
        const { ANTENNA_PRESETS: presets } = await import('@/lib/antennaKB');
        return presets.map(p => ({
          id: p.id, name: p.name, type: p.category, default_frequency: p.frequency * 1e6,
        }));
      }

      // simulate_sweep mock — parametrized by antenna dimensions
      const C0 = 299792458;
      const antennaType = a.antenna_type || a.antennaType || 'dipole';
      const fStart = a.freq_start || a.freqStart;
      const fStop = a.freq_stop || a.freqStop;
      const n = a.freq_points || a.freqPoints || 101;
      const ap = a.antenna_params || {};

      // Physics constants
      const MU0 = 4 * Math.PI * 1e-7;
      const SIGMA_CU = 5.8e7; // copper conductivity S/m

      const clampTan = (x: number) => {
        if (Math.abs(x) < 0.01) return x; // small angle: tan(x) ≈ x
        const t = Math.tan(Math.min(Math.max(x, -1.5), 1.5));
        return Math.abs(t) > 500 ? 500 * Math.sign(t) : t;
      };

      const conductorLoss = (length: number, radius: number, freq: number) =>
        (length / (2 * Math.PI * Math.max(radius, 1e-6))) * Math.sqrt(Math.PI * freq * MU0 / SIGMA_CU);

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

        let zr: number, zi: number;

        const category: AntennaCategory = getCategoryForId(antennaType);
        [zr, zi] = solveByCategory(category, antennaType, ap, f, lambda, k, conductorLoss, clampTan, C0);

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
  method: 'gradient' | 'random' | 'nelder_mead';
}

function SidebarSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border/30">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-text-dim/70 hover:text-text-muted transition-colors"
      >
        {title}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && <div className="pb-4" style={{ animation: 'fadeIn 0.15s ease-out' }}>{children}</div>}
    </div>
  );
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
    antennaType: 'half_wave_dipole',
    frequency: 145,
    length: 1034,
    radius: 1,
    height: 0,
    material: 'copper',
    extraParams: {},
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
      setChartData(result.frequencies.map((f: number, i: number) => ({
        frequency: f / 1e6, s11_db: result.s11Db[i],
      })));
      setS11Data({ real: result.s11Real, imag: result.s11Imag });
      setImpedanceData({ real: result.impedanceReal, imag: result.impedanceImag, freq: result.frequencies });
      setSummary({ resonantFreq: result.resonantFreq, minS11: result.minS11, bandwidth: result.bandwidth });
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

  const vswr = summary ? (() => {
    const s11lin = Math.pow(10, summary.minS11 / 20);
    return ((1 + s11lin) / (1 - s11lin)).toFixed(2);
  })() : null;

  if (showLanding) {
    return <LandingPage onLaunch={() => setShowLanding(false)} />;
  }

  return (
    <div className="noise flex h-screen bg-background text-text overflow-hidden">
      {/* Sidebar */}
      <div className="w-[360px] bg-surface/80 border-r border-border/60 flex flex-col overflow-hidden relative">
        {/* Subtle sidebar glow */}
        <div className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-accent/10 via-transparent to-accent/5 pointer-events-none" />

        {/* Logo */}
        <div className="px-6 py-5 border-b border-border/40 flex items-center gap-4 shrink-0">
          <div className="relative">
            <div className="w-10 h-10 bg-gradient-to-br from-accent to-purple-500 rounded-xl flex items-center justify-center text-lg font-bold text-white shadow-lg shadow-accent/20">
              P
            </div>
            <div className="absolute -inset-1 bg-accent/10 rounded-xl blur-md -z-10" />
          </div>
          <div>
            <div className="text-sm font-bold text-white tracking-tight">PROMIN</div>
            <div className="text-xs text-text-dim font-medium">Antenna Studio</div>
          </div>
          <div className="ml-auto">
            <span className="px-2 py-1 rounded text-xs font-medium bg-accent/10 text-accent/70 border border-accent/10">
              {isTauri ? 'Native' : 'v0.3'}
            </span>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden">
          <AntennaForm
            parameters={params}
            onParametersChange={setParams}
            onSubmit={handleSubmit}
            isSimulating={isSimulating}
          />

          <SidebarSection title="Frequency Presets" defaultOpen>
            <div className="px-6">
              <FrequencyPresets
                onSelect={(freq) => setParams(p => ({ ...p, frequency: freq }))}
                disabled={isSimulating || isOptimizing}
              />
            </div>
          </SidebarSection>

          <SidebarSection title="Optimization">
            <OptimizationPanel
              onStartOptimization={handleStartOptimization}
              onStopOptimization={handleStopOptimization}
              isOptimizing={isOptimizing}
              progress={optimizationProgress}
              results={optimizationResults}
            />
          </SidebarSection>
        </div>

        {/* Solver Info — fixed at bottom */}
        <div className="px-6 py-4 border-t border-border/40 shrink-0 flex items-center gap-3">
          <span className="w-2 h-2 rounded-full bg-success/60 animate-pulse" />
          <span className="text-xs text-text-dim/50 font-medium">
            MoM Solver {isTauri ? '| Rust+rayon' : '| Browser mock'}
          </span>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-auto">
        {/* Top Bar */}
        <div className="px-6 py-3.5 border-b border-border/40 flex items-center justify-between bg-background/80 shrink-0">
          <div className="flex gap-3 items-center">
            <span className="text-sm font-semibold text-text/90">Results</span>
            {isSimulating && (
              <Badge variant="warning">
                <span className="w-1.5 h-1.5 rounded-full bg-warning animate-pulse" />
                Running
              </Badge>
            )}
            {isOptimizing && (
              <Badge variant="purple">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                Optimizing
              </Badge>
            )}
            {summary && !isSimulating && !isOptimizing && (
              <Badge variant="success">Done</Badge>
            )}
          </div>
          <div className="flex gap-4 items-center text-xs text-text-dim">
            {simTime && <span className="tabular-nums font-medium">{simTime}ms</span>}
            {chartData.length > 0 && <span className="tabular-nums">{chartData.length} pts</span>}
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
        <div className="flex-1 p-5 flex flex-col gap-4">
          {error && (
            <div className="px-4 py-3 bg-error/8 border border-error/20 rounded-xl text-error text-xs flex items-center gap-2.5" style={{ animation: 'fadeIn 0.2s ease-out' }}>
              <span className="w-2 h-2 rounded-full bg-error shrink-0" />
              {error}
            </div>
          )}

          {summary ? (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
              <TabsList>
                <TabsTrigger value="s-parameters">S-Params</TabsTrigger>
                <TabsTrigger value="impedance">Impedance</TabsTrigger>
                <TabsTrigger value="3d-view">3D View</TabsTrigger>
                <TabsTrigger value="radiation">Radiation</TabsTrigger>
                <TabsTrigger value="history">History</TabsTrigger>
              </TabsList>

              <TabsContent value="s-parameters" className="flex-1 flex flex-col gap-4">
                {/* Stats — glass cards */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { icon: Radio, label: 'Resonant', value: formatFreq(summary.resonantFreq), color: 'accent', glow: 'rgba(99,102,241,0.08)' },
                    { icon: Activity, label: 'Min S11', value: `${summary.minS11.toFixed(1)} dB`, color: 'success', glow: 'rgba(16,185,129,0.08)' },
                    { icon: Zap, label: 'VSWR', value: `${vswr}:1`, color: 'warning', glow: 'rgba(245,158,11,0.08)' },
                    { icon: Signal, label: 'BW -10dB', value: formatFreq(summary.bandwidth), color: 'info', glow: 'rgba(6,182,212,0.08)' },
                  ].map(({ icon: Icon, label, value, color, glow }) => (
                    <div
                      key={label}
                      className="relative flex items-center gap-3 rounded-xl border border-border/50 bg-surface/80 px-4 py-3.5 overflow-hidden"
                      style={{ animation: 'fadeInScale 0.3s ease-out' }}
                    >
                      <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(circle at 20% 50%, ${glow}, transparent 70%)` }} />
                      <div className={`w-9 h-9 rounded-lg bg-${color}/10 flex items-center justify-center shrink-0`}>
                        <Icon className={`w-4 h-4 text-${color}`} />
                      </div>
                      <div className="relative">
                        <div className="text-xs text-text-muted mb-0.5">{label}</div>
                        <div className={`text-sm font-bold text-${color} tabular-nums leading-tight`}>{value}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* S11 Chart */}
                <div className="bg-surface/80 border border-border/50 rounded-xl p-5 flex-1 min-h-[350px] flex flex-col">
                  <S11Chart data={chartData} />
                </div>
              </TabsContent>

              <TabsContent value="impedance" className="flex-1 flex flex-col">
                <div className="bg-surface/80 border border-border/50 rounded-xl p-5 flex-1 flex items-center justify-center">
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
                <div className="bg-surface/80 border border-border/50 rounded-xl flex-1 min-h-[350px] overflow-hidden">
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
            /* Empty state */
            <div className="flex-1 flex flex-col items-center justify-center gap-7 text-text-dim">
              <div className="relative">
                <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
                  <rect x="10" y="50" width="4" height="16" rx="2" fill="#1a1a2e" />
                  <rect x="19" y="38" width="4" height="28" rx="2" fill="#1a1a2e" />
                  <rect x="28" y="26" width="4" height="40" rx="2" fill="#252540" />
                  <rect x="37" y="10" width="6" height="56" rx="3" fill="url(#grad)" />
                  <rect x="48" y="26" width="4" height="40" rx="2" fill="#252540" />
                  <rect x="57" y="38" width="4" height="28" rx="2" fill="#1a1a2e" />
                  <rect x="66" y="50" width="4" height="16" rx="2" fill="#1a1a2e" />
                  <defs>
                    <linearGradient id="grad" x1="40" y1="10" x2="40" y2="66" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#6366f1" stopOpacity="0.6" />
                      <stop offset="1" stopColor="#6366f1" stopOpacity="0.1" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 bg-accent/8 blur-3xl rounded-full scale-150" />
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-text/50 mb-2">No Simulation Data</div>
                <div className="text-xs text-text-dim/70 max-w-[280px] leading-relaxed">
                  Configure antenna parameters and hit Run
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-text-dim/40 mt-2">
                <span className="w-8 h-px bg-border" />
                <span>31 antenna types available</span>
                <span className="w-8 h-px bg-border" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;