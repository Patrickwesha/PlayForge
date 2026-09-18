import { ARROW_HALF_W, ARROW_LEN, SQUIGGLE_AMP, SQUIGGLE_STEP, TBAR_HALF_W } from '@/model/constants';
import type { PathInsertKind, Point } from '@/model/types';

/** Arrowhead triangle with its tip at `tip`, pointing along unit `dir`. Returns 3 points (yards). */
export function arrowHead(tip: Point, dir: Point, lenYd = ARROW_LEN, halfW = ARROW_HALF_W): [Point, Point, Point] {
  const bx = tip.x - dir.x * lenYd;
  const by = tip.y - dir.y * lenYd;
  const nx = -dir.y;
  const ny = dir.x;
  return [
    tip,
    { x: bx + nx * halfW, y: by + ny * halfW },
    { x: bx - nx * halfW, y: by - ny * halfW },
  ];
}

/** T-bar perpendicular to `dir` centered at `end`. */
export function tBar(end: Point, dir: Point, halfW = TBAR_HALF_W): [Point, Point] {
  const nx = -dir.y;
  const ny = dir.x;
  return [
    { x: end.x + nx * halfW, y: end.y + ny * halfW },
    { x: end.x - nx * halfW, y: end.y - ny * halfW },
  ];
}

/** Bar rotated 45 degrees from perpendicular (cut / chip block mark). */
export function angledBar(end: Point, dir: Point, halfW = TBAR_HALF_W * 1.15): [Point, Point] {
  const c = Math.SQRT1_2;
  // rotate the perpendicular by 45 degrees
  const nx = -dir.y * c - dir.x * c;
  const ny = dir.x * c - dir.y * c;
  return [
    { x: end.x + nx * halfW, y: end.y + ny * halfW },
    { x: end.x - nx * halfW, y: end.y - ny * halfW },
  ];
}

/** Line-based glyph for an insert placed on the path at `at`, with unit tangent `dir`. */
export function insertGlyph(kind: PathInsertKind, at: Point, dir: Point): [Point, Point][] {
  const n = { x: -dir.y, y: dir.x };
  const u = dir;
  const P = (a: number, b: number): Point => ({ x: at.x + u.x * a + n.x * b, y: at.y + u.y * a + n.y * b });
  switch (kind) {
    case 'bars':
      return [
        [P(-0.16, -0.36), P(-0.16, 0.36)],
        [P(0.16, -0.36), P(0.16, 0.36)],
      ];
    case 'chip':
      return [
        [P(-0.16, -0.36), P(-0.16, 0.36)],
        [P(0.16, -0.36), P(0.16, 0.36)],
        [P(-0.4, -0.4), P(0.4, 0.4)],
      ];
    case 'zigzag':
      return [
        [P(-0.45, 0), P(-0.25, 0.32)],
        [P(-0.25, 0.32), P(0, -0.32)],
        [P(0, -0.32), P(0.25, 0.32)],
        [P(0.25, 0.32), P(0.45, 0)],
      ];
    case 'x':
      return [
        [P(-0.3, -0.3), P(0.3, 0.3)],
        [P(-0.3, 0.3), P(0.3, -0.3)],
      ];
  }
}

/** Offset a polyline by a sine wave perpendicular to its direction (motion squiggle). */
export function squiggle(poly: Point[], amp = SQUIGGLE_AMP, step = SQUIGGLE_STEP): Point[] {
  if (poly.length < 2) return poly;
  const out: Point[] = [poly[0]];
  let dist = 0;
  for (let i = 1; i < poly.length; i++) {
    const a = poly[i - 1];
    const b = poly[i];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const segLen = Math.hypot(dx, dy);
    if (segLen === 0) continue;
    const ux = dx / segLen;
    const uy = dy / segLen;
    const n = Math.max(1, Math.ceil(segLen / (step / 2)));
    for (let k = 1; k <= n; k++) {
      const t = k / n;
      const d = dist + segLen * t;
      const isLast = i === poly.length - 1 && k === n;
      const off = isLast ? 0 : Math.sin((d / step) * Math.PI * 2) * amp;
      out.push({ x: a.x + dx * t - uy * off, y: a.y + dy * t + ux * off });
    }
    dist += segLen;
  }
  return out;
}
