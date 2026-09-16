import { ARROW_LEN, COLORS, DASH, DOT_R, HIT_STROKE, PRIMARY_UNDERLAY, STROKE, SYMBOL_R } from '@/model/constants';
import type { Diagram, Path, Point, ViewWindow } from '@/model/types';
import { toSvg, yd } from '@/geometry/transform';
import { buildD, endTangent, resolvePoints, samplePolyline, shortenEnd, toSegments, trimStart } from '@/geometry/path';
import { arrowHead, squiggle, tBar } from '@/geometry/markers';
import { pathColorHex } from './theme';

export type BuiltPath = {
  d: string;
  points: Point[];
  end: Point;
  tangent: Point;
};

export function buildPath(path: Path, players: Diagram['players'], view: ViewWindow): BuiltPath | null {
  let pts = resolvePoints(path, players);
  if (pts.length < 2) return null;
  if (path.anchor.kind === 'player') pts = trimStart(pts, SYMBOL_R + 0.04);
  const end = pts[pts.length - 1];
  const tangent = endTangent(pts);
  if (path.end === 'arrow') pts = shortenEnd(pts, ARROW_LEN * 0.75);
  const segs = toSegments(pts);
  const map = (p: Point) => toSvg(p, view);
  if (path.line === 'squiggle') {
    const poly = squiggle(samplePolyline(segs, 0.12));
    const d = poly
      .map((p, i) => {
        const m = map(p);
        return `${i === 0 ? 'M' : 'L'} ${m.x.toFixed(2)} ${m.y.toFixed(2)}`;
      })
      .join(' ');
    return { d, points: pts, end, tangent };
  }
  return { d: buildD(segs, map), points: pts, end, tangent };
}

function Marker({ path, built, view, color, sw }: { path: Path; built: BuiltPath; view: ViewWindow; color: string; sw: number }) {
  const map = (p: Point) => toSvg(p, view);
  if (path.end === 'arrow') {
    const [a, b, c] = arrowHead(built.end, built.tangent).map(map);
    return (
      <polygon
        points={`${a.x.toFixed(2)},${a.y.toFixed(2)} ${b.x.toFixed(2)},${b.y.toFixed(2)} ${c.x.toFixed(2)},${c.y.toFixed(2)}`}
        fill={color}
        stroke={color}
        strokeWidth={sw * 0.5}
        strokeLinejoin="round"
      />
    );
  }
  if (path.end === 'tbar') {
    const [a, b] = tBar(built.end, built.tangent).map(map);
    return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={color} strokeWidth={sw * 1.15} strokeLinecap="round" />;
  }
  if (path.end === 'dot') {
    const m = map(built.end);
    return <circle cx={m.x} cy={m.y} r={yd(DOT_R)} fill={color} />;
  }
  return null;
}

export function PathLayer({ diagram, view, selectedPathId }: { diagram: Diagram; view: ViewWindow; selectedPathId?: string }) {
  const paths = Object.values(diagram.paths);
  const builtList = paths.map((p) => ({ path: p, built: buildPath(p, diagram.players, view) }));
  return (
    <g data-layer="paths">
      {builtList.map(({ path, built }) =>
        built && path.primary ? (
          <path
            key={`u${path.id}`}
            d={built.d}
            fill="none"
            stroke={COLORS.primary}
            strokeWidth={yd(PRIMARY_UNDERLAY)}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.95}
          />
        ) : null,
      )}
      {builtList.map(({ path, built }) => {
        if (!built) return null;
        const color = pathColorHex(path.color);
        const sw = yd(STROKE[path.width ?? 'normal']);
        const dash =
          path.line === 'dashed' ? DASH.dashed.map(yd).join(' ')
          : path.line === 'dotted' ? DASH.dotted.map(yd).join(' ')
          : undefined;
        const selected = selectedPathId === path.id;
        return (
          <g key={path.id} data-hit={`path:${path.id}`} style={{ cursor: 'pointer' }}>
            <path d={built.d} fill="none" stroke="transparent" strokeWidth={yd(HIT_STROKE)} />
            {selected && (
              <path d={built.d} fill="none" stroke={COLORS.selection} strokeWidth={sw * 3.2} opacity={0.35} strokeLinecap="round" strokeLinejoin="round" />
            )}
            <path
              d={built.d}
              fill="none"
              stroke={color}
              strokeWidth={sw}
              strokeDasharray={dash}
              strokeLinecap={path.line === 'dotted' ? 'round' : 'butt'}
              strokeLinejoin="round"
            />
            <Marker path={path} built={built} view={view} color={color} sw={sw} />
          </g>
        );
      })}
    </g>
  );
}
