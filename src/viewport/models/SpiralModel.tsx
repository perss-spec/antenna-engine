import { useMemo } from 'react'
import { Vector3, CatmullRomCurve3, TubeGeometry } from 'three'

interface SpiralModelProps {
  outerRadius?: number
  turns?: number
  wireRadius?: number
}

export function SpiralModel({
  outerRadius = 0.15,
  turns = 3,
  wireRadius = 0.002,
}: SpiralModelProps) {
  const arms = useMemo(() => {
    const pointsPerTurn = 48
    const totalPoints = pointsPerTurn * turns
    // Archimedean spiral: r = a + b*theta
    // a = 0 (starts at center), b chosen so max r = outerRadius
    const maxTheta = 2 * Math.PI * turns
    const b = outerRadius / maxTheta

    const createArm = (phaseOffset: number) => {
      const points: Vector3[] = []
      for (let i = 0; i <= totalPoints; i++) {
        const theta = (i / totalPoints) * maxTheta
        const r = b * theta
        const x = r * Math.cos(theta + phaseOffset)
        const z = r * Math.sin(theta + phaseOffset)
        points.push(new Vector3(x, 0, z))
      }
      const curve = new CatmullRomCurve3(points)
      return new TubeGeometry(curve, totalPoints, wireRadius, 8, false)
    }

    return [createArm(0), createArm(Math.PI)]
  }, [outerRadius, turns, wireRadius])

  return (
    <group>
      {arms.map((geometry, i) => (
        <mesh key={i} geometry={geometry}>
          <meshStandardMaterial
            color="#a855f7"
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>
      ))}

      {/* Feed point at center */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[wireRadius * 3, 16, 16]} />
        <meshStandardMaterial color="#ffff00" emissive="#333300" />
      </mesh>
    </group>
  )
}
