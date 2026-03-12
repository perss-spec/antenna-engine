import { useState, useCallback, useEffect, useRef } from 'react';
import AntennaForm from './components/AntennaForm/AntennaForm';
import S11Chart from './components/S11Chart/S11Chart';
import SmithChart from './components/SmithChart/SmithChart';
import OptimizationPanel from './components/OptimizationPanel/OptimizationPanel';

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

const styles = {
  app: {
    display: 'flex',
    height: '100vh',
    background: '#0a0a0f',
    color: '#e0e0e0',
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    overflow: 'hidden',
  } as const,
  sidebar: {
    width: '340px',
    background: '#12121a',
    borderRight: '1px solid #1e1e2e',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'auto',
  } as const,
  logo: {
    padding: '20px 24px',
    borderBottom: '1px solid #1e1e2e',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  } as const,
  logoIcon: {
    width: '36px',
    height: '36px',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    borderRadius: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
  } as const,
  logoText: {
    fontSize: '16px',
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.5px',
  } as const,
  logoSub: {
    fontSize: '11px',
    color: '#666',
    marginTop: '2px',
  } as const,
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'auto',
  } as const,
  topbar: {
    padding: '12px 24px',
    borderBottom: '1px solid #1e1e2e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: '#0e0e15',
  } as const,
  badge: (color: string) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 500,
    background: `${color}15`,
    color: color,
    border: `1px solid ${color}30`,
  }),
  content: {
    flex: 1,
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  } as const,
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
  } as const,
  statCard: {
    background: '#12121a',
    border: '1px solid #1e1e2e',
    borderRadius: '8px',
    padding: '16px',
  } as const,
  statLabel: {
    fontSize: '12px',
    color: '#666',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  } as const,
  statValue: (color: string) => ({
    fontSize: '24px',
    fontWeight: 700,
    color: color,
    marginTop: '4px',
    fontVariantNumeric: 'tabular-nums',
  }),
  chartsRow: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '20px',
    flex: 1,
    minHeight: '400px',
  } as const,
  chartContainer: {
    background: '#12121a',
    border: '1px solid #1e1e2e',
    borderRadius: '8px',
    padding: '20px',
    minHeight: '400px',
    display: 'flex',
    flexDirection: 'column' as const,
  } as const,
  smithContainer: {
    background: '#12121a',
    border: '1px solid #1e1e2e',
    borderRadius: '8px',
    padding: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const,
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    gap: '16px',
    color: '#444',
  } as const,
};

function App() {
  const [isSimulating, setIsSimulating] = useState(false);
  const [chartData, setChartData] = useState<S11DataPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ resonantFreq: number; minS11: number; bandwidth: number } | null>(null);
  const [simTime, setSimTime] = useState<number | null>(null);
  const [impedanceData, setImpedanceData] = useState<{ real: number[]; imag: number[]; freq: number[] }>({ real: [], imag: [], freq: [] });

  // Optimization state
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

      // Perturb parameters: random walk around current best
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

        // Update main view with best result so far
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

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { background: #0a0a0f; overflow: hidden; }
      ::-webkit-scrollbar { width: 6px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
      .antenna-form { background: transparent !important; box-shadow: none !important; padding: 16px 24px !important; margin: 0 !important; border-radius: 0 !important; }
      .antenna-form-header { border-color: #1e1e2e !important; }
      .antenna-form-header h3 { color: #e0e0e0 !important; font-size: 14px !important; }
      .form-group label { color: #888 !important; font-size: 12px !important; text-transform: uppercase; letter-spacing: 0.5px; }
      .form-group input, .form-group select { background: #1a1a28 !important; border: 1px solid #2a2a3e !important; color: #e0e0e0 !important; border-radius: 6px !important; padding: 10px 12px !important; }
      .form-group input:focus, .form-group select:focus { border-color: #6366f1 !important; box-shadow: 0 0 0 2px rgba(99,102,241,0.2) !important; }
      .form-group input:disabled, .form-group select:disabled { background: #111 !important; color: #555 !important; }
      .btn-primary { background: linear-gradient(135deg, #6366f1, #8b5cf6) !important; border-radius: 6px !important; padding: 12px 24px !important; font-weight: 600 !important; letter-spacing: 0.3px; width: 100%; }
      .btn-primary:hover:not(:disabled) { filter: brightness(1.1); background: linear-gradient(135deg, #6366f1, #8b5cf6) !important; }
      .form-actions { border-color: #1e1e2e !important; }
      .s11-chart { background: transparent !important; }
      .s11-chart-header h3 { color: #e0e0e0 !important; font-size: 14px !important; margin-bottom: 12px; }
      .recharts-cartesian-grid line { stroke: #1e1e2e !important; }
      .recharts-text { fill: #666 !important; }
      .recharts-tooltip-wrapper .recharts-default-tooltip { background: #1a1a28 !important; border: 1px solid #2a2a3e !important; border-radius: 6px !important; }
      .recharts-legend-item-text { color: #888 !important; }
      select option { background: #1a1a28; color: #e0e0e0; }
    `;
    document.head.appendChild(style);
    return () => { document.head.removeChild(style); };
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
    <div style={styles.app}>
      <div style={styles.sidebar}>
        <div style={styles.logo}>
          <div style={styles.logoIcon}>P</div>
          <div>
            <div style={styles.logoText}>PROMIN</div>
            <div style={styles.logoSub}>Antenna Studio v0.1</div>
          </div>
        </div>
        <AntennaForm
          parameters={params}
          onParametersChange={setParams}
          onSubmit={handleSubmit}
          isSimulating={isSimulating}
        />
        <div style={{ borderTop: '1px solid #1e1e2e', padding: '0' }}>
          <OptimizationPanel
            onStartOptimization={handleStartOptimization}
            onStopOptimization={handleStopOptimization}
            isOptimizing={isOptimizing}
            progress={optimizationProgress}
            results={optimizationResults}
          />
        </div>
        <div style={{ padding: '16px 24px', borderTop: '1px solid #1e1e2e', marginTop: 'auto' }}>
          <div style={{ fontSize: '11px', color: '#444' }}>
            Solver: Method of Moments (MoM)
            <br />Engine: Rust + WebGPU
            <br />{isTauri ? 'Mode: Native (Tauri)' : 'Mode: Browser Preview'}
          </div>
        </div>
      </div>

      <div style={styles.main}>
        <div style={styles.topbar}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 600 }}>Simulation Results</span>
            {isSimulating && (
              <span style={styles.badge('#f59e0b')}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', animation: 'pulse 1s infinite' }} />
                Running...
              </span>
            )}
            {isOptimizing && (
              <span style={styles.badge('#8b5cf6')}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#8b5cf6', animation: 'pulse 1s infinite' }} />
                Optimizing...
              </span>
            )}
            {summary && !isSimulating && !isOptimizing && (
              <span style={styles.badge('#22c55e')}>Complete</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#666' }}>
            {simTime && <span>Time: {simTime}ms</span>}
            <span>Points: {chartData.length || '-'}</span>
          </div>
        </div>

        <div style={styles.content}>
          {error && (
            <div style={{ padding: '12px 16px', background: '#2d1215', border: '1px solid #5c2126', borderRadius: '8px', color: '#f87171', fontSize: '13px' }}>
              {error}
            </div>
          )}

          {summary ? (
            <>
              <div style={styles.statsRow}>
                <div style={styles.statCard}>
                  <div style={styles.statLabel}>Resonant Freq</div>
                  <div style={styles.statValue('#6366f1')}>{formatFreq(summary.resonantFreq)}</div>
                </div>
                <div style={styles.statCard}>
                  <div style={styles.statLabel}>Min S11</div>
                  <div style={styles.statValue('#22c55e')}>{summary.minS11.toFixed(1)} dB</div>
                </div>
                <div style={styles.statCard}>
                  <div style={styles.statLabel}>VSWR</div>
                  <div style={styles.statValue('#f59e0b')}>{vswr}:1</div>
                </div>
                <div style={styles.statCard}>
                  <div style={styles.statLabel}>BW (-10dB)</div>
                  <div style={styles.statValue('#06b6d4')}>{formatFreq(summary.bandwidth)}</div>
                </div>
              </div>

              <div style={styles.chartsRow}>
                <div style={styles.chartContainer}>
                  <S11Chart data={chartData} />
                </div>
                <div style={styles.smithContainer}>
                  <SmithChart
                    impedanceReal={impedanceData.real}
                    impedanceImag={impedanceData.imag}
                    frequency={impedanceData.freq}
                    width={380}
                    height={380}
                    title="Smith Chart"
                  />
                </div>
              </div>
            </>
          ) : (
            <div style={styles.emptyState}>
              <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
                <rect x="8" y="40" width="4" height="16" rx="2" fill="#1e1e2e" />
                <rect x="16" y="28" width="4" height="28" rx="2" fill="#1e1e2e" />
                <rect x="24" y="20" width="4" height="36" rx="2" fill="#2a2a3e" />
                <rect x="32" y="8" width="4" height="48" rx="2" fill="#6366f1" opacity="0.5" />
                <rect x="40" y="20" width="4" height="36" rx="2" fill="#2a2a3e" />
                <rect x="48" y="28" width="4" height="28" rx="2" fill="#1e1e2e" />
                <rect x="56" y="40" width="4" height="16" rx="2" fill="#1e1e2e" />
              </svg>
              <div style={{ fontSize: '16px', fontWeight: 600, color: '#555' }}>No Simulation Data</div>
              <div style={{ fontSize: '13px', maxWidth: '300px', textAlign: 'center', lineHeight: 1.5 }}>
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
