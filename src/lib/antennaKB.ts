import antennaIndexData from '@/data/antennas/index.json';

export type AntennaCategory = 'wire' | 'microstrip' | 'broadband' | 'aperture' | 'array' | 'special';

export interface KBParameter {
  name: string;
  symbol: string;
  unit: string;
  description?: string;
  defaultFormula: string;
  range: { min: number; max: number };
}

export interface KBEntry {
  id: string;
  name: string;
  category: AntennaCategory;
  description: string;
  frequencyRange: { min: number; max: number; unit: string };
  typicalGain: { min: number; max: number; unit: string };
  typicalBandwidth: string;
  polarization: string;
  applications: string[];
  parameters: Record<string, KBParameter>;
  designMethodology: { overview: string; steps: { step: number; title: string; description: string; formula: string }[] };
  equations: Record<string, string>;
  mockSolverHints: { impedanceModel: string; radiationModel: string; keyAssumptions: string[] };
  references: string[];
}

export interface AntennaIndexEntry {
  id: string;
  name: string;
  category: AntennaCategory;
  description: string;
  polarization: string;
  typicalGain: { min: number; max: number; unit: string };
  typicalBandwidth: string;
}

// Eager-load all KB JSONs via Vite glob import
const kbModules = import.meta.glob<{ default: KBEntry }>('@/data/antennas/*.json', { eager: true });

const kbMap = new Map<string, KBEntry>();
for (const [path, mod] of Object.entries(kbModules)) {
  const filename = path.split('/').pop()?.replace('.json', '');
  if (filename && filename !== 'index') {
    kbMap.set(filename, mod.default ?? (mod as unknown as KBEntry));
  }
}

export const antennaIndex: AntennaIndexEntry[] = (antennaIndexData as { antennas: AntennaIndexEntry[] }).antennas;

export function getAntennaData(id: string): KBEntry | undefined {
  return kbMap.get(id);
}

export function getAntennasByCategory(): Record<AntennaCategory, AntennaIndexEntry[]> {
  const result: Record<string, AntennaIndexEntry[]> = {};
  for (const ant of antennaIndex) {
    if (!result[ant.category]) result[ant.category] = [];
    result[ant.category].push(ant);
  }
  return result as Record<AntennaCategory, AntennaIndexEntry[]>;
}

export function getCategoryForId(id: string): AntennaCategory {
  const entry = antennaIndex.find(a => a.id === id);
  return (entry?.category as AntennaCategory) ?? 'wire';
}

// Category display names
export const CATEGORY_LABELS: Record<AntennaCategory, string> = {
  wire: 'Wire Antennas',
  microstrip: 'Microstrip / Patch',
  broadband: 'Broadband',
  aperture: 'Aperture',
  array: 'Arrays',
  special: 'Special / Advanced',
};

// Default frequency (MHz) per antenna — derived from KB frequencyRange midpoint
function defaultFreqMHz(entry: KBEntry): number {
  const mid = Math.sqrt(entry.frequencyRange.min * entry.frequencyRange.max);
  return Math.round(mid / 1e6 * 10) / 10;
}

export interface AntennaPreset {
  id: string;
  name: string;
  category: AntennaCategory;
  description: string;
  frequency: number; // MHz
  polarization: string;
  typicalGain: { min: number; max: number };
}

export const ANTENNA_PRESETS: AntennaPreset[] = antennaIndex.map(a => {
  const kb = getAntennaData(a.id);
  return {
    id: a.id,
    name: a.name,
    category: a.category,
    description: a.description,
    frequency: kb ? defaultFreqMHz(kb) : 1000,
    polarization: a.polarization,
    typicalGain: { min: a.typicalGain.min, max: a.typicalGain.max },
  };
});

// Well-known preset overrides (keep original frequencies for classic types)
const FREQ_OVERRIDES: Record<string, number> = {
  half_wave_dipole: 145,
  quarter_wave_monopole: 433,
  rectangular_patch: 2400,
  quadrifilar_helix: 137.5,
  yagi_uda: 145,
  folded_dipole: 145,
  axial_helix: 435,
  log_periodic: 300,
  small_loop: 14,
  circular_patch: 2400,
  inset_fed_patch: 2400,
  pifa: 2400,
  inverted_f: 2400,
  vivaldi_tsa: 3000,
  bow_tie: 1000,
  archimedean_spiral: 2000,
  discone: 300,
  biconical: 500,
  pyramidal_horn: 10000,
  conical_horn: 10000,
  rectangular_slot: 5800,
  open_waveguide: 10000,
  parabolic_reflector: 12000,
  uniform_linear_array: 2400,
  planar_patch_array: 5800,
  phased_array: 10000,
  butler_matrix_array: 5800,
  sierpinski_fractal: 2400,
  dielectric_resonator: 5800,
  metamaterial_antenna: 2400,
  reconfigurable_antenna: 2400,
};

for (const p of ANTENNA_PRESETS) {
  if (FREQ_OVERRIDES[p.id]) p.frequency = FREQ_OVERRIDES[p.id];
}
