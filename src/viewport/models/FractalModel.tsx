import { useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute, Vector3, Color } from 'three'

interface FractalModelProps {
  size?: number
  iterations?: number
}

function subdivideTriangles(
  triangles: [Vector3, Vector3, Vector3][],
): [Vector3, Vector3, Vector3][] {
  const result: [Vector3, Vector3, Vector3][] = []
  for (const [a, b, c] of triangles) {
    const ab = new Vector3().addVectors(a, b).multiplyScalar(0.5)
    const bc = new Vector3().addVectors(b, c).multiplyScalar(0.5)
    const ca = new Vector3().addVectors(c, a).multiplyScalar(0.5)
    // Keep 3 corner triangles, remove center
    result.push([a, ab, ca], [ab, b, bc], [ca, bc, c])
  }
  return result
}

export function FractalModel({
  size = 0.3,
  iterations = 3,
}: FractalModelProps) {
  const geometry = useMemo(() => {
    const h = size * (Math.sqrt(3) / 2)

    // Initial equilateral triangle (lying in XY plane)
    const v0 = new Vector3(-size / 2, 0, 0)
    const v1 = new Vector3(size / 2, 0, 0)
    const v2 = new Vector3(0, h, 0)

    let triangles: [Vector3, Vector3, Vector3][] = [[v0, v1, v2]]

    for (let i = 0; i < iterations; i++) {
      triangles = subdivideTriangles(triangles)
    }

    const positions: number[] = []
    const colors: number[] = []
    const colorA = new Color('#a855f7')
    const colorB = new Color('#0ea5e9')
    const tempColor = new Color()

    for (const [a, b, c] of triangles) {
      positions.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z)

      // Gradient based on average Y (height) of each vertex
      for (const v of [a, b, c]) {
        const t = h > 0 ? v.y / h : 0
        tempColor.copy(colorA).lerp(colorB, t)
        colors.push(tempColor.r, tempColor.g, tempColor.b)
      }
    }

    const geom = new BufferGeometry()
    geom.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geom.setAttribute('color', new Float32BufferAttribute(colors, 3))
    geom.computeVertexNormals()
    return geom
  }, [size, iterations])

  return (
    <group>
      <mesh geometry={geometry}>
        <meshStandardMaterial
          vertexColors
          metalness={0.4}
          roughness={0.4}
          side={2}
        />
      </mesh>

      {/* Feed point at bottom vertex (v0) */}
      <mesh position={[-size / 2, 0, 0]}>
        <sphereGeometry args={[size * 0.02, 16, 16]} />
        <meshStandardMaterial color="#ffff00" emissive="#333300" />
      </mesh>
    </group>
  )
}
