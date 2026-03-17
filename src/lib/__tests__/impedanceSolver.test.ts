import { describe, it, expect } from 'vitest';
import { solveByCategory } from '../impedanceSolver';
import { Si, Ci, clampTan, conductorLoss, C0 } from '../mathUtils';

describe('mathUtils', () => {
  describe('Si(x) — Sine Integral', () => {
    it('Si(0) = 0', () => {
      expect(Si(0)).toBeCloseTo(0, 10);
    });

    it('Si(1) ≈ 0.9461', () => {
      expect(Si(1)).toBeCloseTo(0.9461, 3);
    });

    it('Si(π) ≈ 1.8519', () => {
      expect(Si(Math.PI)).toBeCloseTo(1.8519, 3);
    });

    it('Si(-x) = -Si(x) (odd function)', () => {
      expect(Si(-2)).toBeCloseTo(-Si(2), 6);
    });

    it('Si(10) ≈ 1.6583', () => {
      expect(Si(10)).toBeCloseTo(1.6583, 2);
    });
  });

  describe('Ci(x) — Cosine Integral', () => {
    it('Ci(1) ≈ 0.3323', () => {
      expect(Ci(1)).toBeCloseTo(0.3323, 2);
    });

    it('Ci(π) is finite and small', () => {
      const val = Ci(Math.PI);
      expect(isFinite(val)).toBe(true);
      expect(Math.abs(val)).toBeLessThan(1);
    });
  });

  describe('clampTan', () => {
    it('small angle: clampTan(0.005) ≈ 0.005', () => {
      expect(clampTan(0.005)).toBeCloseTo(0.005, 4);
    });

    it('moderate angle gives finite result', () => {
      const result = clampTan(1.0);
      expect(Math.abs(result)).toBeLessThan(300);
      expect(isFinite(result)).toBe(true);
    });

    it('near π/2: result is bounded (no infinity)', () => {
      const result = clampTan(1.5);
      expect(Math.abs(result)).toBeLessThan(250);
      expect(isFinite(result)).toBe(true);
    });
  });

  describe('conductorLoss', () => {
    it('returns positive value', () => {
      expect(conductorLoss(0.5, 0.001, 300e6)).toBeGreaterThan(0);
    });

    it('increases with frequency', () => {
      const loss1 = conductorLoss(0.5, 0.001, 100e6);
      const loss2 = conductorLoss(0.5, 0.001, 1e9);
      expect(loss2).toBeGreaterThan(loss1);
    });
  });
});

describe('impedanceSolver — solveByCategory', () => {
  const freq = 300e6;
  const lambda = C0 / freq;
  const k = 2 * Math.PI / lambda;

  describe('wire category', () => {
    it('half-wave dipole: Z_real ≈ 73 ± 10 Ω', () => {
      const [zr, zi] = solveByCategory('wire', 'half_wave_dipole', {
        length_m: lambda / 2,
        radius_m: 0.001,
      }, freq, lambda, k);
      expect(zr).toBeGreaterThan(63);
      expect(zr).toBeLessThan(90);
      expect(isFinite(zi)).toBe(true);
    });

    it('returns finite values for all wire types', () => {
      const types = ['half_wave_dipole', 'quarter_wave_monopole', 'folded_dipole', 'yagi_uda', 'small_loop'];
      for (const t of types) {
        const [zr, zi] = solveByCategory('wire', t, { length_m: lambda / 2, radius_m: 0.001 }, freq, lambda, k);
        expect(isFinite(zr)).toBe(true);
        expect(isFinite(zi)).toBe(true);
        expect(zr).toBeGreaterThan(0);
      }
    });
  });

  describe('microstrip category', () => {
    it('rectangular patch: resonant impedance is positive', () => {
      const f = 2.4e9;
      const lam = C0 / f;
      const kk = 2 * Math.PI / lam;
      const [zr, zi] = solveByCategory('microstrip', 'rectangular_patch', {
        substrate_er: 4.4,
        substrate_height_m: 0.0016,
        length_m: 0.029,
        width_m: 0.038,
      }, f, lam, kk);
      expect(zr).toBeGreaterThan(10);
      expect(zr).toBeLessThan(500);
      expect(isFinite(zi)).toBe(true);
    });

    it('includes loss_tangent effect', () => {
      const f = 2.4e9;
      const lam = C0 / f;
      const kk = 2 * Math.PI / lam;
      const [zr1] = solveByCategory('microstrip', 'rectangular_patch', {
        substrate_er: 4.4, substrate_height_m: 0.0016, loss_tangent: 0.001,
      }, f, lam, kk);
      const [zr2] = solveByCategory('microstrip', 'rectangular_patch', {
        substrate_er: 4.4, substrate_height_m: 0.0016, loss_tangent: 0.1,
      }, f, lam, kk);
      // Higher loss tangent → lower Q → broader response → different impedance
      expect(zr1).not.toBeCloseTo(zr2, 0);
    });
  });

  describe('broadband category', () => {
    it('vivaldi: impedance is reasonable and not hardcoded to 50Ω', () => {
      const [zr, zi] = solveByCategory('broadband', 'vivaldi_tsa', {
        length_m: 0.1,
        radius_m: 0.001,
      }, 3e9, C0 / 3e9, 2 * Math.PI * 3e9 / C0);
      expect(zr).toBeGreaterThan(10);
      expect(isFinite(zi)).toBe(true);
      // Should NOT be damped to exactly 50Ω (old bug)
      expect(Math.abs(zr - 50)).toBeGreaterThan(1);
    });

    it('bow_tie: returns finite impedance', () => {
      const [zr, zi] = solveByCategory('broadband', 'bow_tie', {
        length_m: 0.15,
        radius_m: 0.005,
      }, 1e9, C0 / 1e9, 2 * Math.PI * 1e9 / C0);
      expect(isFinite(zr)).toBe(true);
      expect(isFinite(zi)).toBe(true);
    });
  });

  describe('aperture category', () => {
    it('pyramidal horn: above cutoff', () => {
      const f = 10e9;
      const lam = C0 / f;
      const kk = 2 * Math.PI / lam;
      const [zr, zi] = solveByCategory('aperture', 'pyramidal_horn', {
        aperture_width: 0.05,
        aperture_height: 0.035,
      }, f, lam, kk);
      expect(zr).toBeGreaterThan(100);
      expect(isFinite(zi)).toBe(true);
    });

    it('below cutoff: returns low impedance', () => {
      const f = 1e9;
      const lam = C0 / f;
      const kk = 2 * Math.PI / lam;
      const [zr] = solveByCategory('aperture', 'pyramidal_horn', {
        aperture_width: 0.01, // very small → below cutoff
      }, f, lam, kk);
      // Below cutoff returns [5, -500]
      expect(zr).toBeLessThanOrEqual(5);
    });

    it('parabolic reflector: separate model', () => {
      const f = 12e9;
      const lam = C0 / f;
      const kk = 2 * Math.PI / lam;
      const [zr] = solveByCategory('aperture', 'parabolic_reflector', {
        diameter: 0.6,
        focal_ratio: 0.35,
      }, f, lam, kk);
      expect(zr).toBeGreaterThan(10);
      expect(zr).toBeLessThan(400);
    });
  });

  describe('array category', () => {
    it('ULA with mutual coupling: Z changes with element count', () => {
      const [zr1] = solveByCategory('array', 'uniform_linear_array', {
        num_elements: 2,
        element_spacing: lambda / 2,
        length_m: lambda / 2,
      }, freq, lambda, k);
      const [zr4] = solveByCategory('array', 'uniform_linear_array', {
        num_elements: 8,
        element_spacing: lambda / 2,
        length_m: lambda / 2,
      }, freq, lambda, k);
      // More elements → more mutual coupling → different impedance
      expect(zr1).not.toBeCloseTo(zr4, 0);
    });
  });

  describe('special category', () => {
    it('DRA has high Q (narrow bandwidth response)', () => {
      // Use frequencies closer to resonance where Q=50 matters
      const L = 0.02; // 20mm → fRes ≈ 7.5 GHz
      const fRes = C0 / (2 * L);
      const fOn = fRes;
      const fOff = fRes * 0.7; // well detuned
      const [zr1] = solveByCategory('special', 'dielectric_resonator', {
        length_m: L,
      }, fOn, C0 / fOn, 2 * Math.PI * fOn / C0);
      const [zr2] = solveByCategory('special', 'dielectric_resonator', {
        length_m: L,
      }, fOff, C0 / fOff, 2 * Math.PI * fOff / C0);
      // At resonance Z should be much higher than off-resonance
      expect(zr1).toBeGreaterThan(zr2 * 2);
    });

    it('metamaterial has low Q (wideband)', () => {
      const f1 = 2.4e9;
      const f2 = 2.6e9;
      const [zr1] = solveByCategory('special', 'metamaterial_antenna', { length_m: 0.03 }, f1, C0 / f1, 2 * Math.PI * f1 / C0);
      const [zr2] = solveByCategory('special', 'metamaterial_antenna', { length_m: 0.03 }, f2, C0 / f2, 2 * Math.PI * f2 / C0);
      // Low Q → impedance doesn't change much
      expect(Math.abs(zr1 - zr2)).toBeLessThan(30);
    });
  });

  describe('S11 physical bounds', () => {
    it('|S11| ∈ [0, 1] for all categories', () => {
      const categories = [
        { cat: 'wire' as const, type: 'half_wave_dipole', params: { length_m: lambda / 2, radius_m: 0.001 } },
        { cat: 'microstrip' as const, type: 'rectangular_patch', params: { substrate_er: 4.4, substrate_height_m: 0.0016 } },
        { cat: 'broadband' as const, type: 'vivaldi_tsa', params: { length_m: 0.1, radius_m: 0.001 } },
        { cat: 'aperture' as const, type: 'pyramidal_horn', params: { aperture_width: 0.05 } },
        { cat: 'array' as const, type: 'uniform_linear_array', params: { num_elements: 4, element_spacing: lambda / 2, length_m: lambda / 2 } },
        { cat: 'special' as const, type: 'sierpinski_fractal', params: { length_m: 0.03 } },
      ];

      for (const { cat, type, params } of categories) {
        const [zr, zi] = solveByCategory(cat, type, params, freq, lambda, k);
        expect(isFinite(zr)).toBe(true);
        expect(isFinite(zi)).toBe(true);
        expect(zr).toBeGreaterThan(0);
        // Γ = (Z - Z0) / (Z + Z0)
        const numR = zr - 50;
        const numI = zi;
        const denR = zr + 50;
        const denI = zi;
        const denMag2 = denR * denR + denI * denI;
        const gr = (numR * denR + numI * denI) / denMag2;
        const gi = (numI * denR - numR * denI) / denMag2;
        const s11 = Math.sqrt(gr * gr + gi * gi);
        expect(s11).toBeGreaterThanOrEqual(0);
        expect(s11).toBeLessThanOrEqual(1.01);
      }
    });
  });
});
