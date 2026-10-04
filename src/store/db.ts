import Dexie, { type EntityTable } from 'dexie';
import type { Formation, Play, Playbook, Snap } from '@/model/types';
import { SEED_TIME, itemKey } from '@/model/seedRules';
import type { OutboxRow, TombstoneRow } from '@/sync/types';
import { DEFENSE_FORMATIONS, DEMO_PLAYS, EAGLES_2026_FORMATIONS, EAGLES_2026_FORMATION_ID_PREFIX, EAGLES_2026_REVISION, EAGLES_2026_SNAPS, EAGLES_2026_SNAP_ID_PREFIX, OFFENSE_FORMATIONS, PACKERS_2019_FORMATIONS, PACKERS_2019_ID_PREFIX, PACKERS_2019_PLAYS, PACKERS_2019_PLAYS_REVISION, PACKERS_2019_PLAY_ID_PREFIX, PACKERS_2019_REVISION } from '@/seeds';

export type SettingRow = { key: string; value: unknown };

export class PlayForgeDB extends Dexie {
  formations!: EntityTable<Formation, 'id'>;
  plays!: EntityTable<Play, 'id'>;
  playbooks!: EntityTable<Playbook, 'id'>;
  /** Charted snaps (game situation + result), each linked to a formation. Local only; not synced. */
  snaps!: EntityTable<Snap, 'id'>;
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
    // v3: charted snaps, so formations can be filtered by down, distance, run/pass later
    this.version(3).stores({ snaps: 'id, formationId, week, playId, down' });
    this.on('populate', () => {
      void seedDatabase(this);
    });
    this.on('ready', () => ensureSeeds(this));
  }
}

export const DEMO_PLAYBOOK_ID = 'seed-playbook-beast';
/** Bump when built-in formations or demo plays change; untouched seed rows are refreshed on open. */
export const SEED_VERSION = 4;
/** What the database records as seeded. The pack revision is a content hash, so re-running the formation import refreshes open databases without a manual bump. */
export const SEED_STAMP = `${SEED_VERSION}:${PACKERS_2019_REVISION}:${PACKERS_2019_PLAYS_REVISION}:${EAGLES_2026_REVISION}`;
const SEED_FORMATIONS = [...OFFENSE_FORMATIONS, ...DEFENSE_FORMATIONS, ...PACKERS_2019_FORMATIONS, ...EAGLES_2026_FORMATIONS];
/**
 * No built-in plays: the library holds only plays made in the editor or imported on request. The demo
 * plays and the Green Bay install plays that older versions seeded are removed below when untouched.
 */
const SEED_PLAYS: typeof DEMO_PLAYS = [];
const OLD_SEED_PLAY_IDS = new Set(DEMO_PLAYS.map((p) => p.id));

export async function ensureSeeds(database: PlayForgeDB) {
  const row = await database.settings.get('seedVersion');
  if (row?.value === SEED_STAMP) return;
  await database.transaction('rw', database.formations, database.plays, database.snaps, database.settings, database.tombstones, async () => {
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
    // Eagles chart formations and snaps: the untouched copies follow the data file; a snap imported in the app (updatedAt is real) stays.
    const eaglesIds = new Set(EAGLES_2026_FORMATIONS.map((f) => f.id));
    const staleEagles = await database.formations.filter((f) => f.id.startsWith(EAGLES_2026_FORMATION_ID_PREFIX) && f.builtin === true && !eaglesIds.has(f.id)).primaryKeys();
    await database.formations.bulkDelete(staleEagles);
    const snapIds = new Set(EAGLES_2026_SNAPS.map((s) => s.id));
    const staleSnaps = await database.snaps.filter((s) => s.id.startsWith(EAGLES_2026_SNAP_ID_PREFIX) && s.updatedAt === SEED_TIME && !snapIds.has(s.id)).primaryKeys();
    await database.snaps.bulkDelete(staleSnaps);
    for (const s of EAGLES_2026_SNAPS) {
      const existing = await database.snaps.get(s.id);
      if (!existing || existing.updatedAt === SEED_TIME) await database.snaps.put(s);
    }
    for (const p of SEED_PLAYS) {
      if (gone.has(itemKey('play', p.id))) continue;
      const existing = await database.plays.get(p.id);
      if (!existing || existing.updatedAt === SEED_TIME) await database.plays.put(p);
    }
    // Pack plays that were renamed or dropped by a re-import: remove the untouched copies.
    const stalePlays = await database.plays.filter((p) => (p.id.startsWith(PACKERS_2019_PLAY_ID_PREFIX) || OLD_SEED_PLAY_IDS.has(p.id)) && p.updatedAt === SEED_TIME).primaryKeys();
    await database.plays.bulkDelete(stalePlays);
    await database.settings.put({ key: 'seedVersion', value: SEED_STAMP });
  });
}

export async function seedDatabase(database: PlayForgeDB) {
  const t = SEED_TIME;
  await database.formations.bulkPut(SEED_FORMATIONS);
  await database.plays.bulkPut(SEED_PLAYS);
  await database.snaps.bulkPut(EAGLES_2026_SNAPS);
  await database.playbooks.put({
    id: DEMO_PLAYBOOK_ID,
    name: 'BEAST OFFENSE',
    subtitle: 'Demo playbook',
    cover: { title: 'Beast Offense', subtitle: 'Demo playbook', team: 'PlayForge', season: '2026', showCover: true },
    sections: [
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
