import { useMemo } from 'react';
import type { ViewportAntennaElement } from '../../types';

export interface PatchElementProps {
  element: ViewportAntennaElement;
  selected: boolean;
  showWireframe: boolean;
  onClick: () => void;
}

export function PatchElement({ element, selected, showWireframe, onClick }: PatchElementProps) {
  const { patchGeometry, substrateGeometry, patchPosition, substratePosition } = useMemo(() => {
    if (!element.vertices || element.vertices.length < 4) {
      return {
        patchGeometry: null,
        substrateGeometry: null,
        patchPosition: [0, 0, 0],
        substratePosition: [0, 0, 0]
      };
    }

    const v0 = element.vertices[0];
    const v1 = element.vertices[1];
    const v2 = element.vertices[2];

    const width = Math.sqrt(
      Math.pow(v1.x - v0.x, 2) + Math.pow(v1.y - v0.y, 2) + Math.pow(v1.z - v0.z, 2)
    );
    const length = Math.sqrt(
      Math.pow(v2.x - v1.x, 2) + Math.pow(v2.y - v1.y, 2) + Math.pow(v2.z - v1.z, 2)
    );

    const centerX = (v0.x + v1.x + v2.x + element.vertices[3].x) / 4;
    const centerY = (v0.y + v1.y + v2.y + element.vertices[3].y) / 4;
    const centerZ = (v0.z + v1.z + v2.z + element.vertices[3].z) / 4;

    const thickness = element.thickness || 0.001;
    const substrateHeight = 0.01;

    return {
      patchGeometry: { width, length, thickness },
      substrateGeometry: { width: width * 1.2, length: length * 1.2, height: substrateHeight },
      patchPosition: [centerX, centerY, centerZ + thickness / 2] as [number, number, number],
      substratePosition: [centerX, centerY, centerZ - substrateHeight / 2] as [number, number, number]
    };
  }, [element.vertices, element.thickness]);

  const patchColor = useMemo(() => {
    if (selected) return '#ffff00';
    return '#ff7f00';
  }, [selected]);

  if (!patchGeometry || !substrateGeometry) return null;

  return (
    <group onClick={onClick}>
      <mesh position={patchPosition}>
        <boxGeometry args={[patchGeometry.width, patchGeometry.length, patchGeometry.thickness]} />
        <meshStandardMaterial
          color={patchColor}
          wireframe={showWireframe}
          metalness={0.8}
          roughness={0.2}
        />
      </mesh>

      <mesh position={substratePosition}>
        <boxGeometry args={[substrateGeometry.width, substrateGeometry.length, substrateGeometry.height]} />
        <meshStandardMaterial
          color="#00ff00"
          wireframe={showWireframe}
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  );
}
