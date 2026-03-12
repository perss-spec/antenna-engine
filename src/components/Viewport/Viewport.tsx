import type { ReactNode } from 'react';
import './Viewport.css';

interface ViewportProps {
  children?: ReactNode;
}

export const Viewport = ({ children }: ViewportProps) => {
  return (
    <div className="viewport">
      <div className="viewport-toolbar">
        <div className="toolbar-group">
          <button type="button" className="toolbar-btn" title="Reset View">
            <span className="icon">🏠</span>
          </button>
          <button type="button" className="toolbar-btn" title="Zoom In">
            <span className="icon">🔍</span>
          </button>
          <button type="button" className="toolbar-btn" title="Zoom Out">
            <span className="icon">🔍</span>
          </button>
        </div>
        
        <div className="toolbar-group">
          <button type="button" className="toolbar-btn" title="Wireframe">
            <span className="icon">📐</span>
          </button>
          <button type="button" className="toolbar-btn" title="Solid">
            <span className="icon">🧊</span>
          </button>
        </div>
        
        <div className="toolbar-group">
          <span className="toolbar-label">View:</span>
          <select className="toolbar-select" defaultValue="perspective">
            <option value="perspective">Perspective</option>
            <option value="top">Top</option>
            <option value="front">Front</option>
            <option value="side">Side</option>
          </select>
        </div>
      </div>
      
      <div className="viewport-canvas">
        {/* 3D canvas will be mounted here */}
        <div className="canvas-placeholder">
          <div className="placeholder-content">
            <div className="placeholder-icon">📡</div>
            <h3>3D Antenna Viewer</h3>
            <p>The 3D visualization will be integrated here</p>
            <div className="placeholder-features">
              <div className="feature-item">• Interactive 3D rotation</div>
              <div className="feature-item">• Real-time parameter updates</div>
              <div className="feature-item">• Radiation pattern overlay</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="viewport-status">
        <div className="status-item">
          <span className="status-label">Mesh:</span>
          <span className="status-value">Ready</span>
        </div>
        <div className="status-item">
          <span className="status-label">Vertices:</span>
          <span className="status-value">0</span>
        </div>
        <div className="status-item">
          <span className="status-label">FPS:</span>
          <span className="status-value">60</span>
        </div>
      </div>
      
      {children}
    </div>
  );
};