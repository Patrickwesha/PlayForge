import { describe, expect, it } from 'vitest';
import { newPlay } from '@/model/factories';
import { isUntouchedSeed, itemKey, type ItemKind } from '@/model/seedRules';
import type { Play } from '@/model/types';
import { syncOnce, type Local, type Remote } from './engine';
import { planPull } from './merge';
import { EMPTY_SYNC_STATE, type Entity, type OutboxRow, type PushRow, type RemoteRow, type SyncState, type TombstoneRow } from './types';

/** The cloud table: newest updated_at wins (like the SQL guard trigger), every write gets a fresh rev. */
class FakeCloud implements Remote {
  rows = new Map<string, RemoteRow>();
  rev = 0;
  onPush?: () => void;
  async pull(cursor: number, limit: number) {
    return [...this.rows.values()].filter((r) => r.rev > cursor).sort((a, b) => a.rev - b.rev).slice(0, limit);
  }
  async push(rows: PushRow[]) {
    for (const r of rows) {
      const key = itemKey(r.kind, r.id);
      const old = this.rows.get(key);
      const rev = ++this.rev;
      if (old && Date.parse(r.updated_at) < Date.parse(old.updated_at)) this.rows.set(key, { ...old, rev });
      else this.rows.set(key, { ...r, rev });
    }
    this.onPush?.();
  }
}

/** A device: same rules as repo.sync, held in memory. */
class FakeDevice implements Local {
  rows = new Map<string, Entity>();
  outbox = new Map<string, OutboxRow>();
  tombs = new Map<string, TombstoneRow>();
  state: SyncState = { ...EMPTY_SYNC_STATE };
  save(kind: ItemKind, row: Entity) {
    const key = itemKey(kind, row.id);
    this.rows.set(key, row);
    if (!isUntouchedSeed(kind, row)) this.outbox.set(key, { key, kind, id: row.id, op: 'put', at: row.updatedAt });
    this.tombs.delete(key);
  }
  remove(kind: ItemKind, id: string, at: string) {
    const key = itemKey(kind, id);
    this.rows.delete(key);
    this.outbox.set(key, { key, kind, id, op: 'delete', at });
    this.tombs.set(key, { key, kind, id, deletedAt: at });
  }
  names() {
    return [...this.rows.values()].map((r) => r.name).sort();
  }
  async getState() {
    return { ...this.state };
  }
  async setState(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
  }
  async markAllDirty() {
    for (const [key, row] of this.rows) {
      const kind = key.split(':')[0] as ItemKind;
      if (!isUntouchedSeed(kind, row)) this.outbox.set(key, { key, kind, id: row.id, op: 'put', at: row.updatedAt });
    }
    for (const t of this.tombs.values()) this.outbox.set(t.key, { key: t.key, kind: t.kind, id: t.id, op: 'delete', at: t.deletedAt });
  }
  async readPushBatch() {
    return { outbox: [...this.outbox.values()], local: new Map(this.rows) };
  }
  async ackPushed(entries: OutboxRow[]) {
    for (const e of entries) {
      const cur = this.outbox.get(e.key);
      if (cur && cur.at === e.at && cur.op === e.op) this.outbox.delete(e.key);
    }
  }
  async applyRemote(remote: RemoteRow[], cursor: number) {
    const plan = planPull({ local: this.rows, outbox: this.outbox, tombstones: this.tombs, remote, cursor });
    for (const p of plan.puts) this.rows.set(itemKey(p.kind, p.row.id), p.row);
    for (const d of plan.deletes) {
      const key = itemKey(d.kind, d.id);
      this.rows.delete(key);
      this.tombs.set(key, { key, ...d });
    }
    plan.clearOutbox.forEach((k) => this.outbox.delete(k));
    plan.clearTombstones.forEach((k) => this.tombs.delete(k));
    this.state.cursor = plan.nextCursor;
    return {
      applied: [...plan.puts.map((p) => ({ kind: p.kind, id: p.row.id, op: 'put' as const })), ...plan.deletes.map((d) => ({ kind: d.kind, id: d.id, op: 'delete' as const }))],
      skipped: plan.skipped.length,
      cursor: plan.nextCursor,
    };
  }
}

const play = (id: string, name: string, updatedAt: string): Play => ({ ...newPlay({ name }), id, updatedAt });
const USER = { userId: 'u1' };
const T = (day: number) => `2026-09-${String(day).padStart(2, '0')}T12:00:00.000Z`;

describe('syncOnce', () => {
  it('first sync is a union: both devices keep everything, newest wins on a shared id', async () => {
    const cloud = new FakeCloud();
    const desktop = new FakeDevice();
    const ipad = new FakeDevice();
    // saved while signed out, then the outbox was lost: markAllDirty has to find them again
    desktop.save('play', play('shared', 'POWER (desktop, older)', T(1)));
    desktop.save('play', play('d1', 'COUNTER', T(2)));
    desktop.outbox.clear();
    ipad.save('play', play('shared', 'POWER (ipad, newer)', T(3)));
    ipad.save('play', play('i1', 'SAIL', T(2)));

    await syncOnce(desktop, cloud, USER);
    await syncOnce(ipad, cloud, USER);
    await syncOnce(desktop, cloud, USER);

    const want = ['COUNTER', 'POWER (ipad, newer)', 'SAIL'];
    expect(desktop.names()).toEqual(want);
    expect(ipad.names()).toEqual(want);
    expect(desktop.outbox.size + ipad.outbox.size).toBe(0);
  });

  it('carries edits and deletes both ways', async () => {
    const cloud = new FakeCloud();
    const a = new FakeDevice();
    const b = new FakeDevice();
    a.save('play', play('p', 'V1', T(1)));
    await syncOnce(a, cloud, USER);
    await syncOnce(b, cloud, USER);
    expect(b.names()).toEqual(['V1']);

    b.save('play', play('p', 'V2', T(2)));
    await syncOnce(b, cloud, USER);
    const res = await syncOnce(a, cloud, USER);
    expect(a.names()).toEqual(['V2']);
    expect(res.applied).toEqual([{ kind: 'play', id: 'p', op: 'put' }]);

    a.remove('play', 'p', T(3));
    await syncOnce(a, cloud, USER);
    await syncOnce(b, cloud, USER);
    expect(b.names()).toEqual([]);
    expect(b.tombs.has(itemKey('play', 'p'))).toBe(true);
  });

  it('pulls by server rev, so a row with an ancient client time is not missed (clock skew)', async () => {
    const cloud = new FakeCloud();
    const a = new FakeDevice();
    const b = new FakeDevice();
    a.save('play', play('recent', 'RECENT', T(20)));
    await syncOnce(a, cloud, USER);
    await syncOnce(b, cloud, USER);
    // a device whose clock is a year behind writes a brand new play
    a.save('play', play('skewed', 'SKEWED', '2025-01-01T00:00:00.000Z'));
    await syncOnce(a, cloud, USER);
    await syncOnce(b, cloud, USER);
    expect(b.names()).toEqual(['RECENT', 'SKEWED']);
  });

  it('an edit made while the push is in flight stays queued', async () => {
    const cloud = new FakeCloud();
    const a = new FakeDevice();
    a.save('play', play('p', 'V1', T(1)));
    cloud.onPush = () => {
      cloud.onPush = undefined;
      a.save('play', play('p', 'V2', T(2)));
    };
    await syncOnce(a, cloud, USER);
    expect(a.outbox.get(itemKey('play', 'p'))?.at).toBe(T(2));
    await syncOnce(a, cloud, USER);
    expect((cloud.rows.get(itemKey('play', 'p'))?.data as Play).name).toBe('V2');
    expect(a.outbox.size).toBe(0);
  });

  it('a push that loses on the server heals on the next pull', async () => {
    const cloud = new FakeCloud();
    const a = new FakeDevice();
    const b = new FakeDevice();
    a.save('play', play('p', 'BASE', T(1)));
    await syncOnce(a, cloud, USER);
    await syncOnce(b, cloud, USER);
    // b's newer edit reaches the cloud between a's pull and a's push
    a.save('play', play('p', 'A OLDER', T(2)));
    const pull = cloud.pull.bind(cloud);
    cloud.pull = async (c, l) => {
      const rows = await pull(c, l);
      cloud.pull = pull;
      b.save('play', play('p', 'B NEWER', T(3)));
      await syncOnce(b, cloud, USER);
      return rows;
    };
    await syncOnce(a, cloud, USER);
    expect((cloud.rows.get(itemKey('play', 'p'))?.data as Play).name).toBe('B NEWER');
    await syncOnce(a, cloud, USER);
    expect(a.names()).toEqual(['B NEWER']);
  });

  it('a different account starts over: cursor to zero, everything offered again', async () => {
    const cloudOne = new FakeCloud();
    const cloudTwo = new FakeCloud();
    const a = new FakeDevice();
    a.save('play', play('p', 'MINE', T(1)));
    await syncOnce(a, cloudOne, { userId: 'u1' });
    await syncOnce(a, cloudOne, { userId: 'u1' }); // second round pulls back the echo and moves the cursor
    expect(a.state.cursor).toBeGreaterThan(0);
    await syncOnce(a, cloudTwo, { userId: 'u2' });
    expect(a.state.userId).toBe('u2');
    expect(cloudTwo.rows.size).toBe(1);
  });

  it('runs a full pull from zero when the last one is over a week old', async () => {
    const cloud = new FakeCloud();
    const a = new FakeDevice();
    const b = new FakeDevice();
    a.save('play', play('p', 'MISSED', T(1)));
    await syncOnce(a, cloud, USER);
    const t0 = Date.parse(T(10));
    await syncOnce(b, cloud, { ...USER, now: () => t0 });
    // pretend the cursor skipped past a row
    b.rows.clear();
    await syncOnce(b, cloud, { ...USER, now: () => t0 + 60_000 });
    expect(b.names()).toEqual([]);
    await syncOnce(b, cloud, { ...USER, now: () => t0 + 8 * 24 * 60 * 60 * 1000 });
    expect(b.names()).toEqual(['MISSED']);
  });
});
