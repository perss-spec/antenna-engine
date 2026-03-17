import { useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { RadiationPattern3D } from '@/viewport/RadiationPattern3D';
import { Button } from '@/components/ui/button';
import type { AntennaType } from '@/components/AntennaForm/AntennaForm';
import { getCategoryForId } from '@/lib/antennaKB';
import type { AntennaCategory } from '@/lib/antennaKB';

const isTauri = '__TAURI_INTERNALS__' in window;

const C0 = 299792458;

interface RadiationPatternViewProps {
  antennaType: AntennaType;
  frequency: number;
  patternData?: { pattern: number[][]; maxGain: number };
}

const sinc = (x: number): number => {
  if (Math.abs(x) < 1e-10) return 1.0;
  return Math.sin(x) / x;
};

type PatternModel = { baseGain: number; fn: (theta: number, k: number, lambda: number) => number };

const categoryModels: Record<AntennaCategory, PatternModel> = {
  wire: {
    baseGain: 2.15,
    fn: (theta, k, lambda) => {
      const L = lambda / 2;
      const kL = k * L;
      const cosTheta = Math.cos(theta);
      const sinTheta = Math.sin(theta);
      if (Math.abs(sinTheta) < 1e-10) return -40;
      const numerator = Math.cos(kL / 2 * cosTheta) - Math.cos(kL / 2);
      const f = numerator / sinTheta;
      return Math.max(2.15 + 20 * Math.log10(Math.max(Math.abs(f), 1e-10)), -40);
    }
  },
  microstrip: {
    baseGain: 6.0,
    fn: (theta, k, lambda) => {
      const W = lambda / 2;
      const h = lambda / 50; // typical substrate ~ λ/50
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      // E-plane: cos(kW/2 * sinθ) broadside pattern
      const eArg = k * W / 2 * sinTheta;
      const ePattern = Math.abs(eArg) < 1e-10 ? 1.0 : Math.abs(Math.sin(eArg) / eArg);
      // H-plane: cosθ envelope × sinc(kh*sinθ/2)
      const hArg = k * h / 2 * sinTheta;
      const hPattern = Math.abs(cosTheta) * (Math.abs(hArg) < 1e-10 ? 1.0 : Math.abs(Math.sin(hArg) / hArg));
      // Total pattern is product of E and H planes
      const combined = ePattern * hPattern;
      return Math.max(6.0 + 20 * Math.log10(Math.max(combined, 1e-10)), -40);
    }
  },
  broadband: {
    baseGain: 4.0,
    fn: (theta, k, lambda) => {
      const L = lambda;
      const kL = k * L;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);
      if (Math.abs(sinTheta) < 1e-10) return -40;
      const f = sinc(kL / 4 * cosTheta) * sinTheta;
      return Math.max(4.0 + 20 * Math.log10(Math.max(Math.abs(f), 1e-10)), -40);
    }
  },
  aperture: {
    baseGain: 15.0,
    fn: (theta, k, lambda) => {
      const D = lambda * 3;
      const u = k * D / 2 * Math.sin(theta);
      const af = sinc(u);
      const cosEnv = Math.pow(Math.cos(theta), 2);
      return Math.max(15.0 + 20 * Math.log10(Math.max(Math.abs(af * cosEnv), 1e-10)), -40);
    }
  },
  array: {
    baseGain: 10.0,
    fn: (theta, k, lambda) => {
      const N = 4;
      const d = lambda / 2;
      const cosTheta = Math.cos(theta);
      const psi = k * d * cosTheta;
      let afReal = 0, afImag = 0;
      for (let n = 0; n < N; n++) {
        afReal += Math.cos(n * psi);
        afImag += Math.sin(n * psi);
      }
      const af = Math.sqrt(afReal * afReal + afImag * afImag) / N;
      return Math.max(10.0 + 20 * Math.log10(Math.max(af, 1e-10)), -40);
    }
  },
  special: {
    baseGain: 3.0,
    fn: (theta) => {
      const cosTheta = Math.cos(theta);
      const g = Math.pow(Math.max((1 + cosTheta) / 2, 1e-10), 1.5);
      return Math.max(3.0 + 10 * Math.log10(Math.max(g, 1e-10)), -40);
    }
  },
};

function generateFrequencyDependentPattern(antennaType: string, frequency: number): { pattern: number[][]; maxGain: number } {
  const nTheta = 37;
  const nPhi = 73;
  const pattern: number[][] = [];
  let maxGain = -Infinity;

  const lambda = C0 / frequency;
  const k = 2 * Math.PI / lambda;
  const category = getCategoryForId(antennaType);
  const model = categoryModels[category] || categoryModels.wire;

  for (let it = 0; it < nTheta; it++) {
    const theta = Math.PI * it / (nTheta - 1);
    const row: number[] = [];
    for (let ip = 0; ip < nPhi; ip++) {
      const gain = model.fn(theta, k, lambda);
      if (gain > maxGain) maxGain = gain;
      row.push(gain);
    }
    pattern.push(row);
  }

  return { pattern, maxGain };
}

function getChartColor(index: number): string {
  const el = document.documentElement;
  const style = getComputedStyle(el);
  const color = style.getPropertyValue(`--color-chart-${index}`).trim();
  return color || ['#0ea5e9', '#22c55e', '#eab308', '#ef4444', '#a78bfa', '#f97316'][index - 1] || '#0ea5e9';
}

export function RadiationPatternView({ antennaType, frequency, patternData }: RadiationPatternViewProps) {
  const [pattern, setPattern] = useState<number[][] | null>(null);
  const [maxGain, setMaxGain] = useState(0);
  const [loading, setLoading] = useState(false);
  const [wireframe, setWireframe] = useState(false);

  const computePattern = useCallback(async () => {
    if (patternData) {
      setPattern(patternData.pattern);
      setMaxGain(patternData.maxGain);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      if (isTauri) {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = await invoke<any>('compute_radiation_pattern', {
          antenna_type: antennaType,
          frequency,
          theta_points: 37,
          phi_points: 73,
        });
        setPattern(result.pattern);
        setMaxGain(result.maxGain);
      } else {
        await new Promise(r => setTimeout(r, 300));
        const mock = generateFrequencyDependentPattern(antennaType, frequency);
        setPattern(mock.pattern);
        setMaxGain(mock.maxGain);
      }
    } catch (e) {
      console.error('Failed to compute radiation pattern:', e);
    } finally {
      setLoading(false);
    }
  }, [antennaType, frequency, patternData]);

  useEffect(() => {
    computePattern();
  }, [computePattern]);

  return (
    <div className="flex flex-col gap-3 flex-1">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 items-center">
          <span className="text-sm font-semibold text-text-primary">3D Radiation Pattern</span>
          {maxGain > -Infinity && (
            <span className="text-xs text-text-dim font-mono">
              Max Gain: {maxGain.toFixed(1)} dBi
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant={wireframe ? 'default' : 'outline'}
            size="sm"
            onClick={() => setWireframe(!wireframe)}
          >
            Wireframe
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={computePattern}
            disabled={loading}
          >
            {loading ? 'Computing...' : 'Refresh'}
          </Button>
        </div>
      </div>

      <div className="bg-surface border border-border rounded-lg flex-1 min-h-[300px] overflow-hidden">
        {pattern ? (
          <Canvas
            camera={{ position: [2, 1.5, 2], fov: 50 }}
            style={{ background: 'transparent', width: '100%', height: '100%' }}
          >
            <ambientLight intensity={0.4} />
            <directionalLight position={[10, 10, 5]} intensity={0.8} />
            <RadiationPattern3D
              pattern={pattern}
              maxGain={maxGain}
              radius={1.0}
              opacity={0.85}
              wireframe={wireframe}
            />
            <axesHelper args={[1.5]} />
            <OrbitControls enableDamping dampingFactor={0.05} />
          </Canvas>
        ) : (
          <div className="flex items-center justify-center h-full text-text-dim gap-2">
            {loading ? (
              <>
                <svg className="animate-spin w-4 h-4 text-accent" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                </svg>
                <span>Computing radiation pattern...</span>
              </>
            ) : 'No pattern data'}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-text-dim">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ background: getChartColor(1) }} />
          <span>High Gain</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ background: getChartColor(2) }} />
          <span>Mid</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ background: getChartColor(3) }} />
          <span>Low Gain</span>
        </div>
        <span className="ml-auto font-mono">Theta: 0-180, Phi: 0-360</span>
      </div>
    </div>
  );
}
