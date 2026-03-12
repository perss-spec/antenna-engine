import { useState } from 'react'

interface ViewportControlsProps {
  onToggleRadiation: (visible: boolean) => void
  onToggleAnimation: (animated: boolean) => void
  onOpacityChange: (opacity: number) => void
  radiationVisible: boolean
  animationEnabled: boolean
  radiationOpacity: number
}

export function ViewportControls({
  onToggleRadiation,
  onToggleAnimation,
  onOpacityChange,
  radiationVisible,
  animationEnabled,
  radiationOpacity
}: ViewportControlsProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  
  return (
    <div style={styles.container}>
      <button 
        onClick={() => setIsExpanded(!isExpanded)}
        style={styles.toggleButton}
      >
        {isExpanded ? '◀' : '▶'} Controls
      </button>
      
      {isExpanded && (
        <div style={styles.panel}>
          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>Radiation Pattern</h4>
            
            <label style={styles.control}>
              <input
                type="checkbox"
                checked={radiationVisible}
                onChange={(e) => onToggleRadiation(e.target.checked)}
                style={styles.checkbox}
              />
              Show Pattern
            </label>
            
            <label style={styles.control}>
              <input
                type="checkbox"
                checked={animationEnabled}
                onChange={(e) => onToggleAnimation(e.target.checked)}
                disabled={!radiationVisible}
                style={styles.checkbox}
              />
              Auto Rotate
            </label>
            
            <label style={styles.control}>
              <span>Opacity:</span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.1}
                value={radiationOpacity}
                onChange={(e) => onOpacityChange(parseFloat(e.target.value))}
                disabled={!radiationVisible}
                style={styles.slider}
              />
              <span>{(radiationOpacity * 100).toFixed(0)}%</span>
            </label>
          </div>
          
          <div style={styles.section}>
            <h4 style={styles.sectionTitle}>View</h4>
            
            <div style={styles.info}>
              <div>• Mouse: Orbit camera</div>
              <div>• Wheel: Zoom in/out</div>
              <div>• Right-click: Pan view</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    position: 'absolute' as const,
    top: '20px',
    left: '20px',
    zIndex: 1000
  },
  toggleButton: {
    background: 'rgba(0, 0, 0, 0.8)',
    color: 'white',
    border: 'none',
    padding: '8px 12px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
    fontFamily: 'monospace'
  },
  panel: {
    background: 'rgba(0, 0, 0, 0.9)',
    color: 'white',
    padding: '16px',
    borderRadius: '8px',
    marginTop: '8px',
    minWidth: '220px',
    fontFamily: 'monospace',
    fontSize: '12px'
  },
  section: {
    marginBottom: '16px'
  },
  sectionTitle: {
    margin: '0 0 8px 0',
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#00ff88',
    borderBottom: '1px solid #333',
    paddingBottom: '4px'
  },
  control: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '8px',
    cursor: 'pointer'
  },
  checkbox: {
    cursor: 'pointer'
  },
  slider: {
    flex: 1,
    margin: '0 8px'
  },
  info: {
    fontSize: '11px',
    color: '#ccc',
    lineHeight: '1.4'
  }
}