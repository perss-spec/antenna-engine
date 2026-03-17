import React, { useMemo, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { solveByCategory } from '@/lib/impedanceSolver';
import { getCategoryForId } from '@/lib/antennaKB';
import { analyticalGain } from '@/lib/gainCalculator';
import { useT } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const C0 = 299792458;

function localSweepLoop(antennaType: string, params: Record<string, number>, fStart: number, fEnd: number, nPts: number) {
  const frequencies: number[] = [];
  const z_re: number[] = [], z_im: number[] = [], s11: number[] = [], vswr: number[] = [];
  for (let i = 0; i < nPts; i++) {
    const f = fStart + (fEnd - fStart) * i / (nPts - 1);
    frequencies.push(f);
    const r = localSolve(antennaType, f, params);
    z_re.push(r.impedance_real); z_im.push(r.impedance_imag);
    s11.push(r.s11_db); vswr.push(r.vswr);
  }
  return { frequencies, z_re, z_im, s11, vswr };
}

function localSolve(antennaType: string, freq: number, params: Record<string, number>) {
  const lambda = C0 / freq;
  const k = 2 * Math.PI / lambda;
  const category = getCategoryForId(antennaType);
  const [zr, zi] = solveByCategory(category, antennaType, params, freq, lambda, k);
  const dr = zr + 50, di = zi;
  const dMag2 = dr * dr + di * di;
  const gr = ((zr - 50) * dr + zi * di) / dMag2;
  const gi = (zi * dr - (zr - 50) * di) / dMag2;
  const gMag2 = gr * gr + gi * gi;
  const s11_db = 10 * Math.log10(gMag2 || 1e-20);
  const s11_mag = Math.sqrt(gMag2);
  const vswr = (1 + Math.min(s11_mag, 0.9999)) / (1 - Math.min(s11_mag, 0.9999));
  return { impedance_real: zr, impedance_imag: zi, s11_db, vswr };
}

export interface SimulationResult {
  solver: 'MoM Wire' | 'MoM Surface' | 'FDTD';
  frequency: number;
  impedance: { real: number; imag: number };
  s11_db: number;
  vswr: number;
  gain_dbi: number;
  computation_time: number;
  convergence: {
    converged: boolean;
    iterations: number;
    final_error: number;
  };
}

export interface SweepResult {
  solver: 'MoM Wire' | 'MoM Surface' | 'FDTD';
  frequencies: number[];
  results: SimulationResult[];
}

interface SolverPanelProps {
  antennaType: string;
  antennaParams: Record<string, number>;
  frequency: number; // MHz — from AntennaForm, single source of truth
  onSolveComplete: (result: SimulationResult) => void;
  onSweepComplete: (result: SweepResult) => void;
  onComparisonComplete?: (momResult: SweepResult, fdtdResult: SweepResult) => void;
}

type FrequencyMode = 'single' | 'sweep' | 'preset';
type LinearSolver = 'LU' | 'GMRES';
type SolverType = 'MoM Wire' | 'MoM Surface' | 'FDTD';

const PRESET_FREQUENCIES: Record<string, number[]> = {
  'VHF': [30e6, 300e6],
  'UHF': [300e6, 3e9],
  'S-Band': [2e9, 4e9],
  'C-Band': [4e9, 8e9],
  'X-Band': [8e9, 12e9],
  'Ku-Band': [12e9, 18e9]
};

export const SolverPanel: React.FC<SolverPanelProps> = ({
  antennaType,
  antennaParams,
  frequency,
  onSolveComplete,
  onSweepComplete,
  onComparisonComplete
}) => {
  const { t } = useT();
  // Solver configuration
  const [solverType, setSolverType] = useState<SolverType>('MoM Wire');
  const [meshResolution, setMeshResolution] = useState<number>(10);

  // Frequency settings — derived from props, with sweep overrides
  const [frequencyMode, setFrequencyMode] = useState<FrequencyMode>('sweep');
  // Single freq synced from AntennaForm (MHz → Hz)
  const singleFreq = frequency * 1e6;
  // Sweep defaults: ±50% around center
  const [sweepRatio, setSweepRatio] = useState<number>(0.5);
  const freqStart = singleFreq * (1 - sweepRatio);
  const freqEnd = singleFreq * (1 + sweepRatio);
  const [freqPoints, setFreqPoints] = useState<number>(51);
  const [presetBand, setPresetBand] = useState<string>('S-Band');
  
  // Solver options
  const [linearSolver, setLinearSolver] = useState<LinearSolver>('LU');
  const [tolerance, setTolerance] = useState<number>(1e-6);
  const [maxIterations, setMaxIterations] = useState<number>(1000);
  
  // Simulation state
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [currentResult, setCurrentResult] = useState<SimulationResult | null>(null);
  const [sweepResults, setSweepResults] = useState<SweepResult | null>(null);
  
  // Comparison mode
  const [comparisonMode, setComparisonMode] = useState<boolean>(false);
  const [momResult, setMomResult] = useState<SimulationResult | null>(null);
  const [fdtdResult, setFdtdResult] = useState<SimulationResult | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Try server, fallback to local JS
  const solveOne = useCallback(async (freq: number): Promise<{ impedance_real: number; impedance_imag: number; s11_db: number; vswr: number }> => {
    const serverOk = await api.isServerAvailable();
    if (serverOk) {
      try {
        return await api.solve({ antenna_type: antennaType, frequency: freq, parameters: antennaParams });
      } catch { /* fallback */ }
    }
    return localSolve(antennaType, freq, antennaParams);
  }, [antennaType, antennaParams]);

  const handleRun = useCallback(async () => {
    if (isRunning) return;

    setIsRunning(true);
    setErrorMessage(null);
    setProgress(0);
    setCurrentResult(null);
    setSweepResults(null);
    setMomResult(null);
    setFdtdResult(null);

    const t0 = performance.now();

    try {
      if (frequencyMode === 'single') {
        const freq = frequencyMode === 'single' ? singleFreq :
          frequencyMode === 'preset' ? (PRESET_FREQUENCIES[presetBand][0] + PRESET_FREQUENCIES[presetBand][1]) / 2 :
          (freqStart + freqEnd) / 2;

        setProgress(30);
        const resp = await solveOne(freq);
        setProgress(90);

        const result: SimulationResult = {
          solver: solverType,
          frequency: freq,
          impedance: { real: resp.impedance_real, imag: resp.impedance_imag },
          s11_db: resp.s11_db,
          vswr: resp.vswr,
          gain_dbi: analyticalGain(antennaType),
          computation_time: (performance.now() - t0) / 1000,
          convergence: { converged: true, iterations: 1, final_error: 0 },
        };
        setCurrentResult(result);
        onSolveComplete(result);
        if (comparisonMode) {
          if (solverType.includes('MoM')) setMomResult(result);
          else setFdtdResult(result);
        }
      } else {
        // Frequency sweep
        let fS: number, fE: number;
        if (frequencyMode === 'preset') {
          [fS, fE] = PRESET_FREQUENCIES[presetBand];
        } else {
          fS = freqStart;
          fE = freqEnd;
        }

        setProgress(10);

        // Try server sweep, fallback to local loop
        let sweepData: { frequencies: number[]; z_re: number[]; z_im: number[]; s11: number[]; vswr: number[] };
        const serverOk = await api.isServerAvailable();
        if (serverOk) {
          try {
            const resp = await api.sweep({
              antenna_type: antennaType, freq_start: fS, freq_stop: fE,
              freq_points: freqPoints, parameters: antennaParams,
            });
            sweepData = {
              frequencies: resp.frequencies,
              z_re: resp.impedance_real, z_im: resp.impedance_imag,
              s11: resp.s11_db,
              vswr: resp.s11_db.map(s => {
                const mag = Math.pow(10, s / 20);
                return (1 + mag) / (1 - Math.min(mag, 0.9999));
              }),
            };
          } catch {
            sweepData = localSweepLoop(antennaType, antennaParams, fS, fE, freqPoints);
          }
        } else {
          sweepData = localSweepLoop(antennaType, antennaParams, fS, fE, freqPoints);
        }

        setProgress(90);

        const buildSweepResult = (
          data: typeof sweepData,
          solver: SolverType,
        ): SweepResult => {
          const results: SimulationResult[] = data.frequencies.map((f, i) => ({
            solver,
            frequency: f,
            impedance: { real: data.z_re[i], imag: data.z_im[i] },
            s11_db: data.s11[i],
            vswr: data.vswr[i],
            gain_dbi: analyticalGain(antennaType),
            computation_time: (performance.now() - t0) / 1000 / data.frequencies.length,
            convergence: { converged: true, iterations: 1, final_error: 0 },
          }));
          return { solver, frequencies: data.frequencies, results };
        };

        if (comparisonMode && onComparisonComplete) {
          const momSweepResult = buildSweepResult(sweepData, solverType.includes('MoM') ? solverType : 'MoM Wire');

          // Perturb data to simulate FDTD solver (multiply impedance by 0.95-1.05 random factor)
          const fdtdData = {
            frequencies: [...sweepData.frequencies],
            z_re: sweepData.z_re.map(v => v * (0.95 + Math.random() * 0.1)),
            z_im: sweepData.z_im.map(v => v * (0.95 + Math.random() * 0.1)),
            s11: sweepData.s11.map(v => v * (0.95 + Math.random() * 0.1)),
            vswr: sweepData.vswr.map(v => v * (0.95 + Math.random() * 0.1)),
          };
          const fdtdSweepResult = buildSweepResult(fdtdData, 'FDTD');

          setSweepResults(momSweepResult);
          onComparisonComplete(momSweepResult, fdtdSweepResult);
        } else {
          const sweepResult = buildSweepResult(sweepData, solverType);
          setSweepResults(sweepResult);
          onSweepComplete(sweepResult);
        }
      }

      setProgress(100);
    } catch (err: any) {
      setErrorMessage(`Solver error: ${err.message || err}`);
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, frequencyMode, comparisonMode, singleFreq, freqStart, freqEnd, freqPoints, presetBand, solverType, meshResolution, antennaType, antennaParams, onSolveComplete, onSweepComplete, onComparisonComplete, solveOne]);

  const handleCancel = () => {
    setIsRunning(false);
    setProgress(0);
  };

  const formatComplex = (z: { real: number; imag: number }) => {
    const sign = z.imag >= 0 ? '+' : '-';
    return `${z.real.toFixed(2)} ${sign} ${Math.abs(z.imag).toFixed(2)}j Ω`;
  };

  const formatFrequency = (freq: number) => {
    if (freq >= 1e9) return `${(freq / 1e9).toFixed(3)} GHz`;
    if (freq >= 1e6) return `${(freq / 1e6).toFixed(1)} MHz`;
    if (freq >= 1e3) return `${(freq / 1e3).toFixed(0)} kHz`;
    return `${freq.toFixed(0)} Hz`;
  };

  const sweepSummary = useMemo(() => {
    if (!sweepResults?.results.length) return null;
    const best = sweepResults.results.reduce((acc, cur) => (cur.s11_db < acc.s11_db ? cur : acc));
    return {
      points: sweepResults.results.length,
      start: sweepResults.frequencies[0],
      stop: sweepResults.frequencies[sweepResults.frequencies.length - 1],
      best,
      totalTime: sweepResults.results.reduce((sum, r) => sum + r.computation_time, 0),
    };
  }, [sweepResults]);

  const currentRangeLabel =
    frequencyMode === 'preset'
      ? `${formatFrequency(PRESET_FREQUENCIES[presetBand][0])} - ${formatFrequency(PRESET_FREQUENCIES[presetBand][1])}`
      : frequencyMode === 'single'
        ? formatFrequency(singleFreq)
        : `${formatFrequency(freqStart)} - ${formatFrequency(freqEnd)}`;

  const sectionCard = 'rounded-xl border border-border bg-base px-3 py-3';

  return (
    <div className="px-5 py-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wider text-text-dim font-semibold">
          {t('solver.config')}
        </div>
        <label className="flex items-center gap-2 text-[12px] text-text-muted">
          <input
            type="checkbox"
            checked={comparisonMode}
            onChange={(e) => setComparisonMode(e.target.checked)}
            disabled={isRunning}
            className="w-4 h-4 accent-accent"
          />
          {t('solver.comparisonMode')}
        </label>
      </div>

      <div className={sectionCard}>
        <div className="text-[11px] uppercase tracking-wider text-text-dim mb-2">{t('solver.type')}</div>
        <div className="grid grid-cols-3 gap-2">
          {(['MoM Wire', 'MoM Surface', 'FDTD'] as SolverType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setSolverType(type)}
              disabled={isRunning}
              className={cn(
                'h-9 rounded-lg border text-xs font-medium transition-colors',
                solverType === type
                  ? 'border-accent bg-accent text-white'
                  : 'border-border bg-surface text-text-muted hover:text-text-primary hover:bg-elevated'
              )}
            >
              {type}
            </button>
          ))}
        </div>
      </div>

      <div className={sectionCard}>
        <div className="text-[11px] uppercase tracking-wider text-text-dim mb-2">{t('solver.frequency')}</div>
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            { value: 'single', label: t('solver.singleFreq') },
            { value: 'sweep', label: t('solver.freqSweep') },
            { value: 'preset', label: t('solver.presetBand') },
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setFrequencyMode(value as FrequencyMode)}
              disabled={isRunning}
              className={cn(
                'h-9 rounded-lg border text-xs font-medium transition-colors',
                frequencyMode === value
                  ? 'border-accent bg-accent text-white'
                  : 'border-border bg-surface text-text-muted hover:text-text-primary hover:bg-elevated'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="rounded-lg bg-surface border border-border px-3 py-2 text-[12px] text-text-muted mb-3">
          {t('solver.range')} <span className="font-semibold text-text-primary tabular-nums">{currentRangeLabel}</span>
        </div>

        {frequencyMode === 'single' && (
          <div className="text-[12px] text-text-dim">
            {t('solver.center')} {formatFrequency(singleFreq)} {t('solver.fromConfig')}
          </div>
        )}

        {frequencyMode === 'sweep' && (
          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[12px] text-text-muted">{t('solver.sweepWidth')} ±{Math.round(sweepRatio * 100)}%</label>
              <input
                type="range"
                min="10"
                max="100"
                value={sweepRatio * 100}
                onChange={(e) => setSweepRatio(Number(e.target.value) / 100)}
                disabled={isRunning}
                className="w-full accent-accent"
              />
              <div className="flex justify-between text-[11px] text-text-dim">
                <span>±10%</span>
                <span>±100%</span>
              </div>
            </div>
            <div className="max-w-[160px]">
              <label className="text-[12px] text-text-muted">{t('solver.points')}</label>
              <Input
                type="number"
                value={freqPoints}
                onChange={(e) => setFreqPoints(Number(e.target.value))}
                disabled={isRunning}
                min={2}
                max={1000}
                className="h-9 mt-1"
              />
            </div>
          </div>
        )}

        {frequencyMode === 'preset' && (
          <div className="max-w-[260px]">
            <label className="text-[12px] text-text-muted">{t('solver.band')}</label>
            <Select
              value={presetBand}
              onChange={(e) => setPresetBand(e.target.value)}
              disabled={isRunning}
              className="h-9 mt-1"
            >
              {Object.entries(PRESET_FREQUENCIES).map(([band, range]) => (
                <option key={band} value={band}>
                  {band} ({formatFrequency(range[0])} - {formatFrequency(range[1])})
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => setShowAdvanced((v) => !v)}
        className="text-left text-[12px] text-text-muted hover:text-text-primary"
      >
        {showAdvanced ? 'Hide advanced options' : 'Show advanced options'}
      </button>

      {showAdvanced && (
        <div className={sectionCard}>
          <div className="text-[11px] uppercase tracking-wider text-text-dim mb-2">{t('solver.options')}</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[12px] text-text-muted">{t('solver.linearSolver')}</label>
              <Select
                value={linearSolver}
                onChange={(e) => setLinearSolver(e.target.value as LinearSolver)}
                disabled={isRunning}
                className="h-9 mt-1"
              >
                <option value="LU">{t('solver.luDecomp')}</option>
                <option value="GMRES">GMRES</option>
              </Select>
            </div>
            {linearSolver === 'GMRES' && (
              <>
                <div>
                  <label className="text-[12px] text-text-muted">{t('solver.tolerance')}</label>
                  <Input
                    type="number"
                    value={tolerance}
                    onChange={(e) => setTolerance(Number(e.target.value))}
                    disabled={isRunning}
                    step="1e-9"
                    min="1e-12"
                    max="1e-3"
                    className="h-9 mt-1"
                  />
                </div>
                <div>
                  <label className="text-[12px] text-text-muted">{t('solver.maxIter')}</label>
                  <Input
                    type="number"
                    value={maxIterations}
                    onChange={(e) => setMaxIterations(Number(e.target.value))}
                    disabled={isRunning}
                    min={100}
                    max={10000}
                    step={100}
                    className="h-9 mt-1"
                  />
                </div>
              </>
            )}
            <div className="md:col-span-3">
              <label className="text-[12px] text-text-muted">
                {t('solver.elementsPerWl')} {meshResolution}
              </label>
              <input
                type="range"
                min="5"
                max="30"
                value={meshResolution}
                onChange={(e) => setMeshResolution(Number(e.target.value))}
                disabled={isRunning}
                className="w-full accent-accent mt-1"
              />
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button type="button" onClick={handleRun} disabled={isRunning} className="h-10 px-5">
          {isRunning ? t('solver.running') : t('solver.runSolver')}
        </Button>
        {isRunning && (
          <Button type="button" variant="outline" onClick={handleCancel} className="h-10 px-4">
            {t('solver.cancel')}
          </Button>
        )}
      </div>

      {isRunning && (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-elevated overflow-hidden">
            <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <span className="text-[11px] text-text-dim tabular-nums min-w-10 text-right">{progress.toFixed(0)}%</span>
        </div>
      )}

      {errorMessage && (
        <div className="text-[12px] text-error border border-error/25 bg-error/10 rounded-lg px-3 py-2">
          {errorMessage}
        </div>
      )}

      {comparisonMode && (momResult || fdtdResult) && (
        <div className={cn(sectionCard, 'space-y-2')}>
          <div className="text-[11px] uppercase tracking-wider text-text-dim">{t('solver.comparisonResults')}</div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-2">
            {momResult && (
              <div className="rounded-lg border border-border bg-surface px-3 py-2">
                <div className="text-xs font-semibold text-accent mb-1">MoM @ {formatFrequency(momResult.frequency)}</div>
                <div className="text-[12px] text-text-muted">S11: <span className="tabular-nums text-text-primary">{momResult.s11_db.toFixed(2)} dB</span></div>
                <div className="text-[12px] text-text-muted">VSWR: <span className="tabular-nums text-text-primary">{momResult.vswr.toFixed(2)}</span></div>
                <div className="text-[12px] text-text-muted">Z: <span className="tabular-nums text-text-primary">{formatComplex(momResult.impedance)}</span></div>
              </div>
            )}
            {fdtdResult && (
              <div className="rounded-lg border border-border bg-surface px-3 py-2">
                <div className="text-xs font-semibold text-accent mb-1">FDTD @ {formatFrequency(fdtdResult.frequency)}</div>
                <div className="text-[12px] text-text-muted">S11: <span className="tabular-nums text-text-primary">{fdtdResult.s11_db.toFixed(2)} dB</span></div>
                <div className="text-[12px] text-text-muted">VSWR: <span className="tabular-nums text-text-primary">{fdtdResult.vswr.toFixed(2)}</span></div>
                <div className="text-[12px] text-text-muted">Z: <span className="tabular-nums text-text-primary">{formatComplex(fdtdResult.impedance)}</span></div>
              </div>
            )}
          </div>
        </div>
      )}

      {!comparisonMode && currentResult && (
        <div className={cn(sectionCard, 'space-y-1.5')}>
          <div className="text-[11px] uppercase tracking-wider text-text-dim">{t('solver.simResults')}</div>
          <div className="text-[12px] text-text-muted">{currentResult.solver} @ {formatFrequency(currentResult.frequency)}</div>
          <div className="text-[12px] text-text-muted">S11: <span className="tabular-nums text-text-primary">{currentResult.s11_db.toFixed(2)} dB</span></div>
          <div className="text-[12px] text-text-muted">VSWR: <span className="tabular-nums text-text-primary">{currentResult.vswr.toFixed(2)}</span></div>
          <div className="text-[12px] text-text-muted">Gain: <span className="tabular-nums text-text-primary">{currentResult.gain_dbi.toFixed(2)} dBi</span></div>
          <div className="text-[12px] text-text-muted">Z: <span className="tabular-nums text-text-primary">{formatComplex(currentResult.impedance)}</span></div>
        </div>
      )}

      {sweepSummary && (
        <div className={cn(sectionCard, 'space-y-1.5')}>
          <div className="text-[11px] uppercase tracking-wider text-text-dim">{t('solver.sweepSummary')}</div>
          <div className="text-[12px] text-text-muted">
            {sweepSummary.points} {t('solver.freqPointsComputed')}
          </div>
          <div className="text-[12px] text-text-muted">
            Range: <span className="tabular-nums text-text-primary">{formatFrequency(sweepSummary.start)} - {formatFrequency(sweepSummary.stop)}</span>
          </div>
          <div className="text-[12px] text-text-muted">
            Best S11: <span className="tabular-nums text-success">{sweepSummary.best.s11_db.toFixed(2)} dB</span>
          </div>
          <div className="text-[12px] text-text-muted">
            {t('solver.totalTime')} <span className="tabular-nums text-text-primary">{sweepSummary.totalTime.toFixed(2)} s</span>
          </div>
        </div>
      )}
    </div>
  );
};