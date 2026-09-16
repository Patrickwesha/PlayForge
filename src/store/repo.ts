import type { BackupV2, Formation, Play, Playbook, Settings, Side } from '@/model/types';
import { DEFAULT_SETTINGS } from '@/model/types';
import { nowIso } from '@/model/ids';
import { getDb, seedDatabase } from './db';

/** The only module that talks to Dexie. */
export const repo = {
  // ---- formations ----
  async listFormations(side?: Side): Promise<Formation[]> {
    const db = getDb();
    const rows = side ? await db.formations.where('side').equals(side).toArray() : await db.formations.toArray();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
  getFormation(id: string) {
    return getDb().formations.get(id);
  },
  async saveFormation(f: Formation) {
    const row = { ...f, updatedAt: nowIso() };
    await getDb().formations.put(row);
    return row;
  },
  deleteFormation(id: string) {
    return getDb().formations.delete(id);
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
  async savePlay(p: Play) {
    const row = { ...p, updatedAt: nowIso() };
    await getDb().plays.put(row);
    return row;
  },
  deletePlay(id: string) {
    return getDb().plays.delete(id);
  },

  // ---- playbooks ----
  async listPlaybooks(): Promise<Playbook[]> {
    const rows = await getDb().playbooks.toArray();
    return rows.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  },
  getPlaybook(id: string) {
    return getDb().playbooks.get(id);
  },
  async savePlaybook(pb: Playbook) {
    const row = { ...pb, updatedAt: nowIso() };
    await getDb().playbooks.put(row);
    return row;
  },
  deletePlaybook(id: string) {
    return getDb().playbooks.delete(id);
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
  async importAll(data: Pick<BackupV2, 'formations' | 'plays' | 'playbooks'> & { settings?: Settings }, mode: 'merge' | 'replace') {
    const db = getDb();
    await db.transaction('rw', db.formations, db.plays, db.playbooks, db.settings, async () => {
      if (mode === 'replace') {
        await Promise.all([db.formations.clear(), db.plays.clear(), db.playbooks.clear()]);
      }
      await db.formations.bulkPut(data.formations);
      await db.plays.bulkPut(data.plays);
      await db.playbooks.bulkPut(data.playbooks);
      if (data.settings) await db.settings.put({ key: 'settings', value: data.settings });
    });
  },
  async resetToSeeds() {
    const db = getDb();
    await db.transaction('rw', db.formations, db.plays, db.playbooks, async () => {
      await Promise.all([db.formations.clear(), db.plays.clear(), db.playbooks.clear()]);
      await seedDatabase(db);
    });
  },
  async counts() {
    const db = getDb();
    const [formations, plays, playbooks] = await Promise.all([db.formations.count(), db.plays.count(), db.playbooks.count()]);
    return { formations, plays, playbooks };
  },
};
