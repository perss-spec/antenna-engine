import { useRef, useEffect, useState } from 'react';
import type { FC } from 'react';
import './SmithChart.css';

interface SmithChartProps {
  impedanceReal: number[];
  impedanceImag: number[];
  frequency?: number[];
  width?: number;
  height?: number;
  className?: string;
  showGrid?: boolean;
  showLabels?: boolean;
  referenceImpedance?: number; // Z0, typically 50 ohms
  title?: string;
}

interface Point {
  x: number;
  y: number;
}

const SmithChart: FC<SmithChartProps> = ({
  impedanceReal,
  impedanceImag,
  frequency = [],
  width = 400,
  height = 400,
  className = '',
  showGrid = true,
  showLabels = true,
  referenceImpedance = 50,
  title = 'Smith Chart'
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<{ index: number; x: number; y: number } | null>(null);

  // Convert impedance to reflection coefficient (Gamma)
  const impedanceToGamma = (real: number, imag: number): Point => {
    const z = { real: real / referenceImpedance, imag: imag / referenceImpedance };
    const denominator = (1 + z.real) ** 2 + z.imag ** 2;
    
    if (denominator === 0) {
      return { x: 1, y: 0 }; // Open circuit
    }
    
    const gammaReal = ((z.real ** 2 + z.imag ** 2 - 1)) / denominator;
    const gammaImag = (2 * z.imag) / denominator;
    
    return { x: gammaReal, y: gammaImag };
  };

  // Convert Gamma coordinates to canvas coordinates
  const gammaToCanvas = (gamma: Point, centerX: number, centerY: number, radius: number): Point => {
    return {
      x: centerX + gamma.x * radius,
      y: centerY - gamma.y * radius // Flip Y for canvas coordinates
    };
  };

  // Draw resistance circles
  const drawResistanceCircles = (ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number) => {
    const resistanceValues = [0.2, 0.5, 1, 2, 5];
    
    ctx.strokeStyle = '#2a2a3e';
    ctx.lineWidth = 1;

    resistanceValues.forEach(r => {
      const circleRadius = radius / (1 + r);
      const circleX = centerX + (r * radius) / (1 + r);

      ctx.beginPath();
      ctx.arc(circleX, centerY, circleRadius, 0, 2 * Math.PI);
      ctx.stroke();

      // Label
      if (showLabels) {
        ctx.fillStyle = '#555';
        ctx.font = '10px Arial';
        ctx.fillText(r.toString(), circleX + circleRadius - 10, centerY - 5);
      }
    });
  };

  // Draw reactance circles
  const drawReactanceCircles = (ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number) => {
    const reactanceValues = [0.2, 0.5, 1, 2, 5];
    
    ctx.strokeStyle = '#2a2a3e';
    ctx.lineWidth = 1;

    reactanceValues.forEach(x => {
      // Positive reactance (upper half)
      const circleRadius = radius / x;
      const circleY = centerY - radius / x;

      ctx.beginPath();
      ctx.arc(centerX + radius, circleY, circleRadius, 0, 2 * Math.PI);
      ctx.stroke();

      // Negative reactance (lower half)
      const circleYNeg = centerY + radius / x;

      ctx.beginPath();
      ctx.arc(centerX + radius, circleYNeg, circleRadius, 0, 2 * Math.PI);
      ctx.stroke();

      // Labels
      if (showLabels) {
        ctx.fillStyle = '#555';
        ctx.font = '10px Arial';
        ctx.fillText(`+j${x}`, centerX + radius - 15, circleY - circleRadius + 10);
        ctx.fillText(`-j${x}`, centerX + radius - 15, circleYNeg + circleRadius - 5);
      }
    });
  };

  // Draw the outer circle and axes
  const drawBoundary = (ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number) => {
    // Outer circle
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();

    // Horizontal axis
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - radius, centerY);
    ctx.lineTo(centerX + radius, centerY);
    ctx.stroke();

    // Labels
    if (showLabels) {
      ctx.fillStyle = '#666';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.fillText('0', centerX - radius - 15, centerY + 5);
      ctx.fillText('\u221E', centerX + radius + 15, centerY + 5);
      ctx.fillText('+jX', centerX - 10, centerY - radius - 10);
      ctx.fillText('-jX', centerX - 10, centerY + radius + 20);
    }
  };

  // Draw impedance trace
  const drawTrace = (ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number) => {
    if (impedanceReal.length === 0 || impedanceImag.length === 0) return;
    
    const points: Point[] = [];
    
    // Convert all impedance points to canvas coordinates
    for (let i = 0; i < Math.min(impedanceReal.length, impedanceImag.length); i++) {
      const gamma = impedanceToGamma(impedanceReal[i], impedanceImag[i]);
      const canvasPoint = gammaToCanvas(gamma, centerX, centerY, radius);
      points.push(canvasPoint);
    }
    
    if (points.length === 0) return;
    
    // Draw trace line
    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    
    // Draw points
    points.forEach((point, index) => {
      ctx.fillStyle = index === 0 ? '#22c55e' : index === points.length - 1 ? '#ef4444' : '#6366f1';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
      ctx.fill();
      
      // Highlight hovered point
      if (hoveredPoint && hoveredPoint.index === index) {
        ctx.strokeStyle = '#FF9800';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
        ctx.stroke();
      }
    });
  };

  // Handle mouse move for hover effects
  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 40;
    
    // Check if mouse is near any data point
    let nearestPoint: { index: number; x: number; y: number } | null = null;
    let minDistance = Infinity;
    
    for (let i = 0; i < Math.min(impedanceReal.length, impedanceImag.length); i++) {
      const gamma = impedanceToGamma(impedanceReal[i], impedanceImag[i]);
      const canvasPoint = gammaToCanvas(gamma, centerX, centerY, radius);
      const distance = Math.sqrt((mouseX - canvasPoint.x) ** 2 + (mouseY - canvasPoint.y) ** 2);
      
      if (distance < 10 && distance < minDistance) {
        minDistance = distance;
        nearestPoint = { index: i, x: canvasPoint.x, y: canvasPoint.y };
      }
    }
    
    setHoveredPoint(nearestPoint);
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Clear canvas
    ctx.clearRect(0, 0, width, height);
    
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 40;
    
    // Draw Smith chart elements
    if (showGrid) {
      drawResistanceCircles(ctx, centerX, centerY, radius);
      drawReactanceCircles(ctx, centerX, centerY, radius);
    }
    
    drawBoundary(ctx, centerX, centerY, radius);
    drawTrace(ctx, centerX, centerY, radius);
    
  }, [impedanceReal, impedanceImag, width, height, showGrid, showLabels, referenceImpedance, hoveredPoint]);

  return (
    <div className={`smith-chart ${className}`}>
      {title && <h3 className="smith-chart-title">{title}</h3>}
      <div className="smith-chart-container">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          className="smith-chart-canvas"
        />
        
        {/* Tooltip */}
        {hoveredPoint && (
          <div 
            className="smith-chart-tooltip"
            style={{
              left: hoveredPoint.x + 10,
              top: hoveredPoint.y - 30
            }}
          >
            <div>Z = {impedanceReal[hoveredPoint.index]?.toFixed(2)} + j{impedanceImag[hoveredPoint.index]?.toFixed(2)} Ω</div>
            {frequency[hoveredPoint.index] && (
              <div>f = {(frequency[hoveredPoint.index] / 1e6).toFixed(1)} MHz</div>
            )}
          </div>
        )}
      </div>
      
      {/* Legend */}
      <div className="smith-chart-legend">
        <div className="legend-item">
          <span className="legend-color start"></span>
          <span>Start</span>
        </div>
        <div className="legend-item">
          <span className="legend-color trace"></span>
          <span>Trace</span>
        </div>
        <div className="legend-item">
          <span className="legend-color end"></span>
          <span>End</span>
        </div>
        <div className="legend-info">
          <span>Z₀ = {referenceImpedance} Ω</span>
        </div>
      </div>
    </div>
  );
};

export default SmithChart;