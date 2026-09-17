import type { Formation } from '@/model/types';
import { formationFromSeed, ol, type FormationSeed, type PlayerSpec } from './builders';

const QB_UC: PlayerSpec = { label: 'Q', x: 0, y: -1.2, role: 'QB' };
const QB_GUN: PlayerSpec = { label: 'Q', x: 0, y: -5, role: 'QB' };

export const OFFENSE_SEEDS: FormationSeed[] = [
  // --- 11 personnel ---
  {
    id: 'snug', name: 'SNUG', side: 'offense', personnel: '11', tags: ['nfl', '11'],
    players: [...ol(), { label: 'Y', x: 3, y: 0, role: 'TE' }, { label: 'F', x: -3.5, y: -1, role: 'WR' }, { label: 'X', x: -8, y: 0, role: 'WR' }, { label: 'Z', x: 8, y: -1, role: 'WR' }, QB_UC, { label: 'H', x: 0, y: -5, role: 'RB' }],
  },
  {
    id: 'trips-rt', name: 'TRIPS RT', side: 'offense', personnel: '11', tags: ['nfl', '11'],
    players: [...ol(), { label: 'Y', x: 3, y: 0, role: 'TE' }, { label: 'F', x: 7, y: -1, role: 'WR' }, { label: 'Z', x: 14, y: -1, role: 'WR' }, { label: 'X', x: -14, y: 0, role: 'WR' }, QB_GUN, { label: 'H', x: -2.5, y: -5, role: 'RB' }],
  },
  {
    id: 'doubles', name: 'DOUBLES', side: 'offense', personnel: '11', tags: ['nfl', '11'],
    players: [...ol(), { label: 'Y', x: 3, y: 0, role: 'TE' }, { label: 'Z', x: 14, y: -1, role: 'WR' }, { label: 'F', x: -7, y: -1, role: 'WR' }, { label: 'X', x: -14, y: 0, role: 'WR' }, QB_GUN, { label: 'H', x: 2.5, y: -5, role: 'RB' }],
  },
  {
    id: 'bunch-rt', name: 'BUNCH RT', side: 'offense', personnel: '11', tags: ['nfl', '11'],
    players: [...ol(), { label: 'Y', x: 7, y: 0, role: 'TE' }, { label: 'F', x: 6, y: -1.5, role: 'WR' }, { label: 'Z', x: 8.5, y: -1.2, role: 'WR' }, { label: 'X', x: -14, y: 0, role: 'WR' }, QB_GUN, { label: 'H', x: -2.5, y: -5, role: 'RB' }],
  },
  {
    id: 'empty', name: 'EMPTY', side: 'offense', personnel: '11', tags: ['nfl', '11'],
    players: [...ol(), { label: 'Y', x: 3, y: 0, role: 'TE' }, { label: 'F', x: 8, y: -1, role: 'WR' }, { label: 'Z', x: 15, y: -1, role: 'WR' }, { label: 'H', x: -8, y: -1, role: 'RB' }, { label: 'X', x: -15, y: 0, role: 'WR' }, QB_GUN],
  },
  // --- 12 personnel ---
  {
    id: 'ace', name: 'ACE', side: 'offense', personnel: '12', tags: ['nfl', '12'],
    players: [...ol(), { label: 'Y', x: 3, y: 0, role: 'TE' }, { label: 'F', x: -3, y: 0, role: 'TE' }, { label: 'Z', x: 12, y: -1, role: 'WR' }, { label: 'X', x: -12, y: 0, role: 'WR' }, QB_UC, { label: 'H', x: 0, y: -6.5, role: 'RB' }],
  },
  {
    id: 'ace-wing', name: 'ACE WING', side: 'offense', personnel: '12', tags: ['nfl', '12'],
    players: [...ol(), { label: 'Y', x: 3, y: 0, role: 'TE' }, { label: 'F', x: 4, y: -1.2, role: 'TE' }, { label: 'Z', x: 12, y: -1, role: 'WR' }, { label: 'X', x: -12, y: 0, role: 'WR' }, QB_UC, { label: 'H', x: 0, y: -6.5, role: 'RB' }],
  },
  // --- 21 / 22 personnel ---
  {
    id: 'i-pro', name: 'I PRO', side: 'offense', personnel: '21', tags: ['nfl', '21'],
    players: [...ol(), { label: 'Y', x: 3, y: 0, role: 'TE' }, { label: 'Z', x: 12, y: -1, role: 'WR' }, { label: 'X', x: -12, y: 0, role: 'WR' }, QB_UC, { label: 'F', x: 0, y: -4, role: 'RB' }, { label: 'H', x: 0, y: -6.5, role: 'RB' }],
  },
  {
    id: 'strong-rt', name: 'STRONG RT', side: 'offense', personnel: '21', tags: ['nfl', '21'],
    players: [...ol(), { label: 'Y', x: 3, y: 0, role: 'TE' }, { label: 'Z', x: 12, y: -1, role: 'WR' }, { label: 'X', x: -12, y: 0, role: 'WR' }, QB_UC, { label: 'F', x: 2, y: -4, role: 'RB' }, { label: 'H', x: 0, y: -6.5, role: 'RB' }],
  },
  {
    id: 'weak-rt', name: 'WEAK RT', side: 'offense', personnel: '21', tags: ['nfl', '21'],
    players: [...ol(), { label: 'Y', x: 3, y: 0, role: 'TE' }, { label: 'Z', x: 12, y: -1, role: 'WR' }, { label: 'X', x: -12, y: 0, role: 'WR' }, QB_UC, { label: 'F', x: -2, y: -4, role: 'RB' }, { label: 'H', x: 0, y: -6.5, role: 'RB' }],
  },
  {
    id: 'split', name: 'SPLIT', side: 'offense', personnel: '21', tags: ['nfl', '21'],
    players: [...ol(), { label: 'Y', x: 3, y: 0, role: 'TE' }, { label: 'Z', x: 12, y: -1, role: 'WR' }, { label: 'X', x: -12, y: 0, role: 'WR' }, QB_UC, { label: 'F', x: 2, y: -4.5, role: 'RB' }, { label: 'H', x: -2, y: -4.5, role: 'RB' }],
  },
  {
    id: 'power-i', name: 'POWER I', side: 'offense', personnel: '22', tags: ['nfl', '22'],
    players: [...ol(), { label: 'Y', x: 3, y: 0, role: 'TE' }, { label: 'U', x: -3, y: 0, role: 'TE' }, { label: 'Z', x: 12, y: -1, role: 'WR' }, QB_UC, { label: 'F', x: 0, y: -4, role: 'RB' }, { label: 'H', x: 0, y: -6.5, role: 'RB' }],
  },
  // --- 10 personnel ---
  {
    id: 'spread', name: 'SPREAD', side: 'offense', personnel: '10', tags: ['nfl', '10'],
    players: [...ol(), { label: 'Z', x: 15, y: -1, role: 'WR' }, { label: 'Y', x: 7, y: 0, role: 'WR' }, { label: 'F', x: -7, y: -1, role: 'WR' }, { label: 'X', x: -15, y: 0, role: 'WR' }, QB_GUN, { label: 'H', x: 2.5, y: -5, role: 'RB' }],
  },
  // --- Youth / BEAST system ---
  {
    id: 'beast-right', name: 'BEAST RIGHT', side: 'offense', personnel: 'BEAST', tags: ['youth', 'beast'],
    players: [...ol(), { label: 'F', x: -3, y: 0, role: 'TE' }, { label: 'Y', x: 3, y: 0, role: 'TE' }, { label: '1', x: 0, y: -1.2, role: 'QB' }, { label: '2', x: 0, y: -4, role: 'RB' }, { label: '3', x: 3.5, y: -1.2, role: 'WR' }, { label: '4', x: 12, y: 0, role: 'WR' }],
  },
  {
    id: 'beast-left', name: 'BEAST LEFT', side: 'offense', personnel: 'BEAST', tags: ['youth', 'beast'],
    players: [...ol(), { label: 'Y', x: -3, y: 0, role: 'TE' }, { label: 'F', x: 3, y: 0, role: 'TE' }, { label: '1', x: 0, y: -1.2, role: 'QB' }, { label: '2', x: 0, y: -4, role: 'RB' }, { label: '3', x: -3.5, y: -1.2, role: 'WR' }, { label: '4', x: -12, y: 0, role: 'WR' }],
  },
  {
    id: 'beast-wide-right', name: 'BEAST WIDE RIGHT', side: 'offense', personnel: 'BEAST', tags: ['youth', 'beast'],
    players: [...ol(), { label: 'F', x: -3, y: 0, role: 'TE' }, { label: 'Y', x: 3, y: 0, role: 'TE' }, { label: '1', x: 0, y: -1.2, role: 'QB' }, { label: '2', x: 0, y: -4, role: 'RB' }, { label: '3', x: 8, y: -1.2, role: 'WR' }, { label: '4', x: 14, y: 0, role: 'WR' }],
  },
  {
    id: 'pistol-right', name: 'PISTOL RIGHT', side: 'offense', personnel: 'BEAST', tags: ['youth', 'beast'],
    players: [...ol(), { label: 'F', x: -3, y: 0, role: 'TE' }, { label: 'Y', x: 3, y: 0, role: 'TE' }, { label: '1', x: 0, y: -4, role: 'QB' }, { label: '2', x: 0, y: -6.5, role: 'RB' }, { label: '3', x: 3.5, y: -1.2, role: 'WR' }, { label: '4', x: 12, y: 0, role: 'WR' }],
  },
  {
    id: 'double-wing', name: 'DOUBLE WING', side: 'offense', personnel: 'YOUTH', tags: ['youth'],
    players: [...ol('none', 0.8), { label: 'F', x: -2.4, y: 0, role: 'TE' }, { label: 'Y', x: 2.4, y: 0, role: 'TE' }, { label: 'Q', x: 0, y: -1.2, role: 'QB' }, { label: 'B', x: 0, y: -3.5, role: 'RB' }, { label: 'A', x: -3.2, y: -1.2, role: 'RB' }, { label: 'C', x: 3.2, y: -1.2, role: 'RB' }],
  },
  {
    id: 'wing-t-rt', name: 'WING-T RT', side: 'offense', personnel: 'YOUTH', tags: ['youth'],
    players: [...ol(), { label: 'Y', x: 3, y: 0, role: 'TE' }, { label: 'X', x: -10, y: 0, role: 'WR' }, { label: 'Q', x: 0, y: -1.2, role: 'QB' }, { label: 'F', x: 0, y: -4, role: 'RB' }, { label: 'H', x: -2, y: -4, role: 'RB' }, { label: 'W', x: 4, y: -1.2, role: 'RB' }],
  },
  {
    id: 'single-wing', name: 'SINGLE WING', side: 'offense', personnel: 'YOUTH', tags: ['youth'],
    players: [...ol(), { label: 'Y', x: 3, y: 0, role: 'TE' }, { label: 'E', x: -3, y: 0, role: 'TE' }, { label: 'W', x: 4, y: -1.2, role: 'RB' }, { label: 'B', x: 1, y: -2.5, role: 'RB' }, { label: 'T', x: -1, y: -4.5, role: 'RB' }, { label: 'F', x: 1.5, y: -4.5, role: 'RB' }],
  },
  {
    id: 'spread-8', name: 'SPREAD (8-MAN)', side: 'offense', personnel: '8', playersPerSide: 8, tags: ['youth', '8-man'],
    players: [{ label: '', x: -1, y: 0, role: 'OL' }, { label: 'C', x: 0, y: 0, symbol: 'square', role: 'C' }, { label: '', x: 1, y: 0, role: 'OL' }, { label: 'Y', x: 3, y: 0, role: 'TE' }, { label: 'X', x: -10, y: 0, role: 'WR' }, { label: 'Z', x: 10, y: -1, role: 'WR' }, { label: 'Q', x: 0, y: -4, role: 'QB' }, { label: 'H', x: -2.5, y: -4, role: 'RB' }],
  },
  {
    id: 'beast-9', name: 'BEAST (9-MAN)', side: 'offense', personnel: 'BEAST', playersPerSide: 9, tags: ['youth', 'beast', '9-man'],
    players: [...ol(), { label: 'Y', x: 3, y: 0, role: 'TE' }, { label: '1', x: 0, y: -1.2, role: 'QB' }, { label: '2', x: 0, y: -4, role: 'RB' }, { label: '3', x: 3.5, y: -1.2, role: 'WR' }],
  },
];

export const OFFENSE_FORMATIONS: Formation[] = OFFENSE_SEEDS.map(formationFromSeed);
