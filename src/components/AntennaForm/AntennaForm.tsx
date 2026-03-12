import { useState, useCallback } from 'react';
import type { FC, FormEvent, ChangeEvent } from 'react';
import { Radio } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AntennaParameters {
  frequency: number;
  length: number;
  radius: number;
  height: number;
  material: string;
}

interface AntennaFormProps {
  parameters: AntennaParameters;
  onParametersChange: (params: AntennaParameters) => void;
  onSubmit: (params: AntennaParameters) => void;
  isSimulating?: boolean;
  className?: string;
}

const AntennaForm: FC<AntennaFormProps> = ({
  parameters,
  onParametersChange,
  onSubmit,
  isSimulating = false,
  className
}) => {
  const [localParams, setLocalParams] = useState<AntennaParameters>(parameters);

  const handleInputChange = useCallback((field: keyof AntennaParameters) => (
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const value = event.target.type === 'number'
      ? parseFloat(event.target.value) || 0
      : event.target.value;

    const updatedParams = { ...localParams, [field]: value };
    setLocalParams(updatedParams);
    onParametersChange(updatedParams);
  }, [localParams, onParametersChange]);

  const handleSubmit = useCallback((event: FormEvent) => {
    event.preventDefault();
    onSubmit(localParams);
  }, [localParams, onSubmit]);

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <h3 className="text-sm font-semibold text-text">Dipole Antenna Parameters</h3>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="frequency">Frequency (MHz)</Label>
          <Input
            id="frequency"
            type="number"
            value={localParams.frequency}
            onChange={handleInputChange('frequency')}
            min={1}
            max={10000}
            step={0.1}
            disabled={isSimulating}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="length">Length (mm)</Label>
          <Input
            id="length"
            type="number"
            value={localParams.length}
            onChange={handleInputChange('length')}
            min={0.1}
            max={1000}
            step={0.1}
            disabled={isSimulating}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="radius">Wire Radius (mm)</Label>
          <Input
            id="radius"
            type="number"
            value={localParams.radius}
            onChange={handleInputChange('radius')}
            min={0.01}
            max={10}
            step={0.01}
            disabled={isSimulating}
            required
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="height">Height Above Ground (mm)</Label>
          <Input
            id="height"
            type="number"
            value={localParams.height}
            onChange={handleInputChange('height')}
            min={0}
            max={10000}
            step={1}
            disabled={isSimulating}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="material">Material</Label>
          <Select
            id="material"
            value={localParams.material}
            onChange={handleInputChange('material')}
            disabled={isSimulating}
            required
          >
            <option value="copper">Copper</option>
            <option value="aluminum">Aluminum</option>
            <option value="silver">Silver</option>
            <option value="brass">Brass</option>
          </Select>
        </div>

        <Button
          type="submit"
          disabled={isSimulating}
          className="w-full bg-gradient-to-r from-accent to-accent-hover hover:opacity-90 text-white"
        >
          {isSimulating ? (
            'Simulating...'
          ) : (
            <span className="inline-flex items-center gap-2">
              <Radio className="size-4" />
              Run Simulation
            </span>
          )}
        </Button>
      </form>
    </div>
  );
};

export default AntennaForm;
