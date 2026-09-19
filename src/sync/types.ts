import type { Formation, Play, Playbook } from '@/model/types';
import type { ItemKind } from '@/model/seedRules';

export type Entity = Formation | Play | Playbook;

/** "This row still has to go up to the cloud." `at` is the row's updatedAt (put) or the delete time. */
export type OutboxRow = { key: string; kind: ItemKind; id: string; op: 'put' | 'delete'; at: string };

/** "This id was deleted, here or on another device." Keeps deleted rows (seeds included) from coming back. */
export type TombstoneRow = { key: string; kind: ItemKind; id: string; deletedAt: string };

/** A row as the cloud returns it. `rev` is the server-assigned cursor, `updated_at` is the client's own edit time. */
export type RemoteRow = { kind: ItemKind; id: string; data: unknown; updated_at: string; deleted: boolean; rev: number };

/** A row as we send it up. */
export type PushRow = { kind: ItemKind; id: string; data: Entity | null; updated_at: string; deleted: boolean };

export type AppliedChange = { kind: ItemKind; id: string; op: 'put' | 'delete' };

export type SyncState = {
  cursor: number;
  userId: string | null;
  lastSyncedAt: string | null;
  lastFullPullAt: string | null;
};

export const EMPTY_SYNC_STATE: SyncState = { cursor: 0, userId: null, lastSyncedAt: null, lastFullPullAt: null };
