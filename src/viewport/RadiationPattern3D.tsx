import { useMemo } from 'react'
import * as THREE from 'three'

interface RadiationPattern3DProps {
  pattern: number[][]
  maxGain: number
  radius?: number
  opacity?: number
  visible?: boolean
  wireframe?: boolean
  showWireframe?: boolean
  /** Minimum radius ratio (0–1) for nulls. 0.05 = nulls shrink to 5% of max radius */
  nullFloor?: number
  /** Dynamic range in dB. Pattern values below maxGain-dynamicRange clip to nullFloor */
  dynamicRange?: number
}

/** Jet-like colormap: blue → cyan → green → yellow → red */
function gainToColor(normalized: number): [number, number, number] {
  // normalized: 0 (low) → 1 (high)
  const t = Math.max(0, Math.min(1, normalized))
  let r: number, g: number, b: number
  if (t < 0.25) {
    const s = t / 0.25
    r = 0; g = s; b = 1
  } else if (t < 0.5) {
    const s = (t - 0.25) / 0.25
    r = 0; g = 1; b = 1 - s
  } else if (t < 0.75) {
    const s = (t - 0.5) / 0.25
    r = s; g = 1; b = 0
  } else {
    const s = (t - 0.75) / 0.25
    r = 1; g = 1 - s; b = 0
  }
  return [r, g, b]
}

export function RadiationPattern3D({
  pattern,
  maxGain,
  radius = 1.0,
  opacity = 0.85,
  visible = true,
  wireframe = false,
  showWireframe = false,
  nullFloor = 0.05,
  dynamicRange = 40,
}: RadiationPattern3DProps) {
  const { solidGeo, wireGeo } = useMemo(() => {
    if (!pattern || pattern.length < 2 || pattern[0].length < 2) {
      return { solidGeo: new THREE.BufferGeometry(), wireGeo: new THREE.BufferGeometry() }
    }

    const nTheta = pattern.length      // rows = theta samples (0..π)
    const nPhi = pattern[0].length      // cols = phi samples (0..2π)

    // Pre-compute normalized radii + colors
    const minGainFloor = maxGain - dynamicRange
    const rNorm: number[][] = []
    const colors: [number, number, number][][] = []

    for (let it = 0; it < nTheta; it++) {
      const rRow: number[] = []
      const cRow: [number, number, number][] = []
      for (let ip = 0; ip < nPhi; ip++) {
        const g = pattern[it][ip]
        // Clamp to dynamic range, then normalize 0–1
        const clamped = Math.max(g, minGainFloor)
        const norm = dynamicRange > 0 ? (clamped - minGainFloor) / dynamicRange : 0.5
        // Radius: linear in dB scale, with floor
        const r = nullFloor + (1 - nullFloor) * norm
        rRow.push(r * radius)
        cRow.push(gainToColor(norm))
      }
      rNorm.push(rRow)
      colors.push(cRow)
    }

    // Build triangle mesh: (nTheta-1) × (nPhi-1) quads → 2 triangles each
    // Close the phi seam: wrap ip+1 modulo nPhi
    const numQuads = (nTheta - 1) * nPhi
    const numTris = numQuads * 2
    const positions = new Float32Array(numTris * 3 * 3)
    const colorArr = new Float32Array(numTris * 3 * 3)
    const normals = new Float32Array(numTris * 3 * 3)

    const toXYZ = (it: number, ip: number): [number, number, number] => {
      const theta = (Math.PI * it) / (nTheta - 1)
      const phi = (2 * Math.PI * (ip % nPhi)) / nPhi
      const r = rNorm[it][ip % nPhi]
      return [
        r * Math.sin(theta) * Math.cos(phi),
        r * Math.cos(theta),
        r * Math.sin(theta) * Math.sin(phi),
      ]
    }

    const getColor = (it: number, ip: number): [number, number, number] => {
      return colors[it][ip % nPhi]
    }

    let vi = 0
    const tmpA = new THREE.Vector3()
    const tmpB = new THREE.Vector3()
    const tmpN = new THREE.Vector3()

    const putVert = (pos: [number, number, number], col: [number, number, number], normal: [number, number, number]) => {
      positions[vi * 3] = pos[0]
      positions[vi * 3 + 1] = pos[1]
      positions[vi * 3 + 2] = pos[2]
      colorArr[vi * 3] = col[0]
      colorArr[vi * 3 + 1] = col[1]
      colorArr[vi * 3 + 2] = col[2]
      normals[vi * 3] = normal[0]
      normals[vi * 3 + 1] = normal[1]
      normals[vi * 3 + 2] = normal[2]
      vi++
    }

    const computeNormal = (
      p0: [number, number, number],
      p1: [number, number, number],
      p2: [number, number, number],
    ): [number, number, number] => {
      tmpA.set(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2])
      tmpB.set(p2[0] - p0[0], p2[1] - p0[1], p2[2] - p0[2])
      tmpN.crossVectors(tmpA, tmpB).normalize()
      return [tmpN.x, tmpN.y, tmpN.z]
    }

    for (let it = 0; it < nTheta - 1; it++) {
      for (let ip = 0; ip < nPhi; ip++) {
        const ip1 = ip + 1  // wraps via modulo in toXYZ/getColor

        const p00 = toXYZ(it, ip)
        const p10 = toXYZ(it + 1, ip)
        const p01 = toXYZ(it, ip1)
        const p11 = toXYZ(it + 1, ip1)

        const c00 = getColor(it, ip)
        const c10 = getColor(it + 1, ip)
        const c01 = getColor(it, ip1)
        const c11 = getColor(it + 1, ip1)

        // Triangle 1: p00, p10, p01
        const n1 = computeNormal(p00, p10, p01)
        putVert(p00, c00, n1)
        putVert(p10, c10, n1)
        putVert(p01, c01, n1)

        // Triangle 2: p01, p10, p11
        const n2 = computeNormal(p01, p10, p11)
        putVert(p01, c01, n2)
        putVert(p10, c10, n2)
        putVert(p11, c11, n2)
      }
    }

    const solidGeo = new THREE.BufferGeometry()
    solidGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    solidGeo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3))
    solidGeo.setAttribute('normal', new THREE.BufferAttribute(normals, 3))

    // Wireframe: generate lines along θ and φ gridlines
    const wirePoints: number[] = []
    // θ lines (constant theta, sweep phi)
    for (let it = 0; it < nTheta; it += Math.max(1, Math.floor(nTheta / 12))) {
      for (let ip = 0; ip < nPhi; ip++) {
        const a = toXYZ(it, ip)
        const b = toXYZ(it, ip + 1)
        wirePoints.push(a[0], a[1], a[2], b[0], b[1], b[2])
      }
    }
    // φ lines (constant phi, sweep theta)
    for (let ip = 0; ip < nPhi; ip += Math.max(1, Math.floor(nPhi / 12))) {
      for (let it = 0; it < nTheta - 1; it++) {
        const a = toXYZ(it, ip)
        const b = toXYZ(it + 1, ip)
        wirePoints.push(a[0], a[1], a[2], b[0], b[1], b[2])
      }
    }

    const wireGeo = new THREE.BufferGeometry()
    wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wirePoints, 3))

    return { solidGeo, wireGeo }
  }, [pattern, maxGain, radius, nullFloor, dynamicRange])

  if (!visible || !pattern) {
    return null
  }

  return (
    <group>
      {/* Solid surface */}
      {!wireframe && (
        <mesh geometry={solidGeo}>
          <meshPhongMaterial
            vertexColors
            transparent
            opacity={opacity}
            side={THREE.DoubleSide}
            shininess={30}
          />
        </mesh>
      )}

      {/* Wireframe overlay or standalone */}
      {(wireframe || showWireframe) && (
        <lineSegments geometry={wireGeo}>
          <lineBasicMaterial
            color={wireframe ? '#0ea5e9' : '#ffffff'}
            transparent
            opacity={wireframe ? 0.8 : 0.15}
          />
        </lineSegments>
      )}

      {/* Faint wireframe on solid mode for depth perception */}
      {!wireframe && (
        <lineSegments geometry={wireGeo}>
          <lineBasicMaterial color="#ffffff" transparent opacity={0.08} />
        </lineSegments>
      )}
    </group>
  )
}

export default RadiationPattern3D
