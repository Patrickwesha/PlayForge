import Dexie, { type EntityTable } from 'dexie';
import type { Formation, Play, Playbook } from '@/model/types';
import { DEFENSE_FORMATIONS, DEMO_PLAYS, OFFENSE_FORMATIONS } from '@/seeds';

export type SettingRow = { key: string; value: unknown };

export class PlayForgeDB extends Dexie {
  formations!: EntityTable<Formation, 'id'>;
  plays!: EntityTable<Play, 'id'>;
  playbooks!: EntityTable<Playbook, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;

  constructor() {
    super('playforge');
    this.version(1).stores({
      formations: 'id, side, name, updatedAt',
      plays: 'id, name, category, formationId, updatedAt, *tags',
      playbooks: 'id, name, updatedAt',
      settings: 'key',
    });
    this.on('populate', () => {
      void seedDatabase(this);
    });
  }
}

export const DEMO_PLAYBOOK_ID = 'seed-playbook-beast';

export async function seedDatabase(database: PlayForgeDB) {
  const t = '2026-01-01T00:00:00.000Z';
  await database.formations.bulkPut([...OFFENSE_FORMATIONS, ...DEFENSE_FORMATIONS]);
  await database.plays.bulkPut(DEMO_PLAYS);
  await database.playbooks.put({
    id: DEMO_PLAYBOOK_ID,
    name: 'BEAST OFFENSE',
    subtitle: 'Demo playbook',
    cover: { title: 'Beast Offense', subtitle: 'Demo playbook', team: 'PlayForge', season: '2026', showCover: true },
    sections: [
      { id: 'seed-sec-run', title: 'Run game', kind: 'plays', itemIds: DEMO_PLAYS.filter((p) => p.category === 'Run').map((p) => p.id) },
      { id: 'seed-sec-pass', title: 'Pass game', kind: 'plays', itemIds: DEMO_PLAYS.filter((p) => p.category !== 'Run').map((p) => p.id) },
      { id: 'seed-sec-form', title: 'Formations', kind: 'formations', itemIds: OFFENSE_FORMATIONS.filter((f) => f.tags.includes('beast')).map((f) => f.id) },
    ],
    defaultLayout: '6up',
    paper: 'letter',
    createdAt: t,
    updatedAt: t,
  });
}

let instance: PlayForgeDB | null = null;
export function getDb(): PlayForgeDB {
  if (!instance) instance = new PlayForgeDB();
  return instance;
}
