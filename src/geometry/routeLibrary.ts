import { FIELD_WIDTH_YD } from '@/model/constants';
import type { Path, PathPoint, Player, RouteDef } from '@/model/types';

/** Field landmarks a route description can point at, as x distances from the ball. */
export const ROUTE_LANDMARKS = {
  /** Same value as the formation pack's `numbers`. */
  numbers: 18,
  /** Seam rule: 2 yards inside the numbers (field side). */
  seam: 16,
  /** Red line: about 5 yards inside the sideline. */
  redline: 21.5,
  /** Just inside the sideline, where a Flat finishes. */
  sideline: FIELD_WIDTH_YD / 2 - 1.2,
} as const;

const SNAP = 0.25;
const snap = (n: number) => Math.round(n / SNAP) * SNAP + 0;

export type RouteDefOptions = {
  id: string;
  /** 1 = toward the right sideline is "outside", -1 = left. Defaults to the side of the ball the player is on. */
  side?: 1 | -1;
  /** x of the hash marks for routes that aim at one. */
  hashX?: number;
  primary?: boolean;
};

/**
 * Build a player-anchored route from a route library record. Same convention as the 0-9 route tree:
 * the record is written for a right-side receiver and mirrored for the left. Depths in the record are
 * yards from the line of scrimmage, so a receiver off the ball still breaks at the stated depth.
 */
export function routeDefPath(def: RouteDef, player: Player, opts: RouteDefOptions): Path {
  const m = opts.side ?? (player.x < 0 ? -1 : 1);
  const rel = def.points.map((p, i): PathPoint => {
    if (i === 0) return { x: 0, y: 0 };
    const depthIsAbsolute = def.frame === 'back' ? !p.relativeY : p.y > 0;
    return { x: p.x * m, y: depthIsAbsolute ? p.y - player.y : p.y, ...(p.smooth ? { smooth: true } : {}) };
  });

  // Landmarks move the route's aim point to a spot on the field instead of a spot relative to the player.
  const lm = def.landmark;
  const last = rel.length - 1;
  const aimAt = (index: number, absX: number) => {
    const target = absX - player.x;
    const old = rel[index].x;
    if (Math.abs(old) > 0.01) {
      const k = target / old;
      // only stretch or squeeze; a landmark on the far side of the player would flip the route
      if (k > 0) for (let i = 1; i < rel.length; i++) rel[i].x *= i <= index ? k : 1;
      if (k > 0) for (let i = index + 1; i < rel.length; i++) rel[i].x += target - old;
    } else if (Math.abs(target) > 0.5 && rel.length === 2) {
      // a straight vertical that has to work to its landmark first
      rel.splice(1, 0, { x: target, y: Math.min(6, rel[1].y / 2), smooth: true });
      rel[2].x = target;
    }
  };
  if (lm?.kind === 'middle') aimAt(lm.point ?? last, 0);
  else if (lm?.kind === 'seam') aimAt(last, m * ROUTE_LANDMARKS.seam);
  else if (lm?.kind === 'sideline') aimAt(last, m * ROUTE_LANDMARKS.sideline);
  else if (lm?.kind === 'hash' && opts.hashX) aimAt(last, m * (opts.hashX + (lm.offset ?? 0)));

  // never draw past the sideline
  const limit = FIELD_WIDTH_YD / 2 - 0.5;
  const points = rel.map((p) => {
    const absX = Math.max(-limit, Math.min(limit, p.x + player.x));
    return { ...p, x: snap(absX - player.x), y: snap(p.y) };
  });

  return { id: opts.id, anchor: { kind: 'player', playerId: player.id }, points, end: 'arrow', line: 'solid', role: 'route', primary: opts.primary };
}

/** The depth (yards from the LOS) of every vertex of a drawn route, for checking it against its record. */
export function routeDepths(path: Path, player: Player): number[] {
  return path.points.map((p) => snap(p.y + player.y));
}
