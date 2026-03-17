/** Sine integral Si(x) — series expansion for small x, asymptotic for large x */
export function Si(x: number): number {
  const ax = Math.abs(x);
  if (ax < 1e-10) return x;

  if (ax <= 4) {
    // Power series: Si(x) = sum_{n=0}^inf (-1)^n x^{2n+1} / ((2n+1)(2n+1)!)
    let sum = 0;
    let term = x;
    for (let n = 0; n < 20; n++) {
      sum += term;
      term *= -x * x / ((2 * n + 2) * (2 * n + 3)) * (2 * n + 1) / (2 * n + 3);
    }
    return sum;
  }

  // Auxiliary functions for large x (Abramowitz & Stegun 5.2.38-39)
  const f =
    (1 / ax) *
    (1 +
      (7.241163 +
        (2.463936 + (0.130097 + 0.000633 / (ax * ax)) / (ax * ax)) /
          (ax * ax)) /
        (ax * ax)) /
    (1 +
      (7.547478 +
        (2.79429 + (0.15685 + 0.000764 / (ax * ax)) / (ax * ax)) /
          (ax * ax)) /
        (ax * ax));

  const g =
    (1 / (ax * ax)) *
    (1 +
      (4.276731 +
        (1.037824 + (0.012935 + 0.000021 / (ax * ax)) / (ax * ax)) /
          (ax * ax)) /
        (ax * ax)) /
    (1 +
      (4.629863 +
        (1.208568 + (0.019702 + 0.000045 / (ax * ax)) / (ax * ax)) /
          (ax * ax)) /
        (ax * ax));

  const result = Math.PI / 2 - f * Math.cos(ax) - g * Math.sin(ax);
  return x >= 0 ? result : -result;
}

/** Cosine integral Ci(x) = γ + ln(x) + ∫_0^x (cos(t)-1)/t dt */
export function Ci(x: number): number {
  const EULER_GAMMA = 0.5772156649015329;
  const ax = Math.abs(x);

  if (ax < 1e-10) return EULER_GAMMA + Math.log(ax || 1e-30);

  if (ax <= 4) {
    // Power series
    let sum = EULER_GAMMA + Math.log(ax);
    let term = -ax * ax / 4;
    sum += term;
    for (let n = 2; n < 20; n++) {
      term *= -ax * ax / ((2 * n - 1) * 2 * n);
      sum += term / (2 * n);
    }
    return sum;
  }

  // Auxiliary functions for large x
  const f =
    (1 / ax) *
    (1 +
      (7.241163 +
        (2.463936 + (0.130097 + 0.000633 / (ax * ax)) / (ax * ax)) /
          (ax * ax)) /
        (ax * ax)) /
    (1 +
      (7.547478 +
        (2.79429 + (0.15685 + 0.000764 / (ax * ax)) / (ax * ax)) /
          (ax * ax)) /
        (ax * ax));

  const g =
    (1 / (ax * ax)) *
    (1 +
      (4.276731 +
        (1.037824 + (0.012935 + 0.000021 / (ax * ax)) / (ax * ax)) /
          (ax * ax)) /
        (ax * ax)) /
    (1 +
      (4.629863 +
        (1.208568 + (0.019702 + 0.000045 / (ax * ax)) / (ax * ax)) /
          (ax * ax)) /
        (ax * ax));

  return f * Math.sin(ax) - g * Math.cos(ax);
}

/** Smooth clamp for tan(x) — Lorentzian transition instead of hard cap */
export function clampTan(x: number): number {
  if (Math.abs(x) < 0.01) return x;
  const t = Math.tan(Math.min(Math.max(x, -1.5), 1.5));
  // Lorentzian soft-clip: preserves shape near zero, asymptotes to ±maxVal
  const maxVal = 200;
  return maxVal * t / Math.sqrt(t * t + maxVal * maxVal);
}

/** Conductor loss resistance: Rs * L / (2π * a) */
export function conductorLoss(length: number, radius: number, freq: number): number {
  const MU0 = 4 * Math.PI * 1e-7;
  const SIGMA_CU = 5.8e7;
  return (length / (2 * Math.PI * Math.max(radius, 1e-6))) *
    Math.sqrt(Math.PI * freq * MU0 / SIGMA_CU);
}

export const C0 = 299792458;
