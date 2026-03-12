import type { FC } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ColorInfo {
  name: string;
  variable: string;
  hex: string;
  twClass: string;
  textColor?: string;
}

const colors: readonly ColorInfo[] = [
  { name: 'Background', variable: 'var(--color-background)', hex: '#0a0a0f', twClass: 'bg-background', textColor: 'text-text' },
  { name: 'Surface', variable: 'var(--color-surface)', hex: '#12121a', twClass: 'bg-surface', textColor: 'text-text' },
  { name: 'Surface Hover', variable: 'var(--color-surface-hover)', hex: '#1a1a28', twClass: 'bg-surface-hover', textColor: 'text-text' },
  { name: 'Border', variable: 'var(--color-border)', hex: '#1e1e2e', twClass: 'bg-border', textColor: 'text-text' },
  { name: 'Accent', variable: 'var(--color-accent)', hex: '#6366f1', twClass: 'bg-accent', textColor: 'text-white' },
  { name: 'Accent Hover', variable: 'var(--color-accent-hover)', hex: '#8b5cf6', twClass: 'bg-accent-hover', textColor: 'text-white' },
  { name: 'Text', variable: 'var(--color-text)', hex: '#e0e0e0', twClass: 'bg-text', textColor: 'text-background' },
  { name: 'Text Muted', variable: 'var(--color-text-muted)', hex: '#888', twClass: 'bg-text-muted', textColor: 'text-text' },
  { name: 'Text Dim', variable: 'var(--color-text-dim)', hex: '#555', twClass: 'bg-text-dim', textColor: 'text-text' },
  { name: 'Success', variable: 'var(--color-success)', hex: '#22c55e', twClass: 'bg-success', textColor: 'text-white' },
  { name: 'Warning', variable: 'var(--color-warning)', hex: '#f59e0b', twClass: 'bg-warning', textColor: 'text-white' },
  { name: 'Error', variable: 'var(--color-error)', hex: '#ef4444', twClass: 'bg-error', textColor: 'text-white' },
  { name: 'Info', variable: 'var(--color-info)', hex: '#06b6d4', twClass: 'bg-info', textColor: 'text-white' },
];

const ColorPalette: FC = () => {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {colors.map((color) => (
            <div key={color.name} className="border border-border rounded-lg bg-surface flex flex-col">
              <div className={cn(
                'h-24 rounded-t-lg flex items-center justify-center font-bold text-lg',
                color.twClass,
                color.textColor
              )}>
                Aa
              </div>
              <div className="p-3 flex-1 flex flex-col justify-center">
                <p className="font-semibold text-text text-sm">{color.name}</p>
                <p className="text-xs text-text-muted font-mono whitespace-nowrap overflow-hidden text-ellipsis">{color.variable}</p>
                <p className="text-xs text-text-dim font-mono">{color.hex}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default ColorPalette;
