import { useState, useMemo, useCallback } from 'react';
import type { FC, JSX } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';

interface ImpedancePoint {
  re: number;
  im: number;
  freq: number;
}

interface SmithChartProps {
  impedancePoints: ImpedancePoint[];
  referenceImpedance?: number;
  className?: string;
}

interface GammaPoint {
  real: number;
  imag: number;
}

interface TooltipData {
  x: number;
  y: number;
  impedance: { re: number; im: number };
  gamma: GammaPoint;
  vswr: number;
  freq: number;
}

const SVG_SIZE = 400;
const CENTER = SVG_SIZE / 2;
const RADIUS = 170;
const POINT_RADIUS = 5;

const RESISTANCE_VALUES = [0, 0.5, 1, 2, 5];
const REACTANCE_VALUES = [0.5, 1, 2, 5];
const VSWR_VALUES = [1.5, 2, 3];

function impedanceToGamma(re: number, im: number, z0: number): GammaPoint {
  const zr = re / z0;
  const zi = im / z0;
  const denom = (zr + 1) ** 2 + zi ** 2;
  if (denom === 0) return { real: 1, imag: 0 };
  return {
    real: (zr * zr + zi * zi - 1) / denom,
    imag: (2 * zi) / denom,
  };
}

function gammaToImpedance(gamma: GammaPoint, z0: number): { re: number; im: number } {
  const denom = (1 - gamma.real) ** 2 + gamma.imag ** 2;
  if (denom === 0) return { re: Infinity, im: 0 };
  const zr = ((1 - gamma.real ** 2 - gamma.imag ** 2) / denom) * z0;
  const zi = ((2 * gamma.imag) / denom) * z0;
  return { re: zr, im: zi };
}

function gammaToSvg(gamma: GammaPoint): { x: number; y: number } {
  return {
    x: CENTER + gamma.real * RADIUS,
    y: CENTER - gamma.imag * RADIUS,
  };
}

function svgToGamma(x: number, y: number): GammaPoint {
  return {
    real: (x - CENTER) / RADIUS,
    imag: -(y - CENTER) / RADIUS,
  };
}

function gammaMagnitude(g: GammaPoint): number {
  return Math.sqrt(g.real ** 2 + g.imag ** 2);
}

function calcVSWR(g: GammaPoint): number {
  const mag = gammaMagnitude(g);
  if (mag >= 1) return Infinity;
  return (1 + mag) / (1 - mag);
}

function freqToColor(freq: number, minFreq: number, maxFreq: number): string {
  if (minFreq === maxFreq) return 'hsl(220, 90%, 60%)';
  const t = (freq - minFreq) / (maxFreq - minFreq);
  const hue = 260 - t * 220; // purple -> red
  return `hsl(${hue}, 85%, 55%)`;
}

function formatFreq(hz: number): string {
  if (hz >= 1e9) return `${(hz / 1e9).toFixed(3)} GHz`;
  if (hz >= 1e6) return `${(hz / 1e6).toFixed(3)} MHz`;
  if (hz >= 1e3) return `${(hz / 1e3).toFixed(1)} kHz`;
  return `${hz} Hz`;
}

function findCircleUnitCircleIntersections(cx: number, cy: number, r: number): { angle1: number; angle2: number } | null {
  const d = Math.sqrt(cx * cx + cy * cy);
  const unitR = 1;
  
  if (d > r + unitR + 1e-9 || d < Math.abs(r - unitR) - 1e-9) {
    return null;
  }
  
  const a = (unitR * unitR - r * r + d * d) / (2 * d);
  const hSq = unitR * unitR - a * a;
  if (hSq < 0) return null;
  const h = Math.sqrt(Math.max(0, hSq));
  
  const px = (a * cx) / d;
  const py = (a * cy) / d;
  
  const ix1 = px + (h * cy) / d;
  const iy1 = py - (h * cx) / d;
  const ix2 = px - (h * cy) / d;
  const iy2 = py + (h * cx) / d;
  
  const angle1 = Math.atan2(iy1, ix1);
  const angle2 = Math.atan2(iy2, ix2);
  
  return { angle1, angle2 };
}

function clipCircleToUnitCircle(cx: number, cy: number, r: number): string | null {
  const d = Math.sqrt(cx * cx + cy * cy);
  const unitR = 1;

  if (d > r + unitR + 1e-9 || d < Math.abs(r - unitR) - 1e-9) {
    if (r + d <= unitR + 1e-9) {
      const svgCx = CENTER + cx * RADIUS;
      const svgCy = CENTER - cy * RADIUS;
      const svgR = r * RADIUS;
      return `M ${svgCx + svgR} ${svgCy} A ${svgR} ${svgR} 0 1 1 ${svgCx - svgR} ${svgCy} A ${svgR} ${svgR} 0 1 1 ${svgCx + svgR} ${svgCy}`;
    }
    return null;
  }

  const intersections = findCircleUnitCircleIntersections(cx, cy, r);
  if (!intersections) return null;
  
  const { angle1, angle2 } = intersections;
  
  const ix1 = Math.cos(angle1);
  const iy1 = Math.sin(angle1);
  const ix2 = Math.cos(angle2);
  const iy2 = Math.sin(angle2);
  
  let startAngle = angle1;
  let endAngle = angle2;
  
  const testArc = (sa: number, ea: number, largeArc: boolean) => {
    const mid = largeArc
      ? sa + ((ea - sa + 3 * Math.PI) % (2 * Math.PI)) / 2 + Math.PI
      : sa + ((ea - sa + 2 * Math.PI) % (2 * Math.PI)) / 2;
    const mx = cx + r * Math.cos(mid);
    const my = cy + r * Math.sin(mid);
    return mx * mx + my * my <= unitR * unitR + 1e-6;
  };

  let largeArc = false;
  if (!testArc(startAngle, endAngle, false)) {
    largeArc = true;
  }

  const svgX1 = CENTER + ix1 * RADIUS;
  const svgY1 = CENTER - iy1 * RADIUS;
  const svgX2 = CENTER + ix2 * RADIUS;
  const svgY2 = CENTER - iy2 * RADIUS;
  const svgR = r * RADIUS;
  const largeArcFlag = largeArc ? 1 : 0;

  return `M ${svgX1} ${svgY1} A ${svgR} ${svgR} 0 ${largeArcFlag} 1 ${svgX2} ${svgY2}`;
}

const VSWRCircles: FC = () => (
  <g className="stroke-border" strokeWidth={0.5} fill="none" strokeDasharray="3 2">
    {VSWR_VALUES.map((vswr) => {
      const r = (vswr - 1) / (vswr + 1);
      const svgR = r * RADIUS;
      return (
        <circle
          key={`vswr-${vswr}`}
          cx={CENTER}
          cy={CENTER}
          r={svgR}
        />
      );
    })}
  </g>
);

const ConstantResistanceCircles: FC = () => (
  <g className="stroke-border" strokeWidth={0.5} fill="none">
    {RESISTANCE_VALUES.map((r) => {
      const cx = r / (r + 1);
      const cy = 0;
      const cr = 1 / (r + 1);
      const path = clipCircleToUnitCircle(cx, cy, cr);
      return path ? <path key={`r-${r}`} d={path} /> : null;
    })}
  </g>
);

const ConstantReactanceArcs: FC = () => (
  <g className="stroke-border" strokeWidth={0.5} fill="none" strokeDasharray="4 3">
    {REACTANCE_VALUES.flatMap((x) => {
      const arcs: JSX.Element[] = [];
      const pathPos = clipCircleToUnitCircle(1, 1 / x, 1 / x);
      if (pathPos) arcs.push(<path key={`x+${x}`} d={pathPos} />);
      const pathNeg = clipCircleToUnitCircle(1, -1 / x, 1 / x);
      if (pathNeg) arcs.push(<path key={`x-${x}`} d={pathNeg} />);
      return arcs;
    })}
  </g>
);

const GridLabels: FC = () => {
  const resistanceLabels = RESISTANCE_VALUES.map((r) => {
    const svgX = CENTER + (r / (r + 1) - 1 / (r + 1)) * RADIUS;
    return (
      <text
        key={`rl-${r}`}
        x={svgX}
        y={CENTER + 12}
        className="fill-text-dim text-[9px]"
        textAnchor="middle"
      >
        {r}
      </text>
    );
  });

  const reactanceLabels = REACTANCE_VALUES.flatMap((x) => {
    const angle = 2 * Math.atan(1 / x);
    const lx = CENTER + Math.cos(angle) * RADIUS;
    const lyPos = CENTER - Math.sin(angle) * RADIUS;
    const lyNeg = CENTER + Math.sin(angle) * RADIUS;
    return [
      <text key={`xl+${x}`} x={lx + 4} y={lyPos - 2} className="fill-text-dim text-[9px]">
        +j{x}
      </text>,
      <text key={`xl-${x}`} x={lx + 4} y={lyNeg + 10} className="fill-text-dim text-[9px]">
        -j{x}
      </text>,
    ];
  });

  const vswrLabels = VSWR_VALUES.map((vswr) => {
    const r = (vswr - 1) / (vswr + 1);
    const svgX = CENTER + r * RADIUS;
    return (
      <text
        key={`vswr-${vswr}`}
        x={svgX}
        y={CENTER - 8}
        className="fill-text-dim text-[8px]"
        textAnchor="middle"
      >
        {vswr}:1
      </text>
    );
  });

  return <g>{resistanceLabels}{reactanceLabels}{vswrLabels}</g>;
};

const SmithChart: FC<SmithChartProps> = ({
  impedancePoints,
  referenceImpedance = 50,
  className = '',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  const { minFreq, maxFreq } = useMemo(() => {
    if (impedancePoints.length === 0) return { minFreq: 0, maxFreq: 0 };
    const freqs = impedancePoints.map((p) => p.freq);
    return { minFreq: Math.min(...freqs), maxFreq: Math.max(...freqs) };
  }, [impedancePoints]);

  const plotData = useMemo(
    () =>
      impedancePoints.map((p) => {
        const gamma = impedanceToGamma(p.re, p.im, referenceImpedance);
        const svg = gammaToSvg(gamma);
        const color = freqToColor(p.freq, minFreq, maxFreq);
        const vswr = calcVSWR(gamma);
        return { ...p, gamma, svg, color, vswr };
      }),
    [impedancePoints, referenceImpedance, minFreq, maxFreq]
  );

  const frequencyLabels = useMemo(() => {
    if (plotData.length < 10) return [];
    const labels: Array<{ x: number; y: number; freq: number }> = [];
    for (let i = 0; i < plotData.length; i += 10) {
      const point = plotData[i];
      labels.push({
        x: point.svg.x,
        y: point.svg.y,
        freq: point.freq,
      });
    }
    return labels;
  }, [plotData]);

  const handleMouseEnter = useCallback((i: number) => setHoveredIdx(i), []);
  const handleMouseLeave = useCallback(() => setHoveredIdx(null), []);

  const handleMouseMove = useCallback((event: React.MouseEvent<SVGSVGElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - rect.left) / rect.width) * SVG_SIZE;
    const svgY = ((event.clientY - rect.top) / rect.height) * SVG_SIZE;
    
    const gamma = svgToGamma(svgX, svgY);
    const gammaDistance = Math.sqrt(gamma.real ** 2 + gamma.imag ** 2);
    
    if (gammaDistance > 1.05) {
      setTooltip(null);
      return;
    }
    
    let nearestIdx = -1;
    let minDistance = Infinity;
    
    plotData.forEach((point, idx) => {
      const dx = point.svg.x - svgX;
      const dy = point.svg.y - svgY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < minDistance) {
        minDistance = distance;
        nearestIdx = idx;
      }
    });
    
    if (nearestIdx >= 0 && minDistance < 20) {
      const point = plotData[nearestIdx];
      setTooltip({
        x: svgX,
        y: svgY,
        impedance: { re: point.re, im: point.im },
        gamma: point.gamma,
        vswr: point.vswr,
        freq: point.freq,
      });
    } else {
      const impedance = gammaToImpedance(gamma, referenceImpedance);
      const vswr = calcVSWR(gamma);
      setTooltip({
        x: svgX,
        y: svgY,
        impedance,
        gamma,
        vswr,
        freq: 0,
      });
    }
  }, [plotData, referenceImpedance]);

  const handleMouseLeaveChart = useCallback(() => {
    setTooltip(null);
  }, []);

  const hovered = hoveredIdx !== null ? plotData[hoveredIdx] : null;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">Smith Chart</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative flex justify-center">
          <svg
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            className="w-full max-w-[500px] aspect-square"
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeaveChart}
          >
            {/* Background */}
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              className="fill-surface/30 stroke-border"
              strokeWidth={1.5}
            />

            {/* Horizontal axis */}
            <line
              x1={CENTER - RADIUS}
              y1={CENTER}
              x2={CENTER + RADIUS}
              y2={CENTER}
              className="stroke-border"
              strokeWidth={0.8}
            />

            {/* VSWR circles */}
            <VSWRCircles />

            {/* Grid */}
            <ConstantResistanceCircles />
            <ConstantReactanceArcs />
            <GridLabels />

            {/* Impedance trace line */}
            {plotData.length > 1 && (
              <polyline
                points={plotData.map((p) => `${p.svg.x},${p.svg.y}`).join(' ')}
                fill="none"
                stroke="var(--chart-1, #3b82f6)"
                strokeOpacity={0.6}
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
            )}

            {/* Frequency labels */}
            {frequencyLabels.map((label, idx) => (
              <text
                key={`freq-${idx}`}
                x={label.x + 8}
                y={label.y - 8}
                className="fill-text-muted text-[8px] font-mono"
                textAnchor="start"
              >
                {formatFreq(label.freq)}
              </text>
            ))}

            {/* Data points */}
            {plotData.map((p, i) => (
              <circle
                key={i}
                cx={p.svg.x}
                cy={p.svg.y}
                r={hoveredIdx === i ? POINT_RADIUS * 1.6 : POINT_RADIUS}
                fill={p.color}
                className="cursor-pointer transition-all duration-100"
                stroke={hoveredIdx === i ? '#fff' : 'none'}
                strokeWidth={hoveredIdx === i ? 2 : 0}
                onMouseEnter={() => handleMouseEnter(i)}
                onMouseLeave={handleMouseLeave}
              />
            ))}

            {/* Unit circle labels */}
            <text x={CENTER - RADIUS - 14} y={CENTER + 4} className="fill-text-dim text-[11px]" textAnchor="end">
              0
            </text>
            <text x={CENTER + RADIUS + 8} y={CENTER + 4} className="fill-text-dim text-[11px]">
              ∞
            </text>
          </svg>

          {/* Hover tooltip */}
          {hovered && (
            <div
              className="absolute pointer-events-none z-50 rounded-md border border-border bg-elevated px-3 py-2 text-xs font-mono text-text shadow-lg whitespace-nowrap"
              style={{
                left: `${(hovered.svg.x / SVG_SIZE) * 100}%`,
                top: `${(hovered.svg.y / SVG_SIZE) * 100}%`,
                transform: 'translate(12px, -50%)',
              }}
            >
              <div className="font-semibold text-text">
                Z = {hovered.re.toFixed(2)} {hovered.im >= 0 ? '+' : '-'} j{Math.abs(hovered.im).toFixed(2)} Ω
              </div>
              <div className="text-text-dim">f = {formatFreq(hovered.freq)}</div>
              <div className="text-text-dim">
                VSWR = {hovered.vswr === Infinity ? '∞' : hovered.vswr.toFixed(2)}:1
              </div>
              <div className="text-text-dim">
                |Γ| = {gammaMagnitude(hovered.gamma).toFixed(4)}
              </div>
            </div>
          )}

          {/* Mouse tooltip */}
          {tooltip && (
            <div
              className="absolute pointer-events-none z-40 rounded-md border border-border bg-elevated px-2 py-1 text-xs font-mono text-text shadow-md whitespace-nowrap"
              style={{
                left: `${(tooltip.x / SVG_SIZE) * 100}%`,
                top: `${(tooltip.y / SVG_SIZE) * 100}%`,
                transform: 'translate(8px, -100%)',
              }}
            >
              <div>
                Z = {tooltip.impedance.re.toFixed(1)} {tooltip.impedance.im >= 0 ? '+' : '-'} j{Math.abs(tooltip.impedance.im).toFixed(1)} Ω
              </div>
              <div>
                |Γ| = {gammaMagnitude(tooltip.gamma).toFixed(3)}
              </div>
              <div>
                VSWR = {tooltip.vswr === Infinity ? '∞' : tooltip.vswr.toFixed(1)}:1
              </div>
              {tooltip.freq > 0 && (
                <div>f = {formatFreq(tooltip.freq)}</div>
              )}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center justify-between text-xs text-text-dim">
          <div className="flex items-center gap-2">
            <span>Z₀ = {referenceImpedance} Ω</span>
            <span className="text-border">·</span>
            <span>{impedancePoints.length} points</span>
          </div>
          {impedancePoints.length > 0 && (
            <div className="flex items-center gap-1.5">
              <div
                className="h-2 w-16 rounded-sm"
                style={{
                  background: `linear-gradient(to right, ${freqToColor(minFreq, minFreq, maxFreq)}, ${freqToColor(maxFreq, minFreq, maxFreq)})`,
                }}
              />
              <span className="text-xs text-text-dim">freq</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SmithChart;