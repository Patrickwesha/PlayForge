import { describe, expect, it } from 'vitest';
import { newFormation, newPlay, newPlaybook } from '@/model/factories';
import { SEED_TIME, isUntouchedSeed, itemKey } from '@/model/seedRules';
import type { Play } from '@/model/types';
import { planPull, planPush } from './merge';
import type { Entity, OutboxRow, RemoteRow, TombstoneRow } from './types';

const T1 = '2026-09-10T10:00:00.000Z';
const T2 = '2026-09-11T10:00:00.000Z';
const T3 = '2026-09-12T10:00:00.000Z';

const play = (id: string, name: string, updatedAt: string): Play => ({ ...newPlay({ name }), id, updatedAt });
const remotePut = (row: Entity, kind: RemoteRow['kind'], rev: number, updated_at = row.updatedAt): RemoteRow => ({ kind, id: row.id, data: row, updated_at, deleted: false, rev });
const remoteDel = (kind: RemoteRow['kind'], id: string, at: string, rev: number): RemoteRow => ({ kind, id, data: null, updated_at: at, deleted: true, rev });
const maps = (rows: [string, Entity][] = [], outbox: OutboxRow[] = [], tombs: TombstoneRow[] = []) => ({
  local: new Map(rows),
  outbox: new Map(outbox.map((o) => [o.key, o])),
  tombstones: new Map(tombs.map((t) => [t.key, t])),
});
const K = itemKey('play', 'a');

describe('seed rules', () => {
  it('knows an untouched built-in from an edited one', () => {
    expect(isUntouchedSeed('formation', { updatedAt: SEED_TIME, builtin: true })).toBe(true);
    expect(isUntouchedSeed('formation', { updatedAt: T1, builtin: false })).toBe(false);
    expect(isUntouchedSeed('play', { updatedAt: SEED_TIME })).toBe(true);
    expect(isUntouchedSeed('playbook', { updatedAt: T1 })).toBe(false);
  });
});

describe('planPull', () => {
  it('applies a newer cloud edit over a clean local row and moves the cursor', () => {
    const plan = planPull({ ...maps([[K, play('a', 'OLD', T1)]]), remote: [remotePut(play('a', 'NEW', T2), 'play', 7)], cursor: 3 });
    expect(plan.puts.map((p) => (p.row as Play).name)).toEqual(['NEW']);
    expect(plan.nextCursor).toBe(7);
  });

  it('keeps a newer local edit that is waiting to go up', () => {
    const pending: OutboxRow = { key: K, kind: 'play', id: 'a', op: 'put', at: T3 };
    const plan = planPull({ ...maps([[K, play('a', 'MINE', T3)]], [pending]), remote: [remotePut(play('a', 'THEIRS', T2), 'play', 9)], cursor: 0 });
    expect(plan.puts).toEqual([]);
    expect(plan.clearOutbox).toEqual([]);
    expect(plan.nextCursor).toBe(9);
  });

  it('lets a delete beat an older edit, and records the tombstone', () => {
    const pending: OutboxRow = { key: K, kind: 'play', id: 'a', op: 'put', at: T1 };
    const plan = planPull({ ...maps([[K, play('a', 'MINE', T1)]], [pending]), remote: [remoteDel('play', 'a', T2, 4)], cursor: 0 });
    expect(plan.deletes).toEqual([{ kind: 'play', id: 'a', deletedAt: T2 }]);
    expect(plan.clearOutbox).toEqual([K]);
  });

  it('lets an edit beat an older delete, and drops the tombstone', () => {
    const tomb: TombstoneRow = { key: K, kind: 'play', id: 'a', deletedAt: T1 };
    const plan = planPull({ ...maps([], [{ key: K, kind: 'play', id: 'a', op: 'delete', at: T1 }], [tomb]), remote: [remotePut(play('a', 'BACK', T2), 'play', 5)], cursor: 0 });
    expect(plan.puts).toHaveLength(1);
    expect(plan.clearTombstones).toEqual([K]);
    expect(plan.clearOutbox).toEqual([K]);
  });

  it('keeps a row deleted here when the cloud copy is older', () => {
    const tomb: TombstoneRow = { key: K, kind: 'play', id: 'a', deletedAt: T3 };
    const plan = planPull({ ...maps([], [], [tomb]), remote: [remotePut(play('a', 'STALE', T2), 'play', 5)], cursor: 0 });
    expect(plan.puts).toEqual([]);
  });

  it('an untouched built-in always loses to a real edit or delete from another device', () => {
    const seed = { ...newFormation({ name: 'ACE', side: 'offense' }), id: 'seed-ace', builtin: true, updatedAt: SEED_TIME };
    const fk = itemKey('formation', 'seed-ace');
    const edited = { ...seed, builtin: false, name: 'ACE TIGHT', updatedAt: T1 };
    expect(planPull({ ...maps([[fk, seed]]), remote: [remotePut(edited, 'formation', 2)], cursor: 0 }).puts).toHaveLength(1);
    expect(planPull({ ...maps([[fk, seed]]), remote: [remoteDel('formation', 'seed-ace', T1, 3)], cursor: 0 }).deletes).toHaveLength(1);
  });

  it('compares times as numbers: +00:00 and Z are the same instant (echo of our own push is a no-op)', () => {
    const mine = play('a', 'MINE', T2);
    const plan = planPull({ ...maps([[K, mine]]), remote: [remotePut(mine, 'play', 8, '2026-09-11T10:00:00+00:00')], cursor: 0 });
    expect(plan.puts).toEqual([]);
    expect(plan.nextCursor).toBe(8);
  });

  it('skips junk but still moves the cursor past it', () => {
    const bad: RemoteRow = { kind: 'play', id: 'x', data: { id: 'x', nope: true }, updated_at: T2, deleted: false, rev: 11 };
    const wrongId = remotePut(play('b', 'B', T2), 'play', 12);
    wrongId.id = 'c';
    const plan = planPull({ ...maps(), remote: [bad, wrongId], cursor: 0 });
    expect(plan.puts).toEqual([]);
    expect(plan.skipped.map((s) => s.reason)).toEqual(['invalid data', 'id mismatch']);
    expect(plan.nextCursor).toBe(12);
  });

  it('keeps fields it does not know about (a newer app version wrote them)', () => {
    const future = { ...play('a', 'NEW', T2), futureField: 42 };
    const plan = planPull({ ...maps(), remote: [remotePut(future, 'play', 1)], cursor: 0 });
    expect((plan.puts[0].row as unknown as { futureField: number }).futureField).toBe(42);
  });

  it('resolves the same key twice in one batch in rev order', () => {
    const plan = planPull({ ...maps(), remote: [remoteDel('play', 'a', T3, 6), remotePut(play('a', 'V1', T2), 'play', 5)], cursor: 0 });
    expect(plan.puts).toEqual([]);
    expect(plan.deletes).toEqual([{ kind: 'play', id: 'a', deletedAt: T3 }]);
  });

  it('handles all three kinds', () => {
    const pb = { ...newPlaybook('BOOK'), id: 'pb1', updatedAt: T1 };
    const f = { ...newFormation({ name: 'TRIPS', side: 'offense' }), id: 'f1', updatedAt: T1 };
    const plan = planPull({ ...maps(), remote: [remotePut(pb, 'playbook', 1), remotePut(f, 'formation', 2), remotePut(play('p1', 'P', T1), 'play', 3)], cursor: 0 });
    expect(plan.puts.map((p) => p.kind).sort()).toEqual(['formation', 'play', 'playbook']);
  });
});

describe('planPush', () => {
  it('sends edits and deletes, never untouched built-ins or rows that vanished', () => {
    const seedPlay = play('seed-demo', 'DEMO', SEED_TIME);
    const mine = play('a', 'MINE', T2);
    const outbox: OutboxRow[] = [
      { key: K, kind: 'play', id: 'a', op: 'put', at: T2 },
      { key: itemKey('play', 'seed-demo'), kind: 'play', id: 'seed-demo', op: 'put', at: SEED_TIME },
      { key: itemKey('play', 'ghost'), kind: 'play', id: 'ghost', op: 'put', at: T1 },
      { key: itemKey('formation', 'seed-ace'), kind: 'formation', id: 'seed-ace', op: 'delete', at: T3 },
    ];
    const { rows, drop } = planPush(outbox, new Map<string, Entity>([[K, mine], [itemKey('play', 'seed-demo'), seedPlay]]));
    expect(rows).toEqual([
      { kind: 'play', id: 'a', data: mine, updated_at: T2, deleted: false },
      { kind: 'formation', id: 'seed-ace', data: null, updated_at: T3, deleted: true },
    ]);
    expect(drop.map((d) => d.id)).toEqual(['seed-demo', 'ghost']);
  });
});
