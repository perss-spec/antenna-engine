import type { DimensionLineProps } from './types';

export function DimensionArrow({
  x1,
  y1,
  x2,
  y2,
  label,
  color = 'var(--color-text-dim, #888)',
  offset = 0,
}: DimensionLineProps) {
  const arrowSize = 4;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return null;

  const ux = dx / len;
  const uy = dy / len;
  // perpendicular
  const px = -uy;
  const py = ux;

  // offset the whole line perpendicular
  const ox1 = x1 + px * offset;
  const oy1 = y1 + py * offset;
  const ox2 = x2 + px * offset;
  const oy2 = y2 + py * offset;

  // arrowhead points
  const a1Left = `${ox1 + ux * arrowSize + px * arrowSize},${oy1 + uy * arrowSize + py * arrowSize}`;
  const a1Right = `${ox1 + ux * arrowSize - px * arrowSize},${oy1 + uy * arrowSize - py * arrowSize}`;
  const a2Left = `${ox2 - ux * arrowSize + px * arrowSize},${oy2 - uy * arrowSize + py * arrowSize}`;
  const a2Right = `${ox2 - ux * arrowSize - px * arrowSize},${oy2 - uy * arrowSize - py * arrowSize}`;

  // label position: centered, offset perpendicular
  const lx = (ox1 + ox2) / 2 + px * 10;
  const ly = (oy1 + oy2) / 2 + py * 10;

  // rotation for text to follow line
  const angle = Math.atan2(dy, dx) * (180 / Math.PI);
  const textAngle = angle > 90 || angle < -90 ? angle + 180 : angle;

  return (
    <g>
      {/* extension lines from original points to offset line */}
      {offset !== 0 && (
        <>
          <line
            x1={x1}
            y1={y1}
            x2={ox1 - px * 2}
            y2={oy1 - py * 2}
            stroke={color}
            strokeWidth={0.5}
            strokeDasharray="2,2"
          />
          <line
            x1={x2}
            y1={y2}
            x2={ox2 - px * 2}
            y2={oy2 - py * 2}
            stroke={color}
            strokeWidth={0.5}
            strokeDasharray="2,2"
          />
        </>
      )}
      {/* main line */}
      <line x1={ox1} y1={oy1} x2={ox2} y2={oy2} stroke={color} strokeWidth={0.75} />
      {/* arrowhead at start */}
      <polygon points={`${ox1},${oy1} ${a1Left} ${a1Right}`} fill={color} />
      {/* arrowhead at end */}
      <polygon points={`${ox2},${oy2} ${a2Left} ${a2Right}`} fill={color} />
      {/* label */}
      <text
        x={lx}
        y={ly}
        fill={color}
        fontSize={9}
        fontFamily="monospace"
        textAnchor="middle"
        dominantBaseline="central"
        transform={`rotate(${textAngle}, ${lx}, ${ly})`}
      >
        {label}
      </text>
    </g>
  );
}
