import { useMemo } from 'react'
import { LatheGeometry, ConeGeometry, CylinderGeometry, Vector2 } from 'three'

interface ParabolicModelProps {
  diameter?: number
  focalLength?: number
  feedRadius?: number
}

export function ParabolicModel({
  diameter = 0.6,
  focalLength = 0.2,
  feedRadius = 0.015,
}: ParabolicModelProps) {
  const dishGeometry = useMemo(() => {
    const segments = 40
    const radius = diameter / 2
    const points: Vector2[] = []

    // Parabolic profile: y = x^2 / (4f)
    for (let i = 0; i <= segments; i++) {
      const x = (i / segments) * radius
      const y = (x * x) / (4 * focalLength)
      points.push(new Vector2(x, y))
    }

    return new LatheGeometry(points, 48)
  }, [diameter, focalLength])

  const feedConeGeometry = useMemo(
    () => new ConeGeometry(feedRadius, feedRadius * 3, 12),
    [feedRadius],
  )

  const strutGeometry = useMemo(() => {
    const radius = diameter / 2
    const edgeY = (radius * radius) / (4 * focalLength)
    const dx = radius
    const dy = focalLength - edgeY
    const strutLength = Math.sqrt(dx * dx + dy * dy)
    return new CylinderGeometry(0.002, 0.002, strutLength, 6)
  }, [diameter, focalLength])

  const struts = useMemo(() => {
    const radius = diameter / 2
    const edgeY = (radius * radius) / (4 * focalLength)
    const result: { position: [number, number, number]; rotation: [number, number, number] }[] = []

    for (let i = 0; i < 3; i++) {
      const angle = (i * 2 * Math.PI) / 3
      const ex = radius * Math.cos(angle)
      const ez = radius * Math.sin(angle)

      // Midpoint between dish edge and focal point
      const mx = ex / 2
      const mz = ez / 2
      const my = (edgeY + focalLength) / 2

      // Rotation: strut goes from (ex, edgeY, ez) to (0, focalLength, 0)
      const dx = -ex
      const dy = focalLength - edgeY
      const dz = -ez
      const len = Math.sqrt(dx * dx + dy * dy + dz * dz)

      const rotX = Math.acos(dy / len)
      const rotY = Math.atan2(dx, dz)

      result.push({
        position: [mx, my, mz],
        rotation: [rotX, rotY, 0],
      })
    }

    return result
  }, [diameter, focalLength])

  return (
    <group>
      {/* Parabolic dish */}
      <mesh geometry={dishGeometry}>
        <meshStandardMaterial
          color="#c0c0c0"
          metalness={0.8}
          roughness={0.15}
          side={2}
        />
      </mesh>

      {/* Feed horn at focal point */}
      <mesh
        geometry={feedConeGeometry}
        position={[0, focalLength, 0]}
        rotation={[Math.PI, 0, 0]}
      >
        <meshStandardMaterial
          color="#ff8800"
          metalness={0.5}
          roughness={0.3}
        />
      </mesh>

      {/* Support struts */}
      {struts.map((strut, i) => (
        <mesh
          key={i}
          geometry={strutGeometry}
          position={strut.position}
          rotation={strut.rotation}
        >
          <meshStandardMaterial
            color="#666666"
            metalness={0.4}
            roughness={0.5}
          />
        </mesh>
      ))}
    </group>
  )
}
