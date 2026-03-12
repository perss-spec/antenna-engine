import { useMemo } from 'react'
import { SphereGeometry, BufferAttribute, Color } from 'three'
import type { RadiationPattern } from '../types/antenna'

interface RadiationPattern3DProps {
  pattern: RadiationPattern
  radius?: number
  opacity?: number
  visible?: boolean
  wireframe?: boolean
}

export function RadiationPattern3D({
  pattern,
  radius = 1.0,
  opacity = 0.8,
  visible = true,
  wireframe = false
}: RadiationPattern3DProps) {
  const geometry = useMemo(() => {
    if (!pattern || !pattern.theta.length || !pattern.phi.length) {
      return new SphereGeometry()
    }

    // Create sphere geometry with sufficient resolution
    const thetaSegments = pattern.theta.length
    const phiSegments = pattern.phi.length
    const geometry = new SphereGeometry(radius, phiSegments - 1, thetaSegments - 1)

    // Get position attribute to map colors to vertices
    const positions = geometry.attributes.position
    const vertexCount = positions.count
    const colors = new Float32Array(vertexCount * 3)

    // Find min/max gain for color mapping
    const flatGain = pattern.gain.flat()
    const minGain = Math.min(...flatGain)
    const maxGain = Math.max(...flatGain)
    const gainRange = maxGain - minGain

    // Color each vertex based on corresponding gain value
    for (let i = 0; i < vertexCount; i++) {
      // Map vertex index to theta/phi indices
      const phiIndex = Math.floor(i / thetaSegments) % phiSegments
      const thetaIndex = i % thetaSegments
      
      // Clamp indices to valid range
      const safePhiIndex = Math.min(phiIndex, pattern.phi.length - 1)
      const safeThetaIndex = Math.min(thetaIndex, pattern.theta.length - 1)
      
      // Get gain value for this vertex
      const gain = pattern.gain[safeThetaIndex]?.[safePhiIndex] ?? minGain
      
      // Normalize gain to 0-1 range
      const normalizedGain = gainRange > 0 ? (gain - minGain) / gainRange : 0.5
      
      // Map to color: blue (low gain) -> green -> yellow -> red (high gain)
      const color = new Color()
      if (normalizedGain < 0.5) {
        // Blue to green
        const t = normalizedGain * 2
        color.setRGB(0, t, 1 - t)
      } else {
        // Green to red
        const t = (normalizedGain - 0.5) * 2
        color.setRGB(t, 1 - t, 0)
      }
      
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b
    }

    // Add color attribute to geometry
    geometry.setAttribute('color', new BufferAttribute(colors, 3))
    geometry.computeVertexNormals()

    return geometry
  }, [pattern, radius])

  if (!visible || !pattern) {
    return null
  }

  return (
    <mesh geometry={geometry}>
      <meshPhongMaterial
        vertexColors
        transparent
        opacity={opacity}
        wireframe={wireframe}
        side={2} // DoubleSide to see pattern from inside and outside
      />
    </mesh>
  )
}

export default RadiationPattern3D