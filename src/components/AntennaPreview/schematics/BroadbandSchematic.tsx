import type { SchematicProps } from './types';
import { DimensionArrow } from './DimensionArrow';
import { FeedPointMarker } from './FeedPointMarker';

const CX = 180;
const CY = 120;

function VivaldiTSA({ params }: { params: Record<string, number> }) {
  const slotWidth = params.slot_width ?? 2;
  const taperLength = params.taper_length ?? 80;
  const openingWidth = params.opening_width ?? 60;
  const substrateW = params.substrate_width ?? 100;
  const substrateH = params.substrate_height ?? taperLength + 20;

  const halfSlot = Math.max(slotWidth * 0.5, 1);
  const halfOpening = Math.max(openingWidth * 0.5, 10);
  const sx = CX - substrateW / 2;
  const sy = CY - substrateH / 2;

  // Exponential taper: from narrow slot to wide opening
  const steps = 30;
  const topPoints: string[] = [];
  const bottomPoints: string[] = [];

  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = CX - taperLength / 2 + t * taperLength;
    // Exponential opening: starts at halfSlot, ends at halfOpening
    const expFactor = Math.exp(t * 3) / Math.exp(3);
    const yOff = halfSlot + (halfOpening - halfSlot) * expFactor;
    topPoints.push(`${x},${CY - yOff}`);
    bottomPoints.push(`${x},${CY + yOff}`);
  }

  const topPath = `M${topPoints.join(' L')}`;
  const bottomPath = `M${bottomPoints.join(' L')}`;

  return (
    <g>
      {/* Substrate */}
      <rect
        x={sx} y={sy}
        width={substrateW} height={substrateH}
        fill="#1e293b" stroke="#334155" strokeWidth={1}
        rx={2}
      />
      {/* Upper flare */}
      <path
        d={`${topPath} L${CX - taperLength / 2},${CY - halfSlot} L${CX - taperLength / 2},${sy} L${CX + taperLength / 2},${sy} L${CX + taperLength / 2},${CY - halfOpening} Z`}
        fill="#f97316" opacity={0.85}
      />
      {/* Lower flare */}
      <path
        d={`${bottomPath} L${CX - taperLength / 2},${CY + halfSlot} L${CX - taperLength / 2},${sy + substrateH} L${CX + taperLength / 2},${sy + substrateH} L${CX + taperLength / 2},${CY + halfOpening} Z`}
        fill="#f97316" opacity={0.85}
      />
      {/* Feed point at narrow end */}
      <FeedPointMarker x={CX - taperLength / 2} y={CY} />
      {/* Dimensions */}
      <DimensionArrow
        x1={CX - taperLength / 2} y1={sy - 12}
        x2={CX + taperLength / 2} y2={sy - 12}
        label={`${taperLength.toFixed(0)} mm`}
      />
      <DimensionArrow
        x1={CX + taperLength / 2 + 12} y1={CY - halfOpening}
        x2={CX + taperLength / 2 + 12} y2={CY + halfOpening}
        label={`${openingWidth.toFixed(0)} mm`}
      />
    </g>
  );
}

function BowTie({ params }: { params: Record<string, number> }) {
  const armLength = params.arm_length ?? 60;
  const flareAngle = params.flare_angle ?? 45;
  const gap = params.gap ?? 4;

  const halfGap = gap / 2;
  const rad = (flareAngle / 2) * (Math.PI / 180);
  const tipY = Math.sin(rad) * armLength;
  const tipX = Math.cos(rad) * armLength;

  return (
    <g>
      {/* Left triangle */}
      <polygon
        points={`
          ${CX - halfGap},${CY}
          ${CX - halfGap - tipX},${CY - tipY}
          ${CX - halfGap - tipX},${CY + tipY}
        `}
        fill="#0ea5e9" opacity={0.85}
        stroke="#0ea5e9" strokeWidth={1}
      />
      {/* Right triangle */}
      <polygon
        points={`
          ${CX + halfGap},${CY}
          ${CX + halfGap + tipX},${CY - tipY}
          ${CX + halfGap + tipX},${CY + tipY}
        `}
        fill="#0ea5e9" opacity={0.85}
        stroke="#0ea5e9" strokeWidth={1}
      />
      {/* Feed at center gap */}
      <FeedPointMarker x={CX} y={CY} />
      {/* Dimensions */}
      <DimensionArrow
        x1={CX - halfGap - tipX} y1={CY + tipY + 16}
        x2={CX + halfGap + tipX} y2={CY + tipY + 16}
        label={`${(2 * armLength + gap).toFixed(0)} mm`}
      />
      <DimensionArrow
        x1={CX + halfGap + tipX + 14} y1={CY - tipY}
        x2={CX + halfGap + tipX + 14} y2={CY + tipY}
        label={`${(2 * tipY).toFixed(0)} mm`}
      />
    </g>
  );
}

function Discone({ params }: { params: Record<string, number> }) {
  const discRadius = params.disc_radius ?? 50;
  const coneHeight = params.cone_height ?? 70;
  const coneBaseRadius = params.cone_base_radius ?? 55;

  const junctionY = CY - 10;

  return (
    <g>
      {/* Disc (horizontal flat element on top) */}
      <ellipse
        cx={CX} cy={junctionY - 4}
        rx={discRadius} ry={8}
        fill="#0ea5e9" opacity={0.7}
        stroke="#0ea5e9" strokeWidth={1.5}
      />
      {/* Cone below (inverted triangle) */}
      <polygon
        points={`
          ${CX},${junctionY}
          ${CX - coneBaseRadius},${junctionY + coneHeight}
          ${CX + coneBaseRadius},${junctionY + coneHeight}
        `}
        fill="#0ea5e9" opacity={0.5}
        stroke="#0ea5e9" strokeWidth={1.5}
      />
      {/* Vertical mast line */}
      <line
        x1={CX} y1={junctionY + coneHeight}
        x2={CX} y2={junctionY + coneHeight + 20}
        stroke="#64748b" strokeWidth={2}
      />
      {/* Feed at junction */}
      <FeedPointMarker x={CX} y={junctionY} />
      {/* Dimensions */}
      <DimensionArrow
        x1={CX - discRadius} y1={junctionY - 20}
        x2={CX + discRadius} y2={junctionY - 20}
        label={`${(discRadius * 2).toFixed(0)} mm`}
      />
      <DimensionArrow
        x1={CX + coneBaseRadius + 14} y1={junctionY}
        x2={CX + coneBaseRadius + 14} y2={junctionY + coneHeight}
        label={`${coneHeight.toFixed(0)} mm`}
      />
    </g>
  );
}

function Biconical({ params }: { params: Record<string, number> }) {
  const coneHeight = params.cone_height ?? 50;
  const coneRadius = params.cone_radius ?? 45;

  return (
    <g>
      {/* Upper cone (tip at center, base up) */}
      <polygon
        points={`
          ${CX},${CY}
          ${CX - coneRadius},${CY - coneHeight}
          ${CX + coneRadius},${CY - coneHeight}
        `}
        fill="#0ea5e9" opacity={0.6}
        stroke="#0ea5e9" strokeWidth={1.5}
      />
      {/* Lower cone (tip at center, base down) */}
      <polygon
        points={`
          ${CX},${CY}
          ${CX - coneRadius},${CY + coneHeight}
          ${CX + coneRadius},${CY + coneHeight}
        `}
        fill="#0ea5e9" opacity={0.6}
        stroke="#0ea5e9" strokeWidth={1.5}
      />
      {/* Feed at center junction */}
      <FeedPointMarker x={CX} y={CY} />
      {/* Dimensions */}
      <DimensionArrow
        x1={CX - coneRadius} y1={CY + coneHeight + 16}
        x2={CX + coneRadius} y2={CY + coneHeight + 16}
        label={`${(coneRadius * 2).toFixed(0)} mm`}
      />
      <DimensionArrow
        x1={CX + coneRadius + 14} y1={CY - coneHeight}
        x2={CX + coneRadius + 14} y2={CY + coneHeight}
        label={`${(coneHeight * 2).toFixed(0)} mm`}
      />
    </g>
  );
}

export function BroadbandSchematic({
  params,
  antennaType,
}: SchematicProps & { antennaType: string }) {
  const renderer = (() => {
    switch (antennaType) {
      case 'vivaldi_tsa':
        return <VivaldiTSA params={params} />;
      case 'bow_tie':
        return <BowTie params={params} />;
      case 'discone':
        return <Discone params={params} />;
      case 'biconical':
        return <Biconical params={params} />;
      default:
        return (
          <text x={CX} y={CY} textAnchor="middle" fill="#64748b" fontSize={14}>
            Unknown: {antennaType}
          </text>
        );
    }
  })();

  return (
    <svg viewBox="0 0 360 240" xmlns="http://www.w3.org/2000/svg">
      <rect width={360} height={240} fill="transparent" />
      {renderer}
    </svg>
  );
}
