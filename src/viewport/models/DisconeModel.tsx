import { useMemo } from 'react'
import * as THREE from 'three'

interface DisconeModelProps {
  coneHeight?: number
  coneRadius?: number
  discRadius?: number
  gap?: number
}

export function DisconeModel({
  coneHeight = 0.25,
  coneRadius = 0.15,
  discRadius = 0.12,
  gap = 0.008,
}: DisconeModelProps) {
  const { coneGeometry, discGeometry } = useMemo(() => {
    const coneGeom = new THREE.ConeGeometry(coneRadius, coneHeight, 32, 1, true)
    const discGeom = new THREE.CircleGeometry(discRadius, 32)
    return { coneGeometry: coneGeom, discGeometry: discGeom }
  }, [coneHeight, coneRadius, discRadius])

  const feedRadius = gap * 0.5

  return (
    <group>
      {/* Cone (inverted, opening downward) */}
      <mesh
        geometry={coneGeometry}
        position={[0, -(coneHeight / 2 + gap / 2), 0]}
        rotation={[Math.PI, 0, 0]}
      >
        <meshStandardMaterial
          color="#94a3b8"
          metalness={0.7}
          roughness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Disc on top */}
      <mesh
        geometry={discGeometry}
        position={[0, gap / 2, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <meshStandardMaterial
          color="#94a3b8"
          metalness={0.7}
          roughness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Feed point at junction */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[feedRadius, 16, 16]} />
        <meshStandardMaterial color="#ffff00" emissive="#333300" />
      </mesh>
    </group>
  )
}
