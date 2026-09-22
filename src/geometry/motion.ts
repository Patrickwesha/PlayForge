import type { Player, Point } from '@/model/types';

/** A motion never crosses the line of scrimmage: anything on the ball dips behind it on the way. */
const BEHIND_LOS = -1;

/** from -> via -> player, in yards, kept behind the line of scrimmage. */
export function motionPoints(p: Player): Point[] {
  if (!p.motion) return [];
  const pts: Point[] = [p.motion.from, ...(p.motion.via ?? []), { x: p.x, y: p.y }];
  const out: Point[] = [];
  pts.forEach((pt, i) => {
    out.push(pt);
    const next = pts[i + 1];
    if (!next) return;
    // leaving or reaching a spot on the ball: travel one yard behind the line in between
    if (Math.max(pt.y, next.y) > BEHIND_LOS && Math.abs(next.x - pt.x) > 1.5) {
      const dir = Math.sign(next.x - pt.x);
      if (pt.y > BEHIND_LOS) out.push({ x: pt.x + dir * 0.75, y: BEHIND_LOS });
      if (next.y > BEHIND_LOS) out.push({ x: next.x - dir * 0.75, y: BEHIND_LOS });
    }
  });
  return out;
}
