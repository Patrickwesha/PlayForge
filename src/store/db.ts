import Dexie, { type EntityTable } from 'dexie';
import type { Formation, Play, Playbook } from '@/model/types';
import { SEED_TIME, itemKey } from '@/model/seedRules';
import type { OutboxRow, TombstoneRow } from '@/sync/types';
import { DEFENSE_FORMATIONS, DEMO_PLAYS, OFFENSE_FORMATIONS, PACKERS_2019_FORMATIONS, PACKERS_2019_ID_PREFIX, PACKERS_2019_REVISION } from '@/seeds';

export type SettingRow = { key: string; value: unknown };

export class PlayForgeDB extends Dexie {
  formations!: EntityTable<Formation, 'id'>;
  plays!: EntityTable<Play, 'id'>;
  playbooks!: EntityTable<Playbook, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;
  /** Rows that still have to be pushed to the cloud. */
  outbox!: EntityTable<OutboxRow, 'key'>;
  /** Ids deleted here or on another device, so they never come back (built-ins included). */
  tombstones!: EntityTable<TombstoneRow, 'key'>;

  constructor() {
    super('playforge');
    this.version(1).stores({
      formations: 'id, side, name, updatedAt',
      plays: 'id, name, category, formationId, updatedAt, *tags',
      playbooks: 'id, name, updatedAt',
      settings: 'key',
    });
    // v2: sync bookkeeping lives in its own tables so the library rows and backups stay clean.
    this.version(2).stores({ outbox: 'key, kind', tombstones: 'key, kind' });
    this.on('populate', () => {
      void seedDatabase(this);
    });
    this.on('ready', () => ensureSeeds(this));
  }
}

export const DEMO_PLAYBOOK_ID = 'seed-playbook-beast';
/** Bump when built-in formations or demo plays change; untouched seed rows are refreshed on open. */
export const SEED_VERSION = 3;
/** What the database records as seeded. The pack revision is a content hash, so re-running the formation import refreshes open databases without a manual bump. */
export const SEED_STAMP = `${SEED_VERSION}:${PACKERS_2019_REVISION}`;
const SEED_FORMATIONS = [...OFFENSE_FORMATIONS, ...DEFENSE_FORMATIONS, ...PACKERS_2019_FORMATIONS];

export async function ensureSeeds(database: PlayForgeDB) {
  const row = await database.settings.get('seedVersion');
  if (row?.value === SEED_STAMP) return;
  await database.transaction('rw', database.formations, database.plays, database.settings, database.tombstones, async () => {
    // a built-in that was deleted (here or on another device) stays deleted
    const gone = new Set(await database.tombstones.toCollection().primaryKeys());
    for (const f of SEED_FORMATIONS) {
      if (gone.has(itemKey('formation', f.id))) continue;
      const existing = await database.formations.get(f.id);
      if (!existing || existing.builtin) await database.formations.put(f);
    }
    // Pack entries that were renamed or removed upstream: drop the untouched copies so a re-import never doubles up.
    const packIds = new Set(PACKERS_2019_FORMATIONS.map((f) => f.id));
    const stale = await database.formations.filter((f) => f.id.startsWith(PACKERS_2019_ID_PREFIX) && f.builtin === true && !packIds.has(f.id)).primaryKeys();
    await database.formations.bulkDelete(stale);
    for (const p of DEMO_PLAYS) {
      if (gone.has(itemKey('play', p.id))) continue;
      const existing = await database.plays.get(p.id);
      if (!existing || existing.updatedAt === SEED_TIME) await database.plays.put(p);
    }
    await database.settings.put({ key: 'seedVersion', value: SEED_STAMP });
  });
}

export async function seedDatabase(database: PlayForgeDB) {
  const t = SEED_TIME;
  await database.formations.bulkPut(SEED_FORMATIONS);
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
  await database.settings.put({ key: 'seedVersion', value: SEED_STAMP });
}

let instance: PlayForgeDB | null = null;
export function getDb(): PlayForgeDB {
  if (!instance) instance = new PlayForgeDB();
  return instance;
}
