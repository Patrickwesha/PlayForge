import { ARROW_HALF_W, ARROW_LEN, SQUIGGLE_AMP, SQUIGGLE_STEP, TBAR_HALF_W } from '@/model/constants';
import type { Point } from '@/model/types';

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
