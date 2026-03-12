import { useMemo } from 'react'
import { CircleGeometry } from 'three'
import type { FC } from 'react'

interface GroundPlaneProps {
  radius?: number
  color?: string
  opacity?: number
  wireframe?: boolean
}

export const GroundPlane: FC<GroundPlaneProps> = ({
  radius = 0.5,
  color = '#222222',
  opacity = 0.6,
  wireframe = true,
}) => {
  const geometry = useMemo(() => {
    // Create circle geometry with sufficient segments for smooth appearance
    const segments = Math.max(32, Math.floor(radius * 64))
    return new CircleGeometry(radius, segments)
  }, [radius])

  return (
    <mesh
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]} // Rotate 90 degrees on X axis to make it horizontal
      position={[0, 0, 0]} // Place at y=0 (ground level)
    >
      <meshBasicMaterial
        color={color}
        transparent
        opacity={opacity}
        wireframe={wireframe}
        side={2} // DoubleSide to see from both sides
      />
    </mesh>
  )
}

export default GroundPlane