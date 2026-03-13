import { useMemo } from 'react';
import { Vector3 as ThreeVec3, CatmullRomCurve3, TubeGeometry } from 'three';
import type { ViewportAntennaElement, Vec3 } from '../../types';

export interface QFHElementProps {
  element: ViewportAntennaElement;
  selected: boolean;
  showWireframe: boolean;
  onClick: () => void;
}

export function QFHElement({ element, selected, showWireframe, onClick }: QFHElementProps) {
  const helixGeometry = useMemo(() => {
    if (!element.vertices || element.vertices.length < 4) return null;

    const points = element.vertices.map(
      (vertex: Vec3) => new ThreeVec3(vertex.x, vertex.y, vertex.z)
    );

    const curve = new CatmullRomCurve3(points, false, 'catmullrom', 0.5);

    const radius = element.radius || 0.001;
    const tubularSegments = Math.max(64, points.length * 8);
    const radialSegments = 8;

    return new TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
  }, [element.vertices, element.radius]);

  const materialColor = useMemo(() => {
    if (selected) return '#ffff00';
    switch (element.material) {
      case 'copper': return '#ff7f00';
      case 'pec': return '#c0c0c0';
      default: return '#808080';
    }
  }, [element.material, selected]);

  if (!helixGeometry) return null;

  return (
    <mesh geometry={helixGeometry} onClick={onClick}>
      <meshStandardMaterial
        color={materialColor}
        wireframe={showWireframe}
        metalness={0.8}
        roughness={0.2}
      />
    </mesh>
  );
}
