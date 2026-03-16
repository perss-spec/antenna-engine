import React, { useState, useRef } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface AntennaParams {
  frequency: number;
  gain: number;
  beamwidth: number;
  impedance: number;
  polarization: 'vertical' | 'horizontal' | 'circular';
  antennaType: 'dipole' | 'yagi' | 'patch' | 'horn';
}

interface SimulationResult {
  swr: number;
  efficiency: number;
  gainPattern: number[];
  impedanceReal: number;
  impedanceImag: number;
}

interface AntennaDesignerProps {
  onDesignChange?: (params: AntennaParams) => void;
}

const AntennaModel: React.FC<{ params: AntennaParams }> = ({ params }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  
  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.5;
    }
  });

  const getGeometry = () => {
    switch (params.antennaType) {
      case 'dipole':
        return <cylinderGeometry args={[0.02, 0.02, 2]} />;
      case 'yagi':
        return (
          <group>
            <mesh position={[0, 0, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 2]} />
              <meshStandardMaterial color="#888888" />
            </mesh>
            <mesh position={[0, 0, -0.5]}>
              <cylinderGeometry args={[0.01, 0.01, 1.5]} />
              <meshStandardMaterial color="#666666" />
            </mesh>
            <mesh position={[0, 0, 0.3]}>
              <cylinderGeometry args={[0.01, 0.01, 1.8]} />
              <meshStandardMaterial color="#666666" />
            </mesh>
          </group>
        );
      case 'patch':
        return <boxGeometry args={[1, 0.1, 1]} />;
      case 'horn':
        return <coneGeometry args={[1, 2, 8]} />;
      default:
        return <cylinderGeometry args={[0.02, 0.02, 2]} />;
    }
  };

  if (params.antennaType === 'yagi') {
    return <>{getGeometry()}</>;
  }

  return (
    <mesh ref={meshRef}>
      {getGeometry()}
      <meshStandardMaterial color="#888888" />
    </mesh>
  );
};

const AntennaDesigner: React.FC<AntennaDesignerProps> = ({ onDesignChange }) => {
  const [params, setParams] = useState<AntennaParams>({
    frequency: 2400,
    gain: 10,
    beamwidth: 60,
    impedance: 50,
    polarization: 'vertical',
    antennaType: 'dipole'
  });

  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleParamChange = (key: keyof AntennaParams, value: any) => {
    const newParams = { ...params, [key]: value };
    setParams(newParams);
    onDesignChange?.(newParams);
  };

  const runSimulation = async () => {
    setIsSimulating(true);
    setError(null);

    try {
      const result = await invoke<SimulationResult>('simulate_antenna', { params });
      setSimulation(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation failed');
      console.error('Simulation error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="antenna-designer">
      <div className="design-panel">
        <h2>Antenna Parameters</h2>
        
        <div className="param-group">
          <label>
            Antenna Type:
            <select
              value={params.antennaType}
              onChange={(e) => handleParamChange('antennaType', e.target.value)}
            >
              <option value="dipole">Dipole</option>
              <option value="yagi">Yagi-Uda</option>
              <option value="patch">Patch</option>
              <option value="horn">Horn</option>
            </select>
          </label>

          <label>
            Frequency (MHz):
            <input
              type="number"
              value={params.frequency}
              onChange={(e) => handleParamChange('frequency', parseFloat(e.target.value))}
              min="1"
              max="10000"
            />
          </label>

          <label>
            Target Gain (dBi):
            <input
              type="number"
              value={params.gain}
              onChange={(e) => handleParamChange('gain', parseFloat(e.target.value))}
              min="0"
              max="30"
            />
          </label>

          <label>
            Beamwidth (degrees):
            <input
              type="number"
              value={params.beamwidth}
              onChange={(e) => handleParamChange('beamwidth', parseFloat(e.target.value))}
              min="10"
              max="360"
            />
          </label>

          <label>
            Impedance (Ω):
            <input
              type="number"
              value={params.impedance}
              onChange={(e) => handleParamChange('impedance', parseFloat(e.target.value))}
              min="1"
              max="1000"
            />
          </label>

          <label>
            Polarization:
            <select
              value={params.polarization}
              onChange={(e) => handleParamChange('polarization', e.target.value)}
            >
              <option value="vertical">Vertical</option>
              <option value="horizontal">Horizontal</option>
              <option value="circular">Circular</option>
            </select>
          </label>
        </div>

        <button
          className="simulate-btn"
          onClick={runSimulation}
          disabled={isSimulating}
        >
          {isSimulating ? 'Simulating...' : 'Run Simulation'}
        </button>

        {error && (
          <div className="error-message">
            Error: {error}
          </div>
        )}

        {simulation && (
          <div className="results-panel">
            <h3>Simulation Results</h3>
            <div className="result-item">
              <span>SWR:</span>
              <span>{simulation.swr.toFixed(2)}</span>
            </div>
            <div className="result-item">
              <span>Efficiency:</span>
              <span>{(simulation.efficiency * 100).toFixed(1)}%</span>
            </div>
            <div className="result-item">
              <span>Impedance:</span>
              <span>{simulation.impedanceReal.toFixed(1)} + j{simulation.impedanceImag.toFixed(1)} Ω</span>
            </div>
          </div>
        )}
      </div>

      <div className="preview-panel">
        <h3>3D Preview</h3>
        <div className="canvas-container">
          <Canvas camera={{ position: [5, 5, 5], fov: 60 }}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} />
            <AntennaModel params={params} />
            <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
          </Canvas>
        </div>
      </div>
    </div>
  );
};

export default AntennaDesigner;