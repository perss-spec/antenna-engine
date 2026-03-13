import { useMemo } from 'react'
import { BufferGeometry, BufferAttribute, CylinderGeometry, BoxGeometry, Vector3 as ThreeVec3, Quaternion, Matrix4 } from 'three'
import type { ViewportAntennaGeometry, ViewportAntennaElement } from '../types'

interface AntennaRendererProps {
  geometry: ViewportAntennaGeometry
  selectedElementId?: string
  onElementClick?: (elementId: string) => void
}

function WireElement({ element, isSelected, onClick }: {
  element: ViewportAntennaElement
  isSelected: boolean
  onClick?: () => void
}) {
  const { geometry, position, rotation } = useMemo(() => {
    if (!element.vertices || element.vertices.length < 2) {
      return { geometry: new CylinderGeometry(), position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0, 1] as [number, number, number, number] }
    }

    const start = new ThreeVec3(element.vertices[0].x, element.vertices[0].y, element.vertices[0].z)
    const end = new ThreeVec3(element.vertices[1].x, element.vertices[1].y, element.vertices[1].z)
    const direction = new ThreeVec3().subVectors(end, start)
    const length = direction.length()
    const center = new ThreeVec3().addVectors(start, end).multiplyScalar(0.5)

    const radius = element.radius || 0.001
    const geometry = new CylinderGeometry(radius, radius, length, 8)

    const orientation = new Matrix4().lookAt(start, end, new ThreeVec3(0, 1, 0))
    const quaternion = new Quaternion().setFromRotationMatrix(orientation)
    quaternion.multiply(new Quaternion().setFromAxisAngle(new ThreeVec3(1, 0, 0), Math.PI / 2))

    return {
      geometry,
      position: [center.x, center.y, center.z] as [number, number, number],
      rotation: [quaternion.x, quaternion.y, quaternion.z, quaternion.w] as [number, number, number, number]
    }
  }, [element])

  const color = element.material === 'copper' ? '#ff6600' : '#c0c0c0'

  return (
    <mesh
      geometry={geometry}
      position={position}
      quaternion={rotation}
      onClick={onClick}
    >
      <meshPhongMaterial
        color={color}
        emissive={isSelected ? '#333300' : '#000000'}
        shininess={100}
      />
    </mesh>
  )
}

function PatchElementRenderer({ element, isSelected, onClick }: {
  element: ViewportAntennaElement
  isSelected: boolean
  onClick?: () => void
}) {
  const { patchGeometry, substrateGeometry, patchPosition, substratePosition } = useMemo(() => {
    if (!element.vertices || element.vertices.length < 4) {
      return {
        patchGeometry: new BoxGeometry(),
        substrateGeometry: new BoxGeometry(),
        patchPosition: [0, 0, 0] as [number, number, number],
        substratePosition: [0, 0, 0] as [number, number, number]
      }
    }

    const v0 = element.vertices[0]
    const v1 = element.vertices[1]
    const v2 = element.vertices[2]

    const width = Math.sqrt((v1.x - v0.x) ** 2 + (v1.y - v0.y) ** 2 + (v1.z - v0.z) ** 2)
    const height = Math.sqrt((v2.x - v0.x) ** 2 + (v2.y - v0.y) ** 2 + (v2.z - v0.z) ** 2)
    const thickness = element.thickness || 0.001

    const centerX = (v0.x + v1.x + v2.x + element.vertices[3].x) / 4
    const centerY = (v0.y + v1.y + v2.y + element.vertices[3].y) / 4
    const centerZ = (v0.z + v1.z + v2.z + element.vertices[3].z) / 4

    const patchGeometry = new BoxGeometry(width, height, thickness)
    const substrateGeometry = new BoxGeometry(width * 1.2, height * 1.2, thickness * 10)

    return {
      patchGeometry,
      substrateGeometry,
      patchPosition: [centerX, centerY, centerZ + thickness / 2] as [number, number, number],
      substratePosition: [centerX, centerY, centerZ - thickness * 4] as [number, number, number]
    }
  }, [element])

  return (
    <group onClick={onClick}>
      <mesh geometry={substrateGeometry} position={substratePosition}>
        <meshPhongMaterial color="#228B22" transparent opacity={0.3} />
      </mesh>
      <mesh geometry={patchGeometry} position={patchPosition}>
        <meshPhongMaterial
          color={element.material === 'copper' ? '#ff6600' : '#c0c0c0'}
          emissive={isSelected ? '#333300' : '#000000'}
          shininess={100}
        />
      </mesh>
    </group>
  )
}

export function AntennaRenderer({ geometry, selectedElementId, onElementClick }: AntennaRendererProps) {
  const allVertices = useMemo(() => {
    return geometry.elements.flatMap((el: ViewportAntennaElement) => el.vertices || [])
  }, [geometry])

  const meshGeometry = useMemo(() => {
    if (!allVertices.length) {
      return new BufferGeometry()
    }

    const verts = new Float32Array(allVertices.length * 3)
    for (let i = 0; i < allVertices.length; i++) {
      const vertex = allVertices[i]
      verts[i * 3] = vertex.x
      verts[i * 3 + 1] = vertex.y
      verts[i * 3 + 2] = vertex.z
    }

    const bufferGeometry = new BufferGeometry()
    bufferGeometry.setAttribute('position', new BufferAttribute(verts, 3))
    bufferGeometry.computeVertexNormals()

    return bufferGeometry
  }, [allVertices])

  return (
    <group>
      {allVertices.length > 0 && (
        <mesh geometry={meshGeometry}>
          <meshPhongMaterial color="#ff6600" shininess={100} wireframe={false} />
        </mesh>
      )}

      {geometry.elements.map((element: ViewportAntennaElement) => {
        const isSelected = element.id === selectedElementId
        const handleClick = () => onElementClick?.(element.id)

        if (element.type === 'wire') {
          return (
            <WireElement
              key={element.id}
              element={element}
              isSelected={isSelected}
              onClick={handleClick}
            />
          )
        } else if (element.type === 'patch') {
          return (
            <PatchElementRenderer
              key={element.id}
              element={element}
              isSelected={isSelected}
              onClick={handleClick}
            />
          )
        }

        return null
      })}
    </group>
  )
}
