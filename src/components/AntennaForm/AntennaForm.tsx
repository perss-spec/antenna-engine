import { useState, useCallback, useEffect, useMemo } from 'react';
import type { FC, FormEvent, ChangeEvent } from 'react';
import { Radio, ChevronDown } from 'lucide-react';
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

function CollapsibleSection({ title, defaultOpen = false, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-t border-border/30">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-text-dim/70 hover:text-text-muted transition-colors"
      >
        {title}
        <ChevronDown className={cn('w-3 h-3 transition-transform duration-200', open && 'rotate-180')} />
      </button>
      {open && <div className="px-4 pb-3" style={{ animation: 'fadeIn 0.15s ease-out' }}>{children}</div>}
    </div>
  );
}

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
    <div className={cn('flex flex-col', className)}>
      <form onSubmit={handleSubmit} className="flex flex-col">
        {/* Antenna Type */}
        <div className="px-6 py-4 flex flex-col gap-2">
          <Label htmlFor="antennaType" className="text-xs">Antenna Type</Label>
          <Select
            id="antennaType"
            value={localParams.antennaType}
            onChange={handleTypeChange}
            disabled={isSimulating}
            className="h-9 text-xs"
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
            <p className="text-[10px] leading-tight text-text-dim/70 line-clamp-2">
              {preset.description.slice(0, 100)}
            </p>
          )}
        </div>

        {/* Core Parameters */}
        <div className="px-6 pb-4 grid grid-cols-2 gap-x-4 gap-y-3">
          <div className="col-span-2 flex flex-col gap-1">
            <Label htmlFor="frequency" className="text-xs">Frequency (MHz)</Label>
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
              className="h-9 text-xs"
            />
          </div>

          {showWireParams && (
            <>
              <div className="flex flex-col gap-1">
                <Label htmlFor="length" className="text-xs">Length (mm)</Label>
                <Input
                  id="length"
                  type="number"
                  value={localParams.length}
                  onChange={handleInputChange('length')}
                  min={0.1}
                  max={100000}
                  step={0.1}
                  disabled={isSimulating}
                  className="h-9 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="radius" className="text-xs">Radius (mm)</Label>
                <Input
                  id="radius"
                  type="number"
                  value={localParams.radius}
                  onChange={handleInputChange('radius')}
                  min={0.01}
                  max={10}
                  step={0.01}
                  disabled={isSimulating}
                  className="h-9 text-xs"
                />
              </div>
            </>
          )}

          {showPatchParams && (
            <>
              <div className="flex flex-col gap-1">
                <Label htmlFor="patchWidth" className="text-xs">Width (mm)</Label>
                <Input
                  id="patchWidth"
                  type="number"
                  value={localParams.patchWidth || 38}
                  onChange={handleInputChange('patchWidth')}
                  min={1}
                  max={500}
                  step={0.1}
                  disabled={isSimulating}
                  className="h-9 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="substrateEr" className="text-xs">Er</Label>
                <Input
                  id="substrateEr"
                  type="number"
                  value={localParams.substrateEr || 4.4}
                  onChange={handleInputChange('substrateEr')}
                  min={1}
                  max={20}
                  step={0.1}
                  disabled={isSimulating}
                  className="h-9 text-xs"
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label htmlFor="substrateHeight" className="text-xs">Sub. H (mm)</Label>
                <Input
                  id="substrateHeight"
                  type="number"
                  value={localParams.substrateHeight || 1.6}
                  onChange={handleInputChange('substrateHeight')}
                  min={0.1}
                  max={10}
                  step={0.1}
                  disabled={isSimulating}
                  className="h-9 text-xs"
                />
              </div>
            </>
          )}

          <div className="flex flex-col gap-1">
            <Label htmlFor="material" className="text-xs">Material</Label>
            <Select
              id="material"
              value={localParams.material}
              onChange={handleInputChange('material')}
              disabled={isSimulating}
              required
              className="h-9 text-xs"
            >
              <option value="copper">Copper</option>
              <option value="aluminum">Aluminum</option>
              <option value="silver">Silver</option>
              <option value="brass">Brass</option>
            </Select>
          </div>
        </div>

        {/* KB Extra Parameters — collapsible */}
        {extraKBParams.length > 0 && (
          <CollapsibleSection title="KB Parameters">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {extraKBParams.slice(0, 6).map(([key, param]) => (
                <div key={key} className="flex flex-col gap-0.5">
                  <Label htmlFor={`extra-${key}`} className="text-[10px] text-text-dim truncate" title={`${param.name} (${param.symbol})`}>
                    {param.symbol} ({param.unit})
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
                    className="h-7 text-[11px]"
                  />
                </div>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Run button */}
        <div className="px-6 py-4">
          <div className="relative">
            <Button
              type="submit"
              disabled={isSimulating}
              className="w-full h-10 bg-gradient-to-r from-accent via-accent to-purple-500 hover:opacity-90 text-white text-sm font-semibold shadow-lg shadow-accent/25 rounded-xl"
            >
              {isSimulating ? (
                <span className="inline-flex items-center gap-2">
                  <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full" style={{ animation: 'spin-slow 0.8s linear infinite' }} />
                  Simulating...
                </span>
              ) : (
                <span className="inline-flex items-center gap-2">
                  <Radio className="size-4" />
                  Run Simulation
                </span>
              )}
            </Button>
            {!isSimulating && <div className="absolute -inset-0.5 bg-gradient-to-r from-accent to-purple-500 rounded-xl blur-md opacity-20 -z-10" />}
          </div>
        </div>
      </form>
    </div>
  );
};

export default AntennaForm;
