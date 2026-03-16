import React, { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Grid, Edges, Line } from '@react-three/drei';
import * as THREE from 'three';

interface MeshData {
  vertices: Float32Array;
  triangles: Uint32Array;
  wireSegments: Uint32Array;
  triangleQuality?: Float32Array; // aspect ratios
}

interface ComplexArray {
  real: Float32Array;
  imag: Float32Array;
}

interface MeshViewerProps {
  mesh: MeshData | null;
  currents?: ComplexArray;
  mode: 'wireframe' | 'solid' | 'transparent';
  showQuality: boolean;
}

function MeshGeometry({ 
  mesh, 
  currents, 
  mode, 
  showQuality 
}: MeshViewerProps) {
  const triangleMeshRef = useRef<THREE.Mesh>(null);
  const wireSegmentsRef = useRef<THREE.LineSegments>(null);

  // Create triangle geometry
  const triangleGeometry = useMemo(() => {
    if (!mesh) return null;
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(mesh.vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(mesh.triangles, 1));
    geometry.computeVertexNormals();
    
    return geometry;
  }, [mesh]);

  // Create wire segments geometry
  const wireGeometry = useMemo(() => {
    if (!mesh) return null;
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(mesh.vertices, 3));
    geometry.setIndex(new THREE.BufferAttribute(mesh.wireSegments, 1));
    
    return geometry;
  }, [mesh]);

  // Create color attributes for triangles
  const triangleColors = useMemo(() => {
    if (!mesh) return null;
    
    const vertexCount = mesh.vertices.length / 3;
    const colors = new Float32Array(vertexCount * 3);
    
    if (showQuality && mesh.triangleQuality) {
      // Quality heatmap (red = poor, green = good)
      const triangleCount = mesh.triangles.length / 3;
      
      for (let i = 0; i < triangleCount; i++) {
        const quality = mesh.triangleQuality[i];
        const normalizedQuality = Math.min(Math.max(quality, 0), 1);
        
        // Get triangle vertex indices
        const v1 = mesh.triangles[i * 3];
        const v2 = mesh.triangles[i * 3 + 1];
        const v3 = mesh.triangles[i * 3 + 2];
        
        // Color interpolation: red (0) to yellow (0.5) to green (1)
        const r = normalizedQuality < 0.5 ? 1 : 1 - (normalizedQuality - 0.5) * 2;
        const g = normalizedQuality < 0.5 ? normalizedQuality * 2 : 1;
        const b = 0;
        
        // Apply color to triangle vertices
        [v1, v2, v3].forEach(vertexIndex => {
          colors[vertexIndex * 3] = r;
          colors[vertexIndex * 3 + 1] = g;
          colors[vertexIndex * 3 + 2] = b;
        });
      }
    } else if (currents) {
      // Current density magnitude colormap
      const vertexCount = mesh.vertices.length / 3;
      const magnitudes = new Float32Array(vertexCount);
      
      // Calculate current magnitudes
      for (let i = 0; i < vertexCount; i++) {
        const real = currents.real[i] || 0;
        const imag = currents.imag[i] || 0;
        magnitudes[i] = Math.sqrt(real * real + imag * imag);
      }
      
      // Find min/max for normalization
      const maxMag = Math.max(...magnitudes);
      const minMag = Math.min(...magnitudes);
      const range = maxMag - minMag;
      
      // Apply jet colormap
      for (let i = 0; i < vertexCount; i++) {
        const normalized = range > 0 ? (magnitudes[i] - minMag) / range : 0;
        const { r, g, b } = jetColormap(normalized);
        
        colors[i * 3] = r;
        colors[i * 3 + 1] = g;
        colors[i * 3 + 2] = b;
      }
    } else {
      // Default surface color (blue)
      for (let i = 0; i < vertexCount; i++) {
        colors[i * 3] = 0.2;     // R
        colors[i * 3 + 1] = 0.4; // G  
        colors[i * 3 + 2] = 0.8; // B
      }
    }
    
    return new THREE.BufferAttribute(colors, 3);
  }, [mesh, currents, showQuality]);

  // Wire segment colors (copper)
  const wireColors = useMemo(() => {
    if (!mesh) return null;
    
    const vertexCount = mesh.vertices.length / 3;
    const colors = new Float32Array(vertexCount * 3);
    
    // Copper color
    for (let i = 0; i < vertexCount; i++) {
      colors[i * 3] = 0.72;     // R
      colors[i * 3 + 1] = 0.45; // G
      colors[i * 3 + 2] = 0.20; // B
    }
    
    return new THREE.BufferAttribute(colors, 3);
  }, [mesh]);

  // Material based on mode
  const triangleMaterial = useMemo(() => {
    const baseProps = {
      vertexColors: true,
      side: THREE.DoubleSide,
    };
    
    switch (mode) {
      case 'wireframe':
        return new THREE.MeshBasicMaterial({
          ...baseProps,
          wireframe: true,
        });
      case 'transparent':
        return new THREE.MeshLambertMaterial({
          ...baseProps,
          transparent: true,
          opacity: 0.7,
        });
      default: // solid
        return new THREE.MeshLambertMaterial(baseProps);
    }
  }, [mode]);

  // Update geometries with colors
  React.useEffect(() => {
    if (triangleGeometry && triangleColors) {
      triangleGeometry.setAttribute('color', triangleColors);
    }
  }, [triangleGeometry, triangleColors]);

  React.useEffect(() => {
    if (wireGeometry && wireColors) {
      wireGeometry.setAttribute('color', wireColors);
    }
  }, [wireGeometry, wireColors]);

  if (!mesh) return null;

  return (
    <group>
      {/* Triangle mesh */}
      {triangleGeometry && (
        <mesh
          ref={triangleMeshRef}
          geometry={triangleGeometry}
          material={triangleMaterial}
        />
      )}
      
      {/* Wire segments */}
      {wireGeometry && (
        <lineSegments
          ref={wireSegmentsRef}
          geometry={wireGeometry}
        >
          <lineBasicMaterial vertexColors />
        </lineSegments>
      )}
    </group>
  );
}

// Jet colormap implementation
function jetColormap(value: number): { r: number; g: number; b: number } {
  const v = Math.min(Math.max(value, 0), 1);
  
  let r, g, b;
  
  if (v < 0.125) {
    r = 0;
    g = 0;
    b = 0.5 + v * 4;
  } else if (v < 0.375) {
    r = 0;
    g = (v - 0.125) * 4;
    b = 1;
  } else if (v < 0.625) {
    r = (v - 0.375) * 4;
    g = 1;
    b = 1 - (v - 0.375) * 4;
  } else if (v < 0.875) {
    r = 1;
    g = 1 - (v - 0.625) * 4;
    b = 0;
  } else {
    r = 1 - (v - 0.875) * 4;
    g = 0;
    b = 0;
  }
  
  return { r, g, b };
}

export default function MeshViewer(props: MeshViewerProps) {
  return (
    <group>
      {/* Grid helper */}
      <Grid 
        args={[20, 20]} 
        cellSize={1} 
        cellThickness={0.5} 
        cellColor="#6f6f6f" 
        sectionSize={5} 
        sectionThickness={1} 
        sectionColor="#9d4b4b" 
        fadeDistance={50} 
        fadeStrength={1} 
        infiniteGrid 
      />
      
      {/* Axis helper */}
      <axesHelper args={[5]} />
      
      {/* Lighting */}
      <ambientLight intensity={0.4} />
      <directionalLight 
        position={[10, 10, 5]} 
        intensity={0.8}
        castShadow
      />
      <directionalLight 
        position={[-10, -10, -5]} 
        intensity={0.4}
      />
      
      {/* Mesh geometry */}
      <MeshGeometry {...props} />
    </group>
  );
}