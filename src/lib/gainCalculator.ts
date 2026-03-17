import { api } from '@/lib/api';
import { getCategoryForId } from '@/lib/antennaKB';

const GAIN_TABLE: Record<string, number> = {
  // wire
  half_wave_dipole: 2.15,
  quarter_wave_monopole: 5.15,
  folded_dipole: 2.15,
  dipole: 2.15,
  monopole: 5.15,
  yagi: 10.0,
  yagi_uda: 10.0,
  lpda: 7.0,
  helix: 12.0,
  helical: 12.0,
  loop: 1.75,
  // microstrip
  patch: 6.0,
  microstrip_patch: 6.0,
  ifa: 2.0,
  pifa: 3.0,
  // broadband
  vivaldi: 8.0,
  bow_tie: 3.0,
  biconical: 2.0,
  discone: 2.0,
  spiral: 3.0,
  // aperture
  horn: 15.0,
  pyramidal_horn: 15.0,
  conical_horn: 13.0,
  parabolic: 30.0,
  slot: 4.0,
  // array
  phased_array: 12.0,
  linear_array: 10.0,
  // special
  qfh: 3.0,
  turnstile: 2.15,
  fractal: 2.5,
  isotropic: 0.0,
};

export function analyticalGain(antennaType: string): number {
  return GAIN_TABLE[antennaType] ?? GAIN_TABLE[getCategoryForId(antennaType)] ?? 2.15;
}

export async function computeGain(antennaType: string, frequency: number): Promise<number> {
  try {
    const serverOk = await api.isServerAvailable();
    if (serverOk) {
      const resp = await api.pattern({
        antenna_type: antennaType,
        frequency,
        theta_points: 37,
        phi_points: 73,
      });
      return resp.max_gain;
    }
  } catch { /* fallback */ }
  return analyticalGain(antennaType);
}
