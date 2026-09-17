import type { Point } from '@/model/types';

export type SnapGuide = {
  axis: 'x' | 'y';
  value: number;
  kind: 'align' | 'hash' | 'symmetry' | 'grid' | 'los' | 'spacing';
  /** For spacing guides: the neighbour the gap was measured from. */
  ref?: number;
};
export type SnapResult = { point: Point; guides: SnapGuide[] };

export type SnapContext = {
  /** Positions of other players (not the ones being dragged). */
  others: Point[];
  /** Grid step in yards (0 disables grid snapping). */
  grid?: number;
  /** Hash mark x offset from center; snaps to +/- hashX. */
  hashX?: number;
  /** Snap distance in yards. */
  threshold?: number;
  /** Mirror other players about x = 0. */
  symmetry?: boolean;
  /** Skip everything (Alt held). */
  disabled?: boolean;
  /** Lock to one axis relative to the drag origin (Shift held). */
  axisLock?: { origin: Point };
  /** Default gap used to line players up next to a neighbour when the row has no established gap. */
  spacing?: number;
};

type Cand = { v: number; kind: SnapGuide['kind']; ref?: number };

function nearest(value: number, candidates: Cand[], threshold: number) {
  let best: Cand | null = null;
  let bestD = threshold;
  for (const c of candidates) {
    const d = Math.abs(c.v - value);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return best;
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const ROW_TOL = 0.3;

/** Most common gap between consecutive x positions (rounded to 0.25), or undefined. */
function commonGap(xs: number[]): number | undefined {
  if (xs.length < 2) return undefined;
  const counts = new Map<number, number>();
  for (let i = 1; i < xs.length; i++) {
    const g = Math.round((xs[i] - xs[i - 1]) * 4) / 4;
    if (g > 0.2) counts.set(g, (counts.get(g) ?? 0) + 1);
  }
  let best: number | undefined;
  let bestN = 0;
  for (const [g, n] of counts) if (n > bestN || (n === bestN && best !== undefined && g < best)) { best = g; bestN = n; }
  return best;
}

/**
 * Snap a raw yard point. y: align with another player or the LOS, else grid.
 * x: players on the same row offer "next to me" slots (row gap or 1 yd) and midpoints between
 * neighbours; players on other rows offer vertical alignment; then hashes, mirror, center, grid.
 */
export function snapPoint(raw: Point, ctx: SnapContext): SnapResult {
  let p = { ...raw };
  const guides: SnapGuide[] = [];
  if (ctx.axisLock) {
    const dx = Math.abs(raw.x - ctx.axisLock.origin.x);
    const dy = Math.abs(raw.y - ctx.axisLock.origin.y);
    if (dx >= dy) p.y = ctx.axisLock.origin.y; else p.x = ctx.axisLock.origin.x;
  }
  if (ctx.disabled) return { point: p, guides };
  const th = ctx.threshold ?? 0.35;
  const grid = ctx.grid ?? 0.5;

  // ---- y ----
  const ys: Cand[] = ctx.others.map((o) => ({ v: o.y, kind: 'align' as const }));
  ys.push({ v: 0, kind: 'los' });
  const sy = nearest(p.y, ys, th);
  if (sy) {
    p.y = sy.v;
    guides.push({ axis: 'y', value: sy.v, kind: sy.kind });
  } else if (grid > 0) p.y = Math.round(p.y / grid) * grid;

  // ---- x ----
  const mates = ctx.others.filter((o) => Math.abs(o.y - p.y) < ROW_TOL).map((o) => o.x).sort((a, b) => a - b);
  const xs: Cand[] = [];
  const gap = commonGap(mates) ?? ctx.spacing ?? 1;
  const occupied = (v: number) => mates.some((m) => Math.abs(m - v) < 0.15);
  for (let i = 0; i < mates.length; i++) {
    const m = mates[i];
    for (const v of [m + gap, m - gap]) if (!occupied(v)) xs.push({ v, kind: 'spacing', ref: m });
    if (i + 1 < mates.length && mates[i + 1] - m >= 1.2) xs.push({ v: (m + mates[i + 1]) / 2, kind: 'spacing', ref: m });
  }
  for (const o of ctx.others) if (Math.abs(o.y - p.y) >= ROW_TOL) xs.push({ v: o.x, kind: 'align' });
  if (ctx.hashX) xs.push({ v: ctx.hashX, kind: 'hash' }, { v: -ctx.hashX, kind: 'hash' });
  if (ctx.symmetry) for (const o of ctx.others) if (Math.abs(o.x) > 0.01 && !occupied(-o.x)) xs.push({ v: -o.x, kind: 'symmetry' });
  if (!occupied(0)) xs.push({ v: 0, kind: 'symmetry' });

  const sx = nearest(p.x, xs, th);
  if (sx) {
    p.x = sx.v;
    guides.push({ axis: 'x', value: sx.v, kind: sx.kind, ref: sx.ref });
  } else if (grid > 0) p.x = Math.round(p.x / grid) * grid;

  p = { x: round3(p.x), y: round3(p.y) };
  return { point: p, guides };
}

export type WaypointOptions = {
  grid?: number;
  disabled?: boolean;
  threshold?: number;
  axisLock?: boolean;
  /** Snap the segment direction to multiples of this angle in degrees (e.g. 45 for blocks). */
  angleSnap?: number;
};

/** Snap a route waypoint: optional angle snap from the previous point, alignment with it, else grid. */
export function snapWaypoint(raw: Point, prev: Point | null, opts: WaypointOptions = {}): SnapResult {
  if (opts.disabled) return { point: raw, guides: [] };
  const grid = opts.grid ?? 0.5;
  const th = opts.threshold ?? 0.3;
  const p = { x: raw.x, y: raw.y };
  const guides: SnapGuide[] = [];
  if (prev && opts.angleSnap) {
    const dx = raw.x - prev.x;
    const dy = raw.y - prev.y;
    const dist = Math.round(Math.hypot(dx, dy) * 4) / 4;
    if (dist > 0) {
      const step = (opts.angleSnap * Math.PI) / 180;
      const a = Math.round(Math.atan2(dy, dx) / step) * step;
      return { point: { x: round3(prev.x + Math.cos(a) * dist), y: round3(prev.y + Math.sin(a) * dist) }, guides };
    }
  }
  if (prev) {
    if (opts.axisLock) {
      if (Math.abs(raw.x - prev.x) >= Math.abs(raw.y - prev.y)) p.y = prev.y; else p.x = prev.x;
    }
    if (Math.abs(p.x - prev.x) < th) {
      p.x = prev.x;
      guides.push({ axis: 'x', value: prev.x, kind: 'align' });
    }
    if (Math.abs(p.y - prev.y) < th) {
      p.y = prev.y;
      guides.push({ axis: 'y', value: prev.y, kind: 'align' });
    }
  }
  if (grid > 0) {
    if (!guides.some((g) => g.axis === 'x')) p.x = Math.round(p.x / grid) * grid;
    if (!guides.some((g) => g.axis === 'y')) p.y = Math.round(p.y / grid) * grid;
  }
  return { point: { x: round3(p.x), y: round3(p.y) }, guides };
}
