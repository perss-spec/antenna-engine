import type { ReactNode } from 'react';
import { useState } from 'react';
import './MainLayout.css';

interface MainLayoutProps {
  children?: ReactNode;
}

export const MainLayout = ({ children }: MainLayoutProps) => {
  const [leftPanelWidth, setLeftPanelWidth] = useState(300);
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = () => {
    setIsResizing(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    
    const newWidth = e.clientX;
    if (newWidth >= 200 && newWidth <= 600) {
      setLeftPanelWidth(newWidth);
    }
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  // Add global mouse event listeners for resizing
  useState(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => handleMouseMove(e);
    const handleGlobalMouseUp = () => handleMouseUp();

    if (isResizing) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  });

  return (
    <div className="main-layout">
      <div 
        className="parameter-panel"
        style={{ width: `${leftPanelWidth}px` }}
      >
        <div className="parameter-panel-header">
          <h2>Antenna Parameters</h2>
        </div>
        <div className="parameter-panel-content">
          {/* Parameter controls will be added here */}
          <div className="parameter-section">
            <h3>Geometry</h3>
            <div className="parameter-placeholder">
              Parameter controls coming soon...
            </div>
          </div>
          <div className="parameter-section">
            <h3>Material Properties</h3>
            <div className="parameter-placeholder">
              Parameter controls coming soon...
            </div>
          </div>
          <div className="parameter-section">
            <h3>Simulation Settings</h3>
            <div className="parameter-placeholder">
              Parameter controls coming soon...
            </div>
          </div>
        </div>
      </div>
      
      <div 
        className={`resize-handle ${isResizing ? 'resizing' : ''}`}
        onMouseDown={handleMouseDown}
      />
      
      <div className="viewport-container">
        <div className="viewport-header">
          <h2>3D Viewport</h2>
          <div className="viewport-controls">
            <button className="viewport-btn">Reset View</button>
            <button className="viewport-btn">Wireframe</button>
            <button className="viewport-btn">Solid</button>
          </div>
        </div>
        <div className="viewport-content">
          {children || (
            <div className="viewport-placeholder">
              <div className="viewport-placeholder-content">
                <div className="viewport-placeholder-icon">📡</div>
                <p>3D Antenna Visualization</p>
                <p className="viewport-placeholder-subtitle">
                  WebGPU integration coming soon...
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};