import { describe, it, expect, vi } from 'vitest';
import { analyticalGain, computeGain } from '../gainCalculator';

vi.mock('@/lib/api', () => ({
  api: {
    isServerAvailable: vi.fn(),
    pattern: vi.fn(),
  },
}));

import { api } from '@/lib/api';

describe('analyticalGain', () => {
  it('returns 2.15 for half_wave_dipole', () => {
    expect(analyticalGain('half_wave_dipole')).toBe(2.15);
  });

  it('returns 6.0 for patch', () => {
    expect(analyticalGain('patch')).toBe(6.0);
  });

  it('returns 15.0 for horn', () => {
    expect(analyticalGain('horn')).toBe(15.0);
  });

  it('falls back to 2.15 for unknown type', () => {
    expect(analyticalGain('unknown_type')).toBe(2.15);
  });
});

describe('computeGain', () => {
  it('returns analytical gain when server unavailable', async () => {
    vi.mocked(api.isServerAvailable).mockResolvedValue(false);

    const gain = await computeGain('patch', 2.4e9);
    expect(gain).toBe(6.0);
    expect(api.isServerAvailable).toHaveBeenCalled();
  });
});
