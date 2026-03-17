import type { SchematicProps } from './types';
import { DimensionArrow } from './DimensionArrow';
import { FeedPointMarker } from './FeedPointMarker';

const CX = 180;
const CY = 120;

function buildSpiralPath(
  cx: number,
  cy: number,
  a: number,
  b: number,
  thetaMax: number,
  thetaOffset: number,
  steps: number,
): string {
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const theta = thetaOffset + (thetaMax * i) / steps;
    const r = a + b * theta;
    const x = cx + r * Math.cos(theta);
    const y = cy + r * Math.sin(theta);
    points.push(i === 0 ? `M${x},${y}` : `L${x},${y}`);
  }
  return points.join(' ');
}

export function SpiralSchematic({ params }: SchematicProps) {
  const outerDiameter = params.outer_diameter ?? 100;
  const numTurns = params.num_turns ?? 3;
  const innerRadius = params.inner_radius ?? 2;

  const thetaMax = numTurns * 2 * Math.PI;
  const maxRadius = outerDiameter / 2;
  // r = a + b*theta => at theta=0: r=a=innerRadius, at theta=thetaMax: r=maxRadius
  const a = innerRadius;
  const b = (maxRadius - innerRadius) / thetaMax;
  const steps = Math.max(100, numTurns * 60);

  // Scale to fit viewBox with some padding
  const scaledMaxR = Math.min(CX - 30, CY - 30);
  const scale = maxRadius > 0 ? scaledMaxR / maxRadius : 1;

  const arm1 = buildSpiralPath(CX, CY, a * scale, b * scale, thetaMax, 0, steps);
  const arm2 = buildSpiralPath(CX, CY, a * scale, b * scale, thetaMax, Math.PI, steps);

  const displayR = scaledMaxR;

  return (
    <svg viewBox="0 0 360 240" xmlns="http://www.w3.org/2000/svg">
      <rect width={360} height={240} fill="transparent" />

      {/* Spiral arm 1 */}
      <path
        d={arm1}
        fill="none"
        stroke="#a855f7"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      {/* Spiral arm 2 */}
      <path
        d={arm2}
        fill="none"
        stroke="#a855f7"
        strokeWidth={2.5}
        strokeLinecap="round"
        opacity={0.7}
      />

      {/* Outer diameter circle (reference) */}
      <circle
        cx={CX} cy={CY} r={displayR}
        fill="none"
        stroke="#475569"
        strokeWidth={0.5}
        strokeDasharray="4,3"
      />

      {/* Feed point at center */}
      <FeedPointMarker x={CX} y={CY} />

      {/* Dimension: outer diameter */}
      <DimensionArrow
        x1={CX - displayR} y1={CY + displayR + 16}
        x2={CX + displayR} y2={CY + displayR + 16}
        label={`${outerDiameter.toFixed(0)} mm`}
      />
    </svg>
  );
}
