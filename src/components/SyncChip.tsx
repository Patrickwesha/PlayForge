'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestSync } from '@/sync/controller';
import { useSync } from '@/sync/syncStore';

export function ago(iso: string | null, now: number): string {
  if (!iso) return 'not yet';
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

/** Small sync status in the top bar. Tap to sync now, or to go sign in. Hidden when sync is not set up. */
export function SyncChip() {
  const router = useRouter();
  const { ready, phase, lastSyncedAt, pending } = useSync();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);
  if (!ready || phase === 'off') return null;

  const label =
    phase === 'signedOut' ? 'Sync off' : phase === 'syncing' ? 'Syncing…' : phase === 'offline' ? 'Offline' : phase === 'error' ? 'Sync error' : `Synced ${ago(lastSyncedAt, now)}`;
  const dot = phase === 'idle' ? 'bg-emerald-400' : phase === 'syncing' ? 'bg-sky-400 animate-pulse' : phase === 'error' ? 'bg-red-500' : 'bg-neutral-500';
  return (
    <button
      className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded text-xs text-neutral-300 hover:text-white hover:bg-neutral-800"
      title={phase === 'signedOut' ? 'Sign in to keep your library the same on every device' : 'Sync now'}
      onClick={() => (phase === 'signedOut' || phase === 'error' ? router.push('/settings') : void requestSync())}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      {label}
      {pending > 0 && phase !== 'signedOut' && <span className="text-neutral-400">· {pending} to send</span>}
    </button>
  );
}
