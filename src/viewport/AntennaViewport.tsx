import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { DipoleModel } from './DipoleModel'
import { MonopoleModel } from './MonopoleModel'
import { PatchModel } from './PatchModel'
import { QfhModel } from './QfhModel'
import { YagiModel } from './models/YagiModel'
import type { AntennaType } from '@/components/AntennaForm/AntennaForm'
import { getCategoryForId } from '@/lib/antennaKB'
import type { AntennaCategory } from '@/lib/antennaKB'
import { cn } from '@/lib/utils'

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
  antennaType: string
  length: number
  frequency: number
  radius: number
}) {
  const wavelength = C0 / frequency
  const category: AntennaCategory = getCategoryForId(antennaType)

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

      {category === 'wire' && antennaType.includes('monopole') && (
        <MonopoleModel
          length={length || wavelength / 4}
          frequency={frequency}
          radius={radius}
          segments={20}
          showFeedPoint
          groundPlaneRadius={wavelength * 0.3}
        />
      )}

      {category === 'wire' && (antennaType.includes('yagi') || antennaType === 'log_periodic') && (
        <YagiModel
          driven_length={wavelength / 2}
          reflector_length={wavelength / 2 * 1.05}
          director_length={wavelength / 2 * 0.91}
          spacing={wavelength * 0.25}
          radius={radius}
        />
      )}

      {category === 'wire' && antennaType.includes('helix') && (
        <QfhModel
          frequency={frequency}
          turns={antennaType === 'axial_helix' ? 5 : 0.5}
          diameter={wavelength * 0.16}
          height={wavelength * 0.26}
          wireRadius={radius}
        />
      )}

      {category === 'wire' && !antennaType.includes('monopole') && !antennaType.includes('yagi') && antennaType !== 'log_periodic' && !antennaType.includes('helix') && (
        <DipoleModel
          length={length || wavelength / 2}
          frequency={frequency}
          radius={radius}
          segments={20}
          showFeedPoint
        />
      )}

      {category === 'microstrip' && (
        <PatchModel
          length={length || wavelength / 4}
          width={(length || wavelength / 4) * 1.3}
          height={0.0016}
          showSubstrate
        />
      )}

      {category === 'broadband' && (
        <DipoleModel
          length={length || wavelength / 2}
          frequency={frequency}
          radius={radius * 3}
          segments={20}
          showFeedPoint
        />
      )}

      {category === 'aperture' && (
        <PatchModel
          length={wavelength}
          width={wavelength * 0.7}
          height={wavelength * 0.5}
          showSubstrate={false}
        />
      )}

      {category === 'array' && (
        <YagiModel
          driven_length={wavelength / 2}
          reflector_length={wavelength / 2}
          director_length={wavelength / 2}
          spacing={wavelength * 0.5}
          radius={radius}
        />
      )}

      {category === 'special' && (
        <DipoleModel
          length={length || wavelength / 2}
          frequency={frequency}
          radius={radius}
          segments={20}
          showFeedPoint
        />
      )}

      <OrbitControls enableDamping dampingFactor={0.05} />
    </>
  )
}

export default function AntennaViewport({
  antennaType = 'half_wave_dipole',
  length = 0.15,
  frequency = 1e9,
  radius = 0.001,
  className,
}: AntennaViewportProps) {
  return (
    <div className={cn('w-full h-full', className)}>
      <Canvas
        camera={{ position: [0.5, 0.3, 0.5], fov: 50 }}
        className="h-full"
        style={{ background: 'transparent' }}
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
