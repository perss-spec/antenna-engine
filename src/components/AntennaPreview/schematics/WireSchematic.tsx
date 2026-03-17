import type { SchematicProps } from './types';
import { DimensionArrow } from './DimensionArrow';
import { FeedPointMarker } from './FeedPointMarker';

const C = 299_792_458; // m/s
const WIRE = '#0ea5e9';
const GROUND = '#444';
const WIRE_W = 2;

function mm(meters: number): string {
  return `${(meters * 1000).toFixed(1)} mm`;
}

function wavelength(freq: number): number {
  return freq > 0 ? C / freq : 1;
}

// --- Individual antenna renderers ---

function HalfWaveDipole({ params, frequency }: SchematicProps) {
  const lambda = wavelength(frequency);
  const totalLen = params.length_m ?? lambda / 2;
  const cx = 180;
  const cy = 120;
  const armPx = 120;

  return (
    <g>
      {/* left arm */}
      <line x1={cx - armPx} y1={cy} x2={cx} y2={cy} stroke={WIRE} strokeWidth={WIRE_W} strokeLinecap="round" />
      {/* right arm */}
      <line x1={cx} y1={cy} x2={cx + armPx} y2={cy} stroke={WIRE} strokeWidth={WIRE_W} strokeLinecap="round" />
      {/* feed gap */}
      <line x1={cx - 3} y1={cy} x2={cx + 3} y2={cy} stroke="none" />
      <FeedPointMarker x={cx} y={cy} />
      <DimensionArrow
        x1={cx - armPx}
        y1={cy}
        x2={cx + armPx}
        y2={cy}
        label={mm(totalLen)}
        offset={20}
      />
    </g>
  );
}

function QuarterWaveMonopole({ params, frequency }: SchematicProps) {
  const lambda = wavelength(frequency);
  const armLen = params.length_m ?? lambda / 4;
  const cx = 180;
  const groundY = 200;
  const topY = 50;

  return (
    <g>
      {/* ground plane hatching */}
      <defs>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="6" stroke={GROUND} strokeWidth={0.8} />
        </pattern>
      </defs>
      <rect x={100} y={groundY} width={160} height={16} fill="url(#hatch)" stroke={GROUND} strokeWidth={1} />
      {/* vertical arm */}
      <line x1={cx} y1={groundY} x2={cx} y2={topY} stroke={WIRE} strokeWidth={WIRE_W} strokeLinecap="round" />
      <FeedPointMarker x={cx} y={groundY} />
      <DimensionArrow x1={cx} y1={groundY} x2={cx} y2={topY} label={mm(armLen)} offset={20} />
    </g>
  );
}

function FoldedDipole({ params, frequency }: SchematicProps) {
  const lambda = wavelength(frequency);
  const totalLen = params.length_m ?? lambda / 2;
  const cx = 180;
  const cy = 120;
  const halfW = 120;
  const gap = 20;

  return (
    <g>
      {/* bottom wire */}
      <line x1={cx - halfW} y1={cy + gap / 2} x2={cx + halfW} y2={cy + gap / 2} stroke={WIRE} strokeWidth={WIRE_W} />
      {/* top wire */}
      <line x1={cx - halfW} y1={cy - gap / 2} x2={cx + halfW} y2={cy - gap / 2} stroke={WIRE} strokeWidth={WIRE_W} />
      {/* left end */}
      <line x1={cx - halfW} y1={cy - gap / 2} x2={cx - halfW} y2={cy + gap / 2} stroke={WIRE} strokeWidth={WIRE_W} />
      {/* right end */}
      <line x1={cx + halfW} y1={cy - gap / 2} x2={cx + halfW} y2={cy + gap / 2} stroke={WIRE} strokeWidth={WIRE_W} />
      {/* feed gap at bottom center */}
      <line x1={cx - 3} y1={cy + gap / 2} x2={cx + 3} y2={cy + gap / 2} stroke="black" strokeWidth={3} />
      <FeedPointMarker x={cx} y={cy + gap / 2} />
      <DimensionArrow
        x1={cx - halfW}
        y1={cy + gap / 2}
        x2={cx + halfW}
        y2={cy + gap / 2}
        label={mm(totalLen)}
        offset={25}
      />
    </g>
  );
}

function AxialHelix({ params, frequency }: SchematicProps) {
  const lambda = wavelength(frequency);
  const turns = params.turns ?? 6;
  const totalLen = params.length_m ?? lambda * turns * 0.25;
  const radius = params.radius_m ?? lambda / (2 * Math.PI);

  const startX = 60;
  const endX = 300;
  const cy = 110;
  const amp = 30;
  const segments = Math.round(turns * 20);

  // sine wave path for helix side view
  let d = `M${startX},${cy}`;
  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    const px = startX + (endX - startX) * t;
    const py = cy + amp * Math.sin(2 * Math.PI * turns * t);
    d += ` L${px.toFixed(1)},${py.toFixed(1)}`;
  }

  return (
    <g>
      {/* ground plane circle */}
      <ellipse cx={startX} cy={cy} rx={12} ry={35} fill="none" stroke={GROUND} strokeWidth={1.5} />
      <path d={d} fill="none" stroke={WIRE} strokeWidth={WIRE_W} />
      <FeedPointMarker x={startX} y={cy} />
      <DimensionArrow x1={startX} y1={cy + amp + 10} x2={endX} y2={cy + amp + 10} label={mm(totalLen)} offset={15} />
      <text x={180} y={25} fill="var(--color-text-dim, #888)" fontSize={9} fontFamily="monospace" textAnchor="middle">
        {`r=${mm(radius)} | ${turns} turns`}
      </text>
    </g>
  );
}

function QuadrifilarHelix({ params, frequency }: SchematicProps) {
  const lambda = wavelength(frequency);
  const totalLen = params.length_m ?? lambda * 0.5;
  const radius = params.radius_m ?? lambda / (2 * Math.PI);
  const cx = 180;
  const cy = 120;
  const r = 70;
  const turns = params.turns ?? 1;
  const colors = ['#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd'];

  // top view: 4 helical strands shown as spirals
  return (
    <g>
      {colors.map((c, idx) => {
        const phaseOff = (idx * Math.PI) / 2;
        const segments = 60;
        let d = '';
        for (let i = 0; i <= segments; i++) {
          const t = i / segments;
          const angle = 2 * Math.PI * turns * t + phaseOff;
          const cr = r * (0.3 + 0.7 * t);
          const px = cx + cr * Math.cos(angle);
          const py = cy + cr * Math.sin(angle);
          d += i === 0 ? `M${px.toFixed(1)},${py.toFixed(1)}` : ` L${px.toFixed(1)},${py.toFixed(1)}`;
        }
        return <path key={idx} d={d} fill="none" stroke={c} strokeWidth={1.8} />;
      })}
      {/* cross pattern at center */}
      <line x1={cx - 8} y1={cy} x2={cx + 8} y2={cy} stroke={WIRE} strokeWidth={1} />
      <line x1={cx} y1={cy - 8} x2={cx} y2={cy + 8} stroke={WIRE} strokeWidth={1} />
      <FeedPointMarker x={cx} y={cy} size={4} />
      <text x={180} y={225} fill="var(--color-text-dim, #888)" fontSize={9} fontFamily="monospace" textAnchor="middle">
        {`L=${mm(totalLen)} r=${mm(radius)}`}
      </text>
    </g>
  );
}

function YagiUda({ params, frequency }: SchematicProps) {
  const lambda = wavelength(frequency);
  const numDirectors = params.num_directors ?? 3;
  const boomLen = params.length_m ?? lambda * (0.3 * (numDirectors + 2));
  const cy = 120;
  const boomStartX = 40;
  const boomEndX = 320;

  // element positions along boom
  const elements: { x: number; halfH: number; type: string }[] = [];
  const totalElements = numDirectors + 2; // reflector + driven + directors
  const spacing = (boomEndX - boomStartX) / (totalElements + 1);

  // reflector (longest)
  elements.push({ x: boomStartX + spacing, halfH: 55, type: 'reflector' });
  // driven
  elements.push({ x: boomStartX + spacing * 2, halfH: 45, type: 'driven' });
  // directors
  for (let i = 0; i < numDirectors; i++) {
    const h = 38 - i * 3;
    elements.push({ x: boomStartX + spacing * (3 + i), halfH: Math.max(h, 22), type: 'director' });
  }

  return (
    <g>
      {/* boom */}
      <line x1={boomStartX} y1={cy} x2={boomEndX} y2={cy} stroke={GROUND} strokeWidth={1.5} />
      {/* elements */}
      {elements.map((el, i) => (
        <line
          key={i}
          x1={el.x}
          y1={cy - el.halfH}
          x2={el.x}
          y2={cy + el.halfH}
          stroke={el.type === 'driven' ? WIRE : el.type === 'reflector' ? '#64748b' : '#94a3b8'}
          strokeWidth={el.type === 'driven' ? WIRE_W : 1.5}
          strokeLinecap="round"
        />
      ))}
      {/* feed on driven */}
      <FeedPointMarker x={elements[1].x} y={cy} />
      {/* labels */}
      <text x={elements[0].x} y={cy + elements[0].halfH + 14} fill="#64748b" fontSize={8} fontFamily="monospace" textAnchor="middle">R</text>
      <text x={elements[1].x} y={cy + elements[1].halfH + 14} fill={WIRE} fontSize={8} fontFamily="monospace" textAnchor="middle">D</text>
      {elements.slice(2).map((el, i) => (
        <text key={i} x={el.x} y={cy + el.halfH + 14} fill="#94a3b8" fontSize={8} fontFamily="monospace" textAnchor="middle">
          {`d${i + 1}`}
        </text>
      ))}
      <DimensionArrow x1={boomStartX} y1={cy - 70} x2={boomEndX} y2={cy - 70} label={mm(boomLen)} />
    </g>
  );
}

function LogPeriodic({ params, frequency }: SchematicProps) {
  const lambda = wavelength(frequency);
  const numElements = params.num_elements ?? 8;
  const totalLen = params.length_m ?? lambda * 1.5;
  const cy = 120;
  const startX = 40;
  const endX = 320;

  const tau = params.tau ?? 0.9;
  const elements: { x: number; halfH: number }[] = [];

  // elements decrease in length toward front (right)
  let currentH = 60;
  const spacing = (endX - startX) / (numElements + 1);
  for (let i = 0; i < numElements; i++) {
    elements.push({ x: startX + spacing * (i + 1), halfH: currentH });
    currentH *= tau;
  }

  return (
    <g>
      {/* two boom lines (transmission line) */}
      <line x1={startX} y1={cy - 3} x2={endX} y2={cy - 3} stroke={GROUND} strokeWidth={1} />
      <line x1={startX} y1={cy + 3} x2={endX} y2={cy + 3} stroke={GROUND} strokeWidth={1} />
      {/* elements alternating connection (crossed feed) */}
      {elements.map((el, i) => (
        <line
          key={i}
          x1={el.x}
          y1={cy - el.halfH}
          x2={el.x}
          y2={cy + el.halfH}
          stroke={WIRE}
          strokeWidth={1.5}
          strokeLinecap="round"
        />
      ))}
      {/* cross connections */}
      {elements.slice(0, -1).map((el, i) => {
        const next = elements[i + 1];
        return (
          <g key={`cross-${i}`}>
            <line x1={el.x} y1={cy - 3} x2={next.x} y2={cy + 3} stroke={GROUND} strokeWidth={0.5} opacity={0.4} />
            <line x1={el.x} y1={cy + 3} x2={next.x} y2={cy - 3} stroke={GROUND} strokeWidth={0.5} opacity={0.4} />
          </g>
        );
      })}
      <FeedPointMarker x={elements[elements.length - 1].x} y={cy} size={4} />
      <DimensionArrow x1={startX} y1={cy + 75} x2={endX} y2={cy + 75} label={mm(totalLen)} />
      <text x={endX + 10} y={cy} fill="var(--color-text-dim, #888)" fontSize={8} fontFamily="monospace" dominantBaseline="central">
        {"-->"}
      </text>
    </g>
  );
}

function SmallLoop({ params, frequency }: SchematicProps) {
  const lambda = wavelength(frequency);
  const diameter = params.radius_m ? params.radius_m * 2 : (params.length_m ?? lambda / 10);
  const cx = 180;
  const cy = 110;
  const r = 65;

  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={WIRE} strokeWidth={WIRE_W} />
      <FeedPointMarker x={cx} y={cy + r} />
      {/* diameter dimension */}
      <DimensionArrow x1={cx - r} y1={cy} x2={cx + r} y2={cy} label={mm(diameter)} offset={-r - 20} />
    </g>
  );
}

// --- Main component ---

const renderers: Record<string, React.FC<SchematicProps>> = {
  half_wave_dipole: HalfWaveDipole,
  quarter_wave_monopole: QuarterWaveMonopole,
  folded_dipole: FoldedDipole,
  axial_helix: AxialHelix,
  quadrifilar_helix: QuadrifilarHelix,
  yagi_uda: YagiUda,
  log_periodic: LogPeriodic,
  small_loop: SmallLoop,
};

export function WireSchematic({
  params,
  frequency,
  antennaType,
  width = 360,
  height = 240,
}: SchematicProps & { antennaType: string }) {
  const Renderer = renderers[antennaType];

  return (
    <svg
      viewBox="0 0 360 240"
      width={width}
      height={height}
      xmlns="http://www.w3.org/2000/svg"
      style={{ background: 'transparent' }}
    >
      {Renderer ? (
        <Renderer params={params} frequency={frequency} />
      ) : (
        <text x={180} y={120} fill="#888" fontSize={12} fontFamily="monospace" textAnchor="middle">
          {`Unknown type: ${antennaType}`}
        </text>
      )}
    </svg>
  );
}
