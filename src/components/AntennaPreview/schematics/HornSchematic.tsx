import type { SchematicProps } from './types';
import { DimensionArrow } from './DimensionArrow';

const METAL = '#94a3b8';
const WAVEGUIDE_INTERIOR = '#1e293b';

interface HornSchematicProps extends SchematicProps {
  antennaType: string;
}

function PyramidalHorn({ params }: Pick<HornSchematicProps, 'params'>) {
  const apertureW = params.aperture_width ?? 60;
  const flareAngle = params.flare_angle ?? 30;
  const wgWidth = params.waveguide_width ?? 20;
  const hornLength = params.horn_length ?? 80;

  const cx = 180;
  const cy = 120;

  const maxScale = 1.6;
  const scaleA = 140 / Math.max(apertureW, 1);
  const scaleL = 200 / Math.max(hornLength, 1);
  const scale = Math.min(scaleA, scaleL, maxScale);

  const wgW = wgWidth * scale;
  const wgLen = 50;
  const hLen = hornLength * scale;
  const apW = apertureW * scale;

  const wgLeft = cx - hLen / 2 - wgLen;
  const wgTop = cy - wgW / 2;

  const flareStart = wgLeft + wgLen;
  const flareEnd = flareStart + hLen;

  return (
    <g>
      <rect x={wgLeft} y={wgTop} width={wgLen} height={wgW} fill={WAVEGUIDE_INTERIOR} stroke={METAL} strokeWidth={2} />

      <path
        d={`M ${flareStart} ${cy - wgW / 2} L ${flareEnd} ${cy - apW / 2} L ${flareEnd} ${cy + apW / 2} L ${flareStart} ${cy + wgW / 2} Z`}
        fill={WAVEGUIDE_INTERIOR}
        stroke={METAL}
        strokeWidth={2}
        strokeLinejoin="round"
      />

      <line x1={flareStart} y1={cy - wgW / 2} x2={flareEnd} y2={cy - apW / 2} stroke={METAL} strokeWidth={2.5} />
      <line x1={flareStart} y1={cy + wgW / 2} x2={flareEnd} y2={cy + apW / 2} stroke={METAL} strokeWidth={2.5} />

      <DimensionArrow
        x1={flareEnd + 2} y1={cy - apW / 2}
        x2={flareEnd + 2} y2={cy + apW / 2}
        label={`A=${apertureW.toFixed(1)}`}
        offset={16}
      />

      <text x={cx} y={cy + apW / 2 + 28} textAnchor="middle" fill="#94a3b8" fontSize={9} fontFamily="monospace">
        {`\u03B1=${flareAngle.toFixed(0)}\u00B0`}
      </text>

      {/* Flare angle arc */}
      <path
        d={`M ${flareStart + 20} ${cy} A 20 20 0 0 0 ${flareStart + 20 * Math.cos((flareAngle * Math.PI) / 180)} ${cy - 20 * Math.sin((flareAngle * Math.PI) / 180)}`}
        fill="none"
        stroke="#60a5fa"
        strokeWidth={0.8}
        strokeDasharray="2,2"
      />
    </g>
  );
}

function ConicalHorn({ params }: Pick<HornSchematicProps, 'params'>) {
  const apertureD = params.aperture_diameter ?? params.aperture_width ?? 60;
  const hornLength = params.horn_length ?? 80;
  const wgDiam = params.waveguide_diameter ?? params.waveguide_width ?? 18;

  const cx = 180;
  const cy = 120;

  const maxScale = 1.6;
  const scaleA = 130 / Math.max(apertureD, 1);
  const scaleL = 200 / Math.max(hornLength, 1);
  const scale = Math.min(scaleA, scaleL, maxScale);

  const wgR = (wgDiam * scale) / 2;
  const wgLen = 50;
  const hLen = hornLength * scale;
  const apR = (apertureD * scale) / 2;

  const wgLeft = cx - hLen / 2 - wgLen;

  const flareStart = wgLeft + wgLen;
  const flareEnd = flareStart + hLen;

  const cp1x = flareStart + hLen * 0.4;
  const cp2x = flareStart + hLen * 0.7;

  return (
    <g>
      <rect x={wgLeft} y={cy - wgR} width={wgLen} height={wgR * 2} fill={WAVEGUIDE_INTERIOR} stroke={METAL} strokeWidth={2} />

      <path
        d={[
          `M ${flareStart} ${cy - wgR}`,
          `C ${cp1x} ${cy - wgR} ${cp2x} ${cy - apR} ${flareEnd} ${cy - apR}`,
          `L ${flareEnd} ${cy + apR}`,
          `C ${cp2x} ${cy + apR} ${cp1x} ${cy + wgR} ${flareStart} ${cy + wgR}`,
          'Z',
        ].join(' ')}
        fill={WAVEGUIDE_INTERIOR}
        stroke={METAL}
        strokeWidth={2}
      />

      <path
        d={`M ${flareStart} ${cy - wgR} C ${cp1x} ${cy - wgR} ${cp2x} ${cy - apR} ${flareEnd} ${cy - apR}`}
        fill="none" stroke={METAL} strokeWidth={2.5}
      />
      <path
        d={`M ${flareStart} ${cy + wgR} C ${cp1x} ${cy + wgR} ${cp2x} ${cy + apR} ${flareEnd} ${cy + apR}`}
        fill="none" stroke={METAL} strokeWidth={2.5}
      />

      <DimensionArrow
        x1={flareEnd + 2} y1={cy - apR}
        x2={flareEnd + 2} y2={cy + apR}
        label={`D=${apertureD.toFixed(1)}`}
        offset={16}
      />
    </g>
  );
}

function OpenWaveguide({ params }: Pick<HornSchematicProps, 'params'>) {
  const wgWidth = params.waveguide_width ?? params.width ?? 22;
  const wgHeight = params.waveguide_height ?? params.height ?? 10;

  const cx = 180;
  const cy = 120;

  const maxScale = 3;
  const scaleW = 120 / Math.max(wgWidth, 1);
  const scaleH = 80 / Math.max(wgHeight, 1);
  const scale = Math.min(scaleW, scaleH, maxScale);

  const h = wgHeight * scale;
  const len = 140;

  const x = cx - len / 2;
  const y = cy - h / 2;

  return (
    <g>
      <rect x={x} y={y} width={len} height={h} fill={WAVEGUIDE_INTERIOR} stroke={METAL} strokeWidth={2.5} rx={1} />

      <rect x={x + len - 4} y={y} width={4} height={h} fill={WAVEGUIDE_INTERIOR} stroke="none" />
      <line x1={x + len} y1={y - 2} x2={x + len} y2={y + h + 2} stroke={METAL} strokeWidth={1} strokeDasharray="3,2" />

      <DimensionArrow
        x1={x} y1={y - 2}
        x2={x + len} y2={y - 2}
        label="Waveguide"
        offset={-16}
        color="#94a3b8"
      />
      <DimensionArrow
        x1={x + len + 4} y1={y}
        x2={x + len + 4} y2={y + h}
        label={`${wgWidth.toFixed(1)}\u00D7${wgHeight.toFixed(1)}`}
        offset={16}
      />

      <text x={x + len + 8} y={cy + h / 2 + 20} fill="#64748b" fontSize={8} fontFamily="monospace">Open end</text>
    </g>
  );
}

export function HornSchematic({ params, antennaType }: HornSchematicProps) {
  let content: React.ReactNode;

  switch (antennaType) {
    case 'conical_horn':
      content = <ConicalHorn params={params} />;
      break;
    case 'open_waveguide':
      content = <OpenWaveguide params={params} />;
      break;
    case 'pyramidal_horn':
    default:
      content = <PyramidalHorn params={params} />;
      break;
  }

  return (
    <svg viewBox="0 0 360 240" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
      <rect width={360} height={240} fill="transparent" />
      {content}
    </svg>
  );
}
