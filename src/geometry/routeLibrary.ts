import { FIELD_WIDTH_YD, HASH_PRESETS } from '@/model/constants';
import type { LandmarkSpot, Path, PathPoint, Player, Point, RouteDef, RouteLandmark } from '@/model/types';

/** Field landmarks a route description can point at, as x distances from the ball. */
export const ROUTE_LANDMARKS = {
  /** Centre of the painted numbers. Same value as the formation pack's `numbers`. */
  numbers: 18,
  /** The numbers are about 2 yards across, so an edge is 1 yard off the centre. */
  numbersHalfWidth: 1,
  /** Red line: about 5 yards inside the sideline. */
  redline: 21.5,
  /** Just inside the sideline, where a Flat finishes. */
  sideline: FIELD_WIDTH_YD / 2 - 1.2,
  pylon: FIELD_WIDTH_YD / 2,
  /** Each upright is 3.08 yards from the middle of the field (18 ft 6 in crossbar). */
  upright: 3.08,
  endZoneDepth: 10,
  /** Where the line of scrimmage is assumed to be when nothing says otherwise. */
  defaultYardsToGoal: 40,
} as const;

/** What the landmark resolver has to know about the field. All optional. */
export type FieldContext = {
  /** Which side of the ball is the wide (field) side: 1 = right, -1 = left. Defaults to the right. */
  fieldSide?: 1 | -1;
  /** Ball on its own side of the 50 ('minus') or the opponent's ('plus'). */
  ballOn?: 'minus' | 'plus';
  /** Line of scrimmage to the goal line, in yards. Defaults to the route's own `assumes`, then 40. */
  yardsToGoal?: number;
  hashX?: number;
  /** x of the offensive tackle on the player's side, for landmarks measured from him. */
  tackleX?: number;
};

const SNAP = 0.25;
const snap = (n: number) => Math.round(n / SNAP) * SNAP + 0;

export type RouteDefOptions = FieldContext & {
  id: string;
  /** 1 = toward the right sideline is "outside", -1 = left. Defaults to the side of the ball the player is on. */
  side?: 1 | -1;
  primary?: boolean;
};

/** Pick the spot that applies: the boundary value on the boundary side, the plus value past the 50. */
export function landmarkSpotFor(lm: RouteLandmark, side: 1 | -1, ctx: FieldContext): LandmarkSpot {
  if (ctx.ballOn === 'plus' && lm.ballPlus) return lm.ballPlus;
  return side === (ctx.fieldSide ?? 1) || !lm.boundary ? lm.field : lm.boundary;
}

/**
 * Where a landmark is, in absolute yards (x from the ball, y from the line of scrimmage).
 * x-only landmarks (red line, numbers, split, hash ...) leave y undefined; depth-only ones
 * (goal line, end line) leave x undefined; pylons and uprights give both.
 */
export function resolveLandmark(spot: LandmarkSpot, side: 1 | -1, player: Point, ctx: FieldContext, yardsToGoal: number): { x?: number; y?: number } {
  const L = ROUTE_LANDMARKS;
  const off = spot.offset ?? 0;
  const goal = yardsToGoal;
  switch (spot.spot) {
    case 'front-pylon':
      return { x: side * (L.pylon + Math.min(off, 0)), y: goal };
    case 'back-pylon':
      // "1 yd short of the back pylon" = offset -1 in depth
      return { x: side * L.pylon, y: goal + L.endZoneDepth + off };
    case 'far-pylon':
      return { x: -side * L.pylon, y: goal };
    case 'near-upright':
      return { x: side * L.upright, y: goal + L.endZoneDepth };
    case 'goal-line':
      return { y: goal + off };
    case 'end-line':
      return { y: goal + L.endZoneDepth + off };
    case 'redline':
      return { x: side * (L.redline + off) };
    case 'split': {
      // the book split: 2 yards inside the numbers to the field, 1 yard inside to the boundary
      const inside = side === (ctx.fieldSide ?? 1) ? 2 : 1;
      return { x: side * (L.numbers - inside + off) };
    }
    case 'numbers': {
      const edge = spot.edge === 'outside' ? L.numbersHalfWidth : spot.edge === 'inside' ? -L.numbersHalfWidth : 0;
      return { x: side * (L.numbers + edge + off) };
    }
    case 'hash':
      return { x: side * ((ctx.hashX ?? HASH_PRESETS.nfl) + off) };
    case 'opposite-hash':
      return { x: -side * ((ctx.hashX ?? HASH_PRESETS.nfl) + off) };
    case 'middle':
      return { x: side * off };
    case 'sideline':
      return { x: side * (L.sideline + off) };
    case 'tackle':
      return { x: side * (Math.abs(ctx.tackleX ?? 2) + off) };
    default:
      return { x: player.x };
  }
}

/**
 * Build a player-anchored route from a route library record. Same convention as the 0-9 route tree:
 * the record is written for a right-side receiver and mirrored for the left. Depths in the record are
 * yards from the line of scrimmage, so a receiver off the ball still breaks at the stated depth.
 * Landmarks then move the points they name onto (or toward) real spots on the field.
 */
export function routeDefPath(def: RouteDef, player: Player, opts: RouteDefOptions): Path {
  const m = opts.side ?? (player.x < 0 ? -1 : 1);
  const rel = def.points.map((p, i): PathPoint => {
    if (i === 0) return { x: 0, y: 0 };
    const depthIsAbsolute = def.frame === 'back' ? !p.relativeY : p.y > 0;
    return { x: p.x * m, y: depthIsAbsolute ? p.y - player.y : p.y, ...(p.smooth ? { smooth: true } : {}) };
  });
  const yardsToGoal = opts.yardsToGoal ?? def.assumes?.yardsToGoal ?? ROUTE_LANDMARKS.defaultYardsToGoal;

  /** Put point `index` at absolute x: points before it stretch with it, points after it ride along. */
  const placeX = (index: number, absX: number) => {
    const target = absX - player.x;
    const old = rel[index].x;
    if (Math.abs(old) > 0.01) {
      const k = target / old;
      // only stretch or squeeze; a landmark on the far side of the player would flip the route
      if (k > 0) {
        for (let i = 1; i <= index; i++) rel[i].x *= k;
        for (let i = index + 1; i < rel.length; i++) rel[i].x += target - old;
      }
    } else if (Math.abs(target) > 0.5 && rel.length === 2) {
      // a straight vertical that has to work to its landmark first
      rel.splice(1, 0, { x: target, y: Math.min(6, rel[1].y / 2), smooth: true });
      rel[2].x = target;
    } else if (Math.abs(target) > 0.5) {
      rel[index].x = target;
    }
  };

  for (const lm of def.landmarks ?? []) {
    const index = lm.point < 0 ? rel.length + lm.point : lm.point;
    if (index < 1 || index >= rel.length) continue;
    const at = resolveLandmark(landmarkSpotFor(lm, m, opts), m, player, opts, yardsToGoal);
    if (at.x !== undefined && at.y !== undefined) {
      // a pylon or an upright: aim the leg at it. It is usually far away, so keep the leg's own length.
      const from = rel[index - 1];
      const dx = at.x - player.x - from.x;
      const dy = at.y - player.y - from.y;
      const dist = Math.hypot(dx, dy) || 1;
      const len = lm.mode === 'end' ? dist : Math.min(dist, Math.hypot(rel[index].x - from.x, rel[index].y - from.y));
      rel[index] = { ...rel[index], x: from.x + (dx / dist) * len, y: from.y + (dy / dist) * len };
    } else if (at.x !== undefined) placeX(index, at.x);
    else if (at.y !== undefined) rel[index].y = at.y - player.y;
  }

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
