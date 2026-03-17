import { useMemo } from 'react'
import * as THREE from 'three'

interface VivaldiModelProps {
  length?: number
  apertureWidth?: number
  substrateWidth?: number
}

export function VivaldiModel({
  length = 0.3,
  apertureWidth = 0.15,
  substrateWidth = 0.002,
}: VivaldiModelProps) {
  const { topArm, bottomArm, substrate } = useMemo(() => {
    const steps = 40
    const armThickness = 0.003

    // Exponential taper: y = A * exp(R * x)
    // At x=0, gap ~= small; at x=length, gap = apertureWidth
    const gapMin = 0.005
    const R = Math.log(apertureWidth / gapMin) / length

    const makeArmShape = (sign: number) => {
      const shape = new THREE.Shape()

      // Outer edge (straight)
      const outerY = sign * (apertureWidth / 2 + 0.01)

      shape.moveTo(0, sign * gapMin / 2)

      // Inner edge: exponential taper via bezier approximation
      for (let i = 1; i <= steps; i++) {
        const x = (i / steps) * length
        const y = sign * gapMin / 2 * Math.exp(R * x)
        shape.lineTo(x, y)
      }

      // Close along outer edge
      shape.lineTo(length, outerY)
      shape.lineTo(0, outerY)
      shape.closePath()

      return shape
    }

    const topShape = makeArmShape(1)
    const bottomShape = makeArmShape(-1)

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      depth: armThickness,
      bevelEnabled: false,
    }

    const topGeom = new THREE.ExtrudeGeometry(topShape, extrudeSettings)
    const bottomGeom = new THREE.ExtrudeGeometry(bottomShape, extrudeSettings)

    // Substrate plate
    const subHeight = apertureWidth + 0.04
    const subGeom = new THREE.BoxGeometry(length, subHeight, substrateWidth)

    return {
      topArm: topGeom,
      bottomArm: bottomGeom,
      substrate: subGeom,
    }
  }, [length, apertureWidth, substrateWidth])

  const armThickness = 0.003

  return (
    <group>
      {/* Substrate */}
      <mesh
        geometry={substrate}
        position={[length / 2, 0, -substrateWidth / 2 - armThickness]}
      >
        <meshStandardMaterial
          color="#22c55e"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Top arm */}
      <mesh geometry={topArm}>
        <meshStandardMaterial
          color="#f97316"
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Bottom arm */}
      <mesh geometry={bottomArm}>
        <meshStandardMaterial
          color="#f97316"
          metalness={0.7}
          roughness={0.3}
        />
      </mesh>

      {/* Feed point */}
      <mesh position={[0, 0, armThickness / 2]}>
        <sphereGeometry args={[0.005, 16, 16]} />
        <meshStandardMaterial color="#ffff00" emissive="#333300" />
      </mesh>
    </group>
  )
}
