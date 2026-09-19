import { planPush } from './merge';
import type { AppliedChange, Entity, OutboxRow, PushRow, RemoteRow, SyncState } from './types';

/** The cloud side. `pull` returns rows with rev > cursor, oldest rev first, at most `limit`. */
export type Remote = {
  pull(cursor: number, limit: number): Promise<RemoteRow[]>;
  push(rows: PushRow[]): Promise<void>;
};

/** The device side (repo.sync in the app, an in-memory fake in tests). */
export type Local = {
  getState(): Promise<SyncState>;
  setState(patch: Partial<SyncState>): Promise<void>;
  markAllDirty(): Promise<void>;
  readPushBatch(): Promise<{ outbox: OutboxRow[]; local: Map<string, Entity> }>;
  ackPushed(entries: OutboxRow[]): Promise<void>;
  applyRemote(remote: RemoteRow[], cursor: number): Promise<{ applied: AppliedChange[]; skipped: number; cursor: number }>;
};

export const PULL_PAGE = 500;
export const PUSH_CHUNK = 100;
/** A full pull from zero at least this often covers the rare row a cursor could miss. */
export const FULL_PULL_EVERY_MS = 7 * 24 * 60 * 60 * 1000;

export type SyncResult = { applied: AppliedChange[]; pushed: number; skipped: number };

async function pushOutbox(local: Local, remote: Remote): Promise<number> {
  const batch = await local.readPushBatch();
  const { rows } = planPush(batch.outbox, batch.local);
  for (let i = 0; i < rows.length; i += PUSH_CHUNK) await remote.push(rows.slice(i, i + PUSH_CHUNK));
  // everything we read went up (or never needed to); entries that changed mid-push stay queued
  await local.ackPushed(batch.outbox);
  return rows.length;
}

/**
 * One full round: pull what changed elsewhere, merge it (newest edit wins), then push what changed here.
 * Pulling first makes the very first sync a union of both devices instead of one overwriting the other.
 */
export async function syncOnce(local: Local, remote: Remote, opts: { userId: string; now?: () => number; full?: boolean }): Promise<SyncResult> {
  const now = opts.now ?? Date.now;
  let state = await local.getState();
  if (state.userId !== opts.userId) {
    // first sync on this device, or a different account: start from zero and offer everything we have
    await local.markAllDirty();
    await local.setState({ userId: opts.userId, cursor: 0, lastFullPullAt: null });
    state = await local.getState();
  }
  const stale = !state.lastFullPullAt || now() - Date.parse(state.lastFullPullAt) > FULL_PULL_EVERY_MS;
  const full = opts.full || stale;
  let cursor = full ? 0 : state.cursor;

  const rows: RemoteRow[] = [];
  for (;;) {
    const page = await remote.pull(cursor, PULL_PAGE);
    rows.push(...page);
    if (page.length > 0) cursor = page[page.length - 1].rev;
    if (page.length < PULL_PAGE) break;
  }
  // one apply for the whole pull, so a playbook and its plays land together
  const res = await local.applyRemote(rows, full ? 0 : state.cursor);
  const pushed = await pushOutbox(local, remote);
  const stamp = new Date(now()).toISOString();
  await local.setState(full ? { lastSyncedAt: stamp, lastFullPullAt: stamp } : { lastSyncedAt: stamp });
  return { applied: res.applied, pushed, skipped: res.skipped };
}

/** Just send what is queued (used as the page is hidden). The server keeps the newer copy, so no pull is needed first. */
export async function pushOnly(local: Local, remote: Remote): Promise<number> {
  return pushOutbox(local, remote);
}
