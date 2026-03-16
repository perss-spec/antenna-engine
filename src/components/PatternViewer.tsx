import React, { useRef, useEffect, useState } from 'react';
import type { AntennaPattern } from '../types/antenna';

interface PatternViewerProps {
  pattern: AntennaPattern | null;
  viewMode: '2d' | '3d';
  className?: string;
}

export const PatternViewer: React.FC<PatternViewerProps> = ({ 
  pattern, 
  viewMode, 
  className = '' 
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!pattern || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsLoading(true);
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    try {
      if (viewMode === '2d') {
        render2DPattern(ctx, pattern, canvas.width, canvas.height);
      } else {
        render3DPattern(ctx, pattern, canvas.width, canvas.height);
      }
    } catch (error) {
      console.error('Error rendering pattern:', error);
      renderErrorState(ctx, canvas.width, canvas.height);
    } finally {
      setIsLoading(false);
    }
  }, [pattern, viewMode]);

  const render2DPattern = (
    ctx: CanvasRenderingContext2D, 
    pattern: AntennaPattern, 
    width: number, 
    height: number
  ) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const maxRadius = Math.min(width, height) / 2 - 20;

    // Draw concentric circles for gain levels
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    
    for (let i = 1; i <= 4; i++) {
      const radius = (maxRadius * i) / 4;
      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Draw angle lines
    ctx.strokeStyle = '#d1d5db';
    for (let angle = 0; angle < 360; angle += 30) {
      const radians = (angle * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + maxRadius * Math.cos(radians),
        centerY + maxRadius * Math.sin(radians)
      );
      ctx.stroke();
    }

    // Draw pattern
    if (pattern.pattern_data?.azimuth && pattern.pattern_data?.gain_values) {
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();

      const azimuth = pattern.pattern_data.azimuth;
      const gainValues = pattern.pattern_data.gain_values[0] || [];
      const maxGain = pattern.pattern_data.max_gain || 1;

      for (let i = 0; i < azimuth.length; i++) {
        const angle = (azimuth[i] * Math.PI) / 180;
        const normalizedGain = Math.max(0, (gainValues[i] || 0) / maxGain);
        const radius = maxRadius * normalizedGain;
        
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      
      ctx.closePath();
      ctx.stroke();
      
      // Fill pattern
      ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
      ctx.fill();
    }

    // Draw labels
    ctx.fillStyle = '#374151';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('0°', centerX, centerY - maxRadius - 10);
    ctx.fillText('180°', centerX, centerY + maxRadius + 20);
    ctx.textAlign = 'left';
    ctx.fillText('90°', centerX + maxRadius + 10, centerY + 5);
    ctx.textAlign = 'right';
    ctx.fillText('270°', centerX - maxRadius - 10, centerY + 5);
  };

  const render3DPattern = (
    ctx: CanvasRenderingContext2D, 
    pattern: AntennaPattern, 
    width: number, 
    height: number
  ) => {
    // Simple 3D representation using isometric projection
    const centerX = width / 2;
    const centerY = height / 2;
    const scale = Math.min(width, height) / 4;

    // Draw 3D axes
    ctx.strokeStyle = '#6b7280';
    ctx.lineWidth = 2;
    
    // X axis
    ctx.beginPath();
    ctx.moveTo(centerX - scale, centerY);
    ctx.lineTo(centerX + scale, centerY);
    ctx.stroke();
    
    // Y axis (isometric)
    ctx.beginPath();
    ctx.moveTo(centerX, centerY - scale);
    ctx.lineTo(centerX, centerY + scale);
    ctx.stroke();
    
    // Z axis (isometric)
    ctx.beginPath();
    ctx.moveTo(centerX - scale * 0.5, centerY - scale * 0.5);
    ctx.lineTo(centerX + scale * 0.5, centerY + scale * 0.5);
    ctx.stroke();

    if (pattern.pattern_data?.gain_values) {
      // Draw simplified 3D pattern representation
      ctx.fillStyle = 'rgba(59, 130, 246, 0.6)';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 1;

      const gainData = pattern.pattern_data.gain_values;
      const maxGain = pattern.pattern_data.max_gain || 1;

      // Draw multiple elevation slices
      for (let elevIdx = 0; elevIdx < Math.min(gainData.length, 5); elevIdx++) {
        const elevation = elevIdx * 36; // 0, 36, 72, 108, 144 degrees
        const yOffset = (elevation - 72) * scale / 180;
        
        ctx.beginPath();
        const slice = gainData[elevIdx] || [];
        
        for (let azIdx = 0; azIdx < slice.length; azIdx++) {
          const azimuth = (azIdx * 360) / slice.length;
          const normalizedGain = Math.max(0, (slice[azIdx] || 0) / maxGain);
          const radius = scale * normalizedGain * 0.8;
          
          const angle = (azimuth * Math.PI) / 180;
          const x = centerX + radius * Math.cos(angle);
          const y = centerY + yOffset + radius * Math.sin(angle) * 0.5; // Flatten for isometric view
          
          if (azIdx === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  };

  const renderErrorState = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.fillStyle = '#ef4444';
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Error rendering pattern', width / 2, height / 2);
  };

  if (!pattern) {
    return (
      <div className={`flex items-center justify-center bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg ${className}`}>
        <p className="text-gray-500">No pattern selected</p>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      {isLoading && (
        <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={800}
        height={600}
        className="w-full h-full border border-gray-200 rounded-lg"
      />
      <div className="absolute top-2 left-2 bg-white bg-opacity-90 px-2 py-1 rounded text-sm">
        <strong>{pattern.name}</strong>
        <br />
        Frequency: {pattern.frequency.toFixed(1)} MHz
        <br />
        Gain: {pattern.gain.toFixed(1)} dBi
      </div>
    </div>
  );
};