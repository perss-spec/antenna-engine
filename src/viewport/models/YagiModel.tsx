import { useMemo } from 'react'
import { Cylinder } from '@react-three/drei'

interface YagiModelProps {
  driven_length: number
  reflector_length: number
  director_length: number
  spacing: number
  radius?: number
}

export function YagiModel({
  driven_length,
  reflector_length,
  director_length,
  spacing,
  radius = 0.002,
}: YagiModelProps) {
  const elements = useMemo(() => {
    const cylinderSegments = 12

    return {
      reflector: {
        length: reflector_length,
        position: [0, 0, -spacing] as [number, number, number],
        color: '#888888',
        segments: cylinderSegments,
      },
      driven: {
        length: driven_length,
        position: [0, 0, 0] as [number, number, number],
        color: '#22cc44',
        segments: cylinderSegments,
      },
      director: {
        length: director_length,
        position: [0, 0, spacing] as [number, number, number],
        color: '#4488ff',
        segments: cylinderSegments,
      },
    }
  }, [driven_length, reflector_length, director_length, spacing])

  return (
    <group>
      {/* Reflector — gray */}
      <Cylinder
        args={[radius, radius, elements.reflector.length, elements.reflector.segments]}
        position={elements.reflector.position}
        rotation={[0, 0, Math.PI / 2]}
      >
        <meshStandardMaterial color={elements.reflector.color} />
      </Cylinder>

      {/* Driven element — green */}
      <Cylinder
        args={[radius, radius, elements.driven.length, elements.driven.segments]}
        position={elements.driven.position}
        rotation={[0, 0, Math.PI / 2]}
      >
        <meshStandardMaterial color={elements.driven.color} />
      </Cylinder>

      {/* Director — blue */}
      <Cylinder
        args={[radius, radius, elements.director.length, elements.director.segments]}
        position={elements.director.position}
        rotation={[0, 0, Math.PI / 2]}
      >
        <meshStandardMaterial color={elements.director.color} />
      </Cylinder>

      {/* Feed point indicator on driven element */}
      <mesh position={elements.driven.position}>
        <sphereGeometry args={[radius * 3, 16, 16]} />
        <meshStandardMaterial color="#ffff00" emissive="#333300" />
      </mesh>
    </group>
  )
}
