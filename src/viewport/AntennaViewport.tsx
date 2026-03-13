import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { DipoleModel } from './DipoleModel'
import { MonopoleModel } from './MonopoleModel'
import { PatchModel } from './PatchModel'
import { QfhModel } from './QfhModel'
import { YagiModel } from './models/YagiModel'
import type { AntennaType } from '@/components/AntennaForm/AntennaForm'

const C0 = 299792458

interface AntennaViewportProps {
  antennaType?: AntennaType
  length?: number
  frequency?: number
  radius?: number
  className?: string
}

function AntennaScene({
  antennaType,
  length,
  frequency,
  radius,
}: {
  antennaType: AntennaType
  length: number
  frequency: number
  radius: number
}) {
  const wavelength = C0 / frequency

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 10, 5]} intensity={0.8} />
      <directionalLight position={[-10, -10, -5]} intensity={0.3} />

      <Grid
        cellSize={0.1}
        sectionSize={1}
        fadeDistance={30}
        fadeStrength={1}
        cellColor="#444444"
        sectionColor="#666666"
      />
      <axesHelper args={[1]} />

      {antennaType === 'dipole' && (
        <DipoleModel
          length={length}
          frequency={frequency}
          radius={radius}
          segments={20}
          showFeedPoint
        />
      )}

      {antennaType === 'monopole' && (
        <MonopoleModel
          length={length}
          frequency={frequency}
          radius={radius}
          segments={20}
          showFeedPoint
          groundPlaneRadius={wavelength * 0.3}
        />
      )}

      {antennaType === 'patch' && (
        <PatchModel
          length={length}
          width={length * 1.3}
          height={0.0016}
          showSubstrate
        />
      )}

      {antennaType === 'qfh' && (
        <QfhModel
          frequency={frequency}
          turns={0.5}
          diameter={wavelength * 0.16}
          height={wavelength * 0.26}
          wireRadius={radius}
        />
      )}

      {antennaType === 'yagi' && (
        <YagiModel
          driven_length={wavelength / 2}
          reflector_length={wavelength / 2 * 1.05}
          director_length={wavelength / 2 * 0.91}
          spacing={wavelength * 0.25}
          radius={radius}
        />
      )}

      <OrbitControls enableDamping dampingFactor={0.05} />
    </>
  )
}

export default function AntennaViewport({
  antennaType = 'dipole',
  length = 0.15,
  frequency = 1e9,
  radius = 0.001,
  className,
}: AntennaViewportProps) {
  return (
    <div
      className={className}
      style={{
        width: '100%',
        height: '100vh',
        background: '#1a1a1a',
      }}
    >
      <Canvas
        camera={{ position: [0.5, 0.3, 0.5], fov: 50 }}
        style={{ background: '#1a1a1a' }}
      >
        <AntennaScene
          antennaType={antennaType}
          length={length}
          frequency={frequency}
          radius={radius}
        />
      </Canvas>
    </div>
  )
}
