import { useMemo } from 'react';
import { Color } from 'three';
import type { FieldData } from '../../types/antenna';

export interface CurrentOverlayProps {
  fieldData: FieldData;
  opacity?: number;
}

export function CurrentOverlay({ fieldData, opacity = 0.8 }: CurrentOverlayProps) {
  const { geometry } = useMemo(() => {
    const positions: number[] = [];
    const colorArray: number[] = [];
    
    // Find min/max magnitude for color mapping
    const minMag = Math.min(...fieldData.magnitude);
    const maxMag = Math.max(...fieldData.magnitude);
    const range = maxMag - minMag;
    
    fieldData.positions.forEach((pos, i: number) => {
      positions.push(pos.x, pos.y, pos.z);
      
      // Map magnitude to color (blue = low, red = high)
      const normalized = range > 0 ? (fieldData.magnitude[i] - minMag) / range : 0;
      const color = new Color().setHSL(0.67 * (1 - normalized), 1, 0.5);
      colorArray.push(color.r, color.g, color.b);
    });
    
    return {
      geometry: {
        positions: new Float32Array(positions),
        colors: new Float32Array(colorArray)
      }
    };
  }, [fieldData]);

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          array={geometry.positions}
          count={geometry.positions.length / 3}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          array={geometry.colors}
          count={geometry.colors.length / 3}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        vertexColors
        transparent
        opacity={opacity}
        sizeAttenuation
      />
    </points>
  );
}