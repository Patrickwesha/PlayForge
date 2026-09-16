import { rid } from '@/model/ids';
import type { Path, PathPoint, Player } from '@/model/types';

/**
 * Route tree for a receiver on the RIGHT side of the formation.
 * +x = toward the sideline, -x = inside, +y = downfield.
 */
export const ROUTE_TREE: Record<number, { name: string; points: PathPoint[] }> = {
  0: { name: 'Hitch', points: [{ x: 0, y: 0 }, { x: 0, y: 5 }, { x: -0.9, y: 4.3 }] },
  1: { name: 'Flat', points: [{ x: 0, y: 0 }, { x: 0.5, y: 1.5, smooth: true }, { x: 8, y: 3 }] },
  2: { name: 'Slant', points: [{ x: 0, y: 0 }, { x: 0, y: 3 }, { x: -6, y: 9 }] },
  3: { name: 'Comeback', points: [{ x: 0, y: 0 }, { x: 0, y: 14 }, { x: 3, y: 11 }] },
  4: { name: 'Curl', points: [{ x: 0, y: 0 }, { x: 0, y: 12 }, { x: -2.5, y: 10 }] },
  5: { name: 'Out', points: [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 7, y: 10 }] },
  6: { name: 'Dig', points: [{ x: 0, y: 0 }, { x: 0, y: 12 }, { x: -9, y: 12 }] },
  7: { name: 'Corner', points: [{ x: 0, y: 0 }, { x: 0, y: 12 }, { x: 7, y: 19 }] },
  8: { name: 'Post', points: [{ x: 0, y: 0 }, { x: 0, y: 12 }, { x: -6, y: 18 }] },
  9: { name: 'Go', points: [{ x: 0, y: 0 }, { x: 0, y: 18 }] },
};

export type RouteTreeOptions = { scale?: number; primary?: boolean };

/** Build a player-anchored route path from the tree, mirrored for left-side receivers. */
export function applyRouteTree(n: number, player: Player, opts: RouteTreeOptions = {}): Path {
  const def = ROUTE_TREE[n] ?? ROUTE_TREE[9];
  const mirror = player.x < 0 ? -1 : 1;
  const s = opts.scale ?? 1;
  return {
    id: rid(),
    anchor: { kind: 'player', playerId: player.id },
    points: def.points.map((p) => ({ ...p, x: p.x * mirror * s, y: p.y * s })),
    end: 'arrow',
    line: 'solid',
    role: 'route',
    primary: opts.primary,
  };
}

/** Youth fields and shorter players: scale depths down. */
export function routeScaleFor(playersPerSide: number): number {
  return playersPerSide < 11 ? 0.6 : 1;
}
