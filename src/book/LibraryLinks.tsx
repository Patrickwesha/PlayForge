'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { create } from 'zustand';
import { parseBackup } from '@/io/backup';
import { repo } from '@/store/repo';
import type { Diagram, Play, ViewWindow } from '@/model/types';
import { PlaySvg } from '@/render/PlaySvg';
import { BOOK_RENDER_THEME } from '@/render/theme';
import { onApplied } from '@/sync/events';

type LibState = {
  loaded: boolean;
  /** The book's plays as they are in this device's library (edits included), by id. */
  plays: Map<string, Play>;
  hasPlaybook: boolean;
  refresh: (bookId: string) => Promise<void>;
};

const isBookPlay = (p: Play) => p.id.startsWith('gb19-');

/** The book's plays in this device's PlayForge library (one read for the whole page, refreshed after a sync). */
const useLib = create<LibState>((set) => ({
  loaded: false,
  plays: new Map(),
  hasPlaybook: false,
  refresh: async (bookId) => {
    const [plays, pb] = await Promise.all([repo.listPlays(), repo.getPlaybook(bookId)]);
    set({ loaded: true, plays: new Map(plays.filter(isBookPlay).map((p) => [p.id, p])), hasPlaybook: !!pb });
  },
}));

/** A play edited in the editor after the book was built (the build stamps every play with `built`). */
const editedAfter = (p: Play | undefined, built: string) => !!p && p.updatedAt > built;

/**
 * Banner: add the book's formations, plays and the "Green Bay 2019" playbook to the library, update them from a
 * newer build (keeping every play you edited), and save your edits back into the book for the next build / PDF.
 */
export function LibraryBar({ bookId, libraryUrl, built, canSaveEdits = true }: { bookId: string; libraryUrl: string; built: string; canSaveEdits?: boolean }) {
  const { loaded, hasPlaybook, plays, refresh } = useLib();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    void refresh(bookId);
    return onApplied(() => void refresh(bookId));
  }, [bookId, refresh]);

  const edited = [...plays.values()].filter((p) => editedAfter(p, built));

  const add = async () => {
    setBusy('add');
    setMsg(null);
    try {
      const text = await (await fetch(libraryUrl, { cache: 'no-store' })).text();
      const parsed = parseBackup(text);
      // a play or formation you edited since the build stays yours
      const [myPlays, myFormations] = await Promise.all([repo.listPlays(), repo.listFormations()]);
      const newerPlay = new Map(myPlays.map((p) => [p.id, p.updatedAt]));
      const newerForm = new Map(myFormations.map((f) => [f.id, f.updatedAt]));
      const keepPlays = parsed.data.plays.filter((p) => !((newerPlay.get(p.id) ?? '') > p.updatedAt));
      const keepForms = parsed.data.formations.filter((f) => !((newerForm.get(f.id) ?? '') > f.updatedAt));
      await repo.importAll({ ...parsed.data, plays: keepPlays, formations: keepForms }, 'merge');
      await refresh(bookId);
      const kept = parsed.data.plays.length - keepPlays.length + (parsed.data.formations.length - keepForms.length);
      setMsg(`Added ${keepPlays.length} plays and ${keepForms.length} formations${kept ? `; kept ${kept} you had edited` : ''}.`);
    } catch (e) {
      setMsg(`Could not add the playbook: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const saveEdits = async () => {
    setBusy('save');
    setMsg(null);
    try {
      const res = await fetch(`/api/book/${bookId}/edits`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ plays: edited }) });
      const body = (await res.json()) as { saved?: number; error?: string };
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      setMsg(`Saved ${body.saved} edited play(s) into the book. Rebuild the book (build_book.py) and the PDF to print them.`);
    } catch (e) {
      setMsg(`Could not save the edits: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  if (!loaded) return null;
  return (
    <div className="no-print" style={{ maxWidth: '62rem', margin: '0 auto 1rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
      {hasPlaybook ? (
        <>
          <span>
            In your library: {plays.size} plays in the <strong>Green Bay 2019</strong> playbook{edited.length ? `, ${edited.length} edited by you` : ''}. Every diagram
            below has an Edit link.
          </span>
          <Link className="bk-btn" href={`/playbooks/${bookId}`}>
            Open the playbook
          </Link>
          <button type="button" className="bk-btn" onClick={add} disabled={!!busy} title="Re-import from this build; plays you edited are kept">
            {busy === 'add' ? 'Updating…' : 'Update from this build'}
          </button>
          {edited.length > 0 && canSaveEdits && (
            <button type="button" className="bk-btn" onClick={saveEdits} disabled={!!busy} title="Write your edited plays into source/book/edits so the next book build and PDF use them">
              {busy === 'save' ? 'Saving…' : `Save ${edited.length} edit${edited.length > 1 ? 's' : ''} into the book`}
            </button>
          )}
        </>
      ) : (
        <>
          <span>Add every diagram as a PlayForge play (editable), and the book as the Green Bay 2019 playbook.</span>
          <button type="button" className="bk-btn" onClick={add} disabled={!!busy}>
            {busy === 'add' ? 'Adding…' : 'Add to my library'}
          </button>
        </>
      )}
      {msg && <span style={{ color: 'var(--bk-muted)' }}>{msg}</span>}
    </div>
  );
}

/** "Edit" link to the play editor, shown once the play is in the library. */
export function PlayLink({ id }: { id: string }) {
  const has = useLib((s) => s.plays.has(id));
  if (!has) return null;
  return (
    <Link className="no-print bk-edit" href={`/plays/${id}`} style={{ color: 'inherit', fontSize: '0.7rem', fontWeight: 700 }} title="Open in the play editor">
      Edit
    </Link>
  );
}

/** Window that shows every player and line of a diagram (the same rule the book builder uses). */
function fitView(d: Diagram): ViewWindow {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const p of Object.values(d.players)) {
    xs.push(p.x);
    ys.push(p.y);
    if (p.motion) {
      xs.push(p.motion.from.x);
      ys.push(p.motion.from.y);
    }
  }
  for (const q of Object.values(d.paths)) {
    let ax = 0;
    let ay = 0;
    if (q.anchor.kind === 'player') {
      const a = d.players[q.anchor.playerId];
      if (!a) continue;
      ax = a.x;
      ay = a.y;
    }
    for (const pt of q.points) {
      xs.push(ax + pt.x);
      ys.push(ay + pt.y);
    }
  }
  for (const a of Object.values(d.annotations)) {
    xs.push(a.x);
    ys.push(a.y);
  }
  if (!xs.length) return { minX: -12, maxX: 12, minY: -8, maxY: 8 };
  const pad = 1.8;
  let minX = Math.min(...xs) - pad;
  let maxX = Math.max(...xs) + pad;
  let minY = Math.min(...ys) - pad;
  let maxY = Math.max(...ys) + pad;
  if (maxX - minX < 16) {
    const cx = (minX + maxX) / 2;
    minX = cx - 8;
    maxX = cx + 8;
  }
  const w = maxX - minX;
  if (maxY - minY < w * 0.45) {
    const cy = (minY + maxY) / 2;
    minY = cy - w * 0.225;
    maxY = cy + w * 0.225;
  }
  return { minX, maxX, minY, maxY };
}

/**
 * The diagram as you edited it in PlayForge, when you did: the server-rendered drawing is shown until the library
 * loads, then a play saved after the book was built takes its place. Nothing changes for a play you have not touched.
 */
export function LiveArt({ playId, built, children }: { playId: string; built: string; children: ReactNode }) {
  const play = useLib((s) => s.plays.get(playId));
  if (!editedAfter(play, built)) return <>{children}</>;
  const view = fitView(play!.diagram);
  return (
    <div className="bk-art bk-art-live" style={{ aspectRatio: `${view.maxX - view.minX} / ${view.maxY - view.minY}` }} title="Your edit, from your PlayForge library">
      <PlaySvg diagram={play!.diagram} view={view} theme={BOOK_RENDER_THEME} style={{ height: 'auto' }} />
      <span className="bk-live-tag">your edit</span>
    </div>
  );
}
