import { useMemo } from 'react'
import * as THREE from 'three'

interface LoopModelProps {
  diameter?: number
  wireRadius?: number
}

export function LoopModel({
  diameter = 0.2,
  wireRadius = 0.003,
}: LoopModelProps) {
  const { arcGeometry } = useMemo(() => {
    const radius = diameter / 2
    const gapAngle = 0.15 // radians (~8.6 degrees)
    const arcAngle = Math.PI * 2 - gapAngle

    // Generate arc points for CatmullRomCurve3
    const points: THREE.Vector3[] = []
    const startAngle = gapAngle / 2 - Math.PI / 2
    const numPts = 80
    for (let i = 0; i <= numPts; i++) {
      const angle = startAngle + (i / numPts) * arcAngle
      points.push(new THREE.Vector3(
        Math.cos(angle) * radius,
        Math.sin(angle) * radius,
        0
      ))
    }
    const curve = new THREE.CatmullRomCurve3(points, false)
    const arcGeom = new THREE.TubeGeometry(curve, 64, wireRadius, 12, false)

    return { arcGeometry: arcGeom }
  }, [diameter, wireRadius])

  const radius = diameter / 2
  const gapAngle = 0.15
  const feedAngle = -Math.PI / 2 // bottom

  // Feed point position: center of gap at bottom
  const feedX = Math.cos(feedAngle) * radius
  const feedY = Math.sin(feedAngle) * radius

  // Gap terminal positions
  const termLeft = {
    x: Math.cos(feedAngle - gapAngle / 2) * radius,
    y: Math.sin(feedAngle - gapAngle / 2) * radius,
  }
  const termRight = {
    x: Math.cos(feedAngle + gapAngle / 2) * radius,
    y: Math.sin(feedAngle + gapAngle / 2) * radius,
  }

  return (
    <group>
      {/* Loop arc */}
      <mesh geometry={arcGeometry}>
        <meshStandardMaterial
          color="#b87333"
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Gap terminal caps */}
      <mesh position={[termLeft.x, termLeft.y, 0]}>
        <sphereGeometry args={[wireRadius * 1.2, 8, 8]} />
        <meshStandardMaterial color="#b87333" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[termRight.x, termRight.y, 0]}>
        <sphereGeometry args={[wireRadius * 1.2, 8, 8]} />
        <meshStandardMaterial color="#b87333" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Feed point indicator */}
      <mesh position={[feedX, feedY, 0]}>
        <sphereGeometry args={[wireRadius * 2.5, 16, 16]} />
        <meshStandardMaterial color="#ffff00" emissive="#333300" />
      </mesh>
    </group>
  )
}
