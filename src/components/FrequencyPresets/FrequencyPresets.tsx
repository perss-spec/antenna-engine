import type { FC } from 'react';
import { cn } from '@/lib/utils';

interface FrequencyPreset {
  name: string;
  frequency: number;
}

interface PresetCategory {
  name: string;
  presets: readonly FrequencyPreset[];
}

const presetCategories: readonly PresetCategory[] = [
  {
    name: 'ISM',
    presets: [
      { name: '433M', frequency: 433 },
      { name: '915M', frequency: 915 },
      { name: '2.4G', frequency: 2450 },
      { name: '5.8G', frequency: 5800 },
    ],
  },
  {
    name: 'Ham',
    presets: [
      { name: '2m', frequency: 145 },
      { name: '70cm', frequency: 440 },
      { name: '23cm', frequency: 1296 },
    ],
  },
  {
    name: 'Sat',
    presets: [
      { name: 'NOAA', frequency: 137.5 },
      { name: 'GPS', frequency: 1575.42 },
      { name: 'Iridium', frequency: 1621.35 },
    ],
  },
  {
    name: 'Comm',
    presets: [
      { name: 'FM', frequency: 98.1 },
      { name: 'LTE', frequency: 850 },
      { name: '6E', frequency: 6500 },
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
    <div className={cn('flex flex-col gap-2', className)}>
      {presetCategories.map((category) => (
        <div key={category.name} className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-text-dim/60 w-8 shrink-0">{category.name}</span>
          <div className="flex flex-wrap gap-1">
            {category.presets.map((preset) => (
              <button
                key={preset.name}
                onClick={() => onSelect(preset.frequency)}
                disabled={disabled}
                className={cn(
                  'px-2 py-0.5 rounded text-[10px] font-medium transition-colors',
                  'border border-border/60 bg-surface hover:border-accent hover:bg-accent/10 hover:text-accent',
                  'disabled:pointer-events-none disabled:opacity-40',
                )}
                title={`${preset.frequency} MHz`}
              >
                {preset.name}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default FrequencyPresets;
