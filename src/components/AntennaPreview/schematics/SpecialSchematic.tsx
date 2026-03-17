import type { ReactNode } from 'react';
import type { SchematicProps } from './types';
import { FeedPointMarker } from './FeedPointMarker';

const ELEM = '#0ea5e9';
const CONN = '#64748b';
const DIELECTRIC = '#818cf8';

function SierpinskiTriangle({ cx, cy, size, depth }: { cx: number; cy: number; size: number; depth: number }) {
  const h = (size * Math.sqrt(3)) / 2;
  const x1 = cx;
  const y1 = cy - (2 / 3) * h;
  const x2 = cx - size / 2;
  const y2 = cy + (1 / 3) * h;
  const x3 = cx + size / 2;
  const y3 = cy + (1 / 3) * h;

  if (depth <= 0) {
    return (
      <polygon
        points={`${x1},${y1} ${x2},${y2} ${x3},${y3}`}
        fill={ELEM}
        opacity={0.8}
        stroke={ELEM}
        strokeWidth={0.5}
      />
    );
  }

  const halfSize = size / 2;
  return (
    <g>
      <SierpinskiTriangle cx={(x1 + x2) / 2 + halfSize / 4} cy={(y1 + y2) / 2 - (halfSize * Math.sqrt(3)) / 12} size={halfSize} depth={depth - 1} />
      <SierpinskiTriangle cx={cx - halfSize / 4} cy={cy + (1 / 3) * h - (halfSize * Math.sqrt(3)) / 6} size={halfSize} depth={depth - 1} />
      <SierpinskiTriangle cx={cx + halfSize / 4} cy={cy + (1 / 3) * h - (halfSize * Math.sqrt(3)) / 6} size={halfSize} depth={depth - 1} />
    </g>
  );
}

function SierpinskiFractal() {
  return (
    <g>
      <SierpinskiTriangle cx={180} cy={110} size={180} depth={3} />
      <FeedPointMarker x={180} y={210} />
      {/* Ground plane */}
      <line x1={60} y1={220} x2={300} y2={220} stroke={CONN} strokeWidth={2} />
    </g>
  );
}

function DielectricResonator() {
  const gx = 60;
  const gw = 240;
  const gy = 180;
  const cylW = 80;
  const cylH = 70;
  const cx = 180;
  const cylTop = gy - cylH;

  return (
    <g>
      {/* Ground plane */}
      <rect x={gx} y={gy} width={gw} height={6} rx={1} fill={CONN} />
      {/* Dielectric cylinder (side view — rectangle + ellipses) */}
      <rect x={cx - cylW / 2} y={cylTop} width={cylW} height={cylH} fill={DIELECTRIC} opacity={0.5} stroke={DIELECTRIC} strokeWidth={1.5} />
      <ellipse cx={cx} cy={cylTop} rx={cylW / 2} ry={10} fill={DIELECTRIC} opacity={0.6} stroke={DIELECTRIC} strokeWidth={1} />
      <ellipse cx={cx} cy={gy} rx={cylW / 2} ry={10} fill={DIELECTRIC} opacity={0.3} />
      {/* Probe feed */}
      <line x1={cx - cylW / 2 - 20} y1={gy - 15} x2={cx - cylW / 2} y2={gy - 15} stroke="#ef4444" strokeWidth={2} />
      <circle cx={cx - cylW / 2 - 20} cy={gy - 15} r={4} fill="#ef4444" />
      <text x={cx - cylW / 2 - 30} y={gy - 25} textAnchor="middle" fill="#ef4444" fontSize={9} fontFamily="monospace">
        Probe
      </text>
      {/* Label */}
      <text x={cx} y={cylTop + cylH / 2 + 4} textAnchor="middle" fill="#c7d2fe" fontSize={10} fontFamily="monospace">
        DRA
      </text>
    </g>
  );
}

function MetamaterialAntenna() {
  const rows = 5;
  const cols = 7;
  const cellSize = 32;
  const ox = (360 - cols * cellSize) / 2;
  const oy = (240 - rows * cellSize) / 2;
  const r = cellSize * 0.32;

  return (
    <g>
      {/* Substrate */}
      <rect x={ox - 8} y={oy - 8} width={cols * cellSize + 16} height={rows * cellSize + 16} rx={4} fill="#22c55e11" stroke="#22c55e44" strokeWidth={1} />
      {/* SRR grid */}
      {Array.from({ length: rows }, (_, row) =>
        Array.from({ length: cols }, (_, col) => {
          const cx = ox + col * cellSize + cellSize / 2;
          const cy = oy + row * cellSize + cellSize / 2;
          const gap = 25;
          return (
            <g key={`${row}-${col}`}>
              {/* Outer ring with gap */}
              <path
                d={`M ${cx + r * Math.cos((gap * Math.PI) / 180)} ${cy - r * Math.sin((gap * Math.PI) / 180)} A ${r} ${r} 0 1 0 ${cx + r * Math.cos((-gap * Math.PI) / 180)} ${cy - r * Math.sin((-gap * Math.PI) / 180)}`}
                fill="none"
                stroke={ELEM}
                strokeWidth={1.5}
              />
              {/* Inner ring with gap (opposite side) */}
              <path
                d={`M ${cx - (r * 0.6) * Math.cos((gap * Math.PI) / 180)} ${cy + (r * 0.6) * Math.sin((gap * Math.PI) / 180)} A ${r * 0.6} ${r * 0.6} 0 1 0 ${cx - (r * 0.6) * Math.cos((-gap * Math.PI) / 180)} ${cy + (r * 0.6) * Math.sin((-gap * Math.PI) / 180)}`}
                fill="none"
                stroke={ELEM}
                strokeWidth={1}
                opacity={0.7}
              />
            </g>
          );
        })
      )}
    </g>
  );
}

function ReconfigurableAntenna() {
  const patchW = 120;
  const patchH = 90;
  const cx = 180;
  const cy = 110;

  const switches = [
    { x: cx - patchW / 4, y: cy - patchH / 4 },
    { x: cx + patchW / 4, y: cy - patchH / 4 },
    { x: cx - patchW / 4, y: cy + patchH / 4 },
    { x: cx + patchW / 4, y: cy + patchH / 4 },
    { x: cx, y: cy - patchH / 4 },
    { x: cx, y: cy + patchH / 4 },
  ];

  return (
    <g>
      {/* Substrate */}
      <rect x={cx - patchW / 2 - 15} y={cy - patchH / 2 - 15} width={patchW + 30} height={patchH + 30} rx={4} fill="#22c55e22" stroke="#22c55e" strokeWidth={1} />
      {/* Patch */}
      <rect x={cx - patchW / 2} y={cy - patchH / 2} width={patchW} height={patchH} rx={3} fill={ELEM} opacity={0.7} stroke={ELEM} strokeWidth={1.5} />
      {/* Switch elements */}
      {switches.map((s, i) => (
        <g key={i}>
          <circle cx={s.x} cy={s.y} r={5} fill="#ef4444" opacity={0.9} />
          <circle cx={s.x} cy={s.y} r={2} fill="#fff" />
        </g>
      ))}
      {/* Switch label */}
      <text x={cx} y={cy + patchH / 2 + 35} textAnchor="middle" fill="#ef4444" fontSize={9} fontFamily="monospace">
        PIN / MEMS switches
      </text>
      <FeedPointMarker x={cx} y={cy + patchH / 2 + 60} size={5} />
    </g>
  );
}

export function SpecialSchematic({
  antennaType,
}: SchematicProps & { antennaType: string }) {
  let content: ReactNode;
  switch (antennaType) {
    case 'sierpinski_fractal':
      content = <SierpinskiFractal />;
      break;
    case 'dielectric_resonator':
      content = <DielectricResonator />;
      break;
    case 'metamaterial_antenna':
      content = <MetamaterialAntenna />;
      break;
    case 'reconfigurable_antenna':
      content = <ReconfigurableAntenna />;
      break;
    default:
      content = <SierpinskiFractal />;
  }

  return (
    <svg viewBox="0 0 360 240" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      {content}
    </svg>
  );
}
