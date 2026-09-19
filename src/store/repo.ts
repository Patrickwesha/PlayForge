import type { Table } from 'dexie';
import type { BackupV2, Formation, Play, Playbook, Settings, Side } from '@/model/types';
import { DEFAULT_SETTINGS } from '@/model/types';
import { nowIso } from '@/model/ids';
import { ITEM_KINDS, isUntouchedSeed, itemKey, type ItemKind } from '@/model/seedRules';
import { planPull } from '@/sync/merge';
import { EMPTY_SYNC_STATE, type AppliedChange, type Entity, type OutboxRow, type RemoteRow, type SyncState, type TombstoneRow } from '@/sync/types';
import { getDb, seedDatabase, type PlayForgeDB } from './db';

const tableFor = (db: PlayForgeDB, kind: ItemKind) =>
  (kind === 'formation' ? db.formations : kind === 'play' ? db.plays : db.playbooks) as unknown as Table<Entity, string>;

const syncTables = (db: PlayForgeDB) => [db.formations, db.plays, db.playbooks, db.settings, db.outbox, db.tombstones];

/** Listeners told after any local save or delete, so sync can schedule a push. */
const localChangeListeners = new Set<() => void>();
const notifyLocalChange = () => localChangeListeners.forEach((cb) => cb());

/** Save a row and queue it for the cloud in one transaction. Untouched built-ins never queue. */
async function putTracked<T extends Entity>(kind: ItemKind, row: T): Promise<T> {
  const db = getDb();
  const key = itemKey(kind, row.id);
  await db.transaction('rw', tableFor(db, kind), db.outbox, db.tombstones, async () => {
    await tableFor(db, kind).put(row);
    if (!isUntouchedSeed(kind, row)) await db.outbox.put({ key, kind, id: row.id, op: 'put', at: row.updatedAt });
    await db.tombstones.delete(key);
  });
  notifyLocalChange();
  return row;
}

/** Delete a row, remember that it is gone, and queue the delete for the cloud. */
async function deleteTracked(kind: ItemKind, id: string) {
  const db = getDb();
  const key = itemKey(kind, id);
  const at = nowIso();
  await db.transaction('rw', tableFor(db, kind), db.outbox, db.tombstones, async () => {
    await tableFor(db, kind).delete(id);
    await db.outbox.put({ key, kind, id, op: 'delete', at });
    await db.tombstones.put({ key, kind, id, deletedAt: at });
  });
  notifyLocalChange();
}

async function readSyncState(db: PlayForgeDB): Promise<SyncState> {
  const row = await db.settings.get('sync');
  return { ...EMPTY_SYNC_STATE, ...((row?.value as Partial<SyncState>) ?? {}) };
}

async function clearLibrary(db: PlayForgeDB) {
  await Promise.all([db.formations.clear(), db.plays.clear(), db.playbooks.clear(), db.outbox.clear(), db.tombstones.clear(), db.settings.delete('sync')]);
}

/** The only module that talks to Dexie. */
export const repo = {
  /** Called after every local save or delete. Returns an unsubscribe. */
  onLocalChange(cb: () => void) {
    localChangeListeners.add(cb);
    return () => {
      localChangeListeners.delete(cb);
    };
  },

  // ---- formations ----
  async listFormations(side?: Side): Promise<Formation[]> {
    const db = getDb();
    const rows = side ? await db.formations.where('side').equals(side).toArray() : await db.formations.toArray();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
  getFormation(id: string) {
    return getDb().formations.get(id);
  },
  saveFormation(f: Formation) {
    return putTracked('formation', { ...f, updatedAt: nowIso() });
  },
  deleteFormation(id: string) {
    return deleteTracked('formation', id);
  },

  // ---- plays ----
  async listPlays(): Promise<Play[]> {
    const rows = await getDb().plays.toArray();
    return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  getPlay(id: string) {
    return getDb().plays.get(id);
  },
  async getPlays(ids: string[]) {
    const rows = await getDb().plays.bulkGet(ids);
    return rows.filter((r): r is Play => !!r);
  },
  savePlay(p: Play) {
    return putTracked('play', { ...p, updatedAt: nowIso() });
  },
  deletePlay(id: string) {
    return deleteTracked('play', id);
  },

  // ---- playbooks ----
  async listPlaybooks(): Promise<Playbook[]> {
    const rows = await getDb().playbooks.toArray();
    return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  getPlaybook(id: string) {
    return getDb().playbooks.get(id);
  },
  savePlaybook(pb: Playbook) {
    return putTracked('playbook', { ...pb, updatedAt: nowIso() });
  },
  deletePlaybook(id: string) {
    return deleteTracked('playbook', id);
  },

  // ---- settings ----
  async getSettings(): Promise<Settings> {
    const row = await getDb().settings.get('settings');
    return { ...DEFAULT_SETTINGS, ...((row?.value as Partial<Settings>) ?? {}) };
  },
  async saveSettings(s: Settings) {
    await getDb().settings.put({ key: 'settings', value: s });
  },

  // ---- backup ----
  async exportAll(): Promise<BackupV2> {
    const db = getDb();
    const [formations, plays, playbooks, settings] = await Promise.all([db.formations.toArray(), db.plays.toArray(), db.playbooks.toArray(), repo.getSettings()]);
    return { app: 'playforge', version: 2, exportedAt: nowIso(), formations, plays, playbooks, settings };
  },
  /** Replace starts this device over, so the UI only allows it while signed out of sync. */
  async importAll(data: Pick<BackupV2, 'formations' | 'plays' | 'playbooks'> & { settings?: Settings }, mode: 'merge' | 'replace') {
    const db = getDb();
    await db.transaction('rw', syncTables(db), async () => {
      if (mode === 'replace') await clearLibrary(db);
      const now = nowIso();
      const groups: [ItemKind, Entity[]][] = [
        ['formation', data.formations],
        ['play', data.plays],
        ['playbook', data.playbooks],
      ];
      for (const [kind, rows] of groups) {
        for (const raw of rows) {
          const key = itemKey(kind, raw.id);
          // restoring something that was deleted: stamp it now so the restore beats the delete on every device
          const restored = (await db.tombstones.get(key)) !== undefined;
          const row = restored ? { ...raw, updatedAt: now } : raw;
          await tableFor(db, kind).put(row);
          if (restored) await db.tombstones.delete(key);
          if (!isUntouchedSeed(kind, row)) await db.outbox.put({ key, kind, id: row.id, op: 'put', at: row.updatedAt });
        }
      }
      if (data.settings) await db.settings.put({ key: 'settings', value: data.settings });
    });
    notifyLocalChange();
  },
  /** Start this device over with the built-ins. The UI only allows it while signed out of sync. */
  async resetToSeeds() {
    const db = getDb();
    await db.transaction('rw', syncTables(db), async () => {
      await clearLibrary(db);
      await seedDatabase(db);
    });
  },
  async counts() {
    const db = getDb();
    const [formations, plays, playbooks] = await Promise.all([db.formations.count(), db.plays.count(), db.playbooks.count()]);
    return { formations, plays, playbooks };
  },

  // ---- cloud sync bookkeeping: the engine in src/sync reaches the library only through this ----
  sync: {
    getState(): Promise<SyncState> {
      return readSyncState(getDb());
    },
    async setState(patch: Partial<SyncState>) {
      const db = getDb();
      await db.transaction('rw', db.settings, async () => {
        await db.settings.put({ key: 'sync', value: { ...(await readSyncState(db)), ...patch } });
      });
    },
    outboxCount() {
      return getDb().outbox.count();
    },
    /** First sync on this device (or a different account): queue every real row and every remembered delete. */
    async markAllDirty() {
      const db = getDb();
      await db.transaction('rw', syncTables(db), async () => {
        for (const kind of ITEM_KINDS) {
          const rows = await tableFor(db, kind).toArray();
          await db.outbox.bulkPut(rows.filter((r) => !isUntouchedSeed(kind, r)).map((r): OutboxRow => ({ key: itemKey(kind, r.id), kind, id: r.id, op: 'put', at: r.updatedAt })));
        }
        const tombs = await db.tombstones.toArray();
        await db.outbox.bulkPut(tombs.map((t): OutboxRow => ({ key: t.key, kind: t.kind, id: t.id, op: 'delete', at: t.deletedAt })));
      });
    },
    /** The outbox plus the rows it points at. */
    async readPushBatch(): Promise<{ outbox: OutboxRow[]; local: Map<string, Entity> }> {
      const db = getDb();
      const outbox = await db.outbox.toArray();
      const local = new Map<string, Entity>();
      for (const o of outbox) {
        if (o.op !== 'put') continue;
        const row = await tableFor(db, o.kind).get(o.id);
        if (row) local.set(o.key, row);
      }
      return { outbox, local };
    },
    /** Drop outbox entries that went up, unless the row changed again while the push was in flight. */
    async ackPushed(entries: OutboxRow[]) {
      const db = getDb();
      await db.transaction('rw', db.outbox, async () => {
        for (const e of entries) {
          const cur = await db.outbox.get(e.key);
          if (cur && cur.at === e.at && cur.op === e.op) await db.outbox.delete(e.key);
        }
      });
    },
    /**
     * Merge a batch of cloud rows into the library: read, decide (pure planPull), and write in ONE
     * transaction so an autosave cannot slip in between. Rows are written as-is (no updatedAt bump).
     */
    async applyRemote(remote: RemoteRow[], cursor: number): Promise<{ applied: AppliedChange[]; skipped: number; cursor: number }> {
      const db = getDb();
      return db.transaction('rw', syncTables(db), async () => {
        const local = new Map<string, Entity>();
        const outbox = new Map<string, OutboxRow>();
        const tombstones = new Map<string, TombstoneRow>();
        const seen = new Set<string>();
        for (const r of remote) {
          const key = itemKey(r.kind, r.id);
          if (seen.has(key) || !ITEM_KINDS.includes(r.kind)) continue;
          seen.add(key);
          const [row, pending, tomb] = await Promise.all([tableFor(db, r.kind).get(r.id), db.outbox.get(key), db.tombstones.get(key)]);
          if (row) local.set(key, row);
          if (pending) outbox.set(key, pending);
          if (tomb) tombstones.set(key, tomb);
        }
        const plan = planPull({ local, outbox, tombstones, remote, cursor });
        for (const p of plan.puts) await tableFor(db, p.kind).put(p.row);
        for (const d of plan.deletes) {
          await tableFor(db, d.kind).delete(d.id);
          await db.tombstones.put({ key: itemKey(d.kind, d.id), kind: d.kind, id: d.id, deletedAt: d.deletedAt });
        }
        await db.outbox.bulkDelete(plan.clearOutbox);
        await db.tombstones.bulkDelete(plan.clearTombstones);
        await db.settings.put({ key: 'sync', value: { ...(await readSyncState(db)), cursor: plan.nextCursor } });
        const applied: AppliedChange[] = [
          ...plan.puts.map((p): AppliedChange => ({ kind: p.kind, id: p.row.id, op: 'put' })),
          ...plan.deletes.map((d): AppliedChange => ({ kind: d.kind, id: d.id, op: 'delete' })),
        ];
        return { applied, skipped: plan.skipped.length, cursor: plan.nextCursor };
      });
    },
  },
};
