import { useMemo, useRef, useEffect } from 'react'
import {
  CylinderGeometry,
  MeshStandardMaterial,
  InstancedMesh,
  Object3D,
} from 'three'

interface ArrayModelProps {
  numElements?: number
  spacing?: number
  elementLength?: number
  elementRadius?: number
  rows?: number
}

export function ArrayModel({
  numElements = 4,
  spacing = 0.5,
  elementLength = 0.25,
  elementRadius = 0.002,
  rows = 1,
}: ArrayModelProps) {
  const meshRef = useRef<InstancedMesh>(null)

  const totalCount = numElements * rows

  const geometry = useMemo(
    () => new CylinderGeometry(elementRadius, elementRadius, elementLength, 12),
    [elementRadius, elementLength],
  )

  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: '#0ea5e9',
        metalness: 0.6,
        roughness: 0.3,
      }),
    [],
  )

  useEffect(() => {
    if (!meshRef.current) return

    const dummy = new Object3D()
    const offsetX = ((numElements - 1) * spacing) / 2
    const offsetZ = ((rows - 1) * spacing) / 2

    let idx = 0
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < numElements; col++) {
        dummy.position.set(
          col * spacing - offsetX,
          0,
          row * spacing - offsetZ,
        )
        dummy.rotation.set(0, 0, Math.PI / 2)
        dummy.updateMatrix()
        meshRef.current.setMatrixAt(idx, dummy.matrix)
        idx++
      }
    }
    meshRef.current.instanceMatrix.needsUpdate = true
  }, [numElements, rows, spacing])

  return (
    <group>
      <instancedMesh
        ref={meshRef}
        args={[geometry, material, totalCount]}
      />

      {/* Feed points at each element center */}
      {Array.from({ length: totalCount }, (_, i) => {
        const col = i % numElements
        const row = Math.floor(i / numElements)
        const offsetX = ((numElements - 1) * spacing) / 2
        const offsetZ = ((rows - 1) * spacing) / 2
        return (
          <mesh
            key={i}
            position={[
              col * spacing - offsetX,
              0,
              row * spacing - offsetZ,
            ]}
          >
            <sphereGeometry args={[elementRadius * 3, 8, 8]} />
            <meshStandardMaterial color="#ffff00" emissive="#333300" />
          </mesh>
        )
      })}
    </group>
  )
}
