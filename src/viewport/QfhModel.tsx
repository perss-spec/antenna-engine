import { useMemo } from 'react'
import { Vector3 as ThreeVec3, CatmullRomCurve3, TubeGeometry, CircleGeometry } from 'three'
import type { FC } from 'react'

interface QfhModelProps {
  frequency: number // in Hz
  turns: number // number of turns
  diameter: number // in meters
  height: number // in meters
  wireRadius?: number // wire radius in meters
  groundPlaneRadius?: number // ground plane radius in meters
  className?: string
}

export const QfhModel: FC<QfhModelProps> = ({
  turns,
  diameter,
  height,
  wireRadius = 0.001,
  groundPlaneRadius = 0.1,
}) => {
  const helixData = useMemo(() => {
    const helices = []
    const pointsPerTurn = 32
    const totalPoints = pointsPerTurn * turns
    
    // Generate 4 helical curves (quadrifilar)
    for (let n = 0; n < 4; n++) {
      const points: ThreeVec3[] = []
      
      for (let i = 0; i <= totalPoints; i++) {
        const t = i / totalPoints // parameter from 0 to 1
        const phaseOffset = n * Math.PI / 2 // 90° phase shift between helices
        
        // Parametric equations for helix
        const x = (diameter / 2) * Math.cos(2 * Math.PI * turns * t + phaseOffset)
        const y = (diameter / 2) * Math.sin(2 * Math.PI * turns * t + phaseOffset)
        const z = height * t
        
        points.push(new ThreeVec3(x, y, z))
      }
      
      // Create curve and tube geometry
      const curve = new CatmullRomCurve3(points)
      const tubeGeometry = new TubeGeometry(curve, totalPoints, wireRadius, 8, false)
      
      helices.push({
        geometry: tubeGeometry,
        curve,
        phase: n * 90 // degrees
      })
    }
    
    return helices
  }, [turns, diameter, height, wireRadius])

  const groundPlaneGeometry = useMemo(() => {
    return new CircleGeometry(groundPlaneRadius, 32)
  }, [groundPlaneRadius])

  return (
    <group>
      {/* Ground plane */}
      <mesh
        geometry={groundPlaneGeometry}
        rotation={[-Math.PI / 2, 0, 0]} // Rotate to horizontal
        position={[0, 0, 0]}
      >
        <meshPhongMaterial
          color="#888888"
          shininess={50}
        />
      </mesh>
      
      {/* Four helical wires */}
      {helixData.map((helix, index) => (
        <mesh
          key={index}
          geometry={helix.geometry}
          position={[0, 0, 0]}
        >
          <meshPhongMaterial
            color="#B87333" // Copper color
            shininess={100}
            emissive="#221100" // Slight glow
          />
        </mesh>
      ))}
      
      {/* Feed points at the bottom of each helix */}
      {Array.from({ length: 4 }, (_, n) => {
        const phaseOffset = n * Math.PI / 2
        const x = (diameter / 2) * Math.cos(phaseOffset)
        const y = (diameter / 2) * Math.sin(phaseOffset)
        
        return (
          <mesh
            key={`feed-${n}`}
            position={[x, y, 0]}
          >
            <sphereGeometry args={[wireRadius * 2, 8, 8]} />
            <meshPhongMaterial
              color="#ff0000" // Red feed points
              emissive="#440000"
            />
          </mesh>
        )
      })}
    </group>
  )
}

export default QfhModel