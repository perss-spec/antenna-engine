import { useMemo } from 'react'

interface BiconicalModelProps {
  coneHeight?: number
  coneRadius?: number
  gap?: number
}

export function BiconicalModel({
  coneHeight = 0.2,
  coneRadius = 0.12,
  gap = 0.01,
}: BiconicalModelProps) {
  const feedRadius = useMemo(() => gap * 0.4, [gap])

  return (
    <group>
      {/* Upper cone (tip pointing down toward center) */}
      <mesh
        position={[0, coneHeight / 2 + gap / 2, 0]}
        rotation={[Math.PI, 0, 0]}
      >
        <coneGeometry args={[coneRadius, coneHeight, 32]} />
        <meshStandardMaterial
          color="#94a3b8"
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Lower cone (tip pointing up toward center) */}
      <mesh position={[0, -(coneHeight / 2 + gap / 2), 0]}>
        <coneGeometry args={[coneRadius, coneHeight, 32]} />
        <meshStandardMaterial
          color="#94a3b8"
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Feed point at center */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[feedRadius, 16, 16]} />
        <meshStandardMaterial color="#ffff00" emissive="#333300" />
      </mesh>
    </group>
  )
}
