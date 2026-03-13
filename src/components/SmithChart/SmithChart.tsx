import { useState, useMemo, useCallback } from 'react';
import type { FC } from 'react';
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

const SVG_SIZE = 400;
const CENTER = SVG_SIZE / 2;
const RADIUS = 170;
const POINT_RADIUS = 5;

const RESISTANCE_VALUES = [0, 0.5, 1, 2, 5];
const REACTANCE_VALUES = [0.5, 1, 2, 5];

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

function gammaToSvg(gamma: GammaPoint): { x: number; y: number } {
  return {
    x: CENTER + gamma.real * RADIUS,
    y: CENTER - gamma.imag * RADIUS,
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

/** Clip a circle (cx, cy, r) to the unit circle and return an SVG arc path inside it. */
function clipCircleToUnitCircle(
  cx: number,
  cy: number,
  r: number
): string | null {
  const d = Math.sqrt(cx * cx + cy * cy);
  const unitR = 1; // unit circle radius

  // No intersection check
  if (d > r + unitR + 1e-9 || d < Math.abs(r - unitR) - 1e-9) {
    // Fully inside or fully outside
    if (r + d <= unitR + 1e-9) {
      // Circle fully inside unit circle — draw the whole circle
      const svgCx = CENTER + cx * RADIUS;
      const svgCy = CENTER - cy * RADIUS;
      const svgR = r * RADIUS;
      return `M ${svgCx + svgR} ${svgCy} A ${svgR} ${svgR} 0 1 1 ${svgCx - svgR} ${svgCy} A ${svgR} ${svgR} 0 1 1 ${svgCx + svgR} ${svgCy}`;
    }
    return null;
  }

  // Find intersection points
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

  // We want the arc of the inner circle that lies inside the unit circle.
  // The midpoint of the arc inside the unit circle should be inside the unit circle.
  const midAngle1 = Math.atan2(iy1 - cy, ix1 - cx);
  const midAngle2 = Math.atan2(iy2 - cy, ix2 - cx);

  // Choose the arc that is inside the unit circle
  let startAngle = midAngle1;
  let endAngle = midAngle2;

  // Test midpoint of arc going from startAngle to endAngle
  const testArc = (sa: number, ea: number, largeArc: boolean) => {
    const mid = largeArc
      ? sa + ((ea - sa + 3 * Math.PI) % (2 * Math.PI)) / 2 + Math.PI
      : sa + ((ea - sa + 2 * Math.PI) % (2 * Math.PI)) / 2;
    const mx = cx + r * Math.cos(mid);
    const my = cy + r * Math.sin(mid);
    return mx * mx + my * my <= unitR * unitR + 1e-6;
  };

  // Determine sweep: we try small arc first
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

  // SVG y is flipped, so sweep direction inverts
  return `M ${svgX1} ${svgY1} A ${svgR} ${svgR} 0 ${largeArcFlag} 1 ${svgX2} ${svgY2}`;
}

const ConstantResistanceCircles: FC = () => (
  <g className="stroke-zinc-600 dark:stroke-zinc-500" strokeWidth={0.5} fill="none">
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
  <g className="stroke-zinc-600 dark:stroke-zinc-500" strokeWidth={0.5} fill="none" strokeDasharray="4 3">
    {REACTANCE_VALUES.flatMap((x) => {
      const arcs: JSX.Element[] = [];
      // Positive reactance: center (1, 1/x), radius 1/|x|
      const pathPos = clipCircleToUnitCircle(1, 1 / x, 1 / x);
      if (pathPos) arcs.push(<path key={`x+${x}`} d={pathPos} />);
      // Negative reactance: center (1, -1/x), radius 1/|x|
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
        className="fill-zinc-500 text-[9px]"
        textAnchor="middle"
      >
        {r}
      </text>
    );
  });

  const reactanceLabels = REACTANCE_VALUES.flatMap((x) => {
    // Label near the unit circle boundary at the reactance arc intersection
    const angle = 2 * Math.atan(1 / x);
    const lx = CENTER + Math.cos(angle) * RADIUS;
    const lyPos = CENTER - Math.sin(angle) * RADIUS;
    const lyNeg = CENTER + Math.sin(angle) * RADIUS;
    return [
      <text key={`xl+${x}`} x={lx + 4} y={lyPos - 2} className="fill-zinc-500 text-[9px]">
        +j{x}
      </text>,
      <text key={`xl-${x}`} x={lx + 4} y={lyNeg + 10} className="fill-zinc-500 text-[9px]">
        -j{x}
      </text>,
    ];
  });

  return <g>{resistanceLabels}{reactanceLabels}</g>;
};

const SmithChart: FC<SmithChartProps> = ({
  impedancePoints,
  referenceImpedance = 50,
  className = '',
}) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

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

  const handleMouseEnter = useCallback((i: number) => setHoveredIdx(i), []);
  const handleMouseLeave = useCallback(() => setHoveredIdx(null), []);

  const hovered = hoveredIdx !== null ? plotData[hoveredIdx] : null;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Smith Chart</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative flex justify-center">
          <svg
            viewBox={`0 0 ${SVG_SIZE} ${SVG_SIZE}`}
            className="w-full max-w-[500px] aspect-square"
          >
            {/* Background */}
            <circle
              cx={CENTER}
              cy={CENTER}
              r={RADIUS}
              className="fill-zinc-950/30 stroke-zinc-400 dark:stroke-zinc-500"
              strokeWidth={1.5}
            />

            {/* Horizontal axis */}
            <line
              x1={CENTER - RADIUS}
              y1={CENTER}
              x2={CENTER + RADIUS}
              y2={CENTER}
              className="stroke-zinc-500"
              strokeWidth={0.8}
            />

            {/* Grid */}
            <ConstantResistanceCircles />
            <ConstantReactanceArcs />
            <GridLabels />

            {/* Impedance trace line */}
            {plotData.length > 1 && (
              <polyline
                points={plotData.map((p) => `${p.svg.x},${p.svg.y}`).join(' ')}
                fill="none"
                className="stroke-indigo-400/60"
                strokeWidth={1.5}
                strokeLinejoin="round"
              />
            )}

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
            <text x={CENTER - RADIUS - 14} y={CENTER + 4} className="fill-zinc-400 text-[11px]" textAnchor="end">
              0
            </text>
            <text x={CENTER + RADIUS + 8} y={CENTER + 4} className="fill-zinc-400 text-[11px]">
              ∞
            </text>
          </svg>

          {/* Tooltip */}
          {hovered && (
            <div
              className="absolute pointer-events-none z-50 rounded-md border border-zinc-700 bg-zinc-900/95 px-3 py-2 text-xs font-mono text-zinc-200 shadow-lg whitespace-nowrap"
              style={{
                left: `${(hovered.svg.x / SVG_SIZE) * 100}%`,
                top: `${(hovered.svg.y / SVG_SIZE) * 100}%`,
                transform: 'translate(12px, -50%)',
              }}
            >
              <div className="font-semibold text-zinc-100">
                Z = {hovered.re.toFixed(2)} {hovered.im >= 0 ? '+' : '-'} j{Math.abs(hovered.im).toFixed(2)} Ω
              </div>
              <div className="text-zinc-400">f = {formatFreq(hovered.freq)}</div>
              <div className="text-zinc-400">
                VSWR = {hovered.vswr === Infinity ? '∞' : hovered.vswr.toFixed(2)}:1
              </div>
              <div className="text-zinc-400">
                |Γ| = {gammaMagnitude(hovered.gamma).toFixed(4)}
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
          <div className="flex items-center gap-2">
            <span>Z₀ = {referenceImpedance} Ω</span>
            <span className="text-zinc-600">·</span>
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
              <span className="text-[10px]">freq</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SmithChart;
