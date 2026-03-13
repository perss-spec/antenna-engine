import { useState, useCallback, useEffect, useMemo } from 'react';
import type { FC, FormEvent, ChangeEvent } from 'react';
import { Radio } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  ANTENNA_PRESETS,
  CATEGORY_LABELS,
  getAntennasByCategory,
  getAntennaData,
  getCategoryForId,
} from '@/lib/antennaKB';
import type { AntennaCategory, KBParameter } from '@/lib/antennaKB';

export type AntennaType = string;

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
  extraParams: Record<string, number>;
}

interface AntennaFormProps {
  parameters: AntennaParameters;
  onParametersChange: (params: AntennaParameters) => void;
  onSubmit: (params: AntennaParameters) => void;
  isSimulating?: boolean;
  className?: string;
}

const CATEGORY_ORDER: AntennaCategory[] = ['wire', 'microstrip', 'broadband', 'aperture', 'array', 'special'];

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

  const grouped = useMemo(() => getAntennasByCategory(), []);
  const category = getCategoryForId(localParams.antennaType);
  const kbEntry = useMemo(() => getAntennaData(localParams.antennaType), [localParams.antennaType]);
  const preset = ANTENNA_PRESETS.find(p => p.id === localParams.antennaType);

  // KB-defined extra parameters (exclude frequency/length/radius which are standard)
  const extraKBParams = useMemo(() => {
    if (!kbEntry) return [] as [string, KBParameter][];
    return Object.entries(kbEntry.parameters).filter(
      ([key]) => !['frequency', 'length', 'radius'].includes(key)
    );
  }, [kbEntry]);

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

  const handleExtraParamChange = useCallback((key: string) => (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    const value = parseFloat(event.target.value) || 0;
    const updatedParams = {
      ...localParams,
      extraParams: { ...localParams.extraParams, [key]: value },
    };
    setLocalParams(updatedParams);
    onParametersChange(updatedParams);
  }, [localParams, onParametersChange]);

  const handleTypeChange = useCallback((event: ChangeEvent<HTMLSelectElement>) => {
    const id = event.target.value;
    const p = ANTENNA_PRESETS.find(a => a.id === id);
    const cat = getCategoryForId(id);

    const updatedParams: AntennaParameters = {
      ...localParams,
      antennaType: id,
      frequency: p?.frequency ?? localParams.frequency,
      length: 0,
      radius: 1,
      height: 0,
      substrateEr: cat === 'microstrip' ? 4.4 : undefined,
      substrateHeight: cat === 'microstrip' ? 1.6 : undefined,
      patchWidth: cat === 'microstrip' ? 38 : undefined,
      extraParams: {},
    };
    setLocalParams(updatedParams);
    onParametersChange(updatedParams);
  }, [localParams, onParametersChange]);

  const handleSubmit = useCallback((event: FormEvent) => {
    event.preventDefault();
    onSubmit(localParams);
  }, [localParams, onSubmit]);

  const showWireParams = category === 'wire';
  const showPatchParams = category === 'microstrip';

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
            {CATEGORY_ORDER.map(cat => {
              const items = grouped[cat];
              if (!items?.length) return null;
              return (
                <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
                  {items.map(a => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </optgroup>
              );
            })}
          </Select>
          {preset && (
            <span className="text-[11px] text-accent/70 bg-accent/5 px-2 py-0.5 rounded line-clamp-2">
              {preset.description.slice(0, 120)}
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="frequency">Center Frequency (MHz)</Label>
          <Input
            id="frequency"
            type="number"
            value={localParams.frequency}
            onChange={handleInputChange('frequency')}
            min={1}
            max={300000}
            step={0.1}
            disabled={isSimulating}
            required
          />
        </div>

        {showWireParams && (
          <>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="length">Element Length (mm)</Label>
              <Input
                id="length"
                type="number"
                value={localParams.length}
                onChange={handleInputChange('length')}
                min={0.1}
                max={100000}
                step={0.1}
                disabled={isSimulating}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="radius">Wire Radius (mm)</Label>
              <span className="text-[10px] text-text-dim">Typical: 0.5-3mm. Affects impedance bandwidth.</span>
              <Input
                id="radius"
                type="number"
                value={localParams.radius}
                onChange={handleInputChange('radius')}
                min={0.01}
                max={10}
                step={0.01}
                disabled={isSimulating}
              />
            </div>
          </>
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
              <span className="text-[10px] text-text-dim">Dielectric constant. FR-4=4.4, Rogers=2.2-10.2</span>
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

        {/* Dynamic KB extra parameters */}
        {extraKBParams.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-border pt-2">
            <span className="text-[10px] text-text-dim font-semibold uppercase tracking-wide">KB Parameters</span>
            {extraKBParams.slice(0, 6).map(([key, param]) => (
              <div key={key} className="flex flex-col gap-1">
                <Label htmlFor={`extra-${key}`} className="text-xs">
                  {param.name} ({param.symbol}, {param.unit})
                </Label>
                <Input
                  id={`extra-${key}`}
                  type="number"
                  value={localParams.extraParams[key] ?? ''}
                  onChange={handleExtraParamChange(key)}
                  placeholder={param.defaultFormula}
                  min={param.range.min}
                  max={param.range.max}
                  step="any"
                  disabled={isSimulating}
                />
              </div>
            ))}
          </div>
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
