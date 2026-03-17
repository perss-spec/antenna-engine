import type { AntennaCategory } from '@/lib/antennaKB';
import { Si, Ci, clampTan, conductorLoss, C0 } from '@/lib/mathUtils';

/**
 * Category-based impedance solver.
 * Returns [Z_real, Z_imag] for given antenna parameters at frequency f.
 */
export function solveByCategory(
  category: AntennaCategory,
  antennaType: string,
  ap: Record<string, number>,
  f: number,
  lambda: number,
  k: number,
): [number, number] {
  switch (category) {
    case 'wire':
      return solveWire(ap, f, lambda, k);
    case 'microstrip':
      return solveMicrostrip(ap, f, lambda, k, antennaType);
    case 'broadband':
      return solveBroadband(ap, f, lambda, k, antennaType);
    case 'aperture':
      return solveAperture(ap, f, lambda, antennaType);
    case 'array':
      return solveArray(ap, f, lambda, k);
    case 'special':
    default:
      return solveSpecial(ap, f, lambda, k, antennaType);
  }
}

/** Wire antennas: King's approximation for dipoles, monopoles, helical, loops, yagi, LPDA */
function solveWire(
  ap: Record<string, number>,
  f: number,
  lambda: number,
  k: number,
): [number, number] {
  const L = ap.length_m || lambda / 2;
  const a = ap.radius_m || 0.001;
  // King's method: phase deviation from half-wave resonance
  const psi = k * L / 2 - Math.PI / 2;
  const zr = 73.13 * (1 + 0.014 * psi * psi) + conductorLoss(L, a, f);
  const zi = 42.5 * clampTan(psi);
  return [zr, zi];
}

/** Microstrip: Cavity model (Hammerstad & Jensen) with dielectric + conductor loss */
function solveMicrostrip(
  ap: Record<string, number>,
  f: number,
  lambda: number,
  k: number,
  _antennaType: string,
): [number, number] {
  const er = ap.substrate_er || 4.4;
  const h = ap.substrate_height_m || 0.0016;
  const W = ap.width_m || C0 / (2 * f) * Math.sqrt(2 / (er + 1));
  const erEff = (er + 1) / 2 + (er - 1) / 2 * Math.pow(1 + 12 * h / W, -0.5);
  const deltaL = 0.412 * h * (erEff + 0.3) * (W / h + 0.264)
    / ((erEff - 0.258) * (W / h + 0.8));
  const pLen = ap.length_m || C0 / (2 * f * Math.sqrt(erEff));
  const Le = pLen + 2 * deltaL;
  const fRes = C0 / (2 * Le * Math.sqrt(erEff));
  // Bahl & Bhartia edge impedance for rectangular patch
  const G1 = (W / (120 * lambda)) * (1 - (1 / 24) * Math.pow(k * h, 2));
  const Zedge = Math.min(1 / (2 * Math.max(G1, 1e-6)), 400);

  // Q_total = 1/(1/Q_rad + 1/Q_d + 1/Q_c) — full loss model
  const Q_rad = C0 / (4 * fRes * h * Math.sqrt(erEff));
  const lossTan = ap.loss_tangent || 0.02;
  const Q_d = 1 / lossTan;
  // Conductor Q: skin depth δ = √(2/(ωμσ)), Q_c = h/δ
  const sigma = 5.8e7; // copper conductivity S/m
  const skinDepth = Math.sqrt(2 / (2 * Math.PI * f * 4 * Math.PI * 1e-7 * sigma));
  const Q_c = h / Math.max(skinDepth, 1e-9);
  const Q = 1 / (1 / Q_rad + 1 / Q_d + 1 / Math.max(Q_c, 1));

  const detuning = f / fRes - fRes / f;
  const zr = Zedge / (1 + Q * Q * detuning * detuning);
  const zi = -zr * Q * detuning;
  return [zr, zi];
}

/** Broadband: Klopfenstein taper model for vivaldi, bow-tie, spiral, discone, biconical */
function solveBroadband(
  ap: Record<string, number>,
  f: number,
  lambda: number,
  _k: number,
  antennaType: string,
): [number, number] {
  const L = ap.length_m || lambda / 2;
  const a = ap.radius_m || 0.001;

  // Klopfenstein taper impedance transformation
  const taperRate = ap.taper_rate || getTaperRate(antennaType);
  const zFeed = ap.z_feed || getZFeed(antennaType);
  const zAperture = 120 * Math.log(L / Math.max(a, 1e-6));

  // Taper impedance profile
  const fCenter = C0 / (2 * L);
  const ratio = f / fCenter;
  const bl = (Math.PI / 2) * ratio;

  // Klopfenstein passband ripple — smooth transition from feed to aperture
  const gamma0 = 0.5 * Math.log(zAperture / zFeed);
  const A = Math.acosh(gamma0 / (taperRate + 1e-10));

  // In-band: impedance tapers smoothly; out-of-band: reflection increases
  const normalizedFreq = Math.PI * ratio;
  let ripple: number;
  if (normalizedFreq > A) {
    // In passband — low reflection
    ripple = taperRate * Math.cos(Math.sqrt(normalizedFreq * normalizedFreq - A * A)) /
      Math.cosh(A);
  } else {
    // Below cutoff — higher reflection
    ripple = taperRate * Math.cosh(Math.sqrt(A * A - normalizedFreq * normalizedFreq)) /
      Math.cosh(A);
  }

  // Effective impedance seen at feed
  const Zeff = zFeed * Math.exp(gamma0 * (1 - ripple));

  // Add reactive component from taper
  const tanBl = Math.tan(Math.min(Math.max(bl, -1.5), 1.5));
  const zi = Zeff * 0.15 * tanBl * (1 - ratio) / (ratio + 0.5);

  const zr = Math.max(Zeff, 5) + conductorLoss(L, a, f);
  return [zr, zi * 0.6];
}

/** Aperture: separate pyramidal/conical/parabolic models */
function solveAperture(
  ap: Record<string, number>,
  f: number,
  lambda: number,
  antennaType: string,
): [number, number] {
  const aW = ap.aperture_width || lambda;
  const bW = ap.aperture_height || lambda * 0.7;

  if (antennaType === 'parabolic_reflector') {
    // Parabolic reflector: feed horn impedance modified by dish
    const focalRatio = ap.focal_ratio || 0.35;
    const diameter = ap.diameter || lambda * 10;
    const efficiency = 0.55 + 0.1 * focalRatio;
    const Zfeed = 377 * efficiency / (1 + (diameter / lambda) * 0.01);
    // Detuning reactance: resonant when aperture = design size
    const fRes = C0 / (Math.PI * diameter * 0.5);
    const zi = 377 * 0.05 * (f / fRes - fRes / f);
    return [Math.max(Zfeed, 10), zi];
  }

  const fCutoff = C0 / (2 * Math.max(aW, lambda * 0.5));
  const ratio = f / fCutoff;
  if (ratio <= 1.01) {
    // At/below cutoff — continuous reactive model
    const evanescent = 1 / (ratio + 0.01);
    return [5 * ratio, -377 * evanescent];
  }
  const Zw = 377 / Math.sqrt(1 - Math.pow(fCutoff / f, 2));

  if (antennaType === 'conical_horn') {
    // Conical horn: TE11 mode, different impedance
    const hornRadius = ap.horn_radius || aW / 2;
    const flare = hornRadius / lambda;
    const zr = Zw * 0.9 * (1 - 0.25 / (flare + 1));
    const zi = Zw * 0.08 * (1 - ratio) / ratio;
    return [Math.max(zr, 10), zi];
  }

  // Pyramidal horn or open waveguide
  const flare = Math.sqrt(aW * bW) / lambda;
  const zr = Zw * (1 - 0.3 / (flare + 1));
  const zi = Zw * 0.1 * (1 - ratio) / ratio;
  return [Math.max(zr, 10), zi];
}

/** Array: Induced EMF method (Balanis eq. 8-68) for mutual coupling */
function solveArray(
  ap: Record<string, number>,
  _f: number,
  lambda: number,
  k: number,
): [number, number] {
  const N = ap.num_elements || 4;
  const d = ap.element_spacing || lambda / 2;
  const L = ap.length_m || lambda / 2;

  // Element self-impedance (dipole) — King's method
  const psi = k * L / 2 - Math.PI / 2;
  const ze_r = 73.13 * (1 + 0.014 * psi * psi);
  const ze_i = 42.5 * clampTan(psi);

  // Mutual impedance via Induced EMF method (Balanis eq. 8-68)
  // Z12 = R12 + jX12 computed from Si/Ci integrals
  let Z12_r = 0;
  let Z12_i = 0;

  for (let m = 1; m < N; m++) {
    const md = m * d;
    const kd = k * md;
    const kL = k * L;

    // Balanis mutual impedance for parallel dipoles
    const u1 = kd;
    const u2 = Math.sqrt(kd * kd + kL * kL) + kL;
    const u3 = Math.sqrt(kd * kd + kL * kL) - kL;

    const R12 = 30 * (
      2 * Ci(u1) - Ci(u2) - Ci(u3)
    );
    const X12 = -30 * (
      2 * Si(u1) - Si(u2) - Si(u3)
    );

    // Weight by number of pairs at this spacing
    const pairs = N - m;
    Z12_r += pairs * R12;
    Z12_i += pairs * X12;
  }

  // Edge element correction: elements at edges see fewer neighbors
  const edgeFactor = (N > 2) ? (N - 1) / N : 1;

  // Active element impedance
  const zr = ze_r + Z12_r / N * edgeFactor;
  const zi = ze_i + Z12_i / N * edgeFactor;
  return [Math.max(zr, 5), zi];
}

/** Special: category-specific Q values for DRA, metamaterial, fractal, reconfigurable */
function solveSpecial(
  ap: Record<string, number>,
  f: number,
  lambda: number,
  _k: number,
  antennaType: string,
): [number, number] {
  const L = ap.length_m || lambda / 2;
  const a = ap.radius_m || 0.001;
  const fRes = C0 / (2 * L);

  // Category-specific Q values from KB
  const Q = getSpecialQ(antennaType);

  const detuning = f / fRes - fRes / f;
  const Rrad = 73.13;
  const denom = 1 + Q * Q * detuning * detuning;
  const zr = Rrad / denom + conductorLoss(L, a, f);
  const zi = -Rrad * Q * detuning / denom;
  return [Math.max(zr, 5), zi];
}

// --- Helpers ---

function getSpecialQ(antennaType: string): number {
  const qMap: Record<string, number> = {
    dielectric_resonator: 50,
    metamaterial_antenna: 3,
    sierpinski_fractal: 15,
    reconfigurable_antenna: 20,
  };
  return qMap[antennaType] ?? 20;
}

function getTaperRate(antennaType: string): number {
  const rates: Record<string, number> = {
    vivaldi_tsa: 0.03,
    bow_tie: 0.08,
    archimedean_spiral: 0.02,
    discone: 0.05,
    biconical: 0.04,
  };
  return rates[antennaType] ?? 0.05;
}

function getZFeed(antennaType: string): number {
  const feeds: Record<string, number> = {
    vivaldi_tsa: 75,
    bow_tie: 100,
    archimedean_spiral: 188,
    discone: 50,
    biconical: 73,
  };
  return feeds[antennaType] ?? 50;
}
