import type { Formation } from '@/model/types';
import { formationFromSeed, type FormationSeed, type PlayerSpec } from './builders';

const DL_Y = 1.2;
const LB_Y = 4.5;
const CB_Y = 7;
const S_Y = 12;

const dl = (label: string, x: number): PlayerSpec => ({ label, x, y: DL_Y, role: 'DL' });
const lb = (label: string, x: number, y = LB_Y): PlayerSpec => ({ label, x, y, role: 'LB' });
const db = (label: string, x: number, y: number): PlayerSpec => ({ label, x, y, role: 'DB' });

export const COVERAGES = ['COVER 0', 'COVER 1', 'COVER 2', 'COVER 3', 'COVER 4', '2-MAN', 'QUARTERS', '3 CLOUD', '3 SKY', '3 BUZZ'];

export const DEFENSE_SEEDS: FormationSeed[] = [
  {
    id: 'over', name: 'OVER', side: 'defense', coverage: 'COVER 3', tags: ['nfl', '4-3'],
    players: [dl('E', 4.2), dl('T', 1.6), dl('N', -0.6), dl('E', -2.6), lb('S', 4.5), lb('M', 0.5), lb('W', -3.5), db('C', 14, CB_Y), db('C', -14, CB_Y), db('SS', 7, 9), db('FS', -1, S_Y)],
  },
  {
    id: 'under', name: 'UNDER', side: 'defense', coverage: 'COVER 3', tags: ['nfl', '4-3'],
    players: [dl('E', 3.6), dl('N', 0.6), dl('T', -1.6), dl('E', -3.2), lb('S', 5.5, 1.5), lb('M', 1, LB_Y), lb('W', -2.5, LB_Y), db('C', 14, CB_Y), db('C', -14, CB_Y), db('SS', 7, 9), db('FS', -1, S_Y)],
  },
  {
    id: '3-4', name: '3-4', side: 'defense', coverage: 'COVER 2', tags: ['nfl', '3-4'],
    players: [dl('E', 2.4), dl('N', 0), dl('E', -2.4), lb('S', 4.5, 1.5), lb('M', 1.5), lb('W', -1.5), lb('J', -4.5, 1.5), db('C', 14, CB_Y), db('C', -14, CB_Y), db('SS', 7, 9), db('FS', -6, S_Y)],
  },
  {
    id: '4-2-5', name: '4-2-5', side: 'defense', coverage: 'QUARTERS', tags: ['nfl', 'nickel'],
    players: [dl('E', 4.2), dl('T', 1.6), dl('N', -0.6), dl('E', -2.6), lb('M', 1.5), lb('W', -2.5), db('$', 8, 4.5), db('C', 14, CB_Y), db('C', -14, CB_Y), db('SS', 5, S_Y), db('FS', -5, S_Y)],
  },
  {
    id: 'bear', name: 'BEAR 46', side: 'defense', coverage: 'COVER 1', tags: ['nfl', 'bear'],
    players: [dl('E', 3.5), dl('T', 1.2), dl('N', 0), dl('T', -1.2), dl('E', -3.5), lb('S', 5, 1.5), lb('M', 1.5), lb('W', -4, 1.5), db('C', 14, CB_Y), db('C', -14, CB_Y), db('FS', 0, S_Y)],
  },
  {
    id: '3-3-stack', name: '3-3 STACK', side: 'defense', coverage: 'COVER 3', tags: ['nfl', '3-3'],
    players: [dl('E', 2.4), dl('N', 0), dl('E', -2.4), lb('S', 2.4), lb('M', 0), lb('W', -2.4), db('$', 8, 5), db('C', 14, CB_Y), db('C', -14, CB_Y), db('SS', -8, 5), db('FS', 0, S_Y)],
  },
  {
    id: '5-2', name: '5-2', side: 'defense', coverage: 'COVER 3', tags: ['youth', '5-2'],
    players: [dl('E', 3.5), dl('T', 1.6), dl('N', 0), dl('T', -1.6), dl('E', -3.5), lb('S', 2.5), lb('W', -2.5), db('C', 12, 5), db('C', -12, 5), db('SS', 5, 9), db('FS', -3, 9)],
  },
  {
    id: '6-2', name: '6-2', side: 'defense', coverage: 'COVER 3', tags: ['youth', '6-2'],
    players: [dl('E', 4), dl('T', 2), dl('G', 0.8), dl('G', -0.8), dl('T', -2), dl('E', -4), lb('S', 2.5), lb('W', -2.5), db('C', 10, 5), db('C', -10, 5), db('FS', 0, 9)],
  },
  {
    id: '5-3', name: '5-3', side: 'defense', coverage: 'COVER 3', tags: ['youth', '5-3'],
    players: [dl('E', 3.5), dl('T', 1.6), dl('N', 0), dl('T', -1.6), dl('E', -3.5), lb('S', 3.5), lb('M', 0), lb('W', -3.5), db('C', 12, 5), db('C', -12, 5), db('FS', 0, 9)],
  },
  {
    id: '6-2-8man', name: '6-2 (8-MAN)', side: 'defense', playersPerSide: 8, coverage: 'COVER 0', tags: ['youth', '8-man'],
    players: [dl('E', 3), dl('T', 1.2), dl('T', -1.2), dl('E', -3), lb('S', 2.5), lb('W', -2.5), db('C', 9, 5), db('C', -9, 5)],
  },
];

export const DEFENSE_FORMATIONS: Formation[] = DEFENSE_SEEDS.map(formationFromSeed);
