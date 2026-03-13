import { useState, useCallback } from 'react';
import type { FC, FormEvent, ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

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
      <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2 items-center">
        <div className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={range.enabled}
            onChange={e => setRange(r => ({ ...r, enabled: e.target.checked }))}
            disabled={isOptimizing}
            className="w-3 h-3 accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
          />
          <span className={`text-[11px] font-medium w-6 ${range.enabled ? 'text-text-muted' : 'text-text-dim/50'}`}>{label}</span>
        </div>
        <Input
          type="number"
          value={range.min}
          onChange={e => setRange(r => ({ ...r, min: parseFloat(e.target.value) || 0 }))}
          disabled={isOptimizing || !range.enabled}
          placeholder="min"
          className="h-8 text-[13px] disabled:opacity-40"
        />
        <Input
          type="number"
          value={range.max}
          onChange={e => setRange(r => ({ ...r, max: parseFloat(e.target.value) || 0 }))}
          disabled={isOptimizing || !range.enabled}
          placeholder="max"
          className="h-8 text-[13px] disabled:opacity-40"
        />
        <Input
          type="number"
          value={range.step}
          onChange={e => setRange(r => ({ ...r, step: parseFloat(e.target.value) || 0 }))}
          disabled={isOptimizing || !range.enabled}
          placeholder="step"
          className="h-8 text-[13px] disabled:opacity-40"
        />
      </div>
    );
  }

  return (
    <div className={`px-4 py-4 flex flex-col gap-6 ${className}`}>
      <form onSubmit={handleStart} className="flex flex-col gap-6">

        {/* Targets */}
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-3 gap-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="target-frequency" className="text-[13px] font-medium text-text-muted">Freq (MHz)</Label>
              <Input
                id="target-frequency"
                type="number"
                value={targetFrequency}
                onChange={handleFrequencyChange}
                min={100}
                max={10000}
                step={1}
                disabled={isOptimizing}
                className="h-8 text-[13px] focus-visible:ring-accent/50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="target-s11" className="text-[13px] font-medium text-text-muted">S11 (dB)</Label>
              <Input
                id="target-s11"
                type="number"
                value={targetS11}
                onChange={handleS11Change}
                min={-60}
                max={0}
                step={0.1}
                disabled={isOptimizing}
                className="h-8 text-[13px] focus-visible:ring-accent/50"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="opt-method" className="text-[13px] font-medium text-text-muted">Method</Label>
              <Select
                id="opt-method"
                value={method}
                onChange={handleMethodChange}
                disabled={isOptimizing}
                className="h-8 text-[13px] focus-visible:ring-accent/50"
              >
                <option value="gradient">Gradient</option>
                <option value="random">Random</option>
                <option value="nelder_mead">Nelder-Mead</option>
              </Select>
            </div>
          </div>
        </div>

        {/* Parameter ranges */}
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-2 mb-0.5">
            <div />
            <span className="text-[10px] text-text-dim/60 text-center">min</span>
            <span className="text-[10px] text-text-dim/60 text-center">max</span>
            <span className="text-[10px] text-text-dim/60 text-center">step</span>
          </div>
          {rangeRow('Freq', freqRange, setFreqRange)}
          {rangeRow('Len', lenRange, setLenRange)}
          {rangeRow('Rad', radRange, setRadRange)}
        </div>

        {/* Actions */}
        <div className="flex gap-2 items-center">
          {!isOptimizing ? (
            <Button
              type="submit"
              className="h-8 text-[13px] bg-accent hover:bg-accent-hover text-white px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
            >
              Optimize
            </Button>
          ) : (
            <Button
              type="button"
              variant="destructive"
              onClick={handleStop}
              className="h-8 text-[13px] px-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50"
            >
              Stop
            </Button>
          )}

          {isOptimizing && (
            <div className="flex-1">
              <div className="flex justify-between text-[10px] text-text-dim mb-0.5">
                <span>Progress</span>
                <span className="tabular-nums">{progress.toFixed(0)}%</span>
              </div>
              <div className="w-full h-1 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-accent transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {bestResult && !isOptimizing && (
            <span className="text-[10px] text-success tabular-nums ml-auto">
              Best: {bestResult.s11.toFixed(1)} dB
            </span>
          )}
        </div>
      </form>

      {results.length > 0 && (
        <div className="bg-surface border border-border/50 rounded overflow-hidden">
          <div className="max-h-[120px] overflow-y-auto">
            <table className="w-full text-[10px]">
              <thead className="text-text-dim uppercase tracking-wider border-b border-border/50 sticky top-0 bg-surface">
                <tr>
                  <th className="py-1.5 px-2 text-left">#</th>
                  <th className="py-1.5 px-2 text-left">Freq</th>
                  <th className="py-1.5 px-2 text-left">Len</th>
                  <th className="py-1.5 px-2 text-left">S11</th>
                </tr>
              </thead>
              <tbody>
                {results
                  .slice(-8)
                  .reverse()
                  .map(r => {
                    const isBest = r === bestResult;
                    return (
                      <tr key={r.iteration} className={isBest ? 'bg-success/5' : ''}>
                        <td className="py-1.5 px-2 text-text-dim tabular-nums">{r.iteration}</td>
                        <td className="py-1.5 px-2 tabular-nums">
                          {r.frequency >= 1000
                            ? `${(r.frequency / 1000).toFixed(1)}G`
                            : `${r.frequency}M`}
                        </td>
                        <td className="py-1.5 px-2 tabular-nums">{r.length.toFixed(3)}m</td>
                        <td
                          className={`py-1.5 px-2 tabular-nums ${
                            isBest ? 'text-success font-semibold' : ''
                          }`}
                        >
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
