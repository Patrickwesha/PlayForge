import { rid } from '@/model/ids';
import type { Path, PathPoint, Player, Point } from '@/model/types';

export type Playside = 'L' | 'R';

const sgn = (side: Playside) => (side === 'R' ? 1 : -1);

function block(player: Player, points: PathPoint[], end: Path['end'] = 'tbar', role: Path['role'] = 'block'): Path {
  return { id: rid(), anchor: { kind: 'player', playerId: player.id }, points, end, line: 'solid', role };
}

/** Straight ahead. */
export function baseBlock(player: Player, depth = 1.2): Path {
  return block(player, [{ x: 0, y: 0 }, { x: 0, y: depth }]);
}

/** Toward the ball at 45 degrees (down block). */
export function downBlock(player: Player, dist = 1.4): Path {
  const inward = player.x > 0 ? -1 : player.x < 0 ? 1 : 0;
  const k = dist / Math.SQRT2;
  return block(player, [{ x: 0, y: 0 }, { x: inward * k, y: k }]);
}

/** Away from the ball toward the playside at 45 degrees (reach). */
export function reachBlock(player: Player, side: Playside, dist = 1.4): Path {
  const k = dist / Math.SQRT2;
  return block(player, [{ x: 0, y: 0 }, { x: sgn(side) * k, y: k }]);
}

/** Pull behind the line toward the playside, then turn upfield. */
export function pullBlock(player: Player, side: Playside, dist = 4, end: Path['end'] = 'arrow'): Path {
  const s = sgn(side);
  return block(player, [
    { x: 0, y: 0 },
    { x: s * 1.2, y: -1.0, smooth: true },
    { x: s * (dist - 0.8), y: -0.9, smooth: true },
    { x: s * dist, y: 0.2, smooth: true },
    { x: s * (dist + 0.6), y: 1.8 },
  ], end, 'block');
}

/** Pull and kick out the end man on the line. */
export function kickOutBlock(player: Player, side: Playside, dist = 4): Path {
  const s = sgn(side);
  return block(player, [
    { x: 0, y: 0 },
    { x: s * 1.2, y: -1.0, smooth: true },
    { x: s * (dist - 0.5), y: -0.7, smooth: true },
    { x: s * (dist + 0.8), y: 0.6 },
  ], 'tbar', 'block');
}

/** Two players converge on one target point (double team "V"). Target is absolute yards. */
export function doubleTeam(a: Player, b: Player, target: Point): [Path, Path] {
  const rel = (p: Player): PathPoint => ({ x: target.x - p.x, y: target.y - p.y });
  return [block(a, [{ x: 0, y: 0 }, rel(a)]), block(b, [{ x: 0, y: 0 }, rel(b)])];
}

/** Combo: short block on the down lineman, then climb to the backer. Two paths. */
export function comboBlock(player: Player, side: Playside, climbDepth = 4): [Path, Path] {
  const s = sgn(side);
  return [
    block(player, [{ x: 0, y: 0 }, { x: s * 0.6, y: 0.9 }]),
    block(player, [{ x: 0, y: 0 }, { x: s * 0.3, y: 1.2 }, { x: s * 1.6, y: climbDepth }], 'arrow', 'block'),
  ];
}
