import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CylinderGeometry, Color, Mesh } from 'three'
import { GroundPlane } from './GroundPlane'

interface MonopoleModelProps {
  length: number // in meters
  frequency: number // in Hz
  radius?: number // wire radius in meters
  segments?: number // number of segments for current visualization
  showFeedPoint?: boolean
  currentDistribution?: number[] // normalized 0-1 values per segment
  animationSpeed?: number // animation speed multiplier
  groundPlaneRadius?: number // ground plane radius in meters
  className?: string
}

export function MonopoleModel({
  length,
  frequency,
  radius = 0.001,
  segments = 20,
  showFeedPoint = true,
  currentDistribution,
  animationSpeed = 2.0,
  groundPlaneRadius = 0.5,
}: MonopoleModelProps) {
  const segmentRefs = useRef<(Mesh | null)[]>([])
  
  const segmentData = useMemo(() => {
    // Calculate current distribution along monopole
    // For quarter-wave monopole: I(z) = I0 * sin(k * (L - z))
    const wavelength = 299792458 / frequency // c / f
    const k = (2 * Math.PI) / wavelength // wave number
    const segmentLength = length / segments
    
    const segmentGeometries = []
    const segmentColors = []
    
    for (let i = 0; i < segments; i++) {
      const z = i * segmentLength + segmentLength / 2
      
      // Use provided current distribution or calculate for quarter-wave monopole
      let currentMagnitude
      if (currentDistribution && currentDistribution[i] !== undefined) {
        currentMagnitude = currentDistribution[i]
      } else {
        // Default quarter-wave monopole current distribution
        currentMagnitude = Math.sin(k * (length - z))
      }
      
      const normalizedCurrent = Math.max(0, currentMagnitude)
      
      // Create geometry for this segment
      const segmentGeom = new CylinderGeometry(radius, radius, segmentLength, 8)
      segmentGeometries.push({
        geometry: segmentGeom,
        position: [0, z, 0] as [number, number, number],
        current: normalizedCurrent
      })
      
      // Base color mapping: blue (low current) to red (high current)
      const color = new Color()
      color.setHSL(0.67 * (1 - normalizedCurrent), 1, 0.5)
      segmentColors.push(color)
    }
    
    return { segmentGeometries, segmentColors }
  }, [length, frequency, radius, segments, currentDistribution])

  const feedPointGeometry = useMemo(() => {
    // Small sphere at the feed point (base)
    return {
      radius: radius * 3,
      position: [0, 0, 0] as [number, number, number]
    }
  }, [radius])

  // Animation for current distribution
  useFrame(({ clock }) => {
    if (!currentDistribution || !segmentRefs.current) return
    
    const time = clock.getElapsedTime()
    
    segmentRefs.current.forEach((mesh, index) => {
      if (!mesh || !mesh.material) return
      
      const currentValue = segmentData.segmentGeometries[index]?.current || 0
      
      // Animate current with sinusoidal variation
      const animatedCurrent = currentValue * (0.5 + 0.5 * Math.sin(time * animationSpeed))
      
      // Update color based on animated current
      const animatedColor = new Color()
      animatedColor.setHSL(0.67 * (1 - animatedCurrent), 1, 0.5 + 0.3 * animatedCurrent)
      
      if ('color' in mesh.material) {
        mesh.material.color = animatedColor
      }
    })
  })

  return (
    <group>
      {/* Ground plane */}
      <GroundPlane
        radius={groundPlaneRadius}
        color="#444444"
        opacity={0.8}
        wireframe={false}
      />
      
      {/* Monopole segments */}
      {segmentData.segmentGeometries.map((segment, index) => (
        <mesh
          key={index}
          ref={(ref) => {
            if (segmentRefs.current) {
              segmentRefs.current[index] = ref
            }
          }}
          geometry={segment.geometry}
          position={segment.position}
        >
          <meshPhongMaterial
            color={segmentData.segmentColors[index]}
            shininess={100}
          />
        </mesh>
      ))}
      
      {/* Feed point */}
      {showFeedPoint && (
        <mesh position={feedPointGeometry.position}>
          <sphereGeometry args={[feedPointGeometry.radius, 16, 16]} />
          <meshPhongMaterial
            color="#ffff00" // yellow feed point
            shininess={100}
          />
        </mesh>
      )}
    </group>
  )
}