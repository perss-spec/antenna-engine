import React, { useEffect, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import { AntennaPattern } from '../types/antenna';

interface AntennaViewerProps {
  pattern: AntennaPattern;
  className?: string;
}

interface PatternMeshProps {
  pattern: AntennaPattern;
}

const PatternMesh: React.FC<PatternMeshProps> = ({ pattern }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  useEffect(() => {
    const pd = pattern.pattern_data;
    if (!pd || !pd.elevation || !pd.azimuth || !pd.gain_values) return;

    const vertices: number[] = [];
    const colors: number[] = [];

    for (let i = 0; i < pd.elevation.length; i++) {
      for (let j = 0; j < pd.azimuth.length; j++) {
        const theta = (pd.elevation[i] * Math.PI) / 180;
        const phi = (pd.azimuth[j] * Math.PI) / 180;
        const gainVal = pd.gain_values[i]?.[j] ?? 0;
        const r = Math.max(0, gainVal / 10); // Normalize gain

        const x = r * Math.sin(theta) * Math.cos(phi);
        const y = r * Math.sin(theta) * Math.sin(phi);
        const z = r * Math.cos(theta);

        vertices.push(x, y, z);

        // Color based on gain
        const normalizedGain = Math.max(0, gainVal / 20);
        colors.push(normalizedGain, 0.5, 1 - normalizedGain);
      }
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    
    setGeometry(geom);
  }, [pattern]);

  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.z += 0.01;
    }
  });

  if (!geometry) return null;

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <pointsMaterial size={0.05} vertexColors transparent opacity={0.8} />
    </mesh>
  );
};

const AntennaViewer: React.FC<AntennaViewerProps> = ({ pattern, className = '' }) => {
  return (
    <div className={`antenna-viewer ${className}`} style={{ width: '100%', height: '400px' }}>
      <Canvas camera={{ position: [5, 5, 5], fov: 45 }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        <PatternMesh pattern={pattern} />
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
        <gridHelper args={[10, 10]} />
      </Canvas>
    </div>
  );
};

export default AntennaViewer;