import type { ReactNode } from 'react';
import { COLORS, LABEL_SIZE, LABEL_SIZE_2CH, LETTER_SIZE, SQUARE_SIDE, SYMBOL_R, SYMBOL_STROKE } from '@/model/constants';
import type { Player, ViewWindow } from '@/model/types';
import { toSvg, yd } from '@/geometry/transform';
import { fontFamily } from './svgText';
import { labelColorHex } from './theme';

function shadePath(symbol: Player['symbol'], shade: Player['shade'], r: number): string | null {
  if (!shade || shade === 'none') return null;
  if (symbol === 'square') {
    const h = yd(SQUARE_SIDE) / 2;
    if (shade === 'full') return `M ${-h} ${-h} h ${2 * h} v ${2 * h} h ${-2 * h} Z`;
    if (shade === 'left') return `M ${-h} ${-h} h ${h} v ${2 * h} h ${-h} Z`;
    return `M 0 ${-h} h ${h} v ${2 * h} h ${-h} Z`;
  }
  if (shade === 'full') return `M ${-r} 0 A ${r} ${r} 0 1 0 ${r} 0 A ${r} ${r} 0 1 0 ${-r} 0 Z`;
  if (shade === 'left') return `M 0 ${-r} A ${r} ${r} 0 0 0 0 ${r} Z`;
  return `M 0 ${-r} A ${r} ${r} 0 0 1 0 ${r} Z`;
}

export function PlayerGlyph({ p, selected }: { p: Player; selected?: boolean }) {
  const r = yd(SYMBOL_R);
  const sw = yd(SYMBOL_STROKE);
  const stroke = COLORS.ink;
  const labelFill = p.shade === 'full' ? COLORS.paper : labelColorHex(p.labelColor);
  const twoChar = p.label.length > 1;
  const labelSize = yd(twoChar ? LABEL_SIZE_2CH : LABEL_SIZE);
  const shade = shadePath(p.symbol, p.shade, r);

  if (p.symbol === 'letter') {
    const size = p.label.length > 2 ? LETTER_SIZE * 0.72 : p.label.length > 1 ? LETTER_SIZE * 0.85 : LETTER_SIZE;
    return (
      <g>
        {selected && <circle r={r * 1.4} fill="none" stroke={COLORS.selection} strokeWidth={yd(0.05)} />}
        <text textAnchor="middle" dy="0.35em" fontFamily={fontFamily} fontWeight={700} fontSize={yd(size)} fill={labelColorHex(p.labelColor)}>
          {p.label}
        </text>
      </g>
    );
  }

  let body: ReactNode;
  switch (p.symbol) {
    case 'square': {
      const s = yd(SQUARE_SIDE);
      body = <rect x={-s / 2} y={-s / 2} width={s} height={s} fill={COLORS.paper} stroke={stroke} strokeWidth={sw} />;
      break;
    }
    case 'triangle':
      body = <polygon points={`0,${-r * 1.15} ${r * 1.1},${r * 0.85} ${-r * 1.1},${r * 0.85}`} fill={COLORS.paper} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
      break;
    case 'diamond':
      body = <polygon points={`0,${-r * 1.2} ${r * 1.2},0 0,${r * 1.2} ${-r * 1.2},0`} fill={COLORS.paper} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />;
      break;
    case 'oval':
      body = <ellipse rx={r * 1.25} ry={r * 0.8} fill={COLORS.paper} stroke={stroke} strokeWidth={sw} />;
      break;
    default:
      body = <circle r={r} fill={COLORS.paper} stroke={stroke} strokeWidth={sw} />;
  }

  return (
    <g>
      {selected && <circle r={r * 1.55} fill="none" stroke={COLORS.selection} strokeWidth={yd(0.05)} />}
      {body}
      {shade && <path d={shade} fill={COLORS.ink} />}
      {p.bars === 1 && <line x1={0} x2={0} y1={-r * 0.85} y2={r * 0.85} stroke={stroke} strokeWidth={sw} />}
      {p.bars === 2 && (
        <>
          <line x1={-r * 0.32} x2={-r * 0.32} y1={-r * 0.85} y2={r * 0.85} stroke={stroke} strokeWidth={sw} />
          <line x1={r * 0.32} x2={r * 0.32} y1={-r * 0.85} y2={r * 0.85} stroke={stroke} strokeWidth={sw} />
        </>
      )}
      {p.label && !p.bars && (
        <text textAnchor="middle" dy="0.35em" fontFamily={fontFamily} fontWeight={700} fontSize={labelSize} fill={labelFill}>
          {p.label}
        </text>
      )}
    </g>
  );
}

export function PlayerLayer({ players, view, selectedIds }: { players: Record<string, Player>; view: ViewWindow; selectedIds?: ReadonlySet<string> }) {
  return (
    <g data-layer="players">
      {Object.values(players).map((p) => {
        const s = toSvg(p, view);
        return (
          <g key={p.id} transform={`translate(${s.x.toFixed(2)} ${s.y.toFixed(2)})`} data-hit={`player:${p.id}`} style={{ cursor: 'pointer' }}>
            <PlayerGlyph p={p} selected={selectedIds?.has(p.id)} />
          </g>
        );
      })}
    </g>
  );
}
