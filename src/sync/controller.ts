import { repo } from '@/store/repo';
import { flushIfDirty } from '@/store/autosave';
import { pushOnly, syncOnce } from './engine';
import { emitApplied } from './events';
import { getSupabase, isSyncConfigured } from './supabase';
import { supabaseRemote } from './supabaseRemote';
import { useSync } from './syncStore';

const FOCUS_THROTTLE_MS = 30_000;
const POLL_MS = 60_000;
const AFTER_EDIT_MS = 3_000;
const BACKOFF_MS = [5_000, 15_000, 60_000, 300_000];

let started = false;
let running = false;
let queued: { full: boolean } | null = null;
let userId: string | null = null;
let lastRun = 0;
let failures = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let editTimer: ReturnType<typeof setTimeout> | null = null;

const ui = () => useSync.getState();

async function refreshCounts() {
  const [pending, state] = await Promise.all([repo.sync.outboxCount(), repo.sync.getState()]);
  ui().set({ pending, lastSyncedAt: state.lastSyncedAt });
}

/** Only one tab syncs at a time; a tab that cannot get the lock just skips this round. */
async function withLock<T>(fn: () => Promise<T>): Promise<T | undefined> {
  if (typeof navigator === 'undefined' || !navigator.locks) return fn();
  return navigator.locks.request('playforge-sync', { ifAvailable: true }, (lock) => (lock ? fn() : undefined));
}

/** Run a sync now. Never throws: problems land in the sync store and the app keeps working locally. */
export async function requestSync(opts: { full?: boolean } = {}): Promise<void> {
  if (!userId) return;
  if (running) {
    queued = { full: !!opts.full || !!queued?.full };
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    ui().set({ phase: 'offline' });
    return;
  }
  const sbp = getSupabase();
  if (!sbp) return;
  running = true;
  lastRun = Date.now();
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  ui().set({ phase: 'syncing' });
  try {
    const sb = await sbp;
    const uid = userId;
    await flushIfDirty();
    const res = await withLock(() => syncOnce(repo.sync, supabaseRemote(sb, uid), { userId: uid, full: opts.full }));
    failures = 0;
    ui().set({ phase: 'idle', lastError: null });
    if (res) emitApplied(res.applied);
  } catch (e) {
    failures += 1;
    ui().set({ phase: 'error', lastError: e instanceof Error ? e.message : String(e) });
    retryTimer = setTimeout(() => void requestSync(), BACKOFF_MS[Math.min(failures, BACKOFF_MS.length) - 1]);
  } finally {
    running = false;
    await refreshCounts().catch(() => undefined);
    if (queued && userId) {
      const next = queued;
      queued = null;
      void requestSync(next);
    }
  }
}

async function pushQuietly() {
  if (!userId || running) return;
  const sbp = getSupabase();
  if (!sbp) return;
  try {
    const sb = await sbp;
    await flushIfDirty();
    await pushOnly(repo.sync, supabaseRemote(sb, userId));
  } catch {
    // the page is going away; whatever did not go up is still queued locally
  }
}

function setSession(session: { user: { id: string; email?: string } } | null) {
  const was = userId;
  userId = session?.user.id ?? null;
  ui().set({ ready: true, email: session?.user.email ?? null, phase: userId ? (ui().phase === 'syncing' ? 'syncing' : 'idle') : 'signedOut' });
  if (userId && userId !== was) void requestSync();
}

/** Wire sync up once per page load. Does nothing at all on a deployment without the Supabase env vars. */
export function startSync(): () => void {
  if (started) return () => undefined;
  if (!isSyncConfigured()) {
    ui().set({ ready: true, phase: 'off' });
    return () => undefined;
  }
  const sbp = getSupabase();
  if (!sbp) return () => undefined;
  started = true;
  const cleanups: (() => void)[] = [];
  let cancelled = false;

  void sbp.then(async (sb) => {
    if (cancelled) return;
    const { data } = await sb.auth.getSession();
    setSession(data.session);
    void refreshCounts();
    const sub = sb.auth.onAuthStateChange((_event, session) => {
      // never call supabase from inside this callback (it can deadlock): defer
      setTimeout(() => setSession(session), 0);
    });
    cleanups.push(() => sub.data.subscription.unsubscribe());
  });

  const onWake = () => {
    if (document.visibilityState === 'visible' && Date.now() - lastRun > FOCUS_THROTTLE_MS) {
      failures = 0;
      void requestSync();
    }
  };
  const onVisibility = () => {
    if (document.visibilityState === 'hidden') void pushQuietly();
    else onWake();
  };
  const onOnline = () => void requestSync();
  const onOffline = () => {
    if (userId) ui().set({ phase: 'offline' });
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('focus', onWake);
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  const poll = setInterval(() => {
    if (document.visibilityState === 'visible') void requestSync();
  }, POLL_MS);
  const offLocal = repo.onLocalChange(() => {
    if (!userId) return;
    void refreshCounts();
    if (editTimer) clearTimeout(editTimer);
    editTimer = setTimeout(() => void requestSync(), AFTER_EDIT_MS);
  });

  return () => {
    cancelled = true;
    started = false;
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('focus', onWake);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
    clearInterval(poll);
    offLocal();
    if (editTimer) clearTimeout(editTimer);
    if (retryTimer) clearTimeout(retryTimer);
    cleanups.forEach((c) => c());
  };
}
