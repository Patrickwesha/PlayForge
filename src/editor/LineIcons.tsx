import type { LineStyle, PathColor, PathEnd, PathInsertKind, PathWidth } from '@/model/types';
import { pathColorHex } from '@/render/theme';

const W = 34;
const H = 22;
const stroke = 'currentColor';

export function ThicknessIcon({ width }: { width: PathWidth }) {
  const sw = width === 'thin' ? 1.2 : width === 'thick' ? 4 : 2.4;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <line x1={5} y1={H / 2} x2={W - 5} y2={H / 2} stroke={stroke} strokeWidth={sw} strokeLinecap="round" />
    </svg>
  );
}

export function StyleIcon({ line }: { line: LineStyle }) {
  if (line === 'squiggle') {
    const pts: string[] = [];
    for (let x = 5; x <= W - 5; x += 2) pts.push(`${x},${H / 2 + Math.sin((x / 4) * Math.PI) * 3}`);
    return (
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
        <polyline points={pts.join(' ')} fill="none" stroke={stroke} strokeWidth={2} />
      </svg>
    );
  }
  const dash = line === 'dashed' ? '6 4' : line === 'dotted' ? '1.5 4' : undefined;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <line x1={5} y1={H / 2} x2={W - 5} y2={H / 2} stroke={stroke} strokeWidth={2.4} strokeDasharray={dash} strokeLinecap="round" />
    </svg>
  );
}

export function EndIcon({ end }: { end: PathEnd }) {
  const cx = W / 2;
  const top = 4;
  const bottom = H - 3;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {end === 'none' && (
        <>
          <circle cx={cx} cy={H / 2} r={7} />
          <line x1={cx - 5} y1={H / 2 + 5} x2={cx + 5} y2={H / 2 - 5} />
        </>
      )}
      {end !== 'none' && <line x1={cx} y1={bottom} x2={cx} y2={end === 'arrow' || end === 'openArrow' ? top + 5 : top + 1} />}
      {end === 'arrow' && <polygon points={`${cx},${top} ${cx - 5},${top + 8} ${cx + 5},${top + 8}`} fill={stroke} />}
      {end === 'openArrow' && <polyline points={`${cx - 5},${top + 7} ${cx},${top} ${cx + 5},${top + 7}`} />}
      {end === 'dot' && <circle cx={cx} cy={top + 2} r={3.5} fill={stroke} />}
      {end === 'tbar' && <line x1={cx - 7} y1={top + 1} x2={cx + 7} y2={top + 1} strokeWidth={2.6} />}
      {end === 'tbarAngled' && <line x1={cx - 6} y1={top + 6} x2={cx + 6} y2={top - 3} strokeWidth={2.6} />}
      {end === 'tbarAngledL' && <line x1={cx - 6} y1={top - 3} x2={cx + 6} y2={top + 6} strokeWidth={2.6} />}
    </svg>
  );
}

export function InsertIcon({ kind }: { kind: PathInsertKind }) {
  const cx = W / 2;
  const cy = H / 2;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round">
      <line x1={5} y1={cy} x2={W - 5} y2={cy} strokeWidth={1.2} opacity={0.5} />
      {(kind === 'bars' || kind === 'chip') && (
        <>
          <line x1={cx - 3} y1={cy - 6} x2={cx - 3} y2={cy + 6} />
          <line x1={cx + 3} y1={cy - 6} x2={cx + 3} y2={cy + 6} />
        </>
      )}
      {kind === 'chip' && <line x1={cx - 7} y1={cy + 6} x2={cx + 7} y2={cy - 6} />}
      {kind === 'zigzag' && <polyline points={`${cx - 8},${cy} ${cx - 4},${cy - 6} ${cx},${cy + 6} ${cx + 4},${cy - 6} ${cx + 8},${cy}`} />}
      {kind === 'x' && (
        <>
          <line x1={cx - 5} y1={cy - 5} x2={cx + 5} y2={cy + 5} />
          <line x1={cx - 5} y1={cy + 5} x2={cx + 5} y2={cy - 5} />
        </>
      )}
    </svg>
  );
}

export function ColorSwatch({ color, selected }: { color: PathColor; selected: boolean }) {
  return (
    <svg width={22} height={22} viewBox="0 0 22 22">
      {selected && <circle cx={11} cy={11} r={10} fill="none" stroke="#2D7FF9" strokeWidth={2} />}
      <line x1={5} y1={11} x2={17} y2={11} stroke={pathColorHex(color)} strokeWidth={3.5} strokeLinecap="round" />
    </svg>
  );
}

export const END_OPTIONS: { end: PathEnd; name: string }[] = [
  { end: 'none', name: 'None' },
  { end: 'arrow', name: 'Arrow' },
  { end: 'openArrow', name: 'Open arrow' },
  { end: 'dot', name: 'Dot' },
  { end: 'tbar', name: 'Block (T)' },
  { end: 'tbarAngled', name: 'Angled block' },
  { end: 'tbarAngledL', name: 'Angled block (flipped)' },
];
export const STYLE_OPTIONS: { line: LineStyle; name: string }[] = [
  { line: 'solid', name: 'Solid' },
  { line: 'dashed', name: 'Dashed' },
  { line: 'dotted', name: 'Dotted' },
  { line: 'squiggle', name: 'Wavy (motion)' },
];
export const WIDTH_OPTIONS: { width: PathWidth; name: string }[] = [
  { width: 'thick', name: 'Thick' },
  { width: 'normal', name: 'Medium' },
  { width: 'thin', name: 'Thin' },
];
export const INSERT_OPTIONS: { kind: PathInsertKind; name: string }[] = [
  { kind: 'bars', name: 'Double bar' },
  { kind: 'chip', name: 'Chip' },
  { kind: 'zigzag', name: 'Zigzag' },
  { kind: 'x', name: 'X' },
];
