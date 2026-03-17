import { describe, it, expect } from 'vitest';
import { fromSweepResult, toS11ChartData, toSmithData, toVswrData, toImpedanceChartData } from '@/lib/unifiedResults';
import type { SweepResult } from '@/components/SolverPanel/SolverPanel';

/**
 * Realistic dipole sweep: 5 points around 146 MHz resonance.
 * Impedance near 73+42j at resonance, detuned at edges.
 */
function makeDipoleSweep(): SweepResult {
  const freqs = [140e6, 143e6, 146e6, 149e6, 152e6];
  const impedances = [
    { real: 30, imag: -35 },
    { real: 42, imag: -18 },
    { real: 50.5, imag: 1 },  // near resonance — closest to 50 Ohm
    { real: 60, imag: 20 },
    { real: 38, imag: 40 },
  ];

  const results = freqs.map((f, i) => {
    const zr = impedances[i].real;
    const zi = impedances[i].imag;
    const dr = zr + 50;
    const di = zi;
    const dMag2 = dr * dr + di * di;
    const gr = ((zr - 50) * dr + zi * di) / dMag2;
    const gi = (zi * dr - (zr - 50) * di) / dMag2;
    const gMag2 = gr * gr + gi * gi;
    const s11_db = 10 * Math.log10(gMag2 || 1e-20);
    const s11_mag = Math.sqrt(gMag2);
    const vswr = (1 + Math.min(s11_mag, 0.9999)) / (1 - Math.min(s11_mag, 0.9999));

    return {
      solver: 'MoM Wire' as const,
      frequency: f,
      impedance: impedances[i],
      s11_db,
      vswr,
      gain_dbi: 2.15,
      computation_time: 10,
      convergence: { converged: true, iterations: 5, final_error: 1e-6 },
    };
  });

  return { solver: 'MoM Wire', frequencies: freqs, results };
}

/**
 * Sweep with a clear -10 dB bandwidth window (points 1-3 below -10 dB).
 */
function makeWidebandSweep(): SweepResult {
  const freqs = [100e6, 110e6, 120e6, 130e6, 140e6];
  // S11 values: only middle 3 are below -10 dB
  const s11Values = [-5, -12, -20, -14, -6];
  const impedances = [
    { real: 30, imag: -40 },
    { real: 45, imag: -15 },
    { real: 50, imag: 1 },
    { real: 48, imag: 10 },
    { real: 35, imag: 30 },
  ];

  const results = freqs.map((f, i) => {
    const s11_mag = Math.pow(10, s11Values[i] / 20);
    const vswr = (1 + Math.min(s11_mag, 0.9999)) / (1 - Math.min(s11_mag, 0.9999));
    return {
      solver: 'MoM Wire' as const,
      frequency: f,
      impedance: impedances[i],
      s11_db: s11Values[i],
      vswr,
      gain_dbi: 2.15,
      computation_time: 10,
      convergence: { converged: true, iterations: 5, final_error: 1e-6 },
    };
  });

  return { solver: 'MoM Wire', frequencies: freqs, results };
}

describe('SweepResult -> unified -> chart data pipeline', () => {
  const sweep = makeDipoleSweep();
  const unified = fromSweepResult(sweep);

  it('S11 chart data has correct MHz frequencies and reasonable values', () => {
    const s11Data = toS11ChartData(unified);

    expect(s11Data).toHaveLength(5);
    expect(s11Data.map(d => d.frequency)).toEqual([140, 143, 146, 149, 152]);

    for (const pt of s11Data) {
      expect(pt.s11_db).toBeLessThan(0);
      expect(pt.s11_db).toBeGreaterThan(-40);
    }

    // Best match near resonance (146 MHz, index 2)
    const bestIdx = s11Data.reduce((bi, pt, i, arr) =>
      pt.s11_db < arr[bi].s11_db ? i : bi, 0);
    expect(s11Data[bestIdx].frequency).toBe(146);
  });

  it('VSWR values are > 1 and best match has lowest VSWR', () => {
    const vswrData = toVswrData(unified);

    expect(vswrData).toHaveLength(5);
    for (const pt of vswrData) {
      expect(pt.vswr).toBeGreaterThan(1);
    }

    // Best VSWR should correspond to best S11 (146 MHz)
    const bestIdx = vswrData.reduce((bi, pt, i, arr) =>
      pt.vswr < arr[bi].vswr ? i : bi, 0);
    expect(vswrData[bestIdx].frequency).toBe(146);
  });

  it('impedance chart data matches original impedance values', () => {
    const impData = toImpedanceChartData(unified);

    expect(impData).toHaveLength(5);
    expect(impData[0].frequency).toBe(140);
    expect(impData[0].real).toBe(30);
    expect(impData[0].imag).toBe(-35);

    expect(impData[2].frequency).toBe(146);
    expect(impData[2].real).toBe(50.5);
    expect(impData[2].imag).toBe(1);
  });

  it('Smith data maps impedance points correctly', () => {
    const smith = toSmithData(unified);

    expect(smith).toHaveLength(5);
    for (let i = 0; i < smith.length; i++) {
      expect(smith[i].re).toBe(sweep.results[i].impedance.real);
      expect(smith[i].im).toBe(sweep.results[i].impedance.imag);
      expect(smith[i].freq).toBe(sweep.frequencies[i]);
    }
  });

  it('resonant frequency is detected at minimum S11', () => {
    // Middle point (146 MHz) has impedance closest to 50 Ohm -> lowest S11
    expect(unified.resonantFreq).toBe(146e6);
    expect(unified.minS11).toBeLessThan(-10);
  });
});

describe('bandwidth calculation', () => {
  it('computes positive bandwidth when points are below -10 dB', () => {
    const sweep = makeWidebandSweep();
    const unified = fromSweepResult(sweep);

    // Points at indices 1,2,3 (110, 120, 130 MHz) are below -10 dB
    expect(unified.bandwidth).toBe(130e6 - 110e6); // 20 MHz
    expect(unified.bandwidth).toBeGreaterThan(0);
  });

  it('returns zero bandwidth when no points are below -10 dB', () => {
    const sweep = makeDipoleSweep();
    // Modify all S11 to be above -10 dB
    const weakSweep: SweepResult = {
      ...sweep,
      results: sweep.results.map(r => ({
        ...r,
        s11_db: -5,
      })),
    };
    const unified = fromSweepResult(weakSweep);
    expect(unified.bandwidth).toBe(0);
  });

  it('resonant frequency matches the minimum S11 point in wideband sweep', () => {
    const sweep = makeWidebandSweep();
    const unified = fromSweepResult(sweep);

    // -20 dB at 120 MHz (index 2) is the minimum
    expect(unified.resonantFreq).toBe(120e6);
    expect(unified.minS11).toBe(-20);
  });
});
