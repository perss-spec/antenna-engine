import React, { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

interface PatternData {
  theta: number[];
  phi: number[];
  gain: number[][];
  frequency: number;
  title?: string;
}

interface PatternViewerProps {
  data?: PatternData;
  className?: string;
}

const PatternMesh: React.FC<{ data: PatternData }> = ({ data }) => {
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (!meshRef.current || !data) return;

    const geometry = new THREE.SphereGeometry(1, 32, 32);
    const vertices = geometry.attributes.position;
    const colors = new Float32Array(vertices.count * 3);

    // Map gain data to sphere vertices
    for (let i = 0; i < vertices.count; i++) {
      const vertex = new THREE.Vector3();
      vertex.fromBufferAttribute(vertices, i);
      
      // Convert to spherical coordinates
      const spherical = new THREE.Spherical();
      spherical.setFromVector3(vertex);
      
      const thetaIndex = Math.floor((spherical.theta / Math.PI) * (data.theta.length - 1));
      const phiIndex = Math.floor((spherical.phi / (2 * Math.PI)) * (data.phi.length - 1));
      
      const gainValue = data.gain[thetaIndex]?.[phiIndex] || 0;
      const normalizedGain = Math.max(0, (gainValue + 40) / 40); // Normalize to 0-1
      
      // Color mapping: blue (low) to red (high)
      colors[i * 3] = normalizedGain; // R
      colors[i * 3 + 1] = 0.5 - Math.abs(normalizedGain - 0.5); // G
      colors[i * 3 + 2] = 1 - normalizedGain; // B
      
      // Scale vertex based on gain
      vertex.multiplyScalar(0.5 + normalizedGain * 0.5);
      vertices.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }

    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.attributes.position.needsUpdate = true;

    if (meshRef.current.geometry) {
      meshRef.current.geometry.dispose();
    }
    meshRef.current.geometry = geometry;
  }, [data]);

  return (
    <mesh ref={meshRef}>
      <meshBasicMaterial vertexColors wireframe />
    </mesh>
  );
};

const PatternViewer: React.FC<PatternViewerProps> = ({ data, className }) => {
  const [view2D, setView2D] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const draw2DPattern = (canvas: HTMLCanvasElement, patternData: PatternData) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw coordinate system
    ctx.strokeStyle = '#333333';
    ctx.lineWidth = 1;
    
    // Draw circles
    for (let i = 1; i <= 4; i++) {
      const r = (radius * i) / 4;
      ctx.beginPath();
      ctx.arc(centerX, centerY, r, 0, 2 * Math.PI);
      ctx.stroke();
      
      // Label circles
      ctx.fillStyle = '#666666';
      ctx.font = '12px Arial';
      ctx.fillText(`${-10 * (4 - i)} dB`, centerX + r + 5, centerY);
    }

    // Draw radial lines
    for (let angle = 0; angle < 360; angle += 30) {
      const rad = (angle * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + radius * Math.cos(rad),
        centerY + radius * Math.sin(rad)
      );
      ctx.stroke();
      
      // Label angles
      ctx.fillText(
        `${angle}°`,
        centerX + (radius + 10) * Math.cos(rad),
        centerY + (radius + 10) * Math.sin(rad)
      );
    }

    // Draw pattern
    if (patternData.gain.length > 0) {
      ctx.strokeStyle = '#ff6b6b';
      ctx.lineWidth = 2;
      ctx.beginPath();

      const phiSlice = Math.floor(patternData.phi.length / 2); // Take elevation cut
      
      for (let i = 0; i < patternData.theta.length; i++) {
        const gain = patternData.gain[i]?.[phiSlice] || 0;
        const normalizedGain = Math.max(0, (gain + 40) / 40);
        const r = radius * normalizedGain;
        const angle = (patternData.theta[i] * 180) / Math.PI;
        const rad = (angle * Math.PI) / 180;
        
        const x = centerX + r * Math.cos(rad);
        const y = centerY + r * Math.sin(rad);
        
        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.closePath();
      ctx.stroke();
    }
  };

  useEffect(() => {
    if (view2D && canvasRef.current && data) {
      draw2DPattern(canvasRef.current, data);
    }
  }, [view2D, data]);

  if (!data) {
    return (
      <div className={`pattern-viewer ${className || ''}`}>
        <div className="no-data">
          <p>No pattern data available</p>
          <p>Run a simulation to see radiation patterns</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`pattern-viewer ${className || ''}`}>
      <div className="pattern-header">
        <h3>{data.title || 'Radiation Pattern'}</h3>
        <div className="view-controls">
          <button
            className={!view2D ? 'active' : ''}
            onClick={() => setView2D(false)}
          >
            3D View
          </button>
          <button
            className={view2D ? 'active' : ''}
            onClick={() => setView2D(true)}
          >
            2D View
          </button>
        </div>
      </div>

      <div className="pattern-content">
        {view2D ? (
          <canvas
            ref={canvasRef}
            width={400}
            height={400}
            className="pattern-canvas"
          />
        ) : (
          <div className="pattern-3d">
            <Canvas camera={{ position: [3, 3, 3], fov: 60 }}>
              <ambientLight intensity={0.6} />
              <pointLight position={[10, 10, 10]} />
              <PatternMesh data={data} />
              <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
            </Canvas>
          </div>
        )}
      </div>

      <div className="pattern-info">
        <div className="info-item">
          <span>Frequency:</span>
          <span>{data.frequency.toFixed(1)} MHz</span>
        </div>
        <div className="info-item">
          <span>Data Points:</span>
          <span>{data.theta.length} × {data.phi.length}</span>
        </div>
      </div>
    </div>
  );
};

export default PatternViewer;