import { useState, useEffect } from 'react';
import type { FC } from 'react';
import { Zap, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface SimProgressProps {
  isRunning: boolean;
  progress: number; // 0-100
  currentStep: string;
  elapsedMs: number;
  className?: string;
}

const SimProgress: FC<SimProgressProps> = ({
  isRunning,
  progress,
  currentStep,
  elapsedMs,
  className
}) => {
  const [displayElapsed, setDisplayElapsed] = useState(elapsedMs);

  useEffect(() => {
    if (!isRunning) {
      setDisplayElapsed(elapsedMs);
      return;
    }

    const interval = setInterval(() => {
      setDisplayElapsed(prev => prev + 100);
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning, elapsedMs]);

  const formatElapsedTime = (ms: number): string => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    const minutes = Math.floor(ms / 60000);
    const seconds = Math.floor((ms % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
  };

  const clampedProgress = Math.max(0, Math.min(100, progress));

  return (
    <Card className={cn('', className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className={cn('h-4 w-4', isRunning ? 'text-accent animate-pulse' : 'text-text-muted')} />
            <span className="text-sm font-medium text-text">
              {isRunning ? 'Simulation Running' : 'Simulation Complete'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <Clock className="h-3 w-3" />
            <span className="tabular-nums">{formatElapsedTime(displayElapsed)}</span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-text-muted">{currentStep}</span>
            <span className="text-xs font-mono text-text">{clampedProgress.toFixed(0)}%</span>
          </div>
          <div className="w-full bg-surface-hover rounded-full h-2 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300 ease-out',
                isRunning
                  ? 'bg-gradient-to-r from-accent via-accent-hover to-accent bg-[length:200%_100%] animate-[shimmer_2s_ease-in-out_infinite]'
                  : 'bg-success'
              )}
              style={{ width: `${clampedProgress}%` }}
            />
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              isRunning ? 'bg-accent animate-pulse' : 'bg-success'
            )}
          />
          <span className="text-xs text-text-muted">
            {isRunning ? 'Computing...' : 'Ready'}
          </span>
        </div>
      </CardContent>
    </Card>
  );
};

export default SimProgress;