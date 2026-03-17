import { useMemo } from 'react'
import * as THREE from 'three'

interface HornModelProps {
  apertureWidth?: number
  apertureHeight?: number
  length?: number
  waveguideWidth?: number
  waveguideHeight?: number
}

export function HornModel({
  apertureWidth = 0.3,
  apertureHeight = 0.2,
  length = 0.4,
  waveguideWidth = 0.06,
  waveguideHeight = 0.04,
}: HornModelProps) {
  const { hornGeometry, waveguideGeometry } = useMemo(() => {
    // Horn flare: extrude a trapezoidal cross-section along Z
    const shape = new THREE.Shape()
    // Front face (aperture) at z=length, back face (waveguide) at z=0
    // We build the cross-section and extrude with scale change
    const halfWgW = waveguideWidth / 2
    const halfWgH = waveguideHeight / 2

    // Waveguide cross-section shape
    shape.moveTo(-halfWgW, -halfWgH)
    shape.lineTo(halfWgW, -halfWgH)
    shape.lineTo(halfWgW, halfWgH)
    shape.lineTo(-halfWgW, halfWgH)
    shape.closePath()

    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      steps: 32,
      depth: length,
      bevelEnabled: false,
    }

    const hornGeom = new THREE.ExtrudeGeometry(shape, extrudeSettings)

    // Scale vertices to create flare: linearly from waveguide to aperture
    const posAttr = hornGeom.getAttribute('position')
    const scaleX = apertureWidth / waveguideWidth
    const scaleY = apertureHeight / waveguideHeight

    for (let i = 0; i < posAttr.count; i++) {
      const z = posAttr.getZ(i)
      const t = Math.max(0, Math.min(1, z / length))
      const sx = 1 + (scaleX - 1) * t
      const sy = 1 + (scaleY - 1) * t
      posAttr.setX(i, posAttr.getX(i) * sx)
      posAttr.setY(i, posAttr.getY(i) * sy)
    }

    posAttr.needsUpdate = true
    hornGeom.computeVertexNormals()

    // Waveguide section behind the horn
    const wgLength = length * 0.3
    const wgGeom = new THREE.BoxGeometry(waveguideWidth, waveguideHeight, wgLength)

    return { hornGeometry: hornGeom, waveguideGeometry: wgGeom }
  }, [apertureWidth, apertureHeight, length, waveguideWidth, waveguideHeight])

  const wgLength = length * 0.3
  const feedRadius = Math.min(waveguideWidth, waveguideHeight) * 0.15

  return (
    <group>
      {/* Horn flare */}
      <mesh geometry={hornGeometry}>
        <meshStandardMaterial
          color="#94a3b8"
          metalness={0.8}
          roughness={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Waveguide section */}
      <mesh
        geometry={waveguideGeometry}
        position={[0, 0, -wgLength / 2]}
      >
        <meshStandardMaterial
          color="#94a3b8"
          metalness={0.8}
          roughness={0.3}
        />
      </mesh>

      {/* Feed point indicator */}
      <mesh position={[0, 0, -wgLength]}>
        <sphereGeometry args={[feedRadius, 16, 16]} />
        <meshStandardMaterial color="#ffff00" emissive="#333300" />
      </mesh>
    </group>
  )
}
