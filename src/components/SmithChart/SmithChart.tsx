import { useRef, useEffect, useState } from 'react';
import type { FC } from 'react';

interface SmithChartProps {
  impedanceReal: number[];
  impedanceImag: number[];
  frequency?: number[];
  width?: number;
  height?: number;
  className?: string;
  showGrid?: boolean;
  showLabels?: boolean;
  referenceImpedance?: number;
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

  const impedanceToGamma = (real: number, imag: number): Point => {
    const z = { real: real / referenceImpedance, imag: imag / referenceImpedance };
    const denominator = (1 + z.real) ** 2 + z.imag ** 2;
    if (denominator === 0) return { x: 1, y: 0 };
    return {
      x: ((z.real ** 2 + z.imag ** 2 - 1)) / denominator,
      y: (2 * z.imag) / denominator,
    };
  };

  const gammaToCanvas = (gamma: Point, centerX: number, centerY: number, radius: number): Point => ({
    x: centerX + gamma.x * radius,
    y: centerY - gamma.y * radius,
  });

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
      if (showLabels) {
        ctx.fillStyle = '#555';
        ctx.font = '10px Arial';
        ctx.fillText(r.toString(), circleX + circleRadius - 10, centerY - 5);
      }
    });
  };

  const drawReactanceCircles = (ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number) => {
    const reactanceValues = [0.2, 0.5, 1, 2, 5];
    ctx.strokeStyle = '#2a2a3e';
    ctx.lineWidth = 1;
    reactanceValues.forEach(x => {
      const circleRadius = radius / x;
      ctx.beginPath();
      ctx.arc(centerX + radius, centerY - radius / x, circleRadius, 0, 2 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(centerX + radius, centerY + radius / x, circleRadius, 0, 2 * Math.PI);
      ctx.stroke();
      if (showLabels) {
        ctx.fillStyle = '#555';
        ctx.font = '10px Arial';
        ctx.fillText(`+j${x}`, centerX + radius - 15, centerY - radius / x - circleRadius + 10);
        ctx.fillText(`-j${x}`, centerX + radius - 15, centerY + radius / x + circleRadius - 5);
      }
    });
  };

  const drawBoundary = (ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number) => {
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(centerX - radius, centerY);
    ctx.lineTo(centerX + radius, centerY);
    ctx.stroke();
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

  const drawTrace = (ctx: CanvasRenderingContext2D, centerX: number, centerY: number, radius: number) => {
    if (impedanceReal.length === 0 || impedanceImag.length === 0) return;
    const points: Point[] = [];
    for (let i = 0; i < Math.min(impedanceReal.length, impedanceImag.length); i++) {
      const gamma = impedanceToGamma(impedanceReal[i], impedanceImag[i]);
      points.push(gammaToCanvas(gamma, centerX, centerY, radius));
    }
    if (points.length === 0) return;

    ctx.strokeStyle = '#6366f1';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();

    points.forEach((point, index) => {
      ctx.fillStyle = index === 0 ? '#22c55e' : index === points.length - 1 ? '#ef4444' : '#6366f1';
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3, 0, 2 * Math.PI);
      ctx.fill();
      if (hoveredPoint && hoveredPoint.index === index) {
        ctx.strokeStyle = '#FF9800';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
        ctx.stroke();
      }
    });
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 40;

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 2 - 40;
    if (showGrid) {
      drawResistanceCircles(ctx, centerX, centerY, radius);
      drawReactanceCircles(ctx, centerX, centerY, radius);
    }
    drawBoundary(ctx, centerX, centerY, radius);
    drawTrace(ctx, centerX, centerY, radius);
  }, [impedanceReal, impedanceImag, width, height, showGrid, showLabels, referenceImpedance, hoveredPoint]);

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {title && <h3 className="text-sm font-semibold text-text mb-3 text-center">{title}</h3>}
      <div className="relative inline-block">
        <canvas
          ref={canvasRef}
          width={width}
          height={height}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoveredPoint(null)}
          className="border border-border rounded hover:border-accent cursor-crosshair bg-background"
        />

        {hoveredPoint && (
          <div
            className="absolute bg-surface/95 text-text px-3 py-2 border border-border rounded-md text-xs font-mono pointer-events-none z-50 whitespace-nowrap shadow-lg"
            style={{ left: hoveredPoint.x + 10, top: hoveredPoint.y - 30 }}
          >
            <div>Z = {impedanceReal[hoveredPoint.index]?.toFixed(2)} + j{impedanceImag[hoveredPoint.index]?.toFixed(2)} &Omega;</div>
            {frequency[hoveredPoint.index] && (
              <div>f = {(frequency[hoveredPoint.index] / 1e6).toFixed(1)} MHz</div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-4 mt-3 text-xs text-text-dim">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-success inline-block" />
          <span>Start</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-accent inline-block" />
          <span>Trace</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-error inline-block" />
          <span>End</span>
        </div>
        <div className="ml-auto font-mono text-[11px] text-text-dim">
          Z&#8320; = {referenceImpedance} &Omega;
        </div>
      </div>
    </div>
  );
};

export default SmithChart;
