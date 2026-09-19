import { formationSchema, playSchema, playbookSchema } from '@/model/schema';
import { isUntouchedSeed, itemKey, type ItemKind } from '@/model/seedRules';
import type { Entity, OutboxRow, PushRow, RemoteRow, TombstoneRow } from './types';

const SCHEMAS = { formation: formationSchema, play: playSchema, playbook: playbookSchema } as const;

export type PullInput = {
  /** Local rows for the keys that appear in `remote` (others are irrelevant). Keyed by itemKey. */
  local: Map<string, Entity>;
  outbox: Map<string, OutboxRow>;
  tombstones: Map<string, TombstoneRow>;
  remote: RemoteRow[];
  cursor: number;
};

export type PullPlan = {
  puts: { kind: ItemKind; row: Entity }[];
  deletes: { kind: ItemKind; id: string; deletedAt: string }[];
  /** Outbox entries that lost to the cloud copy. */
  clearOutbox: string[];
  /** Tombstones that lost to a newer cloud edit. */
  clearTombstones: string[];
  skipped: { key: string; reason: string }[];
  nextCursor: number;
};

/** Postgres answers with `+00:00`, the app writes `Z`: always compare as numbers. */
const time = (iso: string) => {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? -Infinity : t;
};

/**
 * Decide what a batch of cloud rows does to this device. Newest edit wins, per row.
 * Local time is: a pending change, else the row's own edit time (an untouched built-in counts as
 * "never edited"), else the time it was deleted here.
 */
export function planPull(input: PullInput): PullPlan {
  // working copies, so a key that shows up twice in one batch resolves in rev order
  const local = new Map(input.local);
  const outbox = new Map(input.outbox);
  const tombstones = new Map(input.tombstones);
  const puts = new Map<string, { kind: ItemKind; row: Entity }>();
  const deletes = new Map<string, { kind: ItemKind; id: string; deletedAt: string }>();
  const clearOutbox = new Set<string>();
  const clearTombstones = new Set<string>();
  const skipped: PullPlan['skipped'] = [];
  let nextCursor = input.cursor;

  for (const r of [...input.remote].sort((a, b) => a.rev - b.rev)) {
    if (r.rev > nextCursor) nextCursor = r.rev;
    const key = itemKey(r.kind, r.id);
    const schema = SCHEMAS[r.kind];
    if (!schema) {
      skipped.push({ key, reason: 'unknown kind' });
      continue;
    }
    if (!r.deleted) {
      const parsed = schema.safeParse(r.data);
      if (!parsed.success || (r.data as { id?: unknown }).id !== r.id) {
        skipped.push({ key, reason: parsed.success ? 'id mismatch' : 'invalid data' });
        continue;
      }
    }

    const pending = outbox.get(key);
    const row = local.get(key);
    const tomb = tombstones.get(key);
    const localTime = pending ? time(pending.at) : row && !isUntouchedSeed(r.kind, row) ? time(row.updatedAt) : tomb ? time(tomb.deletedAt) : -Infinity;
    if (time(r.updated_at) <= localTime) continue; // ours is newer, or this is the echo of our own push

    if (pending) {
      outbox.delete(key);
      clearOutbox.add(key);
    }
    if (r.deleted) {
      local.delete(key);
      puts.delete(key);
      const del = { kind: r.kind, id: r.id, deletedAt: r.updated_at };
      deletes.set(key, del);
      tombstones.set(key, { key, ...del });
      clearTombstones.delete(key);
    } else {
      // keep the original object, not the parsed one, so fields from a newer app version survive
      const entity = r.data as Entity;
      local.set(key, entity);
      puts.set(key, { kind: r.kind, row: entity });
      deletes.delete(key);
      if (tombstones.delete(key)) clearTombstones.add(key);
    }
  }

  return {
    puts: [...puts.values()],
    deletes: [...deletes.values()],
    clearOutbox: [...clearOutbox],
    clearTombstones: [...clearTombstones],
    skipped,
    nextCursor,
  };
}

/** Turn the outbox into rows to send. Untouched built-ins and rows that vanished are dropped. */
export function planPush(outbox: OutboxRow[], local: Map<string, Entity>): { rows: PushRow[]; drop: OutboxRow[] } {
  const rows: PushRow[] = [];
  const drop: OutboxRow[] = [];
  for (const o of outbox) {
    if (o.op === 'delete') {
      rows.push({ kind: o.kind, id: o.id, data: null, updated_at: o.at, deleted: true });
      continue;
    }
    const row = local.get(o.key);
    if (!row || isUntouchedSeed(o.kind, row)) {
      drop.push(o);
      continue;
    }
    rows.push({ kind: o.kind, id: o.id, data: row, updated_at: row.updatedAt, deleted: false });
  }
  return { rows, drop };
}
