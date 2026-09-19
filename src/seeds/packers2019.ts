import type { Formation, FormationConfidence, Player, PlayerRole, PlayerSymbol, QbAlignment } from '@/model/types';
import pack from './data/packers2019.json';

/**
 * 2019 Packers (LaFleur) formation pack. The data file is written by `npm run import:formations`
 * from data/formations/packers-2019.source.json; this module only turns it into Formations.
 * Spots are jobs, not players: Y is the TE and goes to the strength, Z the strong receiver,
 * X the weak receiver, H the halfback, F the primary adjuster.
 */
type Spot = 'LT' | 'LG' | 'C' | 'RG' | 'RT' | 'QB' | 'Y' | 'Z' | 'X' | 'F' | 'H';

type PackEntry = {
  key: string;
  name: string;
  personnel: string;
  family: string;
  strength: 'left' | 'right';
  qbAlignment: QbAlignment;
  sourcePage: number;
  confidence: FormationConfidence;
  note?: string;
  players: { spot: Spot; x: number; y: number }[];
};

/** Linemen start with no label and the center is a blank square, like every other built-in. */
const SPOT: Record<Spot, { label: string; role: PlayerRole; symbol?: PlayerSymbol }> = {
  LT: { label: '', role: 'OL' },
  LG: { label: '', role: 'OL' },
  C: { label: '', role: 'C', symbol: 'square' },
  RG: { label: '', role: 'OL' },
  RT: { label: '', role: 'OL' },
  QB: { label: 'Q', role: 'QB' },
  Y: { label: 'Y', role: 'TE' },
  Z: { label: 'Z', role: 'WR' },
  X: { label: 'X', role: 'WR' },
  F: { label: 'F', role: 'RB' },
  H: { label: 'H', role: 'RB' },
};

const SEED_TIME = '2026-01-01T00:00:00.000Z';

export const PACKERS_2019_TAG = 'packers-2019';
export const PACKERS_2019_ID_PREFIX = 'seed-gb19-';
/** Content hash of the data file; part of the seed stamp so regenerated data reaches open databases. */
export const PACKERS_2019_REVISION: string = pack.revision;

function toFormation(e: PackEntry): Formation {
  const id = `${PACKERS_2019_ID_PREFIX}${e.key}`;
  const players: Record<string, Player> = {};
  for (const p of e.players) {
    const spec = SPOT[p.spot];
    const pid = `${id}-${p.spot.toLowerCase()}`;
    players[pid] = { id: pid, side: 'offense', symbol: spec.symbol ?? 'circle', label: spec.label, x: p.x, y: p.y, role: spec.role };
  }
  return {
    id,
    name: e.name,
    side: 'offense',
    personnel: e.personnel,
    playersPerSide: 11,
    players,
    tags: [PACKERS_2019_TAG, e.personnel],
    family: e.family,
    strength: e.strength,
    qbAlignment: e.qbAlignment,
    source: pack.source,
    sourcePage: e.sourcePage,
    note: e.note,
    confidence: e.confidence,
    builtin: true,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  };
}

export const PACKERS_2019_FORMATIONS: Formation[] = (pack.formations as PackEntry[]).map(toFormation);
