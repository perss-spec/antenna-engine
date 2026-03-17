import { describe, it, expect } from 'vitest';
import {
  fromSimulateResponse,
  fromSweepResult,
  toS11ChartData,
  toSmithData,
  toVswrData,
  toImpedanceChartData,
} from '../unifiedResults';
import type { SweepResult } from '@/components/SolverPanel/SolverPanel';

const mkSimResponse = () => ({
  frequencies: [400e6, 435e6, 470e6],
  s11Db: [-5, -15, -8],
  s11Real: [0.3, -0.1, 0.2],
  s11Imag: [0.1, 0.05, -0.15],
  impedanceReal: [75, 52, 90],
  impedanceImag: [20, -3, 35],
  resonantFreq: 435e6,
  minS11: -15,
  bandwidth: 70e6,
});

const mkSweepResult = (): SweepResult => ({
  solver: 'MoM Wire',
  frequencies: [400e6, 435e6, 470e6],
  results: [
    {
      solver: 'MoM Wire', frequency: 400e6,
      impedance: { real: 75, imag: 20 },
      s11_db: -5, vswr: 3.57, gain_dbi: 2.15, computation_time: 0.01,
      convergence: { converged: true, iterations: 1, final_error: 0 },
    },
    {
      solver: 'MoM Wire', frequency: 435e6,
      impedance: { real: 52, imag: -3 },
      s11_db: -20, vswr: 1.22, gain_dbi: 2.15, computation_time: 0.01,
      convergence: { converged: true, iterations: 1, final_error: 0 },
    },
    {
      solver: 'MoM Wire', frequency: 470e6,
      impedance: { real: 90, imag: 35 },
      s11_db: -8, vswr: 2.32, gain_dbi: 2.15, computation_time: 0.01,
      convergence: { converged: true, iterations: 1, final_error: 0 },
    },
  ],
});

describe('fromSimulateResponse', () => {
  it('creates valid UnifiedSimResults with correct VSWR', () => {
    const r = fromSimulateResponse(mkSimResponse());

    expect(r.source).toBe('simulate');
    expect(r.solverType).toBe('local');
    expect(r.frequencies).toEqual([400e6, 435e6, 470e6]);
    expect(r.s11Db).toEqual([-5, -15, -8]);
    expect(r.resonantFreq).toBe(435e6);
    expect(r.minS11).toBe(-15);
    expect(r.bandwidth).toBe(70e6);

    // VSWR computed from s11Db
    expect(r.vswr).toHaveLength(3);
    r.vswr.forEach(v => expect(v).toBeGreaterThanOrEqual(1));

    // Verify VSWR formula for first point: s11=-5 dB
    const mag = Math.pow(10, -5 / 20);
    const expected = (1 + mag) / (1 - mag);
    expect(r.vswr[0]).toBeCloseTo(expected, 5);
  });
});

describe('fromSweepResult', () => {
  it('creates valid results from SweepResult', () => {
    const r = fromSweepResult(mkSweepResult());

    expect(r.source).toBe('solver');
    expect(r.solverType).toBe('MoM Wire');
    expect(r.frequencies).toEqual([400e6, 435e6, 470e6]);
    expect(r.impedanceReal).toEqual([75, 52, 90]);
    expect(r.impedanceImag).toEqual([20, -3, 35]);
    expect(r.vswr).toEqual([3.57, 1.22, 2.32]);
  });

  it('computes s11Real/Imag from impedance', () => {
    const r = fromSweepResult(mkSweepResult());

    expect(r.s11Real).toHaveLength(3);
    expect(r.s11Imag).toHaveLength(3);

    // Verify reflection coefficient for Z=52-j3 (close to 50 Ω)
    // Gamma = (Z - 50) / (Z + 50) = (2-j3) / (102-j3)
    const zr = 52, zi = -3;
    const dr = zr + 50, di = zi;
    const dMag2 = dr * dr + di * di;
    const expectedReal = ((zr - 50) * dr + zi * di) / dMag2;
    const expectedImag = (zi * dr - (zr - 50) * di) / dMag2;
    expect(r.s11Real[1]).toBeCloseTo(expectedReal, 10);
    expect(r.s11Imag[1]).toBeCloseTo(expectedImag, 10);
  });

  it('finds resonant frequency at min s11', () => {
    const r = fromSweepResult(mkSweepResult());
    // min s11_db is -20 at 435 MHz
    expect(r.resonantFreq).toBe(435e6);
    expect(r.minS11).toBe(-20);
  });
});

describe('toS11ChartData', () => {
  it('converts Hz to MHz', () => {
    const r = fromSimulateResponse(mkSimResponse());
    const chart = toS11ChartData(r);

    expect(chart).toHaveLength(3);
    expect(chart[0].frequency).toBe(400);
    expect(chart[1].frequency).toBe(435);
    expect(chart[2].frequency).toBe(470);
    expect(chart[0].s11_db).toBe(-5);
  });
});

describe('toSmithData', () => {
  it('maps impedanceReal/Imag/freq', () => {
    const r = fromSimulateResponse(mkSimResponse());
    const smith = toSmithData(r);

    expect(smith).toHaveLength(3);
    expect(smith[0]).toEqual({ re: 75, im: 20, freq: 400e6 });
    expect(smith[1]).toEqual({ re: 52, im: -3, freq: 435e6 });
  });
});

describe('toVswrData', () => {
  it('maps frequencies (MHz) and vswr', () => {
    const r = fromSimulateResponse(mkSimResponse());
    const vswr = toVswrData(r);

    expect(vswr).toHaveLength(3);
    expect(vswr[0].frequency).toBe(400);
    expect(vswr[1].frequency).toBe(435);
    vswr.forEach((pt, i) => expect(pt.vswr).toBe(r.vswr[i]));
  });
});

describe('toImpedanceChartData', () => {
  it('maps real/imag with MHz frequencies', () => {
    const r = fromSimulateResponse(mkSimResponse());
    const imp = toImpedanceChartData(r);

    expect(imp).toHaveLength(3);
    expect(imp[0]).toEqual({ frequency: 400, real: 75, imag: 20 });
    expect(imp[2]).toEqual({ frequency: 470, real: 90, imag: 35 });
  });
});

describe('roundtrip', () => {
  it('fromSimulateResponse → toS11ChartData → frequencies in MHz', () => {
    const resp = mkSimResponse();
    const unified = fromSimulateResponse(resp);
    const chart = toS11ChartData(unified);

    chart.forEach((pt, i) => {
      expect(pt.frequency).toBe(resp.frequencies[i] / 1e6);
      expect(pt.s11_db).toBe(resp.s11Db[i]);
    });
  });
});
