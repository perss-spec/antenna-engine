import { useMemo } from 'react'
import { Vector3 as ThreeVec3, CylinderGeometry, Quaternion, Matrix4 } from 'three'
import type { ViewportAntennaElement } from '../types'

interface WireElementProps {
  element: ViewportAntennaElement
  selected?: boolean
  onClick?: (elementId: string) => void
}

function getMaterialColor(material: string): string {
  switch (material) {
    case 'copper': return '#CD7F32'
    case 'pec': return '#C0C0C0'
    default: return '#888888'
  }
}

export function WireElement({ element, selected = false, onClick }: WireElementProps) {
  const { geometry, position, rotation } = useMemo(() => {
    if (!element.vertices || element.vertices.length < 2) {
      const geom = new CylinderGeometry(0.001, 0.001, 0.01, 8)
      return {
        geometry: geom,
        position: new ThreeVec3(0, 0, 0),
        rotation: new Quaternion()
      }
    }

    const start = new ThreeVec3(element.vertices[0].x, element.vertices[0].y, element.vertices[0].z)
    const end = new ThreeVec3(element.vertices[1].x, element.vertices[1].y, element.vertices[1].z)

    const direction = new ThreeVec3().subVectors(end, start)
    const length = direction.length()
    const center = new ThreeVec3().addVectors(start, end).multiplyScalar(0.5)

    const radius = element.radius || 0.001
    const geom = new CylinderGeometry(radius, radius, length, 8)

    const orientation = new Matrix4().lookAt(start, end, new ThreeVec3(0, 1, 0))
    const quat = new Quaternion().setFromRotationMatrix(orientation)
    quat.multiply(new Quaternion().setFromAxisAngle(new ThreeVec3(1, 0, 0), Math.PI / 2))

    return {
      geometry: geom,
      position: center,
      rotation: quat
    }
  }, [element.vertices, element.radius])

  const handleClick = () => {
    if (onClick) {
      onClick(element.id)
    }
  }

  const materialColor = getMaterialColor(element.material ?? 'pec')

  return (
    <group>
      <mesh
        geometry={geometry}
        position={[position.x, position.y, position.z]}
        quaternion={[rotation.x, rotation.y, rotation.z, rotation.w]}
        onClick={handleClick}
      >
        <meshPhongMaterial
          color={materialColor}
          transparent
          opacity={selected ? 0.8 : 0.9}
        />
      </mesh>

      {selected && (
        <mesh position={[position.x, position.y, position.z]}>
          <sphereGeometry args={[(element.radius || 0.001) * 3, 8, 8]} />
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
