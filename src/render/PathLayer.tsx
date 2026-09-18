import { ARROW_LEN, COLORS, DASH, DOT_R, HIT_STROKE, LETTER_SIZE, PRIMARY_UNDERLAY, STROKE, SYMBOL_R } from '@/model/constants';
import type { Diagram, Path, Point, ViewWindow } from '@/model/types';
import { toSvg, yd } from '@/geometry/transform';
import { buildD, endTangent, pointAlong, resolvePoints, samplePolyline, shortenEnd, toSegments, trimStart } from '@/geometry/path';
import { angledBar, arrowHead, insertGlyph, squiggle, tBar } from '@/geometry/markers';
import { pathColorHex } from './theme';

export type BuiltPath = {
  d: string;
  /** absolute points after trimming */
  points: Point[];
  /** sampled polyline (yards) used for inserts */
  poly: Point[];
  end: Point;
  tangent: Point;
};

/** Radius to keep clear around another player's symbol (yards). */
function clearRadius(symbol: Diagram['players'][string]['symbol']): number {
  return symbol === 'letter' ? LETTER_SIZE * 0.55 : SYMBOL_R + 0.12;
}

/**
 * Keep the line from running into another player's symbol: if the end lands inside a
 * symbol, pull it back to the symbol's edge so T-bars and arrows sit clean.
 */
function clearEnd(pts: Point[], path: Path, players: Diagram['players']): Point[] {
  if (pts.length < 2) return pts;
  const end = pts[pts.length - 1];
  const anchorId = path.anchor.kind === 'player' ? path.anchor.playerId : null;
  let best: { d: number; r: number } | null = null;
  for (const p of Object.values(players)) {
    if (p.id === anchorId) continue;
    const d = Math.hypot(p.x - end.x, p.y - end.y);
    const r = clearRadius(p.symbol);
    if (d < r && (!best || d < best.d)) best = { d, r };
  }
  if (!best) return pts;
  return shortenEnd(pts, best.r - best.d);
}

export function buildPath(path: Path, players: Diagram['players'], view: ViewWindow): BuiltPath | null {
  let pts = resolvePoints(path, players);
  if (pts.length < 2) return null;
  // Lines start at the player's center; a filled symbol drawn on top hides that stub so there is
  // no visible gap. Bare-letter defenders have nothing to hide it, so trim to the letter's edge.
  if (path.anchor.kind === 'player' && players[path.anchor.playerId]?.symbol === 'letter') pts = trimStart(pts, LETTER_SIZE * 0.55);
  pts = clearEnd(pts, path, players);
  const end = pts[pts.length - 1];
  const tangent = endTangent(pts);
  const width = STROKE[path.width ?? 'normal'] / STROKE.normal;
  if (path.end === 'arrow') pts = shortenEnd(pts, ARROW_LEN * width * 0.7);
  const segs = toSegments(pts);
  const map = (p: Point) => toSvg(p, view);
  const poly = samplePolyline(segs, 0.12);
  if (path.line === 'squiggle') {
    const sq = squiggle(poly);
    const d = sq
      .map((p, i) => {
        const m = map(p);
        return `${i === 0 ? 'M' : 'L'} ${m.x.toFixed(2)} ${m.y.toFixed(2)}`;
      })
      .join(' ');
    return { d, points: pts, poly, end, tangent };
  }
  return { d: buildD(segs, map), points: pts, poly, end, tangent };
}

function Marker({ path, built, view, color, sw }: { path: Path; built: BuiltPath; view: ViewWindow; color: string; sw: number }) {
  const map = (p: Point) => toSvg(p, view);
  const scale = sw / yd(STROKE.normal);
  switch (path.end) {
    case 'arrow': {
      const [a, b, c] = arrowHead(built.end, built.tangent, ARROW_LEN * scale, 0.28 * scale).map(map);
      return <polygon points={`${a.x.toFixed(2)},${a.y.toFixed(2)} ${b.x.toFixed(2)},${b.y.toFixed(2)} ${c.x.toFixed(2)},${c.y.toFixed(2)}`} fill={color} stroke={color} strokeWidth={sw * 0.4} strokeLinejoin="round" />;
    }
    case 'openArrow': {
      const [a, b, c] = arrowHead(built.end, built.tangent, ARROW_LEN * 1.1 * scale, 0.34 * scale).map(map);
      return <polyline points={`${b.x.toFixed(2)},${b.y.toFixed(2)} ${a.x.toFixed(2)},${a.y.toFixed(2)} ${c.x.toFixed(2)},${c.y.toFixed(2)}`} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />;
    }
    case 'tbar': {
      const [a, b] = tBar(built.end, built.tangent, 0.35 * Math.max(1, scale * 0.9)).map(map);
      return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={sw * 1.15} strokeLinecap="round" />;
    }
    case 'tbarAngled': {
      const [a, b] = angledBar(built.end, built.tangent).map(map);
      return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={sw * 1.15} strokeLinecap="round" />;
    }
    case 'dot': {
      const m = map(built.end);
      return <circle cx={m.x} cy={m.y} r={yd(DOT_R) * Math.max(1, scale * 0.9)} fill={color} />;
    }
    default:
      return null;
  }
}

function Inserts({ path, built, view, color, sw }: { path: Path; built: BuiltPath; view: ViewWindow; color: string; sw: number }) {
  if (!path.inserts?.length) return null;
  const map = (p: Point) => toSvg(p, view);
  return (
    <g stroke={color} strokeWidth={sw} strokeLinecap="round" fill="none">
      {path.inserts.map((ins, i) => {
        const { point, dir } = pointAlong(built.poly, ins.t);
        return insertGlyph(ins.kind, point, dir).map(([a, b], k) => {
          const A = map(a);
          const B = map(b);
          return <line key={`${i}-${k}`} x1={A.x} y1={A.y} x2={B.x} y2={B.y} />;
        });
      })}
    </g>
  );
}

/** Clear space on each side of a line where it crosses a line drawn after it (yards). */
const CROSS_GAP = 0.13;

/**
 * Paths render newest-first so the FIRST line drawn ends up on top. Every line carries a
 * paper-colored halo under its stroke, so wherever a line on top crosses one beneath it, the
 * halo cuts a small gap in the lower line (FirstDown-style bridges) while the top line stays whole.
 */
export function PathLayer({ diagram, view, selectedPathId }: { diagram: Diagram; view: ViewWindow; selectedPathId?: string }) {
  const paths = Object.values(diagram.paths).reverse();
  const builtList = paths.map((p) => ({ path: p, built: buildPath(p, diagram.players, view) }));
  return (
    <g data-layer="paths">
      {builtList.map(({ path, built }) => {
        if (!built) return null;
        const color = pathColorHex(path.color);
        const sw = yd(STROKE[path.width ?? 'normal']);
        const dash =
          path.line === 'dashed' ? DASH.dashed.map(yd).join(' ')
          : path.line === 'dotted' ? `${(sw * 0.1).toFixed(2)} ${(sw * 2.6).toFixed(2)}`
          : undefined;
        const selected = selectedPathId === path.id;
        return (
          <g key={path.id} data-hit={`path:${path.id}`} style={{ cursor: 'pointer' }}>
            <path d={built.d} fill="none" stroke="transparent" strokeWidth={yd(HIT_STROKE)} />
            <path d={built.d} fill="none" stroke={COLORS.paper} strokeWidth={sw + 2 * yd(CROSS_GAP)} strokeLinecap="butt" strokeLinejoin="round" />
            {path.primary && (
              <path d={built.d} fill="none" stroke={COLORS.primary} strokeWidth={yd(PRIMARY_UNDERLAY)} strokeLinecap="round" strokeLinejoin="round" opacity={0.95} />
            )}
            {selected && <path d={built.d} fill="none" stroke={COLORS.selection} strokeWidth={sw * 3} opacity={0.3} strokeLinecap="round" strokeLinejoin="round" />}
            <path
              d={built.d}
              fill="none"
              stroke={color}
              strokeWidth={sw}
              strokeDasharray={dash}
              strokeLinecap={path.line === 'dotted' ? 'round' : 'butt'}
              strokeLinejoin="round"
            />
            <Inserts path={path} built={built} view={view} color={color} sw={sw} />
            <Marker path={path} built={built} view={view} color={color} sw={sw} />
          </g>
        );
      })}
    </g>
  );
}
