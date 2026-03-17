import { useState, useCallback } from 'react';
import type { FC, FormEvent, ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useT } from '@/lib/i18n';

interface OptimizationResult {
  iteration: number;
  frequency: number;
  length: number;
  radius: number;
  s11: number;
  timestamp: Date;
}

interface OptimizationPanelProps {
  onStartOptimization?: (params: OptimizationParams) => void;
  onStopOptimization?: () => void;
  isOptimizing?: boolean;
  progress?: number;
  results?: OptimizationResult[];
  className?: string;
}

interface OptimizationParams {
  targetFrequency: number;
  targetS11: number;
  method: 'gradient' | 'random' | 'nelder_mead';
}

interface ParamRange {
  enabled: boolean;
  min: number;
  max: number;
  step: number;
}

const OptimizationPanel: FC<OptimizationPanelProps> = ({
  onStartOptimization,
  onStopOptimization,
  isOptimizing = false,
  progress = 0,
  results = [],
  className = '',
}) => {
  const { t } = useT();
  const [targetFrequency, setTargetFrequency] = useState<number>(2400);
  const [targetS11, setTargetS11] = useState<number>(-20);
  const [method, setMethod] = useState<'gradient' | 'random' | 'nelder_mead'>('gradient');

  const [freqRange, setFreqRange] = useState<ParamRange>({ enabled: true, min: 2000, max: 3000, step: 10 });
  const [lenRange, setLenRange] = useState<ParamRange>({ enabled: true, min: 10, max: 200, step: 1 });
  const [radRange, setRadRange] = useState<ParamRange>({ enabled: false, min: 0.5, max: 5, step: 0.1 });

  const handleStart = useCallback(
    (e: FormEvent) => {
      e.preventDefault();
      if (onStartOptimization && !isOptimizing) {
        onStartOptimization({ targetFrequency, targetS11, method });
      }
    },
    [targetFrequency, targetS11, method, onStartOptimization, isOptimizing]
  );

  const handleStop = useCallback(() => {
    if (onStopOptimization && isOptimizing) onStopOptimization();
  }, [onStopOptimization, isOptimizing]);

  const handleFrequencyChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setTargetFrequency(parseFloat(e.target.value) || 0);
  }, []);

  const handleS11Change = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setTargetS11(parseFloat(e.target.value) || 0);
  }, []);

  const handleMethodChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setMethod(e.target.value as 'gradient' | 'random' | 'nelder_mead');
  }, []);

  const bestResult =
    results.length > 0 ? results.reduce((b, c) => (c.s11 < b.s11 ? c : b)) : null;

  function rangeRow(
    label: string,
    range: ParamRange,
    setRange: React.Dispatch<React.SetStateAction<ParamRange>>
  ) {
    return (
      <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-3 items-center">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={range.enabled}
            onChange={e => setRange(r => ({ ...r, enabled: e.target.checked }))}
            disabled={isOptimizing}
            className="w-4 h-4 accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          />
          <span className={`text-xs font-medium w-8 ${range.enabled ? 'text-text-muted' : 'text-text-dim/50'}`}>{label}</span>
        </div>
        <Input
          type="number"
          value={range.min}
          onChange={e => setRange(r => ({ ...r, min: parseFloat(e.target.value) || 0 }))}
          disabled={isOptimizing || !range.enabled}
          placeholder="min"
          className="h-10 text-sm disabled:opacity-40"
        />
        <Input
          type="number"
          value={range.max}
          onChange={e => setRange(r => ({ ...r, max: parseFloat(e.target.value) || 0 }))}
          disabled={isOptimizing || !range.enabled}
          placeholder="max"
          className="h-10 text-sm disabled:opacity-40"
        />
        <Input
          type="number"
          value={range.step}
          onChange={e => setRange(r => ({ ...r, step: parseFloat(e.target.value) || 0 }))}
          disabled={isOptimizing || !range.enabled}
          placeholder="step"
          className="h-10 text-sm disabled:opacity-40"
        />
      </div>
    );
  }

  return (
    <div className={`px-5 py-5 flex flex-col gap-4 ${className}`}>
      <div className="rounded-xl border border-border bg-base px-4 py-3">
        <div className="text-[11px] uppercase tracking-wider text-text-dim mb-1">Optimization brief</div>
        <div className="text-[12px] text-text-muted">Tune geometry to approach target S11 with minimal manual iteration.</div>
      </div>

      <form onSubmit={handleStart} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-3 rounded-xl border border-border bg-base p-3">
          <div className="flex flex-col gap-2">
            <Label htmlFor="target-frequency" className="text-xs font-medium text-text-muted">{t('opt.freqMhz')}</Label>
            <Input
              id="target-frequency"
              type="number"
              value={targetFrequency}
              onChange={handleFrequencyChange}
              min={100}
              max={10000}
              step={1}
              disabled={isOptimizing}
              className="h-10 text-sm"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="target-s11" className="text-xs font-medium text-text-muted">{t('opt.s11Db')}</Label>
            <Input
              id="target-s11"
              type="number"
              value={targetS11}
              onChange={handleS11Change}
              min={-60}
              max={0}
              step={0.1}
              disabled={isOptimizing}
              className="h-10 text-sm"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="opt-method" className="text-xs font-medium text-text-muted">{t('opt.method')}</Label>
            <Select
              id="opt-method"
              value={method}
              onChange={handleMethodChange}
              disabled={isOptimizing}
              className="h-10 text-sm"
            >
              <option value="gradient">{t('opt.gradient')}</option>
              <option value="random">{t('opt.random')}</option>
              <option value="nelder_mead">{t('opt.nelderMead')}</option>
            </Select>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-base p-3">
          <div className="text-[11px] uppercase tracking-wider text-text-dim">Search ranges</div>
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-3 mb-0.5">
            <div />
            <span className="text-[11px] text-text-dim/60 text-center">min</span>
            <span className="text-[11px] text-text-dim/60 text-center">max</span>
            <span className="text-[11px] text-text-dim/60 text-center">step</span>
          </div>
          {rangeRow('Freq', freqRange, setFreqRange)}
          {rangeRow('Len', lenRange, setLenRange)}
          {rangeRow('Rad', radRange, setRadRange)}
        </div>

        <div className="flex gap-3 items-center">
          {!isOptimizing ? (
            <Button type="submit" className="h-10 text-sm px-6">
              {t('opt.optimize')}
            </Button>
          ) : (
            <Button type="button" variant="destructive" onClick={handleStop} className="h-10 text-sm px-6">
              {t('opt.stop')}
            </Button>
          )}

          {isOptimizing && (
            <div className="flex-1">
              <div className="flex justify-between text-[10px] text-text-dim mb-0.5">
                <span>{t('opt.progress')}</span>
                <span className="tabular-nums">{progress.toFixed(0)}%</span>
              </div>
              <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {bestResult && !isOptimizing && (
            <span className="text-xs text-success font-medium tabular-nums ml-auto h-7 px-3 inline-flex items-center bg-success/10 rounded-md">
              {t('opt.best')} {bestResult.s11.toFixed(1)} dB
            </span>
          )}
        </div>
      </form>

      {results.length > 0 && (
        <div className="bg-surface border border-border/50 rounded-xl overflow-hidden">
          <div className="px-3 py-2 border-b border-border/50 text-[11px] uppercase tracking-wider text-text-dim">Recent iterations</div>
          <div className="max-h-[160px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="text-text-dim uppercase tracking-wider border-b border-border/50 sticky top-0 bg-surface">
                <tr>
                  <th className="py-2 px-3 text-left">#</th>
                  <th className="py-2 px-3 text-left">Freq</th>
                  <th className="py-2 px-3 text-left">Len</th>
                  <th className="py-2 px-3 text-left">S11</th>
                </tr>
              </thead>
              <tbody>
                {results
                  .slice(-10)
                  .reverse()
                  .map(r => {
                    const isBest = r === bestResult;
                    return (
                      <tr key={r.iteration} className={isBest ? 'bg-success/5' : ''}>
                        <td className="py-2 px-3 text-text-dim tabular-nums">{r.iteration}</td>
                        <td className="py-2 px-3 tabular-nums">
                          {r.frequency >= 1000 ? `${(r.frequency / 1000).toFixed(1)}G` : `${r.frequency}M`}
                        </td>
                        <td className="py-2 px-3 tabular-nums">{r.length.toFixed(3)}m</td>
                        <td className={`py-2 px-3 tabular-nums ${isBest ? 'text-success font-semibold' : ''}`}>
                          {r.s11.toFixed(1)}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default OptimizationPanel;
