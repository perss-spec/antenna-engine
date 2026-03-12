import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { CylinderGeometry, Color, Mesh } from 'three'

interface DipoleModelProps {
  length: number // in meters
  frequency: number // in Hz
  radius?: number // wire radius in meters
  segments?: number // number of segments for current visualization
  showFeedPoint?: boolean
  currentDistribution?: number[] // normalized 0-1 values per segment
  animationSpeed?: number // animation speed multiplier
  className?: string
}

export function DipoleModel({
  length,
  frequency,
  radius = 0.001,
  segments = 20,
  showFeedPoint = true,
  currentDistribution,
  animationSpeed = 2.0,
}: DipoleModelProps) {
  const segmentRefs = useRef<(Mesh | null)[]>([])
  
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
      
      // Use provided current distribution or calculate for half-wave dipole
      let currentMagnitude
      if (currentDistribution && currentDistribution[i] !== undefined) {
        currentMagnitude = currentDistribution[i]
      } else {
        // Default half-wave dipole current distribution
        currentMagnitude = Math.sin(k * (length / 2 - distanceFromCenter))
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
    // Small sphere at the feed point (center)
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
      const baseColor = segmentData.segmentColors[index]
      
      // Animate brightness based on current oscillation
      const oscillation = Math.sin(time * animationSpeed) * 0.5 + 0.5 // 0 to 1
      const animatedIntensity = currentValue * oscillation
      
      // Update material color with animation
      const material = mesh.material as any
      if (material.color) {
        const animatedColor = baseColor.clone()
        animatedColor.multiplyScalar(0.3 + animatedIntensity * 0.7) // Keep some base brightness
        material.color.copy(animatedColor)
      }
      
      // Update emissive for glow effect during high current
      if (material.emissive) {
        const emissiveIntensity = animatedIntensity * currentValue * 0.3
        material.emissive.copy(baseColor).multiplyScalar(emissiveIntensity)
      }
    })
  })

  return (
    <group>
      {/* Render dipole segments with current-based coloring */}
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