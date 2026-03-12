import { useMemo } from 'react'
import { BufferGeometry, BufferAttribute } from 'three'
import type { RadiationPattern as RadiationPatternData } from '../../types/antenna'

interface RadiationPatternProps {
  pattern: RadiationPatternData
  visible: boolean
  opacity?: number
}

export function RadiationPattern({ pattern, visible, opacity = 0.8 }: RadiationPatternProps) {
  const { geometry } = useMemo(() => {
    if (!pattern || !pattern.theta.length || !pattern.phi.length) {
      return { geometry: new BufferGeometry(), colors: new Float32Array(0) }
    }

    const vertices: number[] = []
    const indices: number[] = []
    const colors: number[] = []
    
    // Convert spherical coordinates to Cartesian
    // Gain values are in dB, normalize for radius scaling
    const maxGain = Math.max(...pattern.gain.flat())
    const minGain = Math.min(...pattern.gain.flat())
    const gainRange = maxGain - minGain
    
    let vertexIndex = 0
    
    // Generate vertices for radiation pattern surface
    for (let i = 0; i < pattern.theta.length; i++) {
      for (let j = 0; j < pattern.phi.length; j++) {
        const theta = pattern.theta[i]
        const phi = pattern.phi[j]
        const gain = pattern.gain[i][j]
        
        // Scale radius based on gain (minimum 0.1 to avoid singularities)
        const normalizedGain = gainRange > 0 ? (gain - minGain) / gainRange : 0.5
        const radius = 0.1 + normalizedGain * 0.9
        
        // Spherical to Cartesian conversion
        const x = radius * Math.sin(theta) * Math.cos(phi)
        const y = radius * Math.sin(theta) * Math.sin(phi)
        const z = radius * Math.cos(theta)
        
        vertices.push(x, y, z)
        
        // Color mapping: blue (low) to red (high)
        const r = normalizedGain
        const g = 0.5
        const b = 1 - normalizedGain
        colors.push(r, g, b)
        
        // Generate triangular faces (except for last row/column)
        if (i < pattern.theta.length - 1 && j < pattern.phi.length - 1) {
          const current = vertexIndex
          const right = vertexIndex + 1
          const below = vertexIndex + pattern.phi.length
          const belowRight = vertexIndex + pattern.phi.length + 1
          
          // Two triangles per quad
          indices.push(current, right, below)
          indices.push(right, belowRight, below)
        }
        
        vertexIndex++
      }
    }
    
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3))
    geometry.setAttribute('color', new BufferAttribute(new Float32Array(colors), 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    
    return { geometry, colors: new Float32Array(colors) }
  }, [pattern])

  if (!visible || !pattern) {
    return null
  }

  return (
    <mesh geometry={geometry}>
      <meshPhongMaterial
        vertexColors
        transparent
        opacity={opacity}
        side={2} // DoubleSide
      />
    </mesh>
  )
}