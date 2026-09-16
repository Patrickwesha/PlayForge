import type { Point } from '@/model/types';

export type SnapGuide = { axis: 'x' | 'y'; value: number; kind: 'align' | 'hash' | 'symmetry' | 'grid' | 'los' };
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
};

function nearest(value: number, candidates: { v: number; kind: SnapGuide['kind'] }[], threshold: number) {
  let best: { v: number; kind: SnapGuide['kind'] } | null = null;
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

/**
 * Snap a raw yard point. Priority per axis: align with another player, hash marks,
 * mirror of another player, LOS (y only), then the grid.
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

  const xs: { v: number; kind: SnapGuide['kind'] }[] = [];
  const ys: { v: number; kind: SnapGuide['kind'] }[] = [];
  for (const o of ctx.others) {
    xs.push({ v: o.x, kind: 'align' });
    ys.push({ v: o.y, kind: 'align' });
  }
  if (ctx.hashX) xs.push({ v: ctx.hashX, kind: 'hash' }, { v: -ctx.hashX, kind: 'hash' });
  if (ctx.symmetry) for (const o of ctx.others) if (Math.abs(o.x) > 0.01) xs.push({ v: -o.x, kind: 'symmetry' });
  xs.push({ v: 0, kind: 'symmetry' });
  ys.push({ v: 0, kind: 'los' });

  const sx = nearest(p.x, xs, th);
  const sy = nearest(p.y, ys, th);
  if (sx) {
    p.x = sx.v;
    guides.push({ axis: 'x', value: sx.v, kind: sx.kind });
  } else if (grid > 0) p.x = Math.round(p.x / grid) * grid;
  if (sy) {
    p.y = sy.v;
    guides.push({ axis: 'y', value: sy.v, kind: sy.kind });
  } else if (grid > 0) p.y = Math.round(p.y / grid) * grid;

  p = { x: round3(p.x), y: round3(p.y) };
  return { point: p, guides };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

/** Snap a route waypoint: grid only, plus alignment with the path's previous point. */
export function snapWaypoint(raw: Point, prev: Point | null, opts: { grid?: number; disabled?: boolean; threshold?: number; axisLock?: boolean } = {}): SnapResult {
  if (opts.disabled) return { point: raw, guides: [] };
  const grid = opts.grid ?? 0.5;
  const th = opts.threshold ?? 0.3;
  const p = { x: raw.x, y: raw.y };
  const guides: SnapGuide[] = [];
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
