import { COLORS, STROKE } from '@/model/constants';
import type { Player, ViewWindow } from '@/model/types';
import { toSvg, yd } from '@/geometry/transform';
import { motionPoints } from '@/geometry/motion';
import { PlayerGlyph } from './PlayerLayer';

export { motionPoints };

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
