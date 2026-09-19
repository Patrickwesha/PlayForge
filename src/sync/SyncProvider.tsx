'use client';

import { useEffect } from 'react';
import { startSync } from './controller';
import { useSync } from './syncStore';

/** Starts background sync for the whole app and shows its one-line notices. Renders nothing when there is nothing to say. */
export function SyncProvider() {
  const notice = useSync((s) => s.notice);
  useEffect(() => startSync(), []);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => useSync.getState().set({ notice: null }), 4000);
    return () => clearTimeout(t);
  }, [notice]);
  if (!notice) return null;
  return (
    <div aria-live="polite" className="no-print fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-sm px-4 py-2 rounded-full shadow-lg">
      {notice}
    </div>
  );
}
