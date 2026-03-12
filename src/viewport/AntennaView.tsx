import { useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid } from '@react-three/drei';
import type { AntennaGeometry, FieldData } from '../types/antenna';
import { AntennaRenderer } from './components/AntennaRenderer';
import { CurrentOverlay } from './components/CurrentOverlay';

export interface AntennaViewProps {
  geometry: AntennaGeometry;
  currentData?: FieldData;
  showCurrentOverlay?: boolean;
  showGrid?: boolean;
  showAxes?: boolean;
}

export function AntennaView({
  geometry,
  currentData,
  showCurrentOverlay = false,
  showGrid = true,
  showAxes = true
}: AntennaViewProps) {
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);

  const cameraPosition = useMemo(() => {
    const { min, max } = geometry.bounds;
    const size = Math.max(
      max.x - min.x,
      max.y - min.y,
      max.z - min.z
    );
    return [size * 2, size * 2, size * 2] as [number, number, number];
  }, [geometry.bounds]);

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: cameraPosition, fov: 50 }}
        style={{ background: '#1a1a1a' }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <directionalLight position={[-10, -10, -5]} intensity={0.3} />

        <AntennaRenderer
          geometry={geometry}
          selectedElementId={selectedElementId}
          onElementSelect={setSelectedElementId}
        />

        {showCurrentOverlay && currentData && (
          <CurrentOverlay fieldData={currentData} />
        )}

        {showGrid && (
          <Grid
            cellSize={0.5}
            sectionSize={2}
            fadeDistance={30}
            fadeStrength={1}
            cellThickness={0.5}
            sectionThickness={1.5}
            cellColor="#6f6f6f"
            sectionColor="#9d4b4b"
            position={[0, geometry.bounds.min.y - 0.1, 0]}
          />
        )}

        {showAxes && <axesHelper args={[2]} />}

        <OrbitControls
          enablePan
          enableZoom
          enableRotate
          dampingFactor={0.1}
          rotateSpeed={0.5}
          zoomSpeed={0.8}
        />
      </Canvas>
    </div>
  );
}