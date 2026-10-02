'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { create } from 'zustand';
import { parseBackup } from '@/io/backup';
import { repo } from '@/store/repo';

type LibState = { loaded: boolean; playIds: Set<string>; hasPlaybook: boolean; refresh: (bookId: string) => Promise<void> };

/** Which of the book's plays are already in this device's PlayForge library (one read for the whole page). */
const useLib = create<LibState>((set) => ({
  loaded: false,
  playIds: new Set(),
  hasPlaybook: false,
  refresh: async (bookId) => {
    const [plays, pb] = await Promise.all([repo.listPlays(), repo.getPlaybook(bookId)]);
    set({ loaded: true, playIds: new Set(plays.filter((p) => p.id.startsWith('gb19-')).map((p) => p.id)), hasPlaybook: !!pb });
  },
}));

/** Banner: add the book's formations, plays and the "Green Bay 2019" playbook to the library, or open it. */
export function LibraryBar({ bookId, libraryUrl }: { bookId: string; libraryUrl: string }) {
  const { loaded, hasPlaybook, playIds, refresh } = useLib();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    void refresh(bookId);
  }, [bookId, refresh]);

  const add = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const text = await (await fetch(libraryUrl, { cache: 'no-store' })).text();
      const parsed = parseBackup(text);
      await repo.importAll(parsed.data, 'merge');
      await refresh(bookId);
      setMsg(`Added ${parsed.data.plays.length} plays and ${parsed.data.formations.length} formations.`);
    } catch (e) {
      setMsg(`Could not add the playbook: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) return null;
  return (
    <div className="no-print" style={{ maxWidth: '62rem', margin: '0 auto 1rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
      {hasPlaybook ? (
        <>
          <span>
            In your library: {playIds.size} plays in the <strong>Green Bay 2019</strong> playbook.
          </span>
          <Link className="bk-btn" href={`/playbooks/${bookId}`}>
            Open the playbook
          </Link>
          <button type="button" className="bk-btn" onClick={add} disabled={busy} title="Re-import: replaces the book's plays with this build">
            {busy ? 'Updating…' : 'Update from this build'}
          </button>
        </>
      ) : (
        <>
          <span>Add every diagram as a PlayForge play, and the book as the Green Bay 2019 playbook.</span>
          <button type="button" className="bk-btn" onClick={add} disabled={busy}>
            {busy ? 'Adding…' : 'Add to my library'}
          </button>
        </>
      )}
      {msg && <span style={{ color: 'var(--bk-muted)' }}>{msg}</span>}
    </div>
  );
}

/** "Edit" link to the play editor, shown once the play is in the library. */
export function PlayLink({ id }: { id: string }) {
  const has = useLib((s) => s.playIds.has(id));
  if (!has) return null;
  return (
    <Link className="no-print" href={`/plays/${id}`} style={{ color: 'inherit', fontSize: '0.7rem' }} title="Open in the play editor">
      Edit
    </Link>
  );
}
