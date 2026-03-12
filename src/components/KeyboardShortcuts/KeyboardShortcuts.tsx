import { useEffect, useCallback } from 'react';
import type { FC, ReactNode } from 'react';
import { X } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
  onRunSimulation: () => void;
  onExport: () => void;
  onSwitchTab: (tabIndex: number) => void;
  className?: string;
}

const shortcuts: readonly { description: string; keys: string[] }[] = [
  { description: 'Run Simulation', keys: ['Ctrl', 'Enter'] },
  { description: 'Export Data', keys: ['Ctrl', 'E'] },
  { description: 'Switch to Tab 1-5', keys: ['Ctrl', '1-5'] },
  { description: 'Close Panel / Modal', keys: ['Esc'] },
];

const Kbd: FC<{ children: ReactNode }> = ({ children }) => (
  <kbd className="px-2 py-1 text-xs font-mono rounded bg-surface-hover border border-border text-text">
    {children}
  </kbd>
);

const KeyboardShortcuts: FC<KeyboardShortcutsProps> = ({
  isOpen,
  onClose,
  onRunSimulation,
  onExport,
  onSwitchTab,
  className,
}) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const isModifier = event.ctrlKey || event.metaKey;

    if (isModifier) {
      if (event.key === 'Enter') {
        event.preventDefault();
        onRunSimulation();
      } else if (event.key === 'e') {
        event.preventDefault();
        onExport();
      } else if (event.key >= '1' && event.key <= '5') {
        event.preventDefault();
        onSwitchTab(parseInt(event.key, 10));
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
  }, [onClose, onRunSimulation, onExport, onSwitchTab]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className={cn('fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm', className)} onClick={onClose}>
      <Card className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold text-text">Keyboard Shortcuts</CardTitle>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3">
            {shortcuts.map(({ description, keys }) => (
              <div key={description} className="flex items-center justify-between text-sm">
                <p className="text-text-muted">{description}</p>
                <div className="flex items-center gap-1.5">
                  {keys.map((key) => <Kbd key={key}>{key}</Kbd>)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default KeyboardShortcuts;
