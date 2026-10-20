import type { Formation, Player } from '@/model/types';
import { SEED_TIME } from '@/model/seedRules';
import pack from '../../data/rams-2022/fronts.json';

/**
 * The Rams 2022 defensive fronts (Defensive Identification pp.13-23) as built-in defense formations:
 * every defender where the book draws him over the line, by technique. Written by
 * scripts/rams/extract_fronts.py; positions and names only.
 */
export const RAMS_FRONT_ID_PREFIX = 'seed-rams22-front-';
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const DEPTH = { DL: 1.2, LB: 4.5, DB: 7 } as const;

type FrontEntry = { name: string; group: string; page: number; defenders: { label: string; role: 'DL' | 'LB' | 'DB'; x: number; y: number }[] };

function toFormation(e: FrontEntry, n: number): Formation {
  const id = `${RAMS_FRONT_ID_PREFIX}${slug(e.name)}-${e.page}-${n}`;
  const players: Record<string, Player> = {};
  e.defenders.forEach((d, i) => {
    const pid = `${id}-${i}`;
    // the drawing's depth is schematic: a man drawn on the line stays on it, backers and safeties take the editor's depths
    const y = d.role === 'DL' || d.y < 1.9 ? DEPTH.DL : d.role === 'LB' ? DEPTH.LB : Math.max(DEPTH.DB, d.y * 1.5);
    players[pid] = { id: pid, side: 'defense', symbol: 'letter', label: d.label, x: Math.round(d.x * 4) / 4, y: Math.round(y * 2) / 2, role: d.role };
  });
  return {
    id,
    name: e.name.toUpperCase(),
    side: 'defense',
    playersPerSide: 11,
    players,
    tags: ['rams-2022', e.group, 'front'],
    family: e.group,
    source: 'Rams 2022 (McVay), Defensive Identification',
    sourcePage: e.page,
    note: `The ${e.name} front as the Rams 2022 book draws it (${e.group}, p.${e.page}). ${e.defenders.length} defenders drawn; add the rest of the secondary for a full look.`,
    builtin: true,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  };
}

export const RAMS_FRONTS: Formation[] = (pack.fronts as FrontEntry[]).map(toFormation);
