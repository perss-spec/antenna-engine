import { useMemo } from 'react'
import { Vector3 as ThreeVec3, CatmullRomCurve3, TubeGeometry } from 'three'

interface QfhModelProps {
  radius: number // helix radius in meters
  height: number // total height in meters
  turns: number // number of turns
  wireRadius?: number // wire thickness in meters
  segments?: number // segments per turn for smooth curves
  showFeedPoints?: boolean
  className?: string
}

export function QfhModel({
  radius,
  height,
  turns,
  wireRadius = 0.001,
  segments = 32,
  showFeedPoints = true
}: QfhModelProps) {
  const { helix1Geometry, helix2Geometry, feedGeometry } = useMemo(() => {
    const pointsPerTurn = segments
    const totalPoints = turns * pointsPerTurn
    const heightPerPoint = height / totalPoints
    
    // First helix (0° phase)
    const points1: ThreeVec3[] = []
    for (let i = 0; i <= totalPoints; i++) {
      const angle = (i / pointsPerTurn) * 2 * Math.PI
      const y = i * heightPerPoint - height / 2
      const x = radius * Math.cos(angle)
      const z = radius * Math.sin(angle)
      points1.push(new ThreeVec3(x, y, z))
    }
    
    // Second helix (90° phase offset)
    const points2: ThreeVec3[] = []
    for (let i = 0; i <= totalPoints; i++) {
      const angle = (i / pointsPerTurn) * 2 * Math.PI + Math.PI / 2
      const y = i * heightPerPoint - height / 2
      const x = radius * Math.cos(angle)
      const z = radius * Math.sin(angle)
      points2.push(new ThreeVec3(x, y, z))
    }
    
    // Create smooth curves
    const curve1 = new CatmullRomCurve3(points1)
    const curve2 = new CatmullRomCurve3(points2)
    
    // Create tube geometries
    const helix1Geom = new TubeGeometry(curve1, totalPoints * 2, wireRadius, 8, false)
    const helix2Geom = new TubeGeometry(curve2, totalPoints * 2, wireRadius, 8, false)
    
    // Feed point geometry
    const feedGeom = {
      radius: wireRadius * 3,
      height: wireRadius * 6
    }
    
    return {
      helix1Geometry: helix1Geom,
      helix2Geometry: helix2Geom,
      feedGeometry: feedGeom
    }
  }, [radius, height, turns, wireRadius, segments])

  return (
    <group>
      {/* First helix */}
      <mesh geometry={helix1Geometry}>
        <meshPhongMaterial color="#CD7F32" />
      </mesh>
      
      {/* Second helix */}
      <mesh geometry={helix2Geometry}>
        <meshPhongMaterial color="#B87333" />
      </mesh>
      
      {/* Feed points */}
      {showFeedPoints && (
        <>
          {/* Feed point 1 */}
          <mesh position={[radius, -height / 2, 0]}>
            <cylinderGeometry args={[feedGeometry.radius, feedGeometry.radius, feedGeometry.height, 8]} />
            <meshPhongMaterial color="#FFD700" />
          </mesh>
          
          {/* Feed point 2 */}
          <mesh position={[0, -height / 2, radius]}>
            <cylinderGeometry args={[feedGeometry.radius, feedGeometry.radius, feedGeometry.height, 8]} />
            <meshPhongMaterial color="#FF6347" />
          </mesh>
        </>
      )}
      
      {/* Support structure (optional) */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[wireRadius * 0.5, wireRadius * 0.5, height, 8]} />
        <meshPhongMaterial
          color="#666666"
          transparent
          opacity={0.3}
        />
      </mesh>
    </group>
  )
}