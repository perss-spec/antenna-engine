import React, { useMemo, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { Grid, Edges, Html } from '@react-three/drei';
import * as THREE from 'three';

interface Triangle {
  vertices: [number, number, number][];
  materialId?: number;
}

interface WireSegment {
  start: [number, number, number];
  end: [number, number, number];
  radius: number;
}

interface MeshData {
  triangles: Triangle[];
  wireSegments: WireSegment[];
  vertices: [number, number, number][];
}

interface ComplexArray {
  real: number[];
  imag: number[];
}

interface MeshViewerProps {
  mesh: MeshData | null;
  currents?: ComplexArray;
  mode: 'wireframe' | 'solid' | 'transparent';
  showQuality: boolean;
}

const TriangleMesh: React.FC<{
  triangles: Triangle[];
  vertices: [number, number, number][];
  mode: 'wireframe' | 'solid' | 'transparent';
  showQuality: boolean;
  currents?: ComplexArray;
}> = ({ triangles, vertices, mode, showQuality, currents }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  const { geometry, qualityColors, currentColors } = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const positions: number[] = [];
    const indices: number[] = [];
    const colors: number[] = [];
    const qualityData: number[] = [];
    
    triangles.forEach((triangle, triIndex) => {
      triangle.vertices.forEach((vertex, vertIndex) => {
        positions.push(...vertex);
        indices.push(triIndex * 3 + vertIndex);
        
        // Calculate aspect ratio for quality visualization
        if (vertIndex === 0) {
          const [v0, v1, v2] = triangle.vertices;
          const a = new THREE.Vector3(...v0);
          const b = new THREE.Vector3(...v1);
          const c = new THREE.Vector3(...v2);
          
          const side1 = a.distanceTo(b);
          const side2 = b.distanceTo(c);
          const side3 = c.distanceTo(a);
          
          const s = (side1 + side2 + side3) / 2;
          const area = Math.sqrt(s * (s - side1) * (s - side2) * (s - side3));
          const aspectRatio = (side1 * side2 * side3) / (8 * area * area);
          
          qualityData.push(Math.min(aspectRatio, 10)); // Clamp for visualization
        }
      });
    });

    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    // Quality colors (green = good, red = bad)
    const qualityColors = qualityData.map(quality => {
      const normalized = Math.min(quality / 5, 1); // Normalize to 0-1
      return new THREE.Color().setHSL((1 - normalized) * 0.3, 1, 0.5); // Green to red
    });

    // Current density colors
    const currentColors = currents ? currents.real.map((real, i) => {
      const magnitude = Math.sqrt(real * real + currents.imag[i] * currents.imag[i]);
      const normalized = Math.min(magnitude / 100, 1); // Adjust scale as needed
      return new THREE.Color().setHSL(0.7 - normalized * 0.7, 1, 0.5); // Blue to red
    }) : [];

    return { geometry: geo, qualityColors, currentColors };
  }, [triangles, showQuality, currents]);

  const material = useMemo(() => {
    const baseColor = new THREE.Color(0x4a90e2); // Blue for surfaces
    
    if (mode === 'wireframe') {
      return new THREE.MeshBasicMaterial({ 
        color: baseColor, 
        wireframe: true,
        transparent: false
      });
    }
    
    if (mode === 'transparent') {
      return new THREE.MeshLambertMaterial({ 
        color: baseColor, 
        transparent: true, 
        opacity: 0.3 
      });
    }
    
    return new THREE.MeshLambertMaterial({ color: baseColor });
  }, [mode]);

  return (
    <group>
      <mesh ref={meshRef} geometry={geometry} material={material}>
        {mode !== 'wireframe' && <Edges color="black" />}
      </mesh>
      
      {/* Quality overlay */}
      {showQuality && (
        <mesh geometry={geometry}>
          <meshBasicMaterial vertexColors transparent opacity={0.7} />
        </mesh>
      )}
    </group>
  );
};

const WireMesh: React.FC<{
  wireSegments: WireSegment[];
  mode: 'wireframe' | 'solid' | 'transparent';
}> = ({ wireSegments, mode }) => {
  const wireGeometry = useMemo(() => {
    const positions: number[] = [];
    
    wireSegments.forEach(segment => {
      positions.push(...segment.start, ...segment.end);
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    
    return geo;
  }, [wireSegments]);

  const wireMaterial = useMemo(() => {
    const copperColor = new THREE.Color(0xcd7f32);
    return new THREE.LineBasicMaterial({ 
      color: copperColor,
      transparent: mode === 'transparent',
      opacity: mode === 'transparent' ? 0.6 : 1,
      linewidth: 2
    });
  }, [mode]);

  return (
    <lineSegments geometry={wireGeometry} material={wireMaterial} />
  );
};

const AxisHelper: React.FC = () => {
  return (
    <group>
      {/* X axis - Red */}
      <arrowHelper args={[new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0, 0), 2, 0xff0000]} />
      {/* Y axis - Green */}
      <arrowHelper args={[new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 0), 2, 0x00ff00]} />
      {/* Z axis - Blue */}
      <arrowHelper args={[new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, 0), 2, 0x0000ff]} />
    </group>
  );
};

const QualityLegend: React.FC<{ show: boolean }> = ({ show }) => {
  if (!show) return null;

  return (
    <Html position={[0, 0, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        fontSize: '12px'
      }}>
        <div>Mesh Quality</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '20px', height: '10px', background: 'linear-gradient(to right, #00ff00, #ffff00, #ff0000)' }}></div>
          <span>Good → Bad</span>
        </div>
      </div>
    </Html>
  );
};

const CurrentLegend: React.FC<{ show: boolean }> = ({ show }) => {
  if (!show) return null;

  return (
    <Html position={[0, 0, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute',
        top: '80px',
        right: '20px',
        background: 'rgba(0,0,0,0.7)',
        color: 'white',
        padding: '10px',
        borderRadius: '5px',
        fontSize: '12px'
      }}>
        <div>Current Density</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '20px', height: '10px', background: 'linear-gradient(to right, #0000ff, #00ffff, #ffff00, #ff0000)' }}></div>
          <span>Low → High</span>
        </div>
      </div>
    </Html>
  );
};

export const MeshViewer: React.FC<MeshViewerProps> = ({ 
  mesh, 
  currents, 
  mode, 
  showQuality 
}) => {
  if (!mesh) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100%',
        color: '#666'
      }}>
        No mesh data loaded
      </div>
    );
  }

  return (
    <group>
      {/* Grid helper */}
      <Grid 
        args={[20, 20]} 
        cellSize={1} 
        cellThickness={0.5} 
        cellColor={'#6f6f6f'} 
        sectionSize={5} 
        sectionThickness={1} 
        sectionColor={'#9d4b4b'} 
        fadeDistance={50}
        fadeStrength={1}
        followCamera={false}
        infiniteGrid={true}
      />
      
      {/* Axis helper */}
      <AxisHelper />
      
      {/* Triangle mesh */}
      <TriangleMesh
        triangles={mesh.triangles}
        vertices={mesh.vertices}
        mode={mode}
        showQuality={showQuality}
        currents={currents}
      />
      
      {/* Wire segments */}
      <WireMesh
        wireSegments={mesh.wireSegments}
        mode={mode}
      />
      
      {/* Legends */}
      <QualityLegend show={showQuality} />
      <CurrentLegend show={!!currents} />
      
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <directionalLight position={[-10, -10, -5]} intensity={0.3} />
    </group>
  );
};

export default MeshViewer;