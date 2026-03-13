import { useMemo } from 'react'
import { Vector3 as ThreeVec3, BufferGeometry, Float32BufferAttribute } from 'three'
import type { AntennaElement } from '../../types/antenna'

interface PatchElementProps {
  element: AntennaElement
  selected?: boolean
  onClick?: (elementId: string) => void
}

function getMaterialColor(material: string): string {
  switch (material) {
    case 'copper': return '#CD7F32'
    case 'pec': return '#C0C0C0'
    case 'substrate': return '#228B22'
    default: return '#888888'
  }
}

export function PatchElement({ element, selected = false, onClick }: PatchElementProps) {
  const { geometry, center } = useMemo(() => {
    if (element.vertices.length < 4) {
      // Fallback for insufficient vertices
      const geom = new BufferGeometry()
      const vertices = new Float32Array([
        0, 0, 0,
        0.01, 0, 0,
        0.01, 0.01, 0,
        0, 0.01, 0
      ])
      geom.setAttribute('position', new Float32BufferAttribute(vertices, 3))
      geom.setIndex([0, 1, 2, 0, 2, 3])
      geom.computeVertexNormals()
      return { geometry: geom, center: new ThreeVec3(0.005, 0.005, 0) }
    }

    const geom = new BufferGeometry()

    // Create patch surface from vertices
    const v0 = element.vertices[0]
    const v1 = element.vertices[1]
    const v2 = element.vertices[2]
    const v3 = element.vertices[3]

    const vertices = new Float32Array([
      v0.x, v0.y, v0.z,
      v1.x, v1.y, v1.z,
      v2.x, v2.y, v2.z,
      v3.x, v3.y, v3.z
    ])

    geom.setAttribute('position', new Float32BufferAttribute(vertices, 3))
    geom.setIndex([0, 1, 2, 0, 2, 3])
    geom.computeVertexNormals()
    
    // Calculate center
    const centerVec = new ThreeVec3(
      (v0.x + v1.x + v2.x + v3.x) / 4,
      (v0.y + v1.y + v2.y + v3.y) / 4,
      (v0.z + v1.z + v2.z + v3.z) / 4
    )
    
    return { geometry: geom, center: centerVec }
  }, [element.vertices])

  const handleClick = () => {
    if (onClick) {
      onClick(element.id)
    }
  }

  const materialColor = getMaterialColor(element.material ?? 'pec')
  const thickness = element.thickness || 0.001

  return (
    <group position={[center.x, center.y, center.z]}>
      {/* Patch surface */}
      <mesh
        geometry={geometry}
        onClick={handleClick}
      >
        <meshPhongMaterial
          color={materialColor}
          transparent
          opacity={selected ? 0.8 : 0.9}
          side={2} // DoubleSide
        />
      </mesh>
      
      {/* Substrate box (if substrate material) */}
      {element.material === 'substrate' && (
        <mesh position={[0, 0, -thickness / 2]}>
          <boxGeometry args={[0.02, 0.02, thickness]} />
          <meshPhongMaterial
            color={materialColor}
            transparent
            opacity={0.3}
          />
        </mesh>
      )}
      
      {/* Selection indicator */}
      {selected && (
        <mesh>
          <boxGeometry args={[0.025, 0.025, 0.001]} />
          <meshBasicMaterial
            color="#ffff00"
            transparent
            opacity={0.3}
            wireframe
          />
        </mesh>
      )}
    </group>
  )
}