import { useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { RadiationPattern3D } from '@/viewport/RadiationPattern3D';
import { Button } from '@/components/ui/button';
import type { AntennaType } from '@/components/AntennaForm/AntennaForm';

const isTauri = '__TAURI_INTERNALS__' in window;

interface RadiationPatternViewProps {
  antennaType: AntennaType;
  frequency: number;
}

function generateMockPattern(antennaType: AntennaType): { pattern: number[][]; maxGain: number } {
  const nTheta = 37;
  const nPhi = 73;
  const pattern: number[][] = [];
  let maxGain = -Infinity;

  const models: Record<AntennaType, { baseGain: number; fn: (theta: number) => number }> = {
    dipole: {
      baseGain: 2.15,
      fn: (t) => {
        const st = Math.sin(t);
        if (Math.abs(st) < 1e-6) return -40;
        const f = Math.cos(Math.PI / 2 * Math.cos(t)) / st;
        return 2.15 + 20 * Math.log10(Math.max(Math.abs(f), 1e-10));
      }
    },
    monopole: {
      baseGain: 5.15,
      fn: (t) => {
        const st = Math.sin(t);
        if (Math.abs(st) < 1e-6 || t > Math.PI / 2) return -40;
        const f = Math.cos(Math.PI / 2 * Math.cos(t)) / st;
        return 5.15 + 20 * Math.log10(Math.max(Math.abs(f), 1e-10));
      }
    },
    patch: {
      baseGain: 6.0,
      fn: (t) => {
        const g = Math.pow(Math.cos(t), 2);
        return 6.0 + 10 * Math.log10(Math.max(g, 1e-10));
      }
    },
    qfh: {
      baseGain: 3.0,
      fn: (t) => {
        const g = Math.pow((1 + Math.cos(t)) / 2, 2);
        return 3.0 + 10 * Math.log10(Math.max(g, 1e-10));
      }
    },
    yagi: {
      baseGain: 7.1,
      fn: (t) => {
        const psi = Math.PI / 2 * Math.cos(t);
        const af = Math.abs((1 + 2 * Math.cos(psi)) / 3);
        return 7.1 + 20 * Math.log10(Math.max(af, 1e-10));
      }
    },
  };

  const model = models[antennaType] || models.dipole;

  for (let it = 0; it < nTheta; it++) {
    const theta = Math.PI * it / (nTheta - 1);
    const row: number[] = [];
    for (let ip = 0; ip < nPhi; ip++) {
      const gain = Math.max(model.fn(theta), -40);
      if (gain > maxGain) maxGain = gain;
      row.push(gain);
    }
    pattern.push(row);
  }

  return { pattern, maxGain };
}

export function RadiationPatternView({ antennaType, frequency }: RadiationPatternViewProps) {
  const [pattern, setPattern] = useState<number[][] | null>(null);
  const [maxGain, setMaxGain] = useState(0);
  const [loading, setLoading] = useState(false);
  const [wireframe, setWireframe] = useState(false);

  const computePattern = useCallback(async () => {
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
        const mock = generateMockPattern(antennaType);
        setPattern(mock.pattern);
        setMaxGain(mock.maxGain);
      }
    } catch (e) {
      console.error('Failed to compute radiation pattern:', e);
    } finally {
      setLoading(false);
    }
  }, [antennaType, frequency]);

  useEffect(() => {
    computePattern();
  }, [computePattern]);

  return (
    <div className="flex flex-col gap-3 flex-1">
      <div className="flex items-center justify-between">
        <div className="flex gap-2 items-center">
          <span className="text-sm font-semibold">3D Radiation Pattern</span>
          {maxGain > -Infinity && (
            <span className="text-xs text-text-dim">
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

      <div className="bg-surface border border-border rounded-lg flex-1 min-h-[400px] overflow-hidden">
        {pattern ? (
          <Canvas
            camera={{ position: [2, 1.5, 2], fov: 50 }}
            style={{ background: '#1a1a1a', width: '100%', height: '100%', minHeight: 400 }}
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
          <div className="flex items-center justify-center h-full text-text-dim">
            {loading ? 'Computing radiation pattern...' : 'No pattern data'}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-text-dim">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ background: '#ff0000' }} />
          <span>High Gain</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ background: '#00ff00' }} />
          <span>Mid</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded" style={{ background: '#0000ff' }} />
          <span>Low Gain</span>
        </div>
        <span className="ml-auto">Theta: 0-180, Phi: 0-360</span>
      </div>
    </div>
  );
}
