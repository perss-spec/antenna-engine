import { useState, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { AntennaRenderer } from './components/AntennaRenderer'
import { RadiationPattern } from './components/RadiationPattern'
import { FrequencySweep } from './components/FrequencySweep'
import type { ViewportAntennaGeometry, RadiationPatternData } from './types'

interface AntennaViewProps {
  geometry: ViewportAntennaGeometry
  radiationPatterns?: RadiationPatternData[]
  showRadiationPattern?: boolean
  className?: string
}

export function AntennaView({ 
  geometry, 
  radiationPatterns = [], 
  showRadiationPattern = false,
  className 
}: AntennaViewProps) {
  const [selectedElementId, setSelectedElementId] = useState<string | undefined>()
  const [currentPattern, setCurrentPattern] = useState<RadiationPatternData | undefined>(
    radiationPatterns[0]
  )
  const [showFrequencySweep, setShowFrequencySweep] = useState(false)

  const handleElementClick = useCallback((elementId: string) => {
    setSelectedElementId(prev => prev === elementId ? undefined : elementId)
  }, [])

  const handlePatternChange = useCallback((pattern: RadiationPatternData) => {
    setCurrentPattern(pattern)
  }, [])

  const toggleFrequencySweep = useCallback(() => {
    setShowFrequencySweep(prev => !prev)
  }, [])

  return (
    <div className={className} style={{ position: 'relative', width: '100%', height: '100%' }}>
      <Canvas
        camera={{ position: [5, 5, 5], fov: 50 }}
        style={{ background: '#1a1a1a' }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <directionalLight position={[-10, -10, -5]} intensity={0.3} />
        
        {/* Grid and axes */}
        <Grid 
          cellSize={0.5} 
          sectionSize={2} 
          fadeDistance={30} 
          fadeStrength={1}
          cellColor="#444444"
          sectionColor="#666666"
        />
        <axesHelper args={[2]} />
        
        {/* Antenna geometry */}
        <AntennaRenderer
          geometry={geometry}
          selectedElementId={selectedElementId}
          onElementClick={handleElementClick}
        />
        
        {/* Radiation pattern */}
        {showRadiationPattern && currentPattern && (
          <RadiationPattern
            pattern={currentPattern}
            visible={true}
            opacity={0.7}
          />
        )}
        
        <OrbitControls enableDamping dampingFactor={0.05} />
      </Canvas>
      
      {/* Controls */}
      <div style={{
        position: 'absolute',
        top: '20px',
        right: '20px',
        background: 'rgba(0, 0, 0, 0.8)',
        borderRadius: '8px',
        padding: '16px',
        color: 'white',
        fontFamily: 'monospace',
        fontSize: '14px'
      }}>
        <div style={{ marginBottom: '12px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showRadiationPattern}
              onChange={(e) => setShowFrequencySweep(e.target.checked)}
            />
            Show Radiation Pattern
          </label>
        </div>
        
        {radiationPatterns.length > 1 && (
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showFrequencySweep}
                onChange={toggleFrequencySweep}
              />
              Frequency Sweep
            </label>
          </div>
        )}
        
        {selectedElementId && (
          <div style={{ marginTop: '12px', fontSize: '12px', color: '#ccc' }}>
            Selected: {selectedElementId}
          </div>
        )}
      </div>
      
      {/* Frequency sweep controls */}
      {showFrequencySweep && radiationPatterns.length > 1 && (
        <FrequencySweep
          patterns={radiationPatterns}
          onPatternChange={handlePatternChange}
          autoPlay={false}
          duration={5}
        />
      )}
    </div>
  )
}