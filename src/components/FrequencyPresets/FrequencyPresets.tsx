import type { FC } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

interface FrequencyPreset {
  name: string;
  frequency: number; // in MHz
}

interface PresetCategory {
  name: string;
  presets: readonly FrequencyPreset[];
}

const presetCategories: readonly PresetCategory[] = [
  {
    name: 'ISM',
    presets: [
      { name: '433 MHz', frequency: 433 },
      { name: '915 MHz', frequency: 915 },
      { name: '2.4 GHz', frequency: 2450 },
      { name: '5.8 GHz', frequency: 5800 },
    ],
  },
  {
    name: 'Amateur Radio',
    presets: [
      { name: '2m Band', frequency: 145 },
      { name: '70cm Band', frequency: 440 },
      { name: '23cm Band', frequency: 1296 },
    ],
  },
  {
    name: 'Satellite',
    presets: [
      { name: 'NOAA APT', frequency: 137.5 },
      { name: 'GPS L1', frequency: 1575.42 },
      { name: 'Iridium', frequency: 1621.35 },
    ],
  },
  {
    name: 'Commercial',
    presets: [
      { name: 'FM Radio', frequency: 98.1 },
      { name: 'LTE B5', frequency: 850 },
      { name: 'Wi-Fi 6E', frequency: 6500 },
    ],
  },
];

interface FrequencyPresetsProps {
  onSelect: (frequency: number) => void;
  className?: string;
  disabled?: boolean;
}

const FrequencyPresets: FC<FrequencyPresetsProps> = ({ onSelect, className, disabled = false }) => {
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <Label>Frequency Presets</Label>
      <div className="flex flex-col gap-3">
        {presetCategories.map((category) => (
          <div key={category.name}>
            <h4 className="mb-2 text-xs font-medium text-text-muted uppercase tracking-wider">
              {category.name}
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {category.presets.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => onSelect(preset.frequency)}
                  disabled={disabled}
                  className={cn(
                    'flex h-12 flex-col items-center justify-center rounded-md border p-1 text-center transition-colors',
                    'border-border bg-surface hover:border-accent hover:bg-accent/10 focus:outline-none focus:ring-1 focus:ring-accent',
                    'disabled:pointer-events-none disabled:opacity-50',
                  )}
                >
                  <span className="text-xs font-medium text-text">{preset.name}</span>
                  <span className="text-[10px] text-text-muted">{preset.frequency} MHz</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FrequencyPresets;