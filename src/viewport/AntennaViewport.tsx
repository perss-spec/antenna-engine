import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { DipoleModel } from './DipoleModel'

interface AntennaViewportProps {
  length?: number
  frequency?: number
  radius?: number
  className?: string
}

function AntennaScene({ length, frequency, radius }: { length: number; frequency: number; radius: number }) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <directionalLight position={[-10, -10, -5]} intensity={0.3} />
      
      {/* Grid and axes */}
      <Grid 
        cellSize={0.1} 
        sectionSize={1} 
        fadeDistance={30} 
        fadeStrength={1}
        cellColor="#444444"
        sectionColor="#666666"
      />
      <axesHelper args={[1]} />
      
      {/* Dipole antenna */}
      <DipoleModel
        length={length}
        frequency={frequency}
        radius={radius}
        segments={20}
        showFeedPoint={true}
      />
      
      <OrbitControls enableDamping dampingFactor={0.05} />
    </>
  )
}

export default function AntennaViewport({ 
  length = 0.15, // Default half-wave at 1 GHz
  frequency = 1e9, // 1 GHz
  radius = 0.001, // 1mm wire radius
  className 
}: AntennaViewportProps) {
  return (
    <div 
      className={className}
      style={{ 
        width: '100%', 
        height: '100vh',
        background: '#1a1a1a'
      }}
    >
      <Canvas
        camera={{ position: [0.5, 0.3, 0.5], fov: 50 }}
        style={{ background: '#1a1a1a' }}
      >
        <AntennaScene 
          length={length}
          frequency={frequency}
          radius={radius}
        />
      </Canvas>
    </div>
  )
}