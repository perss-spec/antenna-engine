import { useState, useCallback, useEffect } from 'react';
import { api, SweepResponse } from './api';
import { solveByCategory } from './impedanceSolver';
import { getCategoryForId } from './antennaKB';

const C0 = 299792458;

interface SolverState {
  isServerMode: boolean;
  isComputing: boolean;
  error: string | null;
}

export function useServerSolver() {
  const [serverAvailable, setServerAvailable] = useState<boolean | null>(null);
  const [state, setState] = useState<SolverState>({
    isServerMode: false,
    isComputing: false,
    error: null,
  });

  // Check server on mount
  useEffect(() => {
    api.isServerAvailable().then(available => {
      setServerAvailable(available);
      setState(s => ({ ...s, isServerMode: available }));
    });
  }, []);

  // Sweep solver — uses server or local
  const solveSweep = useCallback(
    async (
      antennaType: string,
      fStart: number,
      fStop: number,
      points: number,
      params: Record<string, number>,
    ): Promise<SweepResponse> => {
      setState(s => ({ ...s, isComputing: true, error: null }));

      try {
        if (state.isServerMode) {
          const result = await api.sweep({
            antenna_type: antennaType,
            freq_start: fStart,
            freq_stop: fStop,
            freq_points: points,
            parameters: params,
          });
          setState(s => ({ ...s, isComputing: false }));
          return result;
        }

        // Local mode — JS solver in browser
        const n = points;
        const frequencies: number[] = [];
        const s11Db: number[] = [];
        const s11Real: number[] = [];
        const s11Imag: number[] = [];
        const impedanceReal: number[] = [];
        const impedanceImag: number[] = [];
        let minS11 = 0;
        let resFreq = fStart;

        const category = getCategoryForId(antennaType);

        for (let i = 0; i < n; i++) {
          const f = fStart + ((fStop - fStart) * i) / (n - 1);
          const lambda = C0 / f;
          const k = (2 * Math.PI) / lambda;
          frequencies.push(f);

          const [zr, zi] = solveByCategory(category, antennaType, params, f, lambda, k);
          impedanceReal.push(zr);
          impedanceImag.push(zi);

          const dr = zr + 50;
          const di = zi;
          const dMag2 = dr * dr + di * di;
          const gr = ((zr - 50) * dr + zi * di) / dMag2;
          const gi = (zi * dr - (zr - 50) * di) / dMag2;
          const gMag2 = gr * gr + gi * gi;
          const s11db = 10 * Math.log10(gMag2 || 1e-20);

          s11Db.push(s11db);
          s11Real.push(gr);
          s11Imag.push(gi);

          if (s11db < minS11) {
            minS11 = s11db;
            resFreq = f;
          }
        }

        // Bandwidth calculation (-10 dB threshold)
        let bwStart = fStart;
        let bwStop = fStop;
        for (let i = 0; i < n; i++) {
          if (s11Db[i] < -10) {
            bwStart = frequencies[i];
            break;
          }
        }
        for (let i = n - 1; i >= 0; i--) {
          if (s11Db[i] < -10) {
            bwStop = frequencies[i];
            break;
          }
        }

        setState(s => ({ ...s, isComputing: false }));
        return {
          frequencies,
          s11_db: s11Db,
          s11_real: s11Real,
          s11_imag: s11Imag,
          impedance_real: impedanceReal,
          impedance_imag: impedanceImag,
          resonant_frequency: resFreq,
          min_s11: minS11,
          bandwidth: bwStop - bwStart,
        };
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        setState(s => ({ ...s, isComputing: false, error: msg }));
        throw err;
      }
    },
    [state.isServerMode],
  );

  const toggleServerMode = useCallback(() => {
    setState(s => ({ ...s, isServerMode: !s.isServerMode }));
  }, []);

  return {
    ...state,
    serverAvailable,
    solveSweep,
    toggleServerMode,
  };
}
