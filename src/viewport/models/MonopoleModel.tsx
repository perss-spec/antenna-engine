import { useMemo } from 'react'
import { Vector3 as ThreeVec3, CylinderGeometry, PlaneGeometry } from 'three'

interface MonopoleModelProps {
  length: number // monopole length in meters
  radius?: number // wire radius in meters
  segments?: number // number of segments for visualization
  showGroundPlane?: boolean
  groundPlaneSize?: number
  currentDistribution?: number[]
  className?: string
}

export function MonopoleModel({
  length,
  radius = 0.001,
  segments = 20,
  showGroundPlane = true,
  groundPlaneSize = 0.2,
  currentDistribution
}: MonopoleModelProps) {
  const { wireGeometry, groundGeometry, segmentData } = useMemo(() => {
    const segmentLength = length / segments
    
    // Main wire geometry (vertical)
    const wireGeom = new CylinderGeometry(radius, radius, length, 8)
    
    // Ground plane geometry
    const groundGeom = new PlaneGeometry(groundPlaneSize, groundPlaneSize)
    
    // Segment data for current visualization
    const segData = []
    for (let i = 0; i < segments; i++) {
      const z = (i + 0.5) * segmentLength // from 0 to length
      
      // Default current distribution for quarter-wave monopole
      let currentMagnitude
      if (currentDistribution && currentDistribution[i] !== undefined) {
        currentMagnitude = currentDistribution[i]
      } else {
        // I(z) = cos(k * z) for quarter-wave monopole
        const k = Math.PI / (2 * length) // quarter-wave
        currentMagnitude = Math.max(0, Math.cos(k * z))
      }
      
      segData.push({
        position: new ThreeVec3(0, z, 0),
        current: currentMagnitude,
        color: `hsl(${240 * (1 - currentMagnitude)}, 100%, 50%)` // blue to red
      })
    }
    
    return {
      wireGeometry: wireGeom,
      groundGeometry: groundGeom,
      segmentData: segData
    }
  }, [length, radius, segments, groundPlaneSize, currentDistribution])

  return (
    <group>
      {/* Ground plane */}
      {showGroundPlane && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
          <primitive object={groundGeometry} />
          <meshPhongMaterial
            color="#C0C0C0"
            transparent
            opacity={0.3}
            side={2} // DoubleSide
          />
        </mesh>
      )}
      
      {/* Main monopole wire */}
      <mesh position={[0, length / 2, 0]} geometry={wireGeometry}>
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
      
      {/* Feed point at base */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[radius * 2, radius * 2, radius * 4, 8]} />
        <meshPhongMaterial color="#FFD700" />
      </mesh>
      
      {/* Wire tip */}
      <mesh position={[0, length, 0]}>
        <sphereGeometry args={[radius * 1.5, 8, 8]} />
        <meshPhongMaterial color="#CD7F32" />
      </mesh>
    </group>
  )
}