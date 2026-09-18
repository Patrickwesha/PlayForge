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
    this.on('ready', () => ensureSeeds(this));
  }
}

export const DEMO_PLAYBOOK_ID = 'seed-playbook-beast';
/** Bump when built-in formations or demo plays change; untouched seed rows are refreshed on open. */
export const SEED_VERSION = 3;
const SEED_TIME = '2026-01-01T00:00:00.000Z';

export async function ensureSeeds(database: PlayForgeDB) {
  const row = await database.settings.get('seedVersion');
  if (row?.value === SEED_VERSION) return;
  await database.transaction('rw', database.formations, database.plays, database.settings, async () => {
    for (const f of [...OFFENSE_FORMATIONS, ...DEFENSE_FORMATIONS]) {
      const existing = await database.formations.get(f.id);
      if (!existing || existing.builtin) await database.formations.put(f);
    }
    for (const p of DEMO_PLAYS) {
      const existing = await database.plays.get(p.id);
      if (!existing || existing.updatedAt === SEED_TIME) await database.plays.put(p);
    }
    await database.settings.put({ key: 'seedVersion', value: SEED_VERSION });
  });
}

export async function seedDatabase(database: PlayForgeDB) {
  const t = SEED_TIME;
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
  await database.settings.put({ key: 'seedVersion', value: SEED_VERSION });
}

let instance: PlayForgeDB | null = null;
export function getDb(): PlayForgeDB {
  if (!instance) instance = new PlayForgeDB();
  return instance;
}
