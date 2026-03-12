import { useState, useEffect, useCallback } from 'react'
import type { RadiationPattern } from '../../types/antenna'

interface FrequencySweepProps {
  patterns: RadiationPattern[]
  onPatternChange: (pattern: RadiationPattern) => void
  autoPlay?: boolean
  duration?: number // seconds for full sweep
}

export function FrequencySweep({ 
  patterns, 
  onPatternChange, 
  autoPlay = false, 
  duration = 5 
}: FrequencySweepProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(autoPlay)
  const [progress, setProgress] = useState(0)

  // Auto-advance animation
  useEffect(() => {
    if (!isPlaying || patterns.length <= 1) return

    const interval = (duration * 1000) / patterns.length
    const timer = setInterval(() => {
      setCurrentIndex(prev => {
        const next = (prev + 1) % patterns.length
        setProgress((next / (patterns.length - 1)) * 100)
        return next
      })
    }, interval)

    return () => clearInterval(timer)
  }, [isPlaying, patterns.length, duration])

  // Notify parent of pattern changes
  useEffect(() => {
    if (patterns[currentIndex]) {
      onPatternChange(patterns[currentIndex])
    }
  }, [currentIndex, patterns, onPatternChange])

  const handlePlay = useCallback(() => {
    setIsPlaying(!isPlaying)
  }, [isPlaying])

  const handleSliderChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const index = parseInt(event.target.value)
    setCurrentIndex(index)
    setProgress((index / (patterns.length - 1)) * 100)
    setIsPlaying(false) // Stop auto-play when manually changing
  }, [patterns.length])

  const handleReset = useCallback(() => {
    setCurrentIndex(0)
    setProgress(0)
    setIsPlaying(false)
  }, [])

  if (!patterns.length) {
    return (
      <div style={{ padding: '16px', color: '#666' }}>
        No frequency data available
      </div>
    )
  }

  const currentPattern = patterns[currentIndex]
  const frequencyGHz = currentPattern ? (currentPattern.frequency / 1e9).toFixed(2) : '0.00'

  return (
    <div style={{
      position: 'absolute',
      bottom: '20px',
      left: '20px',
      right: '20px',
      background: 'rgba(0, 0, 0, 0.8)',
      borderRadius: '8px',
      padding: '16px',
      color: 'white',
      fontFamily: 'monospace'
    }}>
      <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <button
          onClick={handlePlay}
          style={{
            background: isPlaying ? '#ff4444' : '#44ff44',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        
        <button
          onClick={handleReset}
          style={{
            background: '#666',
            border: 'none',
            borderRadius: '4px',
            padding: '8px 16px',
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px'
          }}
        >
          ⏹ Reset
        </button>
        
        <div style={{ flex: 1, textAlign: 'center' }}>
          <strong>Frequency: {frequencyGHz} GHz</strong>
        </div>
        
        <div style={{ fontSize: '12px', color: '#ccc' }}>
          {currentIndex + 1} / {patterns.length}
        </div>
      </div>
      
      <div style={{ position: 'relative' }}>
        <input
          type="range"
          min={0}
          max={patterns.length - 1}
          value={currentIndex}
          onChange={handleSliderChange}
          style={{
            width: '100%',
            height: '6px',
            borderRadius: '3px',
            background: '#333',
            outline: 'none',
            cursor: 'pointer'
          }}
        />
        
        {/* Progress indicator */}
        <div
          style={{
            position: 'absolute',
            top: '0',
            left: '0',
            height: '6px',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #4444ff, #ff4444)',
            borderRadius: '3px',
            pointerEvents: 'none',
            transition: isPlaying ? 'width 0.1s ease' : 'none'
          }}
        />
      </div>
      
      <div style={{ 
        marginTop: '8px', 
        fontSize: '11px', 
        color: '#aaa',
        display: 'flex',
        justifyContent: 'space-between'
      }}>
        <span>{patterns.length > 0 ? (patterns[0].frequency / 1e9).toFixed(2) : '0.00'} GHz</span>
        <span>{patterns.length > 0 ? (patterns[patterns.length - 1].frequency / 1e9).toFixed(2) : '0.00'} GHz</span>
      </div>
    </div>
  )
}