import { create } from 'zustand';

/** off = this deployment has no sync set up. */
export type SyncPhase = 'off' | 'signedOut' | 'idle' | 'syncing' | 'offline' | 'error';

type SyncUiState = {
  /** false until the first session check finishes, so the UI does not flash "signed out". */
  ready: boolean;
  phase: SyncPhase;
  email: string | null;
  lastSyncedAt: string | null;
  lastError: string | null;
  /** Local changes still waiting to go up. */
  pending: number;
  /** One-line message for the toast ("Updated from your other device"). */
  notice: string | null;
  set(patch: Partial<Omit<SyncUiState, 'set'>>): void;
};

export const useSync = create<SyncUiState>((set) => ({
  ready: false,
  phase: 'off',
  email: null,
  lastSyncedAt: null,
  lastError: null,
  pending: 0,
  notice: null,
  set: (patch) => set(patch),
}));
