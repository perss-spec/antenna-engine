import type { SweepResult } from '@/components/SolverPanel/SolverPanel';

export interface UnifiedSimResults {
  frequencies: number[];
  s11Db: number[];
  s11Real: number[];
  s11Imag: number[];
  impedanceReal: number[];
  impedanceImag: number[];
  vswr: number[];
  resonantFreq: number;
  minS11: number;
  bandwidth: number;
  pattern?: { pattern: number[][]; maxGain: number };
  source: 'simulate' | 'solver';
  solverType: string;
}

export interface S11DataPoint {
  frequency: number;
  s11_db: number;
}

export interface ImpedancePoint {
  re: number;
  im: number;
  freq: number;
}

export interface VswrDataPoint {
  frequency: number;
  vswr: number;
}

export interface ImpedanceChartPoint {
  frequency: number;
  real: number;
  imag: number;
}

interface SimulateResponse {
  frequencies: number[];
  s11Db: number[];
  s11Real: number[];
  s11Imag: number[];
  impedanceReal: number[];
  impedanceImag: number[];
  resonantFreq: number;
  minS11: number;
  bandwidth: number;
}

function computeVswr(s11Db: number[]): number[] {
  return s11Db.map(s => {
    const mag = Math.pow(10, s / 20);
    return (1 + Math.min(mag, 0.9999)) / (1 - Math.min(mag, 0.9999));
  });
}

export function fromSimulateResponse(resp: SimulateResponse): UnifiedSimResults {
  return {
    frequencies: resp.frequencies,
    s11Db: resp.s11Db,
    s11Real: resp.s11Real,
    s11Imag: resp.s11Imag,
    impedanceReal: resp.impedanceReal,
    impedanceImag: resp.impedanceImag,
    vswr: computeVswr(resp.s11Db),
    resonantFreq: resp.resonantFreq,
    minS11: resp.minS11,
    bandwidth: resp.bandwidth,
    source: 'simulate',
    solverType: 'local',
  };
}

export function fromSweepResult(sweep: SweepResult): UnifiedSimResults {
  const frequencies = sweep.frequencies;
  const impedanceReal = sweep.results.map(r => r.impedance.real);
  const impedanceImag = sweep.results.map(r => r.impedance.imag);
  const s11Db = sweep.results.map(r => r.s11_db);
  const vswrArr = sweep.results.map(r => r.vswr);

  // Compute s11 real/imag from impedance
  const s11Real: number[] = [];
  const s11Imag: number[] = [];
  for (let i = 0; i < frequencies.length; i++) {
    const zr = impedanceReal[i];
    const zi = impedanceImag[i];
    const dr = zr + 50, di = zi;
    const dMag2 = dr * dr + di * di;
    const gr = ((zr - 50) * dr + zi * di) / dMag2;
    const gi = (zi * dr - (zr - 50) * di) / dMag2;
    s11Real.push(gr);
    s11Imag.push(gi);
  }

  // Find resonant freq and bandwidth
  const minIdx = s11Db.indexOf(Math.min(...s11Db));
  const bwIndices = s11Db.map((v, i) => v <= -10 ? i : -1).filter(i => i >= 0);
  const bandwidth = bwIndices.length >= 2
    ? frequencies[bwIndices[bwIndices.length - 1]] - frequencies[bwIndices[0]]
    : 0;

  return {
    frequencies,
    s11Db,
    s11Real,
    s11Imag,
    impedanceReal,
    impedanceImag,
    vswr: vswrArr,
    resonantFreq: frequencies[minIdx],
    minS11: s11Db[minIdx],
    bandwidth,
    source: 'solver',
    solverType: sweep.solver,
  };
}

export function toS11ChartData(r: UnifiedSimResults): S11DataPoint[] {
  return r.frequencies.map((f, i) => ({
    frequency: f / 1e6,
    s11_db: r.s11Db[i],
  }));
}

export function toSmithData(r: UnifiedSimResults): ImpedancePoint[] {
  return r.impedanceReal.map((re, i) => ({
    re,
    im: r.impedanceImag[i],
    freq: r.frequencies[i],
  }));
}

export function toVswrData(r: UnifiedSimResults): VswrDataPoint[] {
  return r.frequencies.map((f, i) => ({
    frequency: f / 1e6,
    vswr: r.vswr[i],
  }));
}

export function toImpedanceChartData(r: UnifiedSimResults): ImpedanceChartPoint[] {
  return r.frequencies.map((f, i) => ({
    frequency: f / 1e6,
    real: r.impedanceReal[i],
    imag: r.impedanceImag[i],
  }));
}
