import { useMemo } from 'react'
import { BoxGeometry, PlaneGeometry } from 'three'

interface PatchModelProps {
  width: number // patch width in meters
  height: number // patch height in meters
  thickness?: number // conductor thickness in meters
  substrateHeight?: number // substrate thickness in meters
  substrateWidth?: number // substrate width (defaults to patch width * 1.5)
  substrateLength?: number // substrate length (defaults to patch height * 1.5)
  showSubstrate?: boolean
  className?: string
}

export function PatchModel({
  width,
  height,
  thickness = 0.001,
  substrateHeight = 0.01,
  substrateWidth,
  substrateLength,
  showSubstrate = true
}: PatchModelProps) {
  const { patchGeometry, substrateGeometry, groundGeometry } = useMemo(() => {
    // Patch conductor geometry
    const patchGeom = new BoxGeometry(width, height, thickness)
    
    // Substrate dimensions
    const subW = substrateWidth || width * 1.5
    const subL = substrateLength || height * 1.5
    
    // Substrate geometry
    const substrateGeom = new BoxGeometry(subW, subL, substrateHeight)
    
    // Ground plane geometry
    const groundGeom = new PlaneGeometry(subW, subL)
    
    return {
      patchGeometry: patchGeom,
      substrateGeometry: substrateGeom,
      groundGeometry: groundGeom
    }
  }, [width, height, thickness, substrateHeight, substrateWidth, substrateLength])

  return (
    <group>
      {/* Ground plane */}
      <mesh 
        position={[0, 0, -substrateHeight / 2]} 
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <primitive object={groundGeometry} />
        <meshPhongMaterial color="#C0C0C0" />
      </mesh>
      
      {/* Substrate */}
      {showSubstrate && (
        <mesh position={[0, 0, 0]}>
          <primitive object={substrateGeometry} />
          <meshPhongMaterial
            color="#228B22"
            transparent
            opacity={0.3}
          />
        </mesh>
      )}
      
      {/* Patch conductor */}
      <mesh position={[0, 0, substrateHeight / 2 + thickness / 2]}>
        <primitive object={patchGeometry} />
        <meshPhongMaterial color="#CD7F32" />
      </mesh>
      
      {/* Feed point indicator */}
      <mesh position={[0, -height * 0.3, substrateHeight / 2 + thickness]}>
        <cylinderGeometry args={[0.002, 0.002, 0.005, 8]} />
        <meshPhongMaterial color="#FFD700" />
      </mesh>
      
      {/* Current distribution visualization (simplified) */}
      <mesh position={[0, 0, substrateHeight / 2 + thickness + 0.001]}>
        <planeGeometry args={[width * 0.8, height * 0.8]} />
        <meshBasicMaterial
          color="#FF4444"
          transparent
          opacity={0.4}
          wireframe
        />
      </mesh>
    </group>
  )
}