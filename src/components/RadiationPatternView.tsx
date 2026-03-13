import { useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { RadiationPattern3D } from '@/viewport/RadiationPattern3D';
import { Button } from '@/components/ui/button';
import type { AntennaType } from '@/components/AntennaForm/AntennaForm';

const isTauri = '__TAURI_INTERNALS__' in window;

// Physics constants
const C0 = 299792458; // speed of light m/s

interface RadiationPatternViewProps {
  antennaType: AntennaType;
  frequency: number;
}

function generateFrequencyDependentPattern(antennaType: AntennaType, frequency: number): { pattern: number[][]; maxGain: number } {
  const nTheta = 37;
  const nPhi = 73;
  const pattern: number[][] = [];
  let maxGain = -Infinity;

  const lambda = C0 / frequency;
  const k = 2 * Math.PI / lambda;

  // Helper function for sinc with L'Hopital limit
  const sinc = (x: number): number => {
    if (Math.abs(x) < 1e-10) return 1.0;
    return Math.sin(x) / x;
  };

  const models: Record<AntennaType, { baseGain: number; fn: (theta: number) => number }> = {
    dipole: {
      baseGain: 2.15,
      fn: (theta) => {
        const L = lambda / 2; // half-wave dipole
        const kL = k * L;
        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);
        
        if (Math.abs(sinTheta) < 1e-10) {
          // L'Hopital limit as sin(theta) -> 0
          return -40; // null at theta = 0, pi
        }
        
        const numerator = Math.cos(kL / 2 * cosTheta) - Math.cos(kL / 2);
        const f = numerator / sinTheta;
        const gain = 2.15 + 20 * Math.log10(Math.max(Math.abs(f), 1e-10));
        return Math.max(gain, -40);
      }
    },
    monopole: {
      baseGain: 5.15,
      fn: (theta) => {
        if (theta > Math.PI / 2) return -40; // ground plane blocks radiation
        
        const L = lambda / 4; // quarter-wave monopole
        const kL = k * L;
        const cosTheta = Math.cos(theta);
        const sinTheta = Math.sin(theta);
        
        if (Math.abs(sinTheta) < 1e-10) {
          return -40; // null at theta = 0
        }
        
        const numerator = Math.cos(kL / 2 * cosTheta) - Math.cos(kL / 2);
        const f = numerator / sinTheta;
        const gain = 5.15 + 20 * Math.log10(Math.max(Math.abs(f), 1e-10));
        return Math.max(gain, -40);
      }
    },
    patch: {
      baseGain: 6.0,
      fn: (theta) => {
        const W = lambda / 2; // patch width
        const L = lambda / 2; // patch length
        const kW = k * W;
        const kL = k * L;
        const sinTheta = Math.sin(theta);
        const cosTheta = Math.cos(theta);
        
        // E-plane pattern: cos(theta) * sinc(kW/2 * sin(theta))
        const ePattern = Math.abs(cosTheta) * Math.abs(sinc(kW / 2 * sinTheta));
        
        // H-plane pattern: sinc(kL/2 * sin(theta)) * cos(theta)
        const hPattern = Math.abs(sinc(kL / 2 * sinTheta)) * Math.abs(cosTheta);
        
        // Combined pattern (geometric mean)
        const combinedPattern = Math.sqrt(ePattern * hPattern);
        const gain = 6.0 + 20 * Math.log10(Math.max(combinedPattern, 1e-10));
        return Math.max(gain, -40);
      }
    },
    qfh: {
      baseGain: 3.0,
      fn: (theta) => {
        const height = lambda * 0.26; // typical QFH height
        const f0 = C0 / (4 * height);
        const cosTheta = Math.cos(theta);
        
        // Cardioid with frequency-dependent axial ratio
        const cardoidBase = (1 + cosTheta) / 2;
        const freqFactor = 1.5 * frequency / f0;
        const g = Math.pow(Math.max(cardoidBase, 1e-10), freqFactor);
        const gain = 3.0 + 10 * Math.log10(Math.max(g, 1e-10));
        return Math.max(gain, -40);
      }
    },
    yagi: {
      baseGain: 7.1,
      fn: (theta) => {
        const d1 = 0.25 * lambda; // reflector spacing
        const d2 = 0.25 * lambda; // director spacing
        const a2 = 0.8; // director amplitude coefficient
        const cosTheta = Math.cos(theta);
        
        // Array factor: |1 + exp(j*k*d1*cos(theta)) + a2*exp(j*2*k*d2*cos(theta))|/3
        const phase1 = k * d1 * cosTheta;
        const phase2 = 2 * k * d2 * cosTheta;
        
        const real = 1 + Math.cos(phase1) + a2 * Math.cos(phase2);
        const imag = Math.sin(phase1) + a2 * Math.sin(phase2);
        const af = Math.sqrt(real * real + imag * imag) / 3;
        
        const gain = 7.1 + 20 * Math.log10(Math.max(af, 1e-10));
        return Math.max(gain, -40);
      }
    },
  };

  const model = models[antennaType] || models.dipole;

  for (let it = 0; it < nTheta; it++) {
    const theta = Math.PI * it / (nTheta - 1);
    const row: number[] = [];
    for (let ip = 0; ip < nPhi; ip++) {
      const gain = model.fn(theta);
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
        const mock = generateFrequencyDependentPattern(antennaType, frequency);
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