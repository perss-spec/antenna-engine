import { useMemo } from 'react'
import { CylinderGeometry, Color } from 'three'

interface DipoleModelProps {
  length: number // in meters
  frequency: number // in Hz
  radius?: number // wire radius in meters
  segments?: number // number of segments for current visualization
  showFeedPoint?: boolean
  className?: string
}

export function DipoleModel({
  length,
  frequency,
  radius = 0.001,
  segments = 20,
  showFeedPoint = true,
}: DipoleModelProps) {
  const segmentData = useMemo(() => {
    // Calculate current distribution along dipole
    // For half-wave dipole: I(z) = I0 * sin(k * (L/2 - |z|))
    const wavelength = 299792458 / frequency // c / f
    const k = (2 * Math.PI) / wavelength // wave number
    const segmentLength = length / segments
    
    const segmentGeometries = []
    const segmentColors = []
    
    for (let i = 0; i < segments; i++) {
      const z = (i - segments / 2) * segmentLength + segmentLength / 2
      const distanceFromCenter = Math.abs(z)
      
      // Current magnitude calculation for half-wave dipole
      const currentMagnitude = Math.sin(k * (length / 2 - distanceFromCenter))
      const normalizedCurrent = Math.max(0, currentMagnitude)
      
      // Create geometry for this segment
      const segmentGeom = new CylinderGeometry(radius, radius, segmentLength, 8)
      segmentGeometries.push({
        geometry: segmentGeom,
        position: [0, z, 0] as [number, number, number],
        current: normalizedCurrent
      })
      
      // Color mapping: blue (low current) to red (high current)
      const color = new Color()
      color.setHSL(0.67 * (1 - normalizedCurrent), 1, 0.5)
      segmentColors.push(color)
    }
    
    return { segmentGeometries, segmentColors }
  }, [length, frequency, radius, segments])

  const feedPointGeometry = useMemo(() => {
    // Small sphere at the feed point (center)
    return {
      radius: radius * 3,
      position: [0, 0, 0] as [number, number, number]
    }
  }, [radius])

  return (
    <group>
      {/* Render dipole segments with current-based coloring */}
      {segmentData.segmentGeometries.map((segment, index) => (
        <mesh
          key={index}
          geometry={segment.geometry}
          position={segment.position}
        >
          <meshPhongMaterial
            color={segmentData.segmentColors[index]}
            shininess={100}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}
      
      {/* Feed point indicator */}
      {showFeedPoint && (
        <mesh position={feedPointGeometry.position}>
          <sphereGeometry args={[feedPointGeometry.radius, 16, 16]} />
          <meshPhongMaterial
            color="#ffff00"
            emissive="#333300"
            shininess={100}
          />
        </mesh>
      )}
    </group>
  )
}