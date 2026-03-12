import type { FC } from 'react';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { cn } from '@/lib/utils';

interface FrequencyPreset {
  name: string;
  frequency: number; // in MHz
}

const presets: readonly FrequencyPreset[] = [
  { name: 'UHF 433MHz', frequency: 433 },
  { name: 'GPS L1', frequency: 1575.42 },
  { name: 'ISM 2.4GHz', frequency: 2450 },
  { name: 'LTE Band 7', frequency: 2535 },
  { name: 'ISM 5.8GHz', frequency: 5800 },
  { name: 'Wi-Fi 6E', frequency: 6500 },
];

interface FrequencyPresetsProps {
  onSelect: (frequency: number) => void;
  className?: string;
  disabled?: boolean;
}

const FrequencyPresets: FC<FrequencyPresetsProps> = ({ onSelect, className, disabled = false }) => {
  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedFrequency = parseFloat(event.target.value);
    if (!isNaN(selectedFrequency)) {
      onSelect(selectedFrequency);
    }
    // Reset select to placeholder to allow re-selecting the same preset
    event.target.value = '';
  };

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor="frequency-presets">Frequency Presets</Label>
      <Select
        id="frequency-presets"
        onChange={handleSelectChange}
        disabled={disabled}
        defaultValue=""
      >
        <option value="" disabled>
          Select a band...
        </option>
        {presets.map((preset) => (
          <option key={preset.name} value={preset.frequency}>
            {preset.name} ({preset.frequency} MHz)
          </option>
        ))}
      </Select>
    </div>
  );
};

export default FrequencyPresets;
