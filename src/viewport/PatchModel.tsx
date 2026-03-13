import { useMemo } from 'react'
import { BoxGeometry } from 'three'

interface PatchModelProps {
  length: number // patch length in meters
  width: number // patch width in meters
  height?: number // substrate thickness in meters
  groundPlaneSize?: number // ground plane size multiplier
  showSubstrate?: boolean
  className?: string
}

export function PatchModel({
  length,
  width,
  height = 0.0016, // typical substrate thickness (1.6mm)
  groundPlaneSize = 2.0, // ground plane is 2x larger than patch
  showSubstrate = true,
}: PatchModelProps) {
  const geometries = useMemo(() => {
    // Patch geometry - thin rectangle
    const patchGeometry = new BoxGeometry(length, 0.001, width) // very thin patch
    
    // Substrate geometry
    const substrateLength = length * groundPlaneSize
    const substrateWidth = width * groundPlaneSize
    const substrateGeometry = new BoxGeometry(substrateLength, height, substrateWidth)
    
    // Ground plane geometry - same size as substrate, very thin
    const groundPlaneGeometry = new BoxGeometry(substrateLength, 0.001, substrateWidth)
    
    return {
      patch: patchGeometry,
      substrate: substrateGeometry,
      groundPlane: groundPlaneGeometry,
      patchPosition: [0, height / 2 + 0.0005, 0] as [number, number, number], // on top of substrate
      substratePosition: [0, 0, 0] as [number, number, number], // centered
      groundPlanePosition: [0, -height / 2 - 0.0005, 0] as [number, number, number], // bottom of substrate
    }
  }, [length, width, height, groundPlaneSize])

  const feedPointGeometry = useMemo(() => {
    // Small cylinder for feed point (typically at edge or inset)
    const feedRadius = Math.min(length, width) * 0.02
    const feedPosition = [-length * 0.3, height / 2 + 0.001, 0] as [number, number, number] // offset from center
    
    return {
      radius: feedRadius,
      height: 0.005,
      position: feedPosition
    }
  }, [length, width, height])

  return (
    <group>
      {/* Ground plane */}
      <mesh
        geometry={geometries.groundPlane}
        position={geometries.groundPlanePosition}
      >
        <meshPhongMaterial
          color="#888888" // gray ground plane
          shininess={50}
        />
      </mesh>
      
      {/* Substrate */}
      {showSubstrate && (
        <mesh
          geometry={geometries.substrate}
          position={geometries.substratePosition}
        >
          <meshPhongMaterial
            color="#22aa22" // green substrate (FR4)
            transparent
            opacity={0.7}
            shininess={10}
          />
        </mesh>
      )}
      
      {/* Patch */}
      <mesh
        geometry={geometries.patch}
        position={geometries.patchPosition}
      >
        <meshPhongMaterial
          color="#ff6600" // copper color
          shininess={100}
          emissive="#221100" // slight glow
        />
      </mesh>
      
      {/* Feed point */}
      <mesh position={feedPointGeometry.position}>
        <cylinderGeometry args={[feedPointGeometry.radius, feedPointGeometry.radius, feedPointGeometry.height, 8]} />
        <meshPhongMaterial
          color="#ffff00" // yellow feed point
          shininess={100}
        />
      </mesh>
    </group>
  )
}