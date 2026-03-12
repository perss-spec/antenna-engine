import { useMemo } from 'react';
import { Vector3 as ThreeVec3, CatmullRomCurve3, TubeGeometry } from 'three';
import type { AntennaElement } from '../../../types/antenna';

export interface QFHElementProps {
  element: AntennaElement;
  selected: boolean;
  showWireframe: boolean;
  onClick: () => void;
}

export function QFHElement({ element, selected, showWireframe, onClick }: QFHElementProps) {
  const helixGeometry = useMemo(() => {
    if (element.vertices.length < 4) return null;

    // Convert vertices to Three.js Vector3
    const points = element.vertices.map(
      vertex => new ThreeVec3(vertex.x, vertex.y, vertex.z)
    );

    // Create smooth curve through points
    const curve = new CatmullRomCurve3(points, false, 'catmullrom', 0.5);
    
    // Create tube geometry along the curve
    const radius = element.radius || 0.001;
    const tubularSegments = Math.max(64, points.length * 8);
    const radialSegments = 8;
    
    return new TubeGeometry(curve, tubularSegments, radius, radialSegments, false);
  }, [element.vertices, element.radius]);

  const materialColor = useMemo(() => {
    if (selected) return '#ffff00'; // Yellow when selected
    switch (element.material) {
      case 'copper': return '#ff7f00'; // Orange
      case 'pec': return '#c0c0c0'; // Silver
      default: return '#808080'; // Gray
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