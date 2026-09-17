import type { Diagram, Path, PathPoint, Point } from '@/model/types';

export type Segment = { from: Point; to: Point; c1?: Point; c2?: Point };

const sub = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });
const add = (a: Point, b: Point): Point => ({ x: a.x + b.x, y: a.y + b.y });
const mul = (a: Point, k: number): Point => ({ x: a.x * k, y: a.y * k });
export const len = (a: Point) => Math.hypot(a.x, a.y);
export const norm = (a: Point): Point => {
  const l = len(a);
  return l === 0 ? { x: 0, y: 1 } : { x: a.x / l, y: a.y / l };
};

/** Absolute points for a path (adds the anchor player's position). */
export function resolvePoints(path: Path, players: Diagram['players']): PathPoint[] {
  if (path.anchor.kind === 'player') {
    const p = players[path.anchor.playerId];
    if (!p) return [];
    return path.points.map((pt) => ({ ...pt, x: pt.x + p.x, y: pt.y + p.y }));
  }
  return path.points.map((pt) => ({ ...pt }));
}

/** Move the first point along the first segment by r so the line starts at the symbol edge. */
export function trimStart(points: PathPoint[], r: number): PathPoint[] {
  if (points.length < 2) return points;
  const d = sub(points[1], points[0]);
  const l = len(d);
  if (l <= r * 1.5) return points;
  const u = norm(d);
  return [{ ...points[0], x: points[0].x + u.x * r, y: points[0].y + u.y * r }, ...points.slice(1)];
}

/**
 * Convert points to segments. A segment whose end point carries `bend` is a quadratic arc
 * through that control (stored as the equivalent cubic). Otherwise a point flagged `smooth`
 * gets a Catmull-Rom style tangent (half the chord between its neighbours); other points are corners.
 */
export function toSegments(points: PathPoint[]): Segment[] {
  const n = points.length;
  const segs: Segment[] = [];
  for (let i = 0; i < n - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];
    if (p2.bend) {
      const c = p2.bend;
      segs.push({ from: p1, to: p2, c1: add(p1, mul(sub(c, p1), 2 / 3)), c2: add(p2, mul(sub(c, p2), 2 / 3)) });
      continue;
    }
    const s1 = !!p1.smooth && i > 0 && !p1.bend;
    const s2 = !!p2.smooth && i + 2 < n;
    if (!s1 && !s2) {
      segs.push({ from: p1, to: p2 });
      continue;
    }
    const t1 = s1 ? mul(sub(p2, points[i - 1]), 0.5) : sub(p2, p1);
    const t2 = s2 ? mul(sub(points[i + 2], p1), 0.5) : sub(p2, p1);
    segs.push({ from: p1, to: p2, c1: add(p1, mul(t1, 1 / 3)), c2: sub(p2, mul(t2, 1 / 3)) });
  }
  return segs;
}

/** Direction (unit vector) at the end of the path. */
export function endTangent(points: PathPoint[]): Point {
  const segs = toSegments(points);
  if (segs.length === 0) return { x: 0, y: 1 };
  const last = segs[segs.length - 1];
  const from = last.c2 ?? last.from;
  return norm(sub(last.to, from));
}

/** Direction at the start of the path. */
export function startTangent(points: PathPoint[]): Point {
  const segs = toSegments(points);
  if (segs.length === 0) return { x: 0, y: 1 };
  const first = segs[0];
  const to = first.c1 ?? first.to;
  return norm(sub(to, first.from));
}

/** Pull the last point back along the end tangent by d (so a marker tip can sit on the real end). */
export function shortenEnd(points: PathPoint[], d: number): PathPoint[] {
  if (points.length < 2) return points;
  const t = endTangent(points);
  const last = points[points.length - 1];
  return [...points.slice(0, -1), { ...last, x: last.x - t.x * d, y: last.y - t.y * d }];
}

/** Build an SVG "d" string from segments using a coordinate mapper. */
export function buildD(segs: Segment[], map: (p: Point) => Point, decimals = 2): string {
  if (segs.length === 0) return '';
  const f = (p: Point) => {
    const m = map(p);
    return `${m.x.toFixed(decimals)} ${m.y.toFixed(decimals)}`;
  };
  let d = `M ${f(segs[0].from)}`;
  for (const s of segs) {
    if (s.c1 && s.c2) d += ` C ${f(s.c1)} ${f(s.c2)} ${f(s.to)}`;
    else d += ` L ${f(s.to)}`;
  }
  return d;
}

/** Midpoint of each segment (where the bend handles sit). */
export function segmentMidpoints(points: PathPoint[]): Point[] {
  return toSegments(points).map((s) => bezierAt(s, 0.5));
}

/**
 * Quadratic control point that makes the arc from a to b pass through m at t = 0.5.
 * Returns undefined when m is (nearly) on the chord, meaning "straight".
 */
export function bendThrough(a: Point, b: Point, m: Point, straightTolerance = 0.2): Point | undefined {
  const chordMid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const chord = sub(b, a);
  const l = len(chord);
  const off = l === 0 ? len(sub(m, chordMid)) : Math.abs((m.x - a.x) * chord.y - (m.y - a.y) * chord.x) / l;
  if (off < straightTolerance) return undefined;
  return { x: 2 * m.x - chordMid.x, y: 2 * m.y - chordMid.y };
}

/** Approximate a cubic (c1, c2) with a single quadratic control point. */
export function quadraticFromCubic(p0: Point, c1: Point, c2: Point, p3: Point): Point {
  return { x: (3 * (c1.x + c2.x) - (p0.x + p3.x)) / 4, y: (3 * (c1.y + c2.y) - (p0.y + p3.y)) / 4 };
}

export function bezierAt(s: Segment, t: number): Point {
  if (!s.c1 || !s.c2) return add(s.from, mul(sub(s.to, s.from), t));
  const mt = 1 - t;
  const a = mt * mt * mt;
  const b = 3 * mt * mt * t;
  const c = 3 * mt * t * t;
  const d = t * t * t;
  return {
    x: a * s.from.x + b * s.c1.x + c * s.c2.x + d * s.to.x,
    y: a * s.from.y + b * s.c1.y + c * s.c2.y + d * s.to.y,
  };
}

/** Sample segments into a polyline with roughly `step` spacing (yards). */
export function samplePolyline(segs: Segment[], step: number): Point[] {
  const out: Point[] = [];
  segs.forEach((s, i) => {
    const approx = s.c1 && s.c2
      ? len(sub(s.c1, s.from)) + len(sub(s.c2, s.c1)) + len(sub(s.to, s.c2))
      : len(sub(s.to, s.from));
    const n = Math.max(1, Math.ceil(approx / step));
    for (let k = i === 0 ? 0 : 1; k <= n; k++) out.push(bezierAt(s, k / n));
  });
  return out;
}

export function polylineLength(points: Point[]): number {
  let l = 0;
  for (let i = 1; i < points.length; i++) l += len(sub(points[i], points[i - 1]));
  return l;
}

/** Midpoint of a cubic bezier (used by the legacy importer). */
export function cubicMidpoint(p0: Point, c1: Point, c2: Point, p3: Point): Point {
  return bezierAt({ from: p0, c1, c2, to: p3 }, 0.5);
}

/** Distance from a point to the nearest point on a polyline (yards). */
export function distanceToPolyline(p: Point, poly: Point[]): number {
  let best = Infinity;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1];
    const b = poly[i];
    const ab = sub(b, a);
    const l2 = ab.x * ab.x + ab.y * ab.y;
    const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2));
    const q = add(a, mul(ab, t));
    best = Math.min(best, len(sub(p, q)));
  }
  return best;
}
