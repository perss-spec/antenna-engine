import { useState } from 'react'

export interface ViewportControlsProps {
  showGrid: boolean
  onGridToggle: (show: boolean) => void
  showAxes: boolean
  onAxesToggle: (show: boolean) => void
  showCurrent?: boolean
  onCurrentToggle?: (show: boolean) => void
  frequency?: number
  onFrequencyChange?: (frequency: number) => void
}

export function ViewportControls({
  showGrid,
  onGridToggle,
  showAxes,
  onAxesToggle,
  showCurrent = false,
  onCurrentToggle,
  frequency = 2.4e9,
  onFrequencyChange
}: ViewportControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  const formatFrequency = (freq: number): string => {
    if (freq >= 1e9) {
      return `${(freq / 1e9).toFixed(2)} GHz`
    } else if (freq >= 1e6) {
      return `${(freq / 1e6).toFixed(2)} MHz`
    } else if (freq >= 1e3) {
      return `${(freq / 1e3).toFixed(2)} kHz`
    } else {
      return `${freq.toFixed(2)} Hz`
    }
  }

  const handleFrequencyInput = (value: string) => {
    const num = parseFloat(value)
    if (!isNaN(num) && num > 0) {
      onFrequencyChange?.(num * 1e9) // Assume input is in GHz
    }
  }

  return (
    <div className="viewport-controls" style={{
      position: 'absolute',
      top: '10px',
      right: '10px',
      background: 'rgba(0, 0, 0, 0.8)',
      borderRadius: '8px',
      padding: '12px',
      color: 'white',
      fontSize: '14px',
      minWidth: '200px',
      zIndex: 1000
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
        <h3 style={{ margin: 0, fontSize: '16px', flexGrow: 1 }}>Viewport Controls</h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            background: 'none',
            border: 'none',
            color: 'white',
            cursor: 'pointer',
            fontSize: '18px'
          }}
        >
          {isExpanded ? '−' : '+'}
        </button>
      </div>
      
      {isExpanded && (
        <div>
          {/* Display toggles */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => onGridToggle(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              Show Grid
            </label>
            
            <label style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
              <input
                type="checkbox"
                checked={showAxes}
                onChange={(e) => onAxesToggle(e.target.checked)}
                style={{ marginRight: '8px' }}
              />
              Show Axes
            </label>
            
            {onCurrentToggle && (
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: '6px' }}>
                <input
                  type="checkbox"
                  checked={showCurrent}
                  onChange={(e) => onCurrentToggle(e.target.checked)}
                  style={{ marginRight: '8px' }}
                />
                Current Distribution
              </label>
            )}
          </div>
          
          {/* Frequency control */}
          {onFrequencyChange && (
            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', marginBottom: '4px' }}>
                Frequency: {formatFrequency(frequency)}
              </label>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={frequency / 1e9}
                onChange={(e) => handleFrequencyInput(e.target.value)}
                style={{
                  width: '100%',
                  marginBottom: '4px'
                }}
              />
              <input
                type="number"
                placeholder="GHz"
                step="0.1"
                min="0.1"
                max="100"
                value={(frequency / 1e9).toFixed(2)}
                onChange={(e) => handleFrequencyInput(e.target.value)}
                style={{
                  width: '80px',
                  padding: '2px 4px',
                  background: 'rgba(255, 255, 255, 0.1)',
                  border: '1px solid #555',
                  borderRadius: '4px',
                  color: 'white'
                }}
              />
              <span style={{ marginLeft: '4px', fontSize: '12px' }}>GHz</span>
            </div>
          )}
          
          {/* Current overlay legend */}
          {showCurrent && (
            <div style={{ fontSize: '12px', color: '#ccc' }}>
              <div style={{ marginBottom: '4px' }}>Current Scale:</div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: 'linear-gradient(to right, #0066ff, #ff0000)',
                height: '12px',
                borderRadius: '2px',
                marginBottom: '4px'
              }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Low</span>
                <span>High</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}