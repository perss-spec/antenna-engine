import type { SchematicProps } from './types';
import { DimensionArrow } from './DimensionArrow';
import { FeedPointMarker } from './FeedPointMarker';

const SUBSTRATE = '#22c55e33';
const COPPER = '#f97316';
const GROUND = '#555';

interface PatchSchematicProps extends SchematicProps {
  antennaType: string;
}

function RectangularPatch({ params }: Pick<PatchSchematicProps, 'params'>) {
  const L = params.length ?? 30;
  const W = params.width ?? 40;

  const subW = 200;
  const subH = 160;
  const subX = 80;
  const subY = 40;

  const scaleX = (subW - 40) / Math.max(W, 1);
  const scaleY = (subH - 40) / Math.max(L, 1);
  const scale = Math.min(scaleX, scaleY, 3);

  const pW = W * scale;
  const pH = L * scale;
  const pX = subX + (subW - pW) / 2;
  const pY = subY + (subH - pH) / 2;

  const feedX = pX + pW / 2;
  const feedY = pY + pH;

  return (
    <g>
      <rect x={subX} y={subY} width={subW} height={subH} rx={4} fill={SUBSTRATE} stroke="#22c55e" strokeWidth={1} />
      <rect x={pX} y={pY} width={pW} height={pH} rx={2} fill={COPPER} opacity={0.85} />
      <line x1={feedX} y1={feedY} x2={feedX} y2={subY + subH + 20} stroke={COPPER} strokeWidth={3} />
      <FeedPointMarker x={feedX} y={subY + subH + 20} />
      <DimensionArrow x1={pX} y1={pY - 2} x2={pX + pW} y2={pY - 2} label={`W=${W.toFixed(1)}`} offset={-14} />
      <DimensionArrow x1={pX - 2} y1={pY} x2={pX - 2} y2={pY + pH} label={`L=${L.toFixed(1)}`} offset={-14} />
    </g>
  );
}

function CircularPatch({ params }: Pick<PatchSchematicProps, 'params'>) {
  const D = params.diameter ?? params.radius ? (params.radius ?? 20) * 2 : 40;

  const subW = 200;
  const subH = 160;
  const subX = 80;
  const subY = 40;

  const maxR = Math.min(subW, subH) / 2 - 20;
  const r = Math.min((D / 2) * 2, maxR);

  const cx = subX + subW / 2;
  const cy = subY + subH / 2;

  return (
    <g>
      <rect x={subX} y={subY} width={subW} height={subH} rx={4} fill={SUBSTRATE} stroke="#22c55e" strokeWidth={1} />
      <circle cx={cx} cy={cy} r={r} fill={COPPER} opacity={0.85} />
      <line x1={cx} y1={cy + r} x2={cx} y2={subY + subH + 20} stroke={COPPER} strokeWidth={3} />
      <FeedPointMarker x={cx} y={subY + subH + 20} />
      <DimensionArrow x1={cx - r} y1={cy} x2={cx + r} y2={cy} label={`D=${D.toFixed(1)}`} offset={-r - 16} />
    </g>
  );
}

function InsetFedPatch({ params }: Pick<PatchSchematicProps, 'params'>) {
  const L = params.length ?? 30;
  const W = params.width ?? 40;
  const insetDepth = params.inset_depth ?? L * 0.3;
  const insetWidth = params.inset_width ?? W * 0.1;

  const subW = 200;
  const subH = 160;
  const subX = 80;
  const subY = 40;

  const scaleX = (subW - 40) / Math.max(W, 1);
  const scaleY = (subH - 40) / Math.max(L, 1);
  const scale = Math.min(scaleX, scaleY, 3);

  const pW = W * scale;
  const pH = L * scale;
  const pX = subX + (subW - pW) / 2;
  const pY = subY + (subH - pH) / 2;

  const notchW = Math.max(insetWidth * scale, 4);
  const notchH = Math.max(insetDepth * scale, 6);
  const feedX = pX + pW / 2;
  const notchLeft = feedX - notchW;
  const notchRight = feedX + notchW;

  const patchPath = [
    `M ${pX} ${pY}`,
    `L ${pX + pW} ${pY}`,
    `L ${pX + pW} ${pY + pH}`,
    `L ${notchRight} ${pY + pH}`,
    `L ${notchRight} ${pY + pH - notchH}`,
    `L ${notchLeft} ${pY + pH - notchH}`,
    `L ${notchLeft} ${pY + pH}`,
    `L ${pX} ${pY + pH}`,
    'Z',
  ].join(' ');

  return (
    <g>
      <rect x={subX} y={subY} width={subW} height={subH} rx={4} fill={SUBSTRATE} stroke="#22c55e" strokeWidth={1} />
      <path d={patchPath} fill={COPPER} opacity={0.85} />
      <line x1={feedX} y1={pY + pH - notchH} x2={feedX} y2={subY + subH + 20} stroke={COPPER} strokeWidth={3} />
      <FeedPointMarker x={feedX} y={subY + subH + 20} />
      <DimensionArrow x1={pX} y1={pY - 2} x2={pX + pW} y2={pY - 2} label={`W=${W.toFixed(1)}`} offset={-14} />
      <DimensionArrow x1={pX - 2} y1={pY} x2={pX - 2} y2={pY + pH} label={`L=${L.toFixed(1)}`} offset={-14} />
    </g>
  );
}

function PIFASideView({ params }: Pick<PatchSchematicProps, 'params'>) {
  const L = params.length ?? 30;
  const H = params.height ?? 10;

  const groundY = 200;
  const groundX = 40;
  const groundW = 280;

  const scaleX = 200 / Math.max(L, 1);
  const scaleY = 80 / Math.max(H, 1);
  const scale = Math.min(scaleX, scaleY, 6);

  const patchW = L * scale;
  const patchH = Math.max(H * scale, 10);

  const pX = groundX + 40;
  const pY = groundY - patchH - 8;
  const subY = groundY - 8;

  const feedX = pX + patchW * 0.3;

  return (
    <g>
      <rect x={groundX} y={groundY} width={groundW} height={6} rx={1} fill={GROUND} />
      <text x={groundX + groundW / 2} y={groundY + 18} textAnchor="middle" fill={GROUND} fontSize={9} fontFamily="monospace">Ground Plane</text>

      <rect x={pX} y={subY - patchH} width={patchW} height={patchH} fill={SUBSTRATE} stroke="#22c55e" strokeWidth={0.5} />

      <rect x={pX} y={pY} width={patchW} height={3} fill={COPPER} />

      <rect x={pX} y={pY} width={3} height={patchH + 8} fill={COPPER} opacity={0.9} />
      <text x={pX - 4} y={pY + patchH / 2} textAnchor="end" fill={COPPER} fontSize={8} fontFamily="monospace">Short</text>

      <line x1={feedX} y1={groundY} x2={feedX} y2={pY + 3} stroke={COPPER} strokeWidth={2} />
      <FeedPointMarker x={feedX} y={groundY} size={5} />

      <DimensionArrow x1={pX} y1={pY - 4} x2={pX + patchW} y2={pY - 4} label={`L=${L.toFixed(1)}`} offset={-12} />
      <DimensionArrow x1={pX + patchW + 8} y1={pY} x2={pX + patchW + 8} y2={groundY} label={`H=${H.toFixed(1)}`} offset={12} />
    </g>
  );
}

function InvertedFSideView({ params }: Pick<PatchSchematicProps, 'params'>) {
  const L = params.length ?? 30;
  const H = params.height ?? 15;

  const groundY = 200;
  const groundX = 40;
  const groundW = 280;

  const scaleX = 180 / Math.max(L, 1);
  const scaleY = 80 / Math.max(H, 1);
  const scale = Math.min(scaleX, scaleY, 5);

  const topH = Math.max(H * scale, 15);
  const topW = L * scale;

  const baseX = groundX + 80;
  const topY = groundY - topH;

  const bendX = baseX + topW * 0.35;

  return (
    <g>
      <rect x={groundX} y={groundY} width={groundW} height={6} rx={1} fill={GROUND} />
      <text x={groundX + groundW / 2} y={groundY + 18} textAnchor="middle" fill={GROUND} fontSize={9} fontFamily="monospace">Ground Plane</text>

      <line x1={baseX} y1={groundY} x2={baseX} y2={topY} stroke={COPPER} strokeWidth={3} />

      <line x1={baseX} y1={topY} x2={baseX + topW} y2={topY} stroke={COPPER} strokeWidth={3} />

      <line x1={bendX} y1={topY} x2={bendX} y2={topY + topH * 0.45} stroke={COPPER} strokeWidth={2.5} />

      <FeedPointMarker x={baseX} y={groundY} size={5} />

      <DimensionArrow x1={baseX} y1={topY - 4} x2={baseX + topW} y2={topY - 4} label={`L=${L.toFixed(1)}`} offset={-14} />
      <DimensionArrow x1={baseX - 8} y1={topY} x2={baseX - 8} y2={groundY} label={`H=${H.toFixed(1)}`} offset={-14} />

      <text x={baseX + topW + 10} y={topY + 4} fill="#94a3b8" fontSize={9} fontFamily="monospace">F-shape</text>
    </g>
  );
}

export function PatchSchematic({ params, antennaType }: PatchSchematicProps) {
  let content: React.ReactNode;

  switch (antennaType) {
    case 'circular_patch':
      content = <CircularPatch params={params} />;
      break;
    case 'inset_fed_patch':
      content = <InsetFedPatch params={params} />;
      break;
    case 'pifa':
      content = <PIFASideView params={params} />;
      break;
    case 'inverted_f':
      content = <InvertedFSideView params={params} />;
      break;
    case 'rectangular_patch':
    default:
      content = <RectangularPatch params={params} />;
      break;
  }

  return (
    <svg viewBox="0 0 360 240" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width={360} height={240} fill="transparent" />
      {content}
    </svg>
  );
}
