import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

function AntennaScene() {
  return (
    <>
      <ambientLight intensity={0.5} />
      <pointLight position={[10, 10, 10]} />
      <mesh>
        <cylinderGeometry args={[1, 1, 2, 32]} />
        <meshStandardMaterial color="orange" />
      </mesh>
      <OrbitControls />
    </>
  )
}

export default function AntennaViewport() {
  return (
    <div style={{ width: '100%', height: '100vh' }}>
      <Canvas>
        <AntennaScene />
      </Canvas>
    </div>
  )
}