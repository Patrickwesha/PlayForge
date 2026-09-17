import { rid } from '@/model/ids';
import type { Path, PathPoint, Player, Point } from '@/model/types';

export type Playside = 'L' | 'R';

export type BlockPreset = 'base' | 'down' | 'reach' | 'crack' | 'cutoff' | 'trap' | 'kickout' | 'pull' | 'wrap' | 'passSet' | 'combo' | 'double';

export const BLOCK_PRESETS: { id: BlockPreset; name: string; hint: string; multi?: boolean }[] = [
  { id: 'base', name: 'Base', hint: 'Straight ahead, T' },
  { id: 'down', name: 'Down', hint: '45° toward the ball, T' },
  { id: 'reach', name: 'Reach', hint: '45° to the playside, T' },
  { id: 'crack', name: 'Crack', hint: 'Long 45° inside (WR/TE), T' },
  { id: 'cutoff', name: 'Cutoff', hint: 'Backside, flat inside, T' },
  { id: 'trap', name: 'Trap', hint: 'Short pull, kick out, T' },
  { id: 'kickout', name: 'Kick out', hint: 'Long pull, kick out, T' },
  { id: 'pull', name: 'Pull / lead', hint: 'Pull and lead up, arrow' },
  { id: 'wrap', name: 'Wrap', hint: 'Pull and wrap through the hole, arrow' },
  { id: 'passSet', name: 'Pass set', hint: 'Set back, T' },
  { id: 'combo', name: 'Combo', hint: 'Block down man, climb to backer' },
  { id: 'double', name: 'Double', hint: 'Two players on one point (select two)', multi: true },
];

const sgn = (side: Playside) => (side === 'R' ? 1 : -1);
const inwardOf = (p: Player) => (p.x > 0 ? -1 : p.x < 0 ? 1 : 0);

function block(player: Player, points: PathPoint[], end: Path['end'] = 'tbar', role: Path['role'] = 'block'): Path {
  return { id: rid(), anchor: { kind: 'player', playerId: player.id }, points, end, line: 'solid', role };
}

const K = Math.SQRT1_2;

/** Straight ahead. */
export function baseBlock(player: Player, depth = 1.2): Path {
  return block(player, [{ x: 0, y: 0 }, { x: 0, y: depth }]);
}

/** Toward the ball at 45 degrees. */
export function downBlock(player: Player, dist = 1.4): Path {
  const i = inwardOf(player) || 1;
  return block(player, [{ x: 0, y: 0 }, { x: i * dist * K, y: dist * K }]);
}

/** Away from the ball toward the playside at 45 degrees. */
export function reachBlock(player: Player, side: Playside, dist = 1.4): Path {
  return block(player, [{ x: 0, y: 0 }, { x: sgn(side) * dist * K, y: dist * K }]);
}

/** Long 45-degree inside block for a wide receiver or tight end. */
export function crackBlock(player: Player, dist = 3): Path {
  const i = inwardOf(player) || 1;
  return block(player, [{ x: 0, y: 0 }, { x: i * dist * K, y: dist * K }]);
}

/** Backside cutoff: flat and inside. */
export function cutoffBlock(player: Player, dist = 1.4): Path {
  const i = inwardOf(player) || 1;
  return block(player, [{ x: 0, y: 0 }, { x: i * dist * 0.87, y: dist * 0.5 }]);
}

/** Short pull that kicks out the first defender past the hole. */
export function trapBlock(player: Player, side: Playside, dist = 2.6): Path {
  const s = sgn(side);
  return block(player, [{ x: 0, y: 0 }, { x: s * dist, y: 0.7, bend: { x: s * dist * 0.35, y: -0.9 } }]);
}

/** Long pull that kicks out the end man. */
export function kickOutBlock(player: Player, side: Playside, dist = 4.5): Path {
  const s = sgn(side);
  return block(player, [{ x: 0, y: 0 }, { x: s * dist, y: 0.6, bend: { x: s * dist * 0.4, y: -1.1 } }]);
}

/** Pull behind the line and lead up through the hole. */
export function pullBlock(player: Player, side: Playside, dist = 4, end: Path['end'] = 'arrow'): Path {
  const s = sgn(side);
  return block(player, [
    { x: 0, y: 0 },
    { x: s * dist, y: 0.2, bend: { x: s * dist * 0.45, y: -1.4 } },
    { x: s * (dist + 0.4), y: 2.4 },
  ], end, 'block');
}

/** Pull and wrap tight through the hole to the backer. */
export function wrapBlock(player: Player, side: Playside, dist = 3): Path {
  const s = sgn(side);
  return block(player, [
    { x: 0, y: 0 },
    { x: s * dist, y: -0.1, bend: { x: s * dist * 0.45, y: -1.3 } },
    { x: s * (dist + 0.6), y: 3.6, bend: { x: s * (dist + 0.9), y: 1.2 } },
  ], 'arrow', 'block');
}

/** Pass set: step back, T. */
export function passSetBlock(player: Player, depth = 1.0): Path {
  return block(player, [{ x: 0, y: 0 }, { x: 0, y: -depth }]);
}

/** Combo: short block on the down lineman, then climb to the backer. Two paths. */
export function comboBlock(player: Player, side: Playside, climbDepth = 4): [Path, Path] {
  const s = sgn(side);
  return [
    block(player, [{ x: 0, y: 0 }, { x: s * 0.6, y: 0.9 }]),
    block(player, [{ x: 0, y: 0 }, { x: s * 0.3, y: 1.2 }, { x: s * 1.6, y: climbDepth }], 'arrow', 'block'),
  ];
}

/** Two players converge on one target point (double team "V"). Target is absolute yards. */
export function doubleTeam(a: Player, b: Player, target?: Point): [Path, Path] {
  const t = target ?? { x: (a.x + b.x) / 2, y: Math.max(a.y, b.y) + 1.3 };
  const rel = (p: Player): PathPoint => ({ x: t.x - p.x, y: t.y - p.y });
  return [block(a, [{ x: 0, y: 0 }, rel(a)]), block(b, [{ x: 0, y: 0 }, rel(b)])];
}

/** Build the paths for a preset on one player (double team is handled by the caller). */
export function blockPreset(kind: Exclude<BlockPreset, 'double'>, player: Player, side: Playside): Path[] {
  switch (kind) {
    case 'base': return [baseBlock(player)];
    case 'down': return [downBlock(player)];
    case 'reach': return [reachBlock(player, side)];
    case 'crack': return [crackBlock(player)];
    case 'cutoff': return [cutoffBlock(player)];
    case 'trap': return [trapBlock(player, side)];
    case 'kickout': return [kickOutBlock(player, side)];
    case 'pull': return [pullBlock(player, side)];
    case 'wrap': return [wrapBlock(player, side)];
    case 'passSet': return [passSetBlock(player)];
    case 'combo': return comboBlock(player, side);
  }
}
