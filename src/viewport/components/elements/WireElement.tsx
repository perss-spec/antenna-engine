import { useMemo } from 'react';
import { Vector3 as ThreeVec3, CylinderGeometry, Quaternion, Matrix4 } from 'three';
import type { ViewportAntennaElement } from '../../types';

export interface WireElementProps {
  element: ViewportAntennaElement;
  selected: boolean;
  showWireframe: boolean;
  onClick: () => void;
}

export function WireElement({ element, selected, showWireframe, onClick }: WireElementProps) {
  const { geometry, position, rotation } = useMemo(() => {
    if (!element.vertices || element.vertices.length < 2) {
      return { geometry: null, position: [0, 0, 0], rotation: [0, 0, 0, 1] };
    }

    const start = new ThreeVec3(element.vertices[0].x, element.vertices[0].y, element.vertices[0].z);
    const end = new ThreeVec3(element.vertices[1].x, element.vertices[1].y, element.vertices[1].z);

    const direction = new ThreeVec3().subVectors(end, start);
    const length = direction.length();
    const center = new ThreeVec3().addVectors(start, end).multiplyScalar(0.5);

    const orientation = new Matrix4().lookAt(start, end, new ThreeVec3(0, 1, 0));
    const quaternion = new Quaternion().setFromRotationMatrix(orientation);
    quaternion.multiply(new Quaternion().setFromAxisAngle(new ThreeVec3(1, 0, 0), Math.PI / 2));

    const radius = element.radius || 0.001;
    const geometry = new CylinderGeometry(radius, radius, length, 8);

    return {
      geometry,
      position: [center.x, center.y, center.z] as [number, number, number],
      rotation: [quaternion.x, quaternion.y, quaternion.z, quaternion.w] as [number, number, number, number]
    };
  }, [element.vertices, element.radius]);

  const materialColor = useMemo(() => {
    if (selected) return '#ffff00';
    switch (element.material) {
      case 'copper': return '#ff7f00';
      case 'pec': return '#c0c0c0';
      default: return '#808080';
    }
  }, [element.material, selected]);

  if (!geometry) return null;

  return (
    <mesh
      geometry={geometry}
      position={position}
      quaternion={rotation}
      onClick={onClick}
    >
      <meshStandardMaterial
        color={materialColor}
        wireframe={showWireframe}
        metalness={0.8}
        roughness={0.2}
      />
    </mesh>
  );
}
