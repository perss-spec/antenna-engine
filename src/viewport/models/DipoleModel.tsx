import { useMemo } from 'react'
import { Vector3 as ThreeVec3, CylinderGeometry } from 'three'

interface DipoleModelProps {
  length: number // total length in meters
  radius?: number // wire radius in meters
  segments?: number // number of segments for visualization
  showFeedPoint?: boolean
  currentDistribution?: number[] // normalized current values per segment
  className?: string
}

export function DipoleModel({
  length,
  radius = 0.001,
  segments = 20,
  showFeedPoint = true,
  currentDistribution
}: DipoleModelProps) {
  const { wireGeometry, feedGeometry, segmentData } = useMemo(() => {
    const halfLength = length / 2
    const segmentLength = length / segments
    
    // Main wire geometry
    const wireGeom = new CylinderGeometry(radius, radius, length, 8)
    
    // Feed point geometry
    const feedGeom = new CylinderGeometry(radius * 2, radius * 2, radius * 4, 8)
    
    // Segment data for current visualization
    const segData = []
    for (let i = 0; i < segments; i++) {
      const z = (i - segments / 2) * segmentLength + segmentLength / 2
      const distanceFromCenter = Math.abs(z)
      
      // Default sinusoidal current distribution for half-wave dipole
      let currentMagnitude
      if (currentDistribution && currentDistribution[i] !== undefined) {
        currentMagnitude = currentDistribution[i]
      } else {
        // I(z) = sin(k * (L/2 - |z|)) for half-wave dipole
        const k = 2 * Math.PI / (length * 2) // approximate for half-wave
        currentMagnitude = Math.max(0, Math.sin(k * (halfLength - distanceFromCenter)))
      }
      
      segData.push({
        position: new ThreeVec3(0, z, 0),
        current: currentMagnitude,
        color: `hsl(${240 * (1 - currentMagnitude)}, 100%, 50%)` // blue to red
      })
    }
    
    return {
      wireGeometry: wireGeom,
      feedGeometry: feedGeom,
      segmentData: segData
    }
  }, [length, radius, segments, currentDistribution])

  return (
    <group>
      {/* Main dipole wire */}
      <mesh geometry={wireGeometry}>
        <meshPhongMaterial color="#CD7F32" />
      </mesh>
      
      {/* Current distribution visualization */}
      {segmentData.map((segment, index) => (
        <mesh
          key={index}
          position={[segment.position.x, segment.position.y, segment.position.z]}
        >
          <cylinderGeometry args={[radius * 1.2, radius * 1.2, length / segments, 6]} />
          <meshBasicMaterial
            color={segment.color}
            transparent
            opacity={segment.current * 0.8}
          />
        </mesh>
      ))}
      
      {/* Feed point */}
      {showFeedPoint && (
        <mesh geometry={feedGeometry}>
          <meshPhongMaterial color="#FFD700" />
        </mesh>
      )}
      
      {/* Wire end caps */}
      <mesh position={[0, length / 2, 0]}>
        <sphereGeometry args={[radius * 1.5, 8, 8]} />
        <meshPhongMaterial color="#CD7F32" />
      </mesh>
      <mesh position={[0, -length / 2, 0]}>
        <sphereGeometry args={[radius * 1.5, 8, 8]} />
        <meshPhongMaterial color="#CD7F32" />
      </mesh>
    </group>
  )
}