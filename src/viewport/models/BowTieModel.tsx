import { useMemo } from 'react'

interface BowTieModelProps {
  armLength?: number
  angle?: number
  gap?: number
}

export function BowTieModel({
  armLength = 0.15,
  angle = 60,
  gap = 0.01,
}: BowTieModelProps) {
  const coneRadius = useMemo(() => {
    return armLength * Math.tan((angle / 2) * (Math.PI / 180))
  }, [armLength, angle])

  const feedRadius = gap * 0.4

  return (
    <group>
      {/* Left arm (cone pointing right toward center) */}
      <mesh
        position={[-(armLength / 2 + gap / 2), 0, 0]}
        rotation={[0, 0, -Math.PI / 2]}
      >
        <coneGeometry args={[coneRadius, armLength, 32]} />
        <meshStandardMaterial
          color="#0ea5e9"
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Right arm (cone pointing left toward center) */}
      <mesh
        position={[(armLength / 2 + gap / 2), 0, 0]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <coneGeometry args={[coneRadius, armLength, 32]} />
        <meshStandardMaterial
          color="#0ea5e9"
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Feed point at center gap */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[feedRadius, 16, 16]} />
        <meshStandardMaterial color="#ffff00" emissive="#333300" />
      </mesh>
    </group>
  )
}
