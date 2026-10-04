'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { create } from 'zustand';
import { parseBackup } from '@/io/backup';
import { repo } from '@/store/repo';
import type { Diagram, Formation, Play, ViewWindow } from '@/model/types';
import { PlaySvg } from '@/render/PlaySvg';
import { BOOK_RENDER_THEME } from '@/render/theme';
import { onApplied } from '@/sync/events';

type LibState = {
  loaded: boolean;
  /** The book's plays as they are in this device's library (edits included), by id. */
  plays: Map<string, Play>;
  /** PlayForge's own formations (the pack, with every correction made in the editor), by id. */
  formations: Map<string, Formation>;
  hasPlaybook: boolean;
  refresh: (bookId: string) => Promise<void>;
};

const isBookPlay = (p: Play) => p.id.startsWith('gb19-');
/**
 * Formations cut out of the scanned book (not the PlayForge pack). Many were completed by guess where
 * the scan was cut off, so they are no longer added to the library; plays carry their own players.
 */
const isBookFormation = (f: Formation) => f.id.startsWith('gb19-f-');

/** The book's plays in this device's PlayForge library (one read for the whole page, refreshed after a sync). */
const useLib = create<LibState>((set) => ({
  loaded: false,
  plays: new Map(),
  formations: new Map(),
  hasPlaybook: false,
  refresh: async (bookId) => {
    const [plays, formations, pb] = await Promise.all([repo.listPlays(), repo.listFormations(), repo.getPlaybook(bookId)]);
    set({ loaded: true, plays: new Map(plays.filter(isBookPlay).map((p) => [p.id, p])), formations: new Map(formations.map((f) => [f.id, f])), hasPlaybook: !!pb });
  },
}));

/** A play edited in the editor after the book was built (the build stamps every play with `built`). */
const editedAfter = (p: Play | undefined, built: string) => !!p && p.updatedAt > built;

/**
 * Banner: add the book's formations, plays and the "Green Bay 2019" playbook to the library, update them from a
 * newer build (keeping every play you edited), and save your edits back into the book for the next build / PDF.
 */
export function LibraryBar({ bookId, libraryUrl, built, canSaveEdits = true, compact = false }: { bookId: string; libraryUrl: string; built: string; canSaveEdits?: boolean; compact?: boolean }) {
  const { loaded, hasPlaybook, plays, formations, refresh } = useLib();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    void refresh(bookId);
    return onApplied(() => void refresh(bookId));
  }, [bookId, refresh]);

  const edited = [...plays.values()].filter((p) => editedAfter(p, built));
  // book formations still in the library that were never edited (an edit moves updatedAt past the build)
  const staleFormations = [...formations.values()].filter((f) => isBookFormation(f) && !(f.updatedAt > built));

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
      const keepForms = parsed.data.formations.filter((f) => !isBookFormation(f) && !((newerForm.get(f.id) ?? '') > f.updatedAt));
      await repo.importAll({ ...parsed.data, plays: keepPlays, formations: keepForms }, 'merge');
      await refresh(bookId);
      const kept = parsed.data.plays.length - keepPlays.length + parsed.data.formations.filter((f) => !isBookFormation(f)).length - keepForms.length;
      setMsg(`Added ${keepPlays.length} plays and ${keepForms.length} formations${kept ? `; kept ${kept} you had edited` : ''}.`);
    } catch (e) {
      setMsg(`Could not add the playbook: ${(e as Error).message}`);
    } finally {
      setBusy(null);
    }
  };

  const removeBookFormations = async () => {
    if (!confirm(`Remove ${staleFormations.length} formations that came from the scanned book and that you have not edited? Plays keep their own players. Formations you edited stay. This syncs to your other devices.`)) return;
    setBusy('remove');
    setMsg(null);
    try {
      for (const f of staleFormations) await repo.deleteFormation(f.id);
      await refresh(bookId);
      setMsg(`Removed ${staleFormations.length} book formations.`);
    } catch (e) {
      setMsg(`Could not remove them: ${(e as Error).message}`);
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
    <div className="no-print bk-libbar" style={compact ? { marginTop: '0.6rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.78rem' } : { maxWidth: '62rem', margin: '0 auto 1rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
      {hasPlaybook ? (
        <>
          <span style={{ width: '100%' }}>
            {plays.size} of the book&apos;s plays in your library{edited.length ? `, ${edited.length} edited by you` : ''}. Edit on any diagram opens it in the editor.
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
          <span style={{ width: '100%' }}>Edit on any diagram adds that one play to your library and opens it in the editor.</span>
        </>
      )}
      {staleFormations.length > 0 && (
        <button type="button" className="bk-btn" onClick={removeBookFormations} disabled={!!busy} title="Formations cut from the scanned book, many completed by guess. Plays keep their own players; formations you edited stay.">
          {busy === 'remove' ? 'Removing…' : `Remove ${staleFormations.length} book formations I have not edited`}
        </button>
      )}
      {msg && <span style={{ color: 'var(--bk-muted)' }}>{msg}</span>}
    </div>
  );
}

/**
 * "Edit" on every cell. A play already in the library opens in the editor; one that is not yet is pulled in
 * from the book first (that play and its formation only), then opened.
 */
export function PlayLink({ id, bookId, formationId }: { id: string; bookId: string; formationId?: string | null }) {
  const router = useRouter();
  const has = useLib((s) => s.plays.has(id));
  const hasFormation = useLib((s) => !!formationId && s.formations.has(formationId));
  const refresh = useLib((s) => s.refresh);
  const [busy, setBusy] = useState(false);
  const style = { color: 'inherit', fontSize: '0.7rem', fontWeight: 700 } as const;
  if (hasFormation)
    return (
      <Link className="no-print bk-edit" href={`/formations/${formationId}`} style={style} title="This is one of your PlayForge formations: edit it in the formation editor">
        Edit formation
      </Link>
    );
  if (has)
    return (
      <Link className="no-print bk-edit" href={`/plays/${id}`} style={style} title="Open in the play editor">
        Edit
      </Link>
    );
  const pull = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/book/${bookId}/play/${id}`, { cache: 'no-store' });
      if (!res.ok) throw new Error(res.status === 401 ? 'locked' : res.statusText);
      const { play, formation } = (await res.json()) as { play: Play; formation: Formation | null };
      await repo.importAll({ plays: [play], formations: formation && !isBookFormation(formation) ? [formation] : [], playbooks: [] }, 'merge');
      await refresh(bookId);
      router.push(`/plays/${id}`);
    } catch (e) {
      alert(`Could not open this play for editing: ${(e as Error).message}`);
      setBusy(false);
    }
  };
  return (
    <button type="button" className="no-print bk-edit" style={{ ...style, background: 'none', cursor: 'pointer' }} onClick={pull} disabled={busy} title="Add this play to your library and open it in the editor">
      {busy ? 'Opening…' : 'Edit'}
    </button>
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
export function LiveArt({ playId, built, formationId, annotations, children }: { playId: string; built: string; formationId?: string | null; annotations?: Diagram['annotations']; children: ReactNode }) {
  const play = useLib((s) => s.plays.get(playId));
  const formation = useLib((s) => (formationId ? s.formations.get(formationId) : undefined));
  let diagram: Diagram | null = null;
  let tag = '';
  if (editedAfter(play, built)) {
    diagram = play!.diagram;
    tag = 'your edit';
  } else if (formation) {
    diagram = { players: formation.players, paths: {}, annotations: annotations ?? {} };
    tag = 'your formation';
  }
  if (!diagram) return <>{children}</>;
  const view = fitView(diagram);
  return (
    <div className="bk-art bk-art-live" style={{ aspectRatio: `${view.maxX - view.minX} / ${view.maxY - view.minY}` }} title={tag === 'your edit' ? 'Your edit, from your PlayForge library' : 'Drawn from the formation in your PlayForge library'}>
      <PlaySvg diagram={diagram} view={view} theme={BOOK_RENDER_THEME} style={{ height: 'auto' }} />
      <span className="bk-live-tag">{tag}</span>
    </div>
  );
}

/** The cell's confidence badges, hidden once the drawing shown is yours (an edited play or your own formation). */
export function CellStatus({ playId, built, formationId, children }: { playId?: string; built: string; formationId?: string | null; children: ReactNode }) {
  const edited = useLib((s) => (playId ? editedAfter(s.plays.get(playId), built) : false));
  const own = useLib((s) => !!formationId && s.formations.has(formationId));
  if (edited || own) return null;
  return <>{children}</>;
}
