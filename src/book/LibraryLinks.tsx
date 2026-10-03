'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { create } from 'zustand';
import { parseBackup } from '@/io/backup';
import { repo } from '@/store/repo';
import type { Diagram, Formation, Play, ViewWindow } from '@/model/types';
import { PlaySvg } from '@/render/PlaySvg';
import { BOOK_RENDER_THEME } from '@/render/theme';
import { onApplied } from '@/sync/events';
import { PACKERS_2019_ID_PREFIX } from '@/seeds/packers2019';
import { BOOK_FORMATION_SECTION_TITLE, bookFormationSectionId } from './formationMatch';

type LibState = {
  loaded: boolean;
  /** The book's plays as they are in this device's library (edits included), by id. */
  plays: Map<string, Play>;
  /** The book's formations: the Packers 2019 pack (seed-gb19-*) and the ones the build traced (gb19-f-*). */
  formations: Map<string, Formation>;
  hasPlaybook: boolean;
  /** Ids in the playbook's formations sections. */
  playbookFormations: Set<string>;
  refresh: (bookId: string) => Promise<void>;
};

const isBookPlay = (p: Play) => p.id.startsWith('gb19-');
const isBookFormation = (f: Formation) => f.id.startsWith(PACKERS_2019_ID_PREFIX) || f.id.startsWith('gb19-f-');

/** The book's plays in this device's PlayForge library (one read for the whole page, refreshed after a sync). */
const useLib = create<LibState>((set) => ({
  loaded: false,
  plays: new Map(),
  formations: new Map(),
  hasPlaybook: false,
  playbookFormations: new Set(),
  refresh: async (bookId) => {
    const [plays, formations, pb] = await Promise.all([repo.listPlays(), repo.listFormations('offense'), repo.getPlaybook(bookId)]);
    set({
      loaded: true,
      plays: new Map(plays.filter(isBookPlay).map((p) => [p.id, p])),
      formations: new Map(formations.filter(isBookFormation).map((f) => [f.id, f])),
      hasPlaybook: !!pb,
      playbookFormations: new Set(pb?.sections.filter((s) => s.kind === 'formations').flatMap((s) => s.itemIds) ?? []),
    });
  },
}));

/** A play edited in the editor after the book was built (the build stamps every play with `built`). */
const editedAfter = (p: Play | undefined, built: string) => !!p && p.updatedAt > built;
/** A library formation the user has touched: a built-in loses `builtin` on its first save; a traced one carries a newer updatedAt. */
const editedFormation = (f: Formation | undefined, built: string) => !!f && f.builtin !== true && (f.id.startsWith(PACKERS_2019_ID_PREFIX) || f.updatedAt > built);

/**
 * Put the formations the reader matched to the library into the book's playbook, as their own section.
 * Creates the section once; a section that already exists is left as the user arranged it, unless `fill`
 * asks for the missing ones to be added (Update from this build). Returns true when the playbook changed.
 */
export async function ensureFormationSection(bookId: string, formationIds: string[], fill = false): Promise<boolean> {
  const pb = await repo.getPlaybook(bookId);
  if (!pb || formationIds.length === 0) return false;
  const secId = bookFormationSectionId(bookId);
  const sec = pb.sections.find((s) => s.id === secId);
  if (!sec) {
    await repo.savePlaybook({ ...pb, sections: [...pb.sections, { id: secId, title: BOOK_FORMATION_SECTION_TITLE, kind: 'formations', itemIds: [...formationIds] }] });
    return true;
  }
  if (!fill) return false;
  const have = new Set(pb.sections.filter((s) => s.kind === 'formations').flatMap((s) => s.itemIds));
  const missing = formationIds.filter((id) => !have.has(id));
  if (missing.length === 0) return false;
  await repo.savePlaybook({ ...pb, sections: pb.sections.map((s) => (s.id === secId ? { ...s, itemIds: [...s.itemIds, ...missing] } : s)) });
  return true;
}

/**
 * Banner: add the book's formations, plays and the "Green Bay 2019" playbook to the library, update them from a
 * newer build (keeping every play you edited), and save your edits back into the book for the next build / PDF.
 */
export function LibraryBar({ bookId, libraryUrl, built, formationIds = [], canSaveEdits = true, compact = false }: { bookId: string; libraryUrl: string; built: string; /** Library formations the reader matched to the book's formation pages, in page order. */ formationIds?: string[]; canSaveEdits?: boolean; compact?: boolean }) {
  const { loaded, hasPlaybook, plays, formations, playbookFormations, refresh } = useLib();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    void refresh(bookId);
    return onApplied(() => void refresh(bookId));
  }, [bookId, refresh]);
  // the matched library formations join the playbook the first time the reader sees it in the library
  const ensured = useRef(false);
  useEffect(() => {
    if (!loaded || !hasPlaybook || ensured.current || formationIds.length === 0) return;
    ensured.current = true;
    void ensureFormationSection(bookId, formationIds).then((changed) => {
      if (changed) void refresh(bookId);
    });
  }, [loaded, hasPlaybook, bookId, formationIds, refresh]);

  const edited = [...plays.values()].filter((p) => editedAfter(p, built));
  const editedForms = formationIds.filter((id) => editedFormation(formations.get(id), built));
  const inPlaybook = formationIds.filter((id) => playbookFormations.has(id)).length;

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
      await ensureFormationSection(bookId, formationIds, true);
      await refresh(bookId);
      const kept = parsed.data.plays.length - keepPlays.length + (parsed.data.formations.length - keepForms.length);
      setMsg(`Added ${keepPlays.length} plays and ${keepForms.length} formations${kept ? `; kept ${kept} you had edited` : ''}${formationIds.length ? `; ${formationIds.length} library formations in the playbook` : ''}.`);
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
    <div className="no-print bk-libbar" style={compact ? { marginTop: '0.6rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.78rem' } : { maxWidth: '62rem', margin: '0 auto 1rem', display: 'flex', gap: '0.6rem', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.85rem' }}>
      {hasPlaybook ? (
        <>
          <span style={{ width: '100%' }}>
            {plays.size} of the book&apos;s plays in your library{edited.length ? `, ${edited.length} edited by you` : ''}.
            {formationIds.length > 0 && <> {inPlaybook} of {formationIds.length} library formations in the playbook{editedForms.length ? `, ${editedForms.length} edited by you` : ''}.</>} Edit on any diagram opens it in the editor.
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
          <span style={{ width: '100%' }}>
            Edit on any diagram opens it in the editor.{formationIds.length > 0 && <> {formationIds.length} formation diagrams are drawn from the formations already in your library (Edit formation opens them).</>} Or add all 2,030 at once as the Green Bay 2019 playbook:
          </span>
          <button type="button" className="bk-btn" onClick={add} disabled={!!busy}>
            {busy === 'add' ? 'Adding…' : 'Add the whole playbook'}
          </button>
        </>
      )}
      {msg && <span style={{ color: 'var(--bk-muted)' }}>{msg}</span>}
    </div>
  );
}

/**
 * "Edit" on every cell. A play already in the library opens in the editor; one that is not yet is pulled in
 * from the book first (that play and its formation only), then opened.
 */
export function PlayLink({ id, bookId }: { id: string; bookId: string }) {
  const router = useRouter();
  const has = useLib((s) => s.plays.has(id));
  const refresh = useLib((s) => s.refresh);
  const [busy, setBusy] = useState(false);
  const style = { color: 'inherit', fontSize: '0.7rem', fontWeight: 700 } as const;
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
      await repo.importAll({ plays: [play], formations: formation ? [formation] : [], playbooks: [] }, 'merge');
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

/** "Edit formation" on a cell the reader matched to a library formation (the pack is on every device, nothing to pull). */
export function FormationLink({ id }: { id: string }) {
  const f = useLib((s) => s.formations.get(id));
  return (
    <Link className="no-print bk-edit" href={`/formations/${id}`} style={{ color: 'inherit', fontSize: '0.7rem', fontWeight: 700 }} title={f ? `Open "${f.name}" in the formation editor` : 'Open in the formation editor'}>
      Edit formation
    </Link>
  );
}

/**
 * The page-check badge, live: once you edit the cell's play (or the library formation it is drawn from) the
 * "check against the page" and "guessed" notes no longer apply and are replaced by "edited by you".
 */
export function ConfBadge({ playId, formationId, built, conf, issues, guesses }: { playId?: string; formationId?: string; built: string; conf: 'high' | 'medium' | 'low' | 'none'; issues: string[]; guesses: string[] }) {
  const play = useLib((s) => (playId ? s.plays.get(playId) : undefined));
  const formation = useLib((s) => (formationId ? s.formations.get(formationId) : undefined));
  const edited = editedAfter(play, built) || editedFormation(formation, built);
  if (edited)
    return (
      <span className="bk-conf bk-conf-high" title="Edited by you in PlayForge: the rebuild's page check no longer applies">
        edited by you
      </span>
    );
  if (formation)
    return (
      <span className="bk-conf bk-conf-high" title={`Drawn from the PlayForge library formation "${formation.name}" (Packers 2019 pack), not from the scan`}>
        library formation
      </span>
    );
  const guessed = guesses.map((g) => g.split(':')[0].trim());
  return (
    <>
      {guessed.length > 0 && (
        <span className="bk-conf bk-conf-medium" title={guesses.join('\n')}>
          guessed: {guessed.join(', ')}
        </span>
      )}
      <span className={`bk-conf bk-conf-${conf === 'none' ? 'low' : conf}`} title={issues.join('; ') || 'Not rebuilt'} style={guessed.length ? { marginLeft: 0 } : undefined}>
        {conf === 'high' ? 'matches the page' : conf === 'none' ? 'not rebuilt' : 'check against the page'}
      </span>
    </>
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
export function LiveArt({ playId, formationId, built, children }: { playId: string; formationId?: string; built: string; children: ReactNode }) {
  const play = useLib((s) => s.plays.get(playId));
  const formation = useLib((s) => (formationId ? s.formations.get(formationId) : undefined));
  if (editedAfter(play, built)) {
    const view = fitView(play!.diagram);
    return (
      <div className="bk-art bk-art-live" style={{ aspectRatio: `${view.maxX - view.minX} / ${view.maxY - view.minY}` }} title="Your edit, from your PlayForge library">
        <PlaySvg diagram={play!.diagram} view={view} theme={BOOK_RENDER_THEME} style={{ height: 'auto' }} />
        <span className="bk-live-tag">your edit</span>
      </div>
    );
  }
  // a formation page cell that names a formation the library already has: draw that formation (your edits included)
  if (formation) {
    const diagram: Diagram = { players: formation.players, paths: {}, annotations: {} };
    const view = fitView(diagram);
    const yours = editedFormation(formation, built);
    return (
      <div className="bk-art bk-art-live" style={{ aspectRatio: `${view.maxX - view.minX} / ${view.maxY - view.minY}` }} title={yours ? `Your edit of "${formation.name}", from your PlayForge library` : `"${formation.name}" from the PlayForge library (Packers 2019 pack)`}>
        <PlaySvg diagram={diagram} view={view} theme={BOOK_RENDER_THEME} style={{ height: 'auto' }} />
        <span className="bk-live-tag">{yours ? 'your edit' : 'library formation'}</span>
      </div>
    );
  }
  return <>{children}</>;
}
