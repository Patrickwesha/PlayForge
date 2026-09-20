import { COLORS, STROKE } from '@/model/constants';
import type { Player, Point, ViewWindow } from '@/model/types';
import { toSvg, yd } from '@/geometry/transform';
import { PlayerGlyph } from './PlayerLayer';

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

/**
 * Pre-snap motions and shifts: a dashed orange ghost where the player lines up first, and a dotted
 * red path to where he ends up. Drawn under the players so the solid final spot always wins.
 */
export function MotionLayer({ players, view }: { players: Record<string, Player>; view: ViewWindow }) {
  const movers = Object.values(players).filter((p) => p.motion);
  if (movers.length === 0) return null;
  return (
    <g data-layer="motion">
      {movers.map((p) => {
        const pts = motionPoints(p).map((pt) => toSvg(pt, view));
        const ghost = toSvg(p.motion!.from, view);
        return (
          <g key={p.id} data-motion={p.id} data-motion-tag={p.motion!.tag}>
            <polyline
              points={pts.map((s) => `${s.x.toFixed(2)},${s.y.toFixed(2)}`).join(' ')}
              fill="none"
              stroke={COLORS.red}
              strokeWidth={yd(STROKE.normal)}
              strokeDasharray={`${yd(0.06)} ${yd(0.22)}`}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <g transform={`translate(${ghost.x.toFixed(2)} ${ghost.y.toFixed(2)})`} data-ghost={p.id}>
              <PlayerGlyph p={{ ...p, outline: 'dashed', labelColor: 'orange', shade: 'none' }} />
            </g>
          </g>
        );
      })}
    </g>
  );
}
