import type { SchematicProps } from './types';
import { DimensionArrow } from './DimensionArrow';
import { FeedPointMarker } from './FeedPointMarker';

const METAL = '#64748b';
const SLOT_OPENING = '#0f172a';

interface SlotSchematicProps extends SchematicProps {
  antennaType: string;
}

function RectangularSlot({ params }: Pick<SlotSchematicProps, 'params'>) {
  const slotL = params.slot_length ?? params.length ?? 50;
  const slotW = params.slot_width ?? params.width ?? 6;

  const plateX = 50;
  const plateY = 30;
  const plateW = 260;
  const plateH = 180;

  const cx = plateX + plateW / 2;
  const cy = plateY + plateH / 2;

  const maxScaleL = (plateW - 80) / Math.max(slotL, 1);
  const maxScaleW = (plateH - 60) / Math.max(slotW, 1);
  const scale = Math.min(maxScaleL, maxScaleW, 4);

  const sL = slotL * scale;
  const sW = Math.max(slotW * scale, 4);

  const slotX = cx - sL / 2;
  const slotY = cy - sW / 2;

  return (
    <g>
      <rect x={plateX} y={plateY} width={plateW} height={plateH} rx={3} fill={METAL} opacity={0.8} />

      <rect x={slotX} y={slotY} width={sL} height={sW} rx={1} fill={SLOT_OPENING} />

      <DimensionArrow
        x1={slotX} y1={slotY - 2}
        x2={slotX + sL} y2={slotY - 2}
        label={`L=${slotL.toFixed(1)}`}
        offset={-14}
      />
      <DimensionArrow
        x1={slotX + sL + 4} y1={slotY}
        x2={slotX + sL + 4} y2={slotY + sW}
        label={`W=${slotW.toFixed(1)}`}
        offset={14}
      />

      <FeedPointMarker x={cx} y={cy + sW / 2 + 16} size={5} />
      <line x1={cx} y1={cy + sW / 2} x2={cx} y2={cy + sW / 2 + 12} stroke="#ef4444" strokeWidth={1.5} />

      <text x={plateX + plateW / 2} y={plateY + plateH + 16} textAnchor="middle" fill={METAL} fontSize={9} fontFamily="monospace">
        Ground Plane (top view)
      </text>
    </g>
  );
}

function ParabolicReflector({ params }: Pick<SlotSchematicProps, 'params'>) {
  const diameter = params.diameter ?? 100;
  const focalLength = params.focal_length ?? 40;

  const cx = 200;
  const baseY = 200;

  const maxScaleD = 170 / Math.max(diameter, 1);
  const maxScaleF = 120 / Math.max(focalLength, 1);
  const scale = Math.min(maxScaleD, maxScaleF, 2.5);

  const dScaled = diameter * scale;
  const fScaled = focalLength * scale;

  const dishTop = baseY - dScaled / 2;
  const dishCenterY = baseY - dScaled / 2 + dScaled / 2;

  const halfD = dScaled / 2;
  const dishX = cx - fScaled;

  const steps = 40;
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = -1 + (2 * i) / steps;
    const yOff = t * halfD;
    const xOff = (yOff * yOff) / (4 * fScaled);
    points.push(`${dishX + xOff},${dishCenterY + yOff}`);
  }
  const dishPath = `M ${points.join(' L ')}`;

  const focalX = dishX + fScaled;
  const focalY = dishCenterY;

  return (
    <g>
      <path d={dishPath} fill="none" stroke={METAL} strokeWidth={3} strokeLinecap="round" />

      <path d={dishPath} fill={METAL} opacity={0.15} />

      {/* Feed horn at focal point */}
      <polygon
        points={`${focalX},${focalY} ${focalX + 12},${focalY - 8} ${focalX + 12},${focalY + 8}`}
        fill="#f97316"
        stroke="#f97316"
        strokeWidth={1}
      />
      <FeedPointMarker x={focalX + 14} y={focalY} size={4} />

      <line x1={dishX} y1={focalY} x2={focalX} y2={focalY} stroke="#60a5fa" strokeWidth={0.6} strokeDasharray="3,3" />

      <DimensionArrow
        x1={dishX - 8} y1={dishCenterY - halfD}
        x2={dishX - 8} y2={dishCenterY + halfD}
        label={`D=${diameter.toFixed(1)}`}
        offset={-18}
      />
      <DimensionArrow
        x1={dishX} y1={dishCenterY + halfD + 8}
        x2={focalX} y2={dishCenterY + halfD + 8}
        label={`f=${focalLength.toFixed(1)}`}
        offset={14}
      />

      <text x={focalX + 20} y={focalY - 8} fill="#f97316" fontSize={8} fontFamily="monospace">Feed</text>
      <text x={cx} y={dishTop - 8} textAnchor="middle" fill={METAL} fontSize={9} fontFamily="monospace">Side view</text>
    </g>
  );
}

export function SlotSchematic({ params, antennaType }: SlotSchematicProps) {
  let content: React.ReactNode;

  switch (antennaType) {
    case 'parabolic_reflector':
      content = <ParabolicReflector params={params} />;
      break;
    case 'rectangular_slot':
    default:
      content = <RectangularSlot params={params} />;
      break;
  }

  return (
    <svg viewBox="0 0 360 240" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width={360} height={240} fill="transparent" />
      {content}
    </svg>
  );
}
