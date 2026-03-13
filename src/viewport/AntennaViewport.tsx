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
import { useRef, useState, useCallback } from 'react'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { Grid3x3, Maximize } from 'lucide-react'

const C0 = 299792458

const ANTENNA_LABELS: Record<string, string> = {
  half_wave_dipole: 'Half-Wave Dipole',
  quarter_wave_monopole: 'Quarter-Wave Monopole',
  yagi_uda: 'Yagi-Uda',
  log_periodic: 'Log-Periodic',
  axial_helix: 'Axial Helix',
  normal_helix: 'Normal-Mode Helix',
  patch: 'Microstrip Patch',
  horn: 'Horn Antenna',
  parabolic: 'Parabolic Reflector',
  loop: 'Loop Antenna',
  spiral: 'Archimedean Spiral',
  vivaldi: 'Vivaldi (UWB)',
  phased_array: 'Phased Array',
}

interface AntennaViewportProps {
  antennaType?: AntennaType
  length?: number
  frequency?: number
  radius?: number
  className?: string
}

function CameraController(_props: {
  controlsRef: React.RefObject<OrbitControlsImpl | null>
}) {
  return null
}

function AntennaScene({
  antennaType,
  length,
  frequency,
  radius,
  controlsRef,
}: {
  antennaType: string
  length: number
  frequency: number
  radius: number
  controlsRef: React.RefObject<OrbitControlsImpl | null>
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
          reflector_length={(wavelength / 2) * 1.05}
          director_length={(wavelength / 2) * 0.91}
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

      {category === 'wire' &&
        !antennaType.includes('monopole') &&
        !antennaType.includes('yagi') &&
        antennaType !== 'log_periodic' &&
        !antennaType.includes('helix') && (
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

      <OrbitControls ref={controlsRef} enableDamping dampingFactor={0.05} />
      <CameraController controlsRef={controlsRef} />
    </>
  )
}

const VIEW_PRESETS = [
  { key: 'front', label: 'Front' },
  { key: 'top', label: 'Top' },
  { key: 'right', label: 'Right' },
  { key: 'iso', label: 'Iso' },
] as const

export default function AntennaViewport({
  antennaType = 'half_wave_dipole',
  length = 0.15,
  frequency = 1e9,
  radius = 0.001,
  className,
}: AntennaViewportProps) {
  const [wireframe, setWireframe] = useState(false)
  const [activePreset, setActivePreset] = useState<string>('iso')
  const controlsRef = useRef<OrbitControlsImpl | null>(null)

  const label = ANTENNA_LABELS[antennaType] ?? antennaType

  const handlePreset = useCallback(
    (preset: (typeof VIEW_PRESETS)[number]['key']) => {
      setActivePreset(preset)
      const d = 1.2
      const positions: Record<string, [number, number, number]> = {
        front: [0, 0, d],
        top: [0, d, 0],
        right: [d, 0, 0],
        iso: [d * 0.7, d * 0.5, d * 0.7],
      }
      const [x, y, z] = positions[preset]
      if (controlsRef.current) {
        const controls = controlsRef.current as any
        controls.object?.position.set(x, y, z)
        controls.object?.lookAt(0, 0, 0)
        controls.target?.set(0, 0, 0)
        controls.update?.()
      }
    },
    []
  )

  const handleFitAll = useCallback(() => {
    if (controlsRef.current) {
      const controls = controlsRef.current as any
      controls.reset?.()
    }
  }, [])

  return (
    <div className={cn('relative w-full h-full', className)}>
      {/* Viewport header */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center pointer-events-none">
        <span className="mt-2 px-2 py-0.5 text-xs text-zinc-500 bg-zinc-900/60 rounded-md font-mono tracking-wide">
          {label}
        </span>
      </div>

      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 bg-zinc-900/80 backdrop-blur-sm border border-zinc-700/50 rounded-lg p-1">
        {/* View presets */}
        {VIEW_PRESETS.map((p) => (
          <button
            key={p.key}
            title={p.key.charAt(0).toUpperCase() + p.key.slice(1) + ' view'}
            onClick={() => handlePreset(p.key)}
            className={cn(
              'h-7 w-7 flex items-center justify-center rounded transition-colors text-[10px] font-semibold font-mono',
              activePreset === p.key
                ? 'bg-zinc-600 text-zinc-100'
                : 'text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
            )}
          >
            {p.label.slice(0, 1)}
          </button>
        ))}

        <div className="h-px bg-zinc-700/60 mx-1" />

        {/* Wireframe toggle */}
        <button
          title="Toggle wireframe"
          onClick={() => setWireframe((v) => !v)}
          className={cn(
            'h-7 w-7 flex items-center justify-center rounded transition-colors',
            wireframe
              ? 'bg-zinc-600 text-zinc-100'
              : 'text-zinc-400 hover:bg-zinc-700 hover:text-zinc-100'
          )}
        >
          <Grid3x3 size={14} />
        </button>

        {/* Fit all / reset */}
        <button
          title="Fit all (reset view)"
          onClick={handleFitAll}
          className="h-7 w-7 flex items-center justify-center rounded hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
        >
          <Maximize size={14} />
        </button>
      </div>

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

          controlsRef={controlsRef}
        />
      </Canvas>
    </div>
  )
}
