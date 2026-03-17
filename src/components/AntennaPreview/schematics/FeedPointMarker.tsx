interface FeedPointMarkerProps {
  x: number;
  y: number;
  size?: number;
}

export function FeedPointMarker({ x, y, size = 5 }: FeedPointMarkerProps) {
  const s = size;
  // lightning bolt path relative to center
  const bolt = [
    `M${x - s * 0.25},${y - s * 0.5}`,
    `L${x + s * 0.1},${y - s * 0.05}`,
    `L${x - s * 0.1},${y + s * 0.05}`,
    `L${x + s * 0.25},${y + s * 0.5}`,
  ].join(' ');

  return (
    <g>
      <circle
        cx={x}
        cy={y}
        r={s}
        fill="#facc15"
        stroke="#a16207"
        strokeWidth={0.8}
      />
      <path d={bolt} stroke="#92400e" strokeWidth={1} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}
