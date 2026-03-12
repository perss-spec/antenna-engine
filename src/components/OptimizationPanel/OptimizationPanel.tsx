import { useState, useCallback } from 'react';
import type { FC, FormEvent, ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

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
  method: 'gradient' | 'random' | 'bayesian';
}

const OptimizationPanel: FC<OptimizationPanelProps> = ({
  onStartOptimization,
  onStopOptimization,
  isOptimizing = false,
  progress = 0,
  results = [],
  className = ''
}) => {
  const [targetFrequency, setTargetFrequency] = useState<number>(2400);
  const [targetS11, setTargetS11] = useState<number>(-20);
  const [method, setMethod] = useState<'gradient' | 'random' | 'bayesian'>('gradient');

  const handleStartOptimization = useCallback((e: FormEvent) => {
    e.preventDefault();
    if (onStartOptimization && !isOptimizing) {
      onStartOptimization({ targetFrequency, targetS11, method });
    }
  }, [targetFrequency, targetS11, method, onStartOptimization, isOptimizing]);

  const handleStopOptimization = useCallback(() => {
    if (onStopOptimization && isOptimizing) {
      onStopOptimization();
    }
  }, [onStopOptimization, isOptimizing]);

  const handleFrequencyChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setTargetFrequency(parseFloat(e.target.value) || 0);
  }, []);

  const handleS11Change = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setTargetS11(parseFloat(e.target.value) || 0);
  }, []);

  const handleMethodChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setMethod(e.target.value as 'gradient' | 'random' | 'bayesian');
  }, []);

  const formatFrequency = (freq: number): string => {
    if (freq >= 1000) return `${(freq / 1000).toFixed(2)} GHz`;
    return `${freq} MHz`;
  };

  const formatS11 = (s11: number): string => `${s11.toFixed(2)} dB`;

  const formatTimestamp = (timestamp: Date): string => timestamp.toLocaleTimeString();

  const getBestResult = (): OptimizationResult | null => {
    if (results.length === 0) return null;
    return results.reduce((best, current) => current.s11 < best.s11 ? current : best);
  };

  const bestResult = getBestResult();

  return (
    <div className={`p-5 text-text ${className}`}>
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-text mb-4">Antenna Optimization</h3>

        <form onSubmit={handleStartOptimization} className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="target-frequency">Target Frequency (MHz)</Label>
              <Input
                id="target-frequency"
                type="number"
                value={targetFrequency}
                onChange={handleFrequencyChange}
                min={100}
                max={10000}
                step={1}
                disabled={isOptimizing}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="target-s11">Target S11 (dB)</Label>
              <Input
                id="target-s11"
                type="number"
                value={targetS11}
                onChange={handleS11Change}
                min={-60}
                max={0}
                step={0.1}
                disabled={isOptimizing}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="optimization-method">Optimization Method</Label>
              <Select
                id="optimization-method"
                value={method}
                onChange={handleMethodChange}
                disabled={isOptimizing}
              >
                <option value="gradient">Gradient Descent</option>
                <option value="random">Random Search</option>
                <option value="bayesian">Bayesian Optimization</option>
              </Select>
            </div>
          </div>

          <div className="flex gap-3 items-center">
            {!isOptimizing ? (
              <Button type="submit" className="bg-accent hover:bg-accent-hover text-white">
                Start Optimization
              </Button>
            ) : (
              <Button type="button" variant="destructive" onClick={handleStopOptimization}>
                Stop Optimization
              </Button>
            )}

            {isOptimizing && (
              <div className="flex-1 min-w-[120px]">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[11px] text-text-muted">Progress</span>
                  <span className="text-[11px] text-text-muted tabular-nums">{progress.toFixed(1)}%</span>
                </div>
                <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </form>
      </div>

      {bestResult && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle className="text-success">Best Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-text-muted">Frequency: </span>
                <span className="text-text tabular-nums">{formatFrequency(bestResult.frequency)}</span>
              </div>
              <div>
                <span className="text-text-muted">S11: </span>
                <span className="text-success tabular-nums font-semibold">{formatS11(bestResult.s11)}</span>
              </div>
              <div>
                <span className="text-text-muted">Length: </span>
                <span className="text-text tabular-nums">{bestResult.length.toFixed(3)}m</span>
              </div>
              <div>
                <span className="text-text-muted">Radius: </span>
                <span className="text-text tabular-nums">{(bestResult.radius * 1000).toFixed(2)}mm</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {results.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-text mb-3">
            Results ({results.length} iterations)
          </h4>

          <div className="bg-surface border border-border rounded-lg overflow-hidden">
            <div className="max-h-[200px] overflow-y-auto">
              <table className="w-full text-[11px]">
                <thead className="text-text-muted uppercase tracking-wider border-b border-border sticky top-0 bg-surface">
                  <tr>
                    <th className="py-2 px-2 text-left">#</th>
                    <th className="py-2 px-2 text-left">Freq</th>
                    <th className="py-2 px-2 text-left">Length</th>
                    <th className="py-2 px-2 text-left">S11</th>
                    <th className="py-2 px-2 text-left">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {results.slice().reverse().map((result) => {
                    const isBest = result === bestResult;
                    return (
                      <tr
                        key={result.iteration}
                        className={`border-b border-border/50 ${isBest ? 'bg-success/5' : 'hover:bg-surface-hover'}`}
                      >
                        <td className="py-1.5 px-2 text-text-muted tabular-nums">{result.iteration}</td>
                        <td className="py-1.5 px-2 text-text tabular-nums">{formatFrequency(result.frequency)}</td>
                        <td className="py-1.5 px-2 text-text tabular-nums">{result.length.toFixed(4)}m</td>
                        <td className={`py-1.5 px-2 tabular-nums ${isBest ? 'text-success font-semibold' : result.s11 < targetS11 ? 'text-success' : 'text-text'}`}>
                          {formatS11(result.s11)}
                        </td>
                        <td className="py-1.5 px-2 text-text-muted tabular-nums">{formatTimestamp(result.timestamp)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OptimizationPanel;
