import { useState, useEffect, useCallback, useMemo } from 'react';
import type { FC } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trash2, History, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';

// These types would likely be defined in a shared types file
interface AntennaParameters {
  frequency: number;
  length: number;
  radius: number;
  height: number;
  material: string;
}

interface SimulationResultSummary {
  minS11: number;
  resonantFrequency: number;
}

export interface HistoryItem {
  id: string; // ISO string timestamp
  timestamp: number;
  parameters: AntennaParameters;
  result: SimulationResultSummary;
}

interface SimulationHistoryProps {
  onLoadHistory: (item: HistoryItem) => void;
  className?: string;
}

const STORAGE_KEY = 'promin_simulation_history';

const useSimulationHistory = () => {
  const [history, setHistory] = useState<HistoryItem[]>(() => {
    try {
      const storedHistory = localStorage.getItem(STORAGE_KEY);
      return storedHistory ? JSON.parse(storedHistory) : [];
    } catch (error) {
      console.error('Failed to load simulation history:', error);
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('Failed to save simulation history:', error);
    }
  }, [history]);

  const removeHistoryItem = useCallback((id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  }, []);

  const clearHistory = useCallback(() => {
    setHistory([]);
  }, []);

  return { history, removeHistoryItem, clearHistory };
};

const SimulationHistory: FC<SimulationHistoryProps> = ({ onLoadHistory, className }) => {
  const { history, removeHistoryItem, clearHistory } = useSimulationHistory();

  const sortedHistory = useMemo(() => {
    return [...history].sort((a, b) => b.timestamp - a.timestamp);
  }, [history]);

  const s11ToVariant = (s11: number): 'success' | 'warning' | 'error' => {
    if (s11 < -10) return 'success';
    if (s11 <= -6) return 'warning';
    return 'error';
  };

  return (
    <Card className={cn('flex flex-col', className)}>
      <CardHeader className="flex flex-row items-center justify-between p-3 border-b border-border">
        <CardTitle className="flex items-center gap-2">
          <History className="h-3 w-3" />
          Simulation History
        </CardTitle>
        {history.length > 0 && (
          <Button variant="ghost" size="sm" onClick={clearHistory} className="h-7 text-xs px-2">
            Clear All
          </Button>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-3">
        {sortedHistory.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm text-text-muted">No simulation history.</p>
            <p className="text-xs text-text-dim mt-1">Run a simulation to see it here.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {sortedHistory.map((item) => (
              <li key={item.id} className="p-2.5 bg-surface-hover rounded-md border border-border flex flex-col gap-2.5">
                <div className="flex justify-between items-start">
                  <span className="text-xs text-text-muted">
                    {new Date(item.timestamp).toLocaleString()}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => onLoadHistory(item)} className="h-7 text-xs px-2 gap-1">
                      <RotateCw className="h-3 w-3"/>
                      Load
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => removeHistoryItem(item.id)} className="h-7 w-7 p-0 text-text-muted hover:text-error">
                       <Trash2 className="h-3.5 w-3.5" />
                       <span className="sr-only">Delete</span>
                    </Button>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 items-center">
                  <Badge variant="default">
                    L: {item.parameters.length.toFixed(1)}mm
                  </Badge>
                   <Badge variant="purple">
                    F: {(item.result.resonantFrequency / 1e6).toFixed(0)}MHz
                  </Badge>
                  <Badge variant={s11ToVariant(item.result.minS11)}>
                    S11: {item.result.minS11.toFixed(1)}dB
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
};

export default SimulationHistory;
