import { useMemo } from 'react'
import { SphereGeometry, BufferAttribute, Color } from 'three'

interface RadiationPattern3DProps {
  pattern: number[][]
  maxGain: number
  radius?: number
  opacity?: number
  visible?: boolean
  wireframe?: boolean
  showWireframe?: boolean
}

export function RadiationPattern3D({
  pattern,
  maxGain,
  radius = 1.0,
  opacity = 0.8,
  visible = true,
  wireframe = false,
  showWireframe = false
}: RadiationPattern3DProps) {
  const geometry = useMemo(() => {
    if (!pattern || pattern.length === 0 || pattern[0].length === 0) {
      return new SphereGeometry()
    }

    const thetaSegments = pattern.length
    const phiSegments = pattern[0].length
    const geometry = new SphereGeometry(radius, phiSegments - 1, thetaSegments - 1)

    // Get position attribute to map colors to vertices
    const positions = geometry.attributes.position
    const vertexCount = positions.count
    const colorArray = new Float32Array(vertexCount * 3)

    // Find min/max gain for color mapping
    const flatGain = pattern.flat()
    const minGain = Math.min(...flatGain)
    const gainRange = maxGain - minGain

    // Color each vertex based on corresponding gain value
    for (let i = 0; i < vertexCount; i++) {
      // Map vertex index to theta/phi indices
      const phiIndex = Math.floor(i / thetaSegments) % phiSegments
      const thetaIndex = i % thetaSegments
      
      // Clamp indices to valid range
      const safePhiIndex = Math.min(phiIndex, pattern[0].length - 1)
      const safeThetaIndex = Math.min(thetaIndex, pattern.length - 1)
      
      // Get gain value for this vertex
      const gain = pattern[safeThetaIndex]?.[safePhiIndex] ?? minGain
      
      // Normalize gain to 0-1 range
      const normalizedGain = gainRange > 0 ? (gain - minGain) / gainRange : 0.5
      
      // Map to color: blue (low gain) -> green -> red (high gain)
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
      
      colorArray[i * 3] = color.r
      colorArray[i * 3 + 1] = color.g
      colorArray[i * 3 + 2] = color.b
    }

    // Add color attribute to geometry
    geometry.setAttribute('color', new BufferAttribute(colorArray, 3))
    geometry.computeVertexNormals()

    return geometry
  }, [pattern, maxGain, radius])

  if (!visible || !pattern) {
    return null
  }

  return (
    <mesh geometry={geometry}>
      <meshPhongMaterial
        vertexColors
        transparent
        opacity={opacity}
        wireframe={wireframe || showWireframe}
        side={2} // DoubleSide to see pattern from inside and outside
      />
    </mesh>
  )
}

export default RadiationPattern3D