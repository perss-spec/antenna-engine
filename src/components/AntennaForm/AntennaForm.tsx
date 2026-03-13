import { useState, useCallback, useEffect } from 'react';
import type { FC, FormEvent, ChangeEvent } from 'react';
import { Radio } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type AntennaType = 'dipole' | 'monopole' | 'patch' | 'qfh' | 'yagi';

export interface AntennaParameters {
  antennaType: AntennaType;
  frequency: number;
  length: number;
  radius: number;
  height: number;
  material: string;
  substrateEr?: number;
  substrateHeight?: number;
  patchWidth?: number;
}

interface AntennaFormProps {
  parameters: AntennaParameters;
  onParametersChange: (params: AntennaParameters) => void;
  onSubmit: (params: AntennaParameters) => void;
  isSimulating?: boolean;
  className?: string;
}

const ANTENNA_PRESETS: Record<AntennaType, { name: string; frequency: number; length: number; radius: number; height: number; description: string; substrateEr?: number; substrateHeight?: number; patchWidth?: number }> = {
  dipole: { name: 'Half-Wave Dipole', frequency: 145, length: 1034, radius: 1, height: 0, description: 'Classic half-wave dipole' },
  monopole: { name: 'Quarter-Wave Monopole', frequency: 433, length: 173, radius: 1, height: 0, description: 'Monopole over ground plane' },
  patch: { name: 'Rectangular Patch', frequency: 2400, length: 29, radius: 0, height: 0, description: 'Microstrip patch on FR-4', substrateEr: 4.4, substrateHeight: 1.6, patchWidth: 38 },
  qfh: { name: 'QFH (Quadrifilar Helix)', frequency: 137.5, length: 350, radius: 1, height: 550, description: 'Circular polarization helix' },
  yagi: { name: '3-Element Yagi-Uda', frequency: 145, length: 1034, radius: 3, height: 0, description: 'Directional beam antenna' },
};

const AntennaForm: FC<AntennaFormProps> = ({
  parameters,
  onParametersChange,
  onSubmit,
  isSimulating = false,
  className
}) => {
  const [localParams, setLocalParams] = useState<AntennaParameters>(parameters);

  useEffect(() => {
    setLocalParams(parameters);
  }, [parameters]);

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

  const handleTypeChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const type = event.target.value as AntennaType;
    const preset = ANTENNA_PRESETS[type];
    const updatedParams: AntennaParameters = {
      ...localParams,
      antennaType: type,
      frequency: preset.frequency,
      length: preset.length,
      radius: preset.radius,
      height: preset.height,
      substrateEr: preset.substrateEr,
      substrateHeight: preset.substrateHeight,
      patchWidth: preset.patchWidth,
    };
    setLocalParams(updatedParams);
    onParametersChange(updatedParams);
  }, [localParams, onParametersChange]);

  const handleSubmit = useCallback((event: FormEvent) => {
    event.preventDefault();
    onSubmit(localParams);
  }, [localParams, onSubmit]);

  const preset = ANTENNA_PRESETS[localParams.antennaType];
  const showWireParams = ['dipole', 'monopole', 'yagi', 'qfh'].includes(localParams.antennaType);
  const showPatchParams = localParams.antennaType === 'patch';
  const showHeightParam = localParams.antennaType === 'qfh';

  return (
    <div className={cn('flex flex-col gap-3 px-6 py-4', className)}>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="antennaType">Antenna Type</Label>
          <Select
            id="antennaType"
            value={localParams.antennaType}
            onChange={handleTypeChange}
            disabled={isSimulating}
          >
            {Object.entries(ANTENNA_PRESETS).map(([key, val]) => (
              <option key={key} value={key}>{val.name}</option>
            ))}
          </Select>
          <span className="text-[11px] text-text-dim">{preset.description}</span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="frequency">Center Frequency (MHz)</Label>
          <Input
            id="frequency"
            type="number"
            value={localParams.frequency}
            onChange={handleInputChange('frequency')}
            min={1}
            max={30000}
            step={0.1}
            disabled={isSimulating}
            required
          />
        </div>

        {showWireParams && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="length">
                {localParams.antennaType === 'monopole' ? 'Height (mm)' : 'Element Length (mm)'}
              </Label>
              <Input
                id="length"
                type="number"
                value={localParams.length}
                onChange={handleInputChange('length')}
                min={0.1}
                max={10000}
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
          </>
        )}

        {showHeightParam && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="height">Height (mm)</Label>
            <Input
              id="height"
              type="number"
              value={localParams.height}
              onChange={handleInputChange('height')}
              min={1}
              max={10000}
              step={1}
              disabled={isSimulating}
              required
            />
          </div>
        )}

        {showPatchParams && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="patchWidth">Patch Width (mm)</Label>
              <Input
                id="patchWidth"
                type="number"
                value={localParams.patchWidth || 38}
                onChange={handleInputChange('patchWidth')}
                min={1}
                max={500}
                step={0.1}
                disabled={isSimulating}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="substrateEr">Substrate Er</Label>
              <Input
                id="substrateEr"
                type="number"
                value={localParams.substrateEr || 4.4}
                onChange={handleInputChange('substrateEr')}
                min={1}
                max={20}
                step={0.1}
                disabled={isSimulating}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="substrateHeight">Substrate Height (mm)</Label>
              <Input
                id="substrateHeight"
                type="number"
                value={localParams.substrateHeight || 1.6}
                onChange={handleInputChange('substrateHeight')}
                min={0.1}
                max={10}
                step={0.1}
                disabled={isSimulating}
              />
            </div>
          </>
        )}

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
