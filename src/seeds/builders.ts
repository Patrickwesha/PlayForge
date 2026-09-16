import type { Diagram, Formation, Path, Player, PlayerRole, PlayerSymbol, PlayersPerSide, Side } from '@/model/types';

export type PlayerSpec = {
  label: string;
  x: number;
  y: number;
  symbol?: PlayerSymbol;
  role?: PlayerRole;
  shade?: Player['shade'];
  labelColor?: Player['labelColor'];
};

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-');

/** Build a players record with deterministic ids `${prefix}-${label}` (unique per formation). */
export function buildPlayers(prefix: string, side: Side, specs: PlayerSpec[]): Record<string, Player> {
  const out: Record<string, Player> = {};
  const seen: Record<string, number> = {};
  for (const s of specs) {
    const base = slug(s.label || 'ol');
    seen[base] = (seen[base] ?? 0) + 1;
    const id = `${prefix}-${base}${seen[base] > 1 ? seen[base] : ''}`;
    out[id] = {
      id,
      side,
      symbol: s.symbol ?? (side === 'defense' ? 'letter' : 'circle'),
      label: s.label,
      x: s.x,
      y: s.y,
      role: s.role,
      shade: s.shade,
      labelColor: s.labelColor,
    };
  }
  return out;
}

export type OlLabels = 'none' | 'short' | 'long';

/** Five offensive linemen on the LOS, 1 yd apart, center as a square. */
export function ol(labels: OlLabels = 'none', spacing = 1): PlayerSpec[] {
  const L = labels === 'long' ? ['LT', 'LG', 'C', 'RG', 'RT'] : labels === 'short' ? ['T', 'G', 'C', 'G', 'T'] : ['', '', 'C', '', ''];
  const centerLabel = labels === 'none' ? '' : 'C';
  return [
    { label: L[0], x: -2 * spacing, y: 0, role: 'OL' },
    { label: L[1], x: -1 * spacing, y: 0, role: 'OL' },
    { label: centerLabel, x: 0, y: 0, symbol: 'square', role: 'C' },
    { label: L[3], x: 1 * spacing, y: 0, role: 'OL' },
    { label: L[4], x: 2 * spacing, y: 0, role: 'OL' },
  ];
}

export type FormationSeed = {
  id: string;
  name: string;
  side: Side;
  personnel?: string;
  playersPerSide?: PlayersPerSide;
  coverage?: string;
  tags?: string[];
  players: PlayerSpec[];
};

const SEED_TIME = '2026-01-01T00:00:00.000Z';

export function formationFromSeed(s: FormationSeed): Formation {
  return {
    id: `seed-${s.id}`,
    name: s.name,
    side: s.side,
    personnel: s.personnel,
    playersPerSide: s.playersPerSide ?? 11,
    players: buildPlayers(`seed-${s.id}`, s.side, s.players),
    coverage: s.coverage,
    tags: s.tags ?? [],
    builtin: true,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  };
}

/** Helper for demo plays: find a player by label inside a diagram. */
export function byLabel(players: Record<string, Player>, label: string, side?: Side): Player {
  const p = Object.values(players).find((q) => q.label === label && (!side || q.side === side));
  if (!p) throw new Error(`player ${label} not found`);
  return p;
}

let pathCounter = 0;
export function seedPath(playerId: string, points: Path['points'], opts: Partial<Path> = {}): Path {
  pathCounter += 1;
  return {
    id: `sp-${pathCounter}`,
    anchor: { kind: 'player', playerId },
    points,
    end: 'arrow',
    line: 'solid',
    role: 'route',
    ...opts,
  };
}

export function addPaths(d: Diagram, paths: Path[]) {
  for (const p of paths) d.paths[p.id] = p;
}
