import { useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, Box } from '@react-three/drei';
import type { Mesh } from 'three';
import './AntennaView.css';

export interface AntennaViewProps {
  width?: number;
  height?: number;
  className?: string;
}

function AntennaGeometry() {
  const meshRef = useRef<Mesh>(null);

  return (
    <Box ref={meshRef} args={[1, 0.1, 0.1]} position={[0, 0, 0]}>
      <meshStandardMaterial color="#ff6b35" />
    </Box>
  );
}

export function AntennaView({ width, height, className }: AntennaViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleResize = () => {
      // Force canvas resize on window resize
      if (containerRef.current) {
        const canvas = containerRef.current.querySelector('canvas');
        if (canvas) {
          canvas.style.width = '100%';
          canvas.style.height = '100%';
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const containerStyle = {
    width: width ? `${width}px` : '100%',
    height: height ? `${height}px` : '400px',
    ...(className ? {} : {})
  };

  return (
    <div 
      ref={containerRef}
      className={`antenna-view ${className || ''}`}
      style={containerStyle}
    >
      <Canvas
        camera={{ position: [3, 3, 3], fov: 50 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1} />
        
        <Grid 
          args={[10, 10]} 
          cellSize={0.5} 
          cellThickness={0.5} 
          cellColor="#6f6f6f" 
          sectionSize={2} 
          sectionThickness={1} 
          sectionColor="#9d9d9d" 
          fadeDistance={25} 
          fadeStrength={1} 
          followCamera={false} 
          infiniteGrid={true}
        />
        
        <AntennaGeometry />
        
        <OrbitControls 
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          dampingFactor={0.05}
          enableDamping={true}
        />
      </Canvas>
    </div>
  );
}