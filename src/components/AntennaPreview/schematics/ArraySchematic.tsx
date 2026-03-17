import type { ReactNode } from 'react';
import type { SchematicProps } from './types';
import { DimensionArrow } from './DimensionArrow';
import { FeedPointMarker } from './FeedPointMarker';

const ELEM = '#0ea5e9';
const CONN = '#64748b';
const SUBSTRATE = '#22c55e33';

function UniformLinearArray({ params }: { params: Record<string, number> }) {
  const n = Math.max(2, Math.min(params.num_elements ?? 4, 12));
  const spacing = 260 / n;
  const startX = 50 + spacing / 2;
  const cy = 100;

  return (
    <g>
      {/* Ground line */}
      <line x1={30} y1={cy} x2={330} y2={cy} stroke={CONN} strokeWidth={1} strokeDasharray="4,3" />
      {Array.from({ length: n }, (_, i) => {
        const cx = startX + i * spacing;
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={10} fill="none" stroke={ELEM} strokeWidth={2} />
            <circle cx={cx} cy={cy} r={3} fill={ELEM} />
          </g>
        );
      })}
      {n >= 2 && (
        <DimensionArrow
          x1={startX}
          y1={cy}
          x2={startX + spacing}
          y2={cy}
          label="d"
          offset={30}
        />
      )}
      <FeedPointMarker x={startX + ((n - 1) * spacing) / 2} y={cy + 50} />
    </g>
  );
}

function PlanarPatchArray({ params }: { params: Record<string, number> }) {
  const cols = Math.max(2, Math.min(params.num_elements_x ?? 4, 8));
  const rows = Math.max(2, Math.min(params.num_elements_y ?? 4, 6));
  const pW = Math.min(220 / cols, 180 / rows, 30);
  const gap = pW * 0.3;
  const totalW = cols * pW + (cols - 1) * gap;
  const totalH = rows * pW + (rows - 1) * gap;
  const ox = (360 - totalW) / 2;
  const oy = (240 - totalH) / 2;

  return (
    <g>
      <rect x={ox - 10} y={oy - 10} width={totalW + 20} height={totalH + 20} rx={4} fill={SUBSTRATE} stroke="#22c55e" strokeWidth={1} />
      {Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (_, c) => (
          <rect
            key={`${r}-${c}`}
            x={ox + c * (pW + gap)}
            y={oy + r * (pW + gap)}
            width={pW}
            height={pW}
            rx={2}
            fill={ELEM}
            opacity={0.85}
          />
        ))
      )}
    </g>
  );
}

function PhasedArray({ params }: { params: Record<string, number> }) {
  const n = Math.max(2, Math.min(params.num_elements ?? 4, 10));
  const spacing = 240 / n;
  const startX = 60 + spacing / 2;
  const cy = 100;

  return (
    <g>
      <line x1={40} y1={cy} x2={320} y2={cy} stroke={CONN} strokeWidth={1} strokeDasharray="4,3" />
      {Array.from({ length: n }, (_, i) => {
        const cx = startX + i * spacing;
        return (
          <g key={i}>
            <polygon
              points={`${cx},${cy - 12} ${cx + 10},${cy + 8} ${cx - 10},${cy + 8}`}
              fill="none"
              stroke={ELEM}
              strokeWidth={2}
            />
            {i < n - 1 && (
              <path
                d={`M ${cx + 14} ${cy - 18} A 12 12 0 0 1 ${cx + spacing - 14} ${cy - 18}`}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={1.5}
                markerEnd="url(#phaseArrow)"
              />
            )}
          </g>
        );
      })}
      <defs>
        <marker id="phaseArrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6" fill="#f59e0b" />
        </marker>
      </defs>
      <text x={180} y={cy - 32} textAnchor="middle" fill="#f59e0b" fontSize={9} fontFamily="monospace">
        phase shift
      </text>
      <FeedPointMarker x={startX + ((n - 1) * spacing) / 2} y={cy + 50} />
    </g>
  );
}

function ButlerMatrixArray({ params }: { params: Record<string, number> }) {
  const n = Math.max(2, Math.min(params.num_elements ?? 4, 8));
  const spacing = 240 / n;
  const startX = 60 + spacing / 2;
  const elemY = 50;
  const matrixTop = 120;
  const matrixBot = 190;
  const matrixLeft = startX - 20;
  const matrixRight = startX + (n - 1) * spacing + 20;

  return (
    <g>
      {/* Elements */}
      {Array.from({ length: n }, (_, i) => {
        const cx = startX + i * spacing;
        return (
          <g key={i}>
            <circle cx={cx} cy={elemY} r={10} fill="none" stroke={ELEM} strokeWidth={2} />
            <circle cx={cx} cy={elemY} r={3} fill={ELEM} />
            <line x1={cx} y1={elemY + 10} x2={cx} y2={matrixTop} stroke={CONN} strokeWidth={1.5} />
          </g>
        );
      })}
      {/* Butler matrix box */}
      <rect
        x={matrixLeft}
        y={matrixTop}
        width={matrixRight - matrixLeft}
        height={matrixBot - matrixTop}
        rx={6}
        fill="#1e293b"
        stroke={CONN}
        strokeWidth={1.5}
      />
      <text x={(matrixLeft + matrixRight) / 2} y={(matrixTop + matrixBot) / 2 + 4} textAnchor="middle" fill="#94a3b8" fontSize={11} fontFamily="monospace">
        {n}x{n} Butler Matrix
      </text>
      {/* Ports at bottom */}
      {Array.from({ length: n }, (_, i) => {
        const cx = startX + i * spacing;
        return (
          <line key={i} x1={cx} y1={matrixBot} x2={cx} y2={matrixBot + 16} stroke={CONN} strokeWidth={1.5} />
        );
      })}
    </g>
  );
}

export function ArraySchematic({
  params,
  antennaType,
}: SchematicProps & { antennaType: string }) {
  let content: ReactNode;
  switch (antennaType) {
    case 'planar_patch_array':
      content = <PlanarPatchArray params={params} />;
      break;
    case 'phased_array':
      content = <PhasedArray params={params} />;
      break;
    case 'butler_matrix_array':
      content = <ButlerMatrixArray params={params} />;
      break;
    default:
      content = <UniformLinearArray params={params} />;
  }

  return (
    <svg viewBox="0 0 360 240" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
      {content}
    </svg>
  );
}
