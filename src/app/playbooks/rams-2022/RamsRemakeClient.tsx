'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Play, Playbook, PlaybookSection } from '@/model/types';
import { SEED_TIME } from '@/model/seedRules';
import { repo } from '@/store/repo';
import { PlayThumb } from '@/render/PlayThumb';
import { CanBadge } from '@/components/CanBadge';
import { playHeaderLine1 } from '@/model/factories';
import { RAMS_2022_PLAYBOOK_ID, RAMS_2022_PLAY_ID_PREFIX, composeRamsPlay, playSearchText } from '@/systems/rams/compose';
import type { RamsPlayPack, RamsPlaySpec } from '@/systems/rams/types';

const btn = 'text-xs px-2 py-1 rounded border border-neutral-300 bg-white hover:border-black disabled:opacity-40';
const chip = (on: boolean) => `px-2 py-0.5 rounded-full text-xs border ${on ? 'bg-black text-white border-black' : 'bg-white border-neutral-300 hover:border-black'}`;

type Row = { spec: RamsPlaySpec; play: Play; text: string };

const SITUATIONS: { id: string; label: string }[] = [
  { id: 'red-zone', label: 'Red zone' },
  { id: 'two-minute', label: 'Two minute' },
  { id: 'run-alerts', label: 'Run alerts' },
  { id: 'protections', label: 'Protections' },
];
const GROUP_ORDER = ['Outside zone', 'Inside zone', 'Gap', 'Man', 'Specials', 'Transportation', 'Draw', 'Quick game', 'Drop back', 'Empty', 'Play pass', 'Movement', 'Screens', 'Red zone', 'Two minute', 'Goal line', 'Short yardage', 'Run alerts', 'Protections'];
const CATS = ['Run', 'Pass', 'PA', 'Screen'] as const;

function sectionTitle(install: number | null, situation: string | null, group: string | null): string {
  if (situation) return SITUATIONS.find((s) => s.id === situation)?.label ?? situation;
  return `Install ${install ?? '?'} · ${group ?? 'Other'}`;
}

/** Plays grouped the way the Green Bay installs read: install, then the family heading, then the Rams concept page. */
function groupRows(rows: Row[]) {
  const sections = new Map<string, { title: string; install: number; situation: string | null; group: string | null; concepts: Map<string, Row[]> }>();
  for (const r of rows) {
    const key = r.spec.situation ? `s:${r.spec.situation}` : `i:${r.spec.install ?? 0}:${r.spec.group ?? ''}`;
    let s = sections.get(key);
    if (!s) {
      s = { title: sectionTitle(r.spec.install, r.spec.situation, r.spec.group), install: r.spec.install ?? 99, situation: r.spec.situation, group: r.spec.group, concepts: new Map() };
      sections.set(key, s);
    }
    const ck = r.spec.conceptTitle ?? r.spec.pageTitle;
    s.concepts.set(ck, [...(s.concepts.get(ck) ?? []), r]);
  }
  const gi = (g: string | null) => {
    const i = GROUP_ORDER.indexOf(g ?? '');
    return i < 0 ? 99 : i;
  };
  return [...sections.values()].sort((a, b) => (a.situation ? 1 : 0) - (b.situation ? 1 : 0) || a.install - b.install || gi(a.group) - gi(b.group) || (a.situation ? SITUATIONS.findIndex((s) => s.id === a.situation) - SITUATIONS.findIndex((s) => s.id === b.situation) : 0));
}

/** Thumbnail that only renders once it scrolls into view (the book has close to 900 diagrams). */
function LazyThumb({ play }: { play: Play }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || seen) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) {
        setSeen(true);
        io.disconnect();
      }
    }, { rootMargin: '400px' });
    io.observe(el);
    return () => io.disconnect();
  }, [seen]);
  return (
    <div ref={ref} className="aspect-[4/3] bg-white">
      {seen && <PlayThumb diagram={play.diagram} aspect={4 / 3} />}
    </div>
  );
}

function Detail({ row, inLibrary, onClose, onOpen }: { row: Row; inLibrary: boolean; onClose: () => void; onOpen: () => void }) {
  const { play, spec } = row;
  const players = Object.values(play.diagram.players).filter((p) => p.side === 'offense');
  const notesFor = (id: string) => play.positionNotes[id];
  const order = ['X', 'Z', 'Y', 'F', 'H', 'Q', '', ''];
  const sorted = [...players].sort((a, b) => (order.indexOf(a.label) === -1 ? 9 : order.indexOf(a.label)) - (order.indexOf(b.label) === -1 ? 9 : order.indexOf(b.label)) || a.x - b.x);
  const olName = (p: Play['diagram']['players'][string]) => {
    if (p.label) return p.label;
    const line = players.filter((q) => q.role === 'OL' || q.role === 'C').sort((a, b) => a.x - b.x);
    return ['LT', 'LG', 'C', 'RG', 'RT'][line.indexOf(p)] ?? 'OL';
  };
  return (
    <div className="fixed inset-0 z-40 bg-black/40 flex items-stretch justify-end" onClick={onClose}>
      <div className="w-full max-w-3xl bg-white overflow-y-auto p-4 space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-2">
          <div className="min-w-0">
            <div className="text-xs font-bold uppercase text-neutral-600">{playHeaderLine1(play)}</div>
            <h2 className="text-lg font-bold uppercase leading-tight">{play.name}</h2>
            {play.alias && <div className="text-xs text-neutral-600">Rams call: {play.alias}</div>}
            <div className="text-xs text-neutral-500">
              {spec.family} · p.{spec.page} cell {spec.cellNumber ?? spec.cell} · {spec.conceptTitle} · Install {spec.install ?? '?'}
              {spec.situation ? ` · ${sectionTitle(null, spec.situation, null)}` : ''}
              {play.defense?.front ? ` · vs ${play.defense.front}` : ''}
            </div>
          </div>
          <div className="ml-auto flex gap-2 shrink-0">
            <button className={btn} onClick={onOpen}>{inLibrary ? 'Open in editor' : 'Add and open in editor'}</button>
            <button className={btn} onClick={onClose}>Close</button>
          </div>
        </div>
        <div className="border border-neutral-300 rounded overflow-hidden aspect-[4/3]">
          <PlayThumb diagram={play.diagram} aspect={4 / 3} />
        </div>
        <CanBadge play={play} className="rounded border border-amber-200" />
        {play.notes && <p className="text-sm whitespace-pre-line">{play.notes}</p>}
        {spec.conceptOnFilm && (
          <p className="text-sm text-neutral-700">
            <span className="font-semibold">On film: </span>
            {spec.conceptOnFilm}
          </p>
        )}
        <div>
          <h3 className="text-sm font-bold mb-1">Players</h3>
          <table className="text-sm w-full">
            <tbody>
              {sorted.map((p) => {
                const n = notesFor(p.id);
                const route = play.routeTags?.[p.id];
                if (!n && !route && !p.motion) return null;
                return (
                  <tr key={p.id} className="border-t border-neutral-200 align-top">
                    <td className="py-1 pr-2 font-bold w-10">{olName(p)}</td>
                    <td className="py-1">
                      {p.motion && <span className="text-orange-700 mr-1">{p.motion.tag} motion.</span>}
                      {route && !n?.includes(route) && <span className="font-semibold mr-1">{route}.</span>}
                      {n}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {play.reviewNotes?.length ? (
          <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded p-2">
            <div className="font-bold">Check</div>
            {play.reviewNotes.map((r, i) => (
              <div key={i}>{r}</div>
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap gap-1">
          {play.tags.map((t) => (
            <span key={t} className="text-[11px] px-1.5 py-0.5 rounded bg-neutral-100">{t}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function RamsRemakeClient() {
  const router = useRouter();
  const [pack, setPack] = useState<RamsPlayPack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [install, setInstall] = useState<number | 'all'>('all');
  const [situation, setSituation] = useState<string | 'all' | 'none'>('all');
  const [cat, setCat] = useState<(typeof CATS)[number] | 'all'>('all');
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const libPlays = useLiveQuery(() => repo.listPlays(), []);
  const libBook = useLiveQuery(() => repo.getPlaybook(RAMS_2022_PLAYBOOK_ID), []);

  useEffect(() => {
    fetch('/rams-2022/plays.json', { cache: 'force-cache' })
      .then(async (r) => {
        if (!r.ok) throw new Error(r.statusText);
        setPack((await r.json()) as RamsPlayPack);
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const rows = useMemo<Row[]>(() => {
    if (!pack) return [];
    return pack.plays.map((spec) => {
      const play = composeRamsPlay(spec);
      return { spec, play, text: playSearchText(play, [spec.conceptTitle ?? '', spec.pageTitle, spec.group ?? '', spec.family ?? '', `install ${spec.install ?? ''}`, spec.front]) };
    });
  }, [pack]);

  const inLibrary = useMemo(() => new Map((libPlays ?? []).filter((p) => p.id.startsWith(RAMS_2022_PLAY_ID_PREFIX)).map((p) => [p.id, p])), [libPlays]);
  const edited = useMemo(() => [...inLibrary.values()].filter((p) => p.updatedAt !== SEED_TIME), [inLibrary]);

  const filtered = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    return rows.filter((r) => {
      if (install !== 'all' && r.spec.install !== install) return false;
      if (situation === 'none' && r.spec.situation) return false;
      if (situation !== 'all' && situation !== 'none' && r.spec.situation !== situation) return false;
      if (cat !== 'all' && r.play.category !== cat) return false;
      return words.every((w) => r.text.includes(w));
    });
  }, [rows, q, install, situation, cat]);
  const grouped = useMemo(() => groupRows(filtered), [filtered]);
  const current = open ? rows.find((r) => r.play.id === open) : undefined;

  /** The book as a playbook: one section per install heading, then the situations, in the book's order. */
  const buildPlaybook = (all: Row[], existing?: Playbook): Playbook => {
    const sections: PlaybookSection[] = groupRows(all).map((s) => ({
      id: `rams22-sec-${(s.situation ? `s-${s.situation}` : `i${s.install}-${(s.group ?? 'other').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`)}`,
      title: s.title,
      kind: 'plays',
      itemIds: [...s.concepts.values()].flat().map((r) => r.play.id),
    }));
    const t = new Date().toISOString();
    return {
      id: RAMS_2022_PLAYBOOK_ID,
      name: existing?.name ?? 'RAMS 2022 (EAGLES SYSTEM)',
      subtitle: existing?.subtitle ?? 'McVay 2022 in the Green Bay words',
      cover: existing?.cover ?? { title: 'Rams 2022', subtitle: 'Rebuilt in the Eagles 2026 system', team: 'Eagles', season: '2026', showCover: true },
      sections,
      defaultLayout: existing?.defaultLayout ?? '4up',
      paper: existing?.paper ?? 'letter',
      createdAt: existing?.createdAt ?? t,
      updatedAt: t,
    };
  };

  const addAll = async (which: Row[], label: string) => {
    setBusy(label);
    setMsg(null);
    try {
      // a play edited in the editor stays as it is; everything else follows this build
      const keep = which.filter((r) => inLibrary.get(r.play.id)?.updatedAt === undefined || inLibrary.get(r.play.id)?.updatedAt === SEED_TIME);
      const playbook = buildPlaybook(rows, libBook ?? undefined);
      await repo.importAll({ formations: [], plays: keep.map((r) => r.play), playbooks: [playbook] }, 'merge');
      setMsg(`Added ${keep.length} plays${which.length - keep.length ? `, kept ${which.length - keep.length} you had edited` : ''}. The playbook "${playbook.name}" has ${playbook.sections.length} sections.`);
    } catch (e) {
      setMsg(`Could not add the plays: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(null);
    }
  };
  const removeUnedited = async () => {
    const stale = [...inLibrary.values()].filter((p) => p.updatedAt === SEED_TIME);
    if (!confirm(`Remove ${stale.length} Rams plays you have not edited? Edited ones stay. This syncs to your other devices.`)) return;
    setBusy('remove');
    try {
      for (const p of stale) await repo.deletePlay(p.id);
      setMsg(`Removed ${stale.length} plays.`);
    } finally {
      setBusy(null);
    }
  };
  const openInEditor = async (r: Row) => {
    if (!inLibrary.has(r.play.id)) await repo.importAll({ formations: [], plays: [r.play], playbooks: [] }, 'merge');
    router.push(`/plays/${r.play.id}`);
  };

  const installs = useMemo(() => [...new Set(rows.map((r) => r.spec.install ?? 0))].sort((a, b) => a - b), [rows]);

  return (
    <main className="max-w-7xl mx-auto w-full p-4 sm:p-6">
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <Link href="/playbooks" className="text-neutral-500 hover:text-black text-sm">&larr; Playbooks</Link>
        <h1 className="text-xl font-bold">Rams 2022, in the Eagles system</h1>
        <span className="text-sm text-neutral-500">{rows.length ? `${rows.length} diagrams, grouped by Green Bay install and situation` : ''}</span>
      </div>
      <p className="text-sm text-neutral-700 mb-3 max-w-4xl">
        Every diagram of the McVay 2022 book, redrawn with the Green Bay words (the Rams call stays as a search alias), the offense on the pack formation&apos;s landmarks,
        the drawing&apos;s routes, blocks and motions, the front it was drawn against with its defenders, the blocking calls and route words on the players, and the page&apos;s rules
        paraphrased. Search any word: play, formation, concept, blocking call, route, motion, shift, protection, front, personnel, install.
      </p>
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <input className="border border-neutral-300 rounded px-2 py-1 text-sm w-72" placeholder="Search anything: zap, 42 ov shell, sift, z short, 300 jet, stick..." value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="flex gap-1 items-center text-xs">
          <span className="text-neutral-500">Install</span>
          <button className={chip(install === 'all')} onClick={() => setInstall('all')}>All</button>
          {installs.filter(Boolean).map((i) => (
            <button key={i} className={chip(install === i)} onClick={() => setInstall(i)}>{i}</button>
          ))}
        </div>
        <div className="flex gap-1 items-center text-xs">
          <span className="text-neutral-500">Situation</span>
          <button className={chip(situation === 'all')} onClick={() => setSituation('all')}>All</button>
          <button className={chip(situation === 'none')} onClick={() => setSituation('none')}>Installs only</button>
          {SITUATIONS.map((s) => (
            <button key={s.id} className={chip(situation === s.id)} onClick={() => setSituation(s.id)}>{s.label}</button>
          ))}
        </div>
        <div className="flex gap-1 items-center text-xs">
          <button className={chip(cat === 'all')} onClick={() => setCat('all')}>All</button>
          {CATS.map((c) => (
            <button key={c} className={chip(cat === c)} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 mb-4 flex-wrap text-xs">
        <span className="text-neutral-600">
          {inLibrary.size ? `${inLibrary.size} of ${rows.length} in your library${edited.length ? `, ${edited.length} edited by you` : ''}.` : 'Nothing from this book is in your library yet.'}
        </span>
        <button className={btn} disabled={!rows.length || !!busy} onClick={() => void addAll(rows, 'all')} title="Every diagram as a play, plus the playbook with one section per install and situation. Plays you edited are kept.">
          {busy === 'all' ? 'Adding…' : inLibrary.size ? 'Update the whole book from this build' : 'Add the whole book to my library'}
        </button>
        <button className={btn} disabled={!filtered.length || !!busy || filtered.length === rows.length} onClick={() => void addAll(filtered, 'filtered')}>
          {busy === 'filtered' ? 'Adding…' : `Add the ${filtered.length} shown`}
        </button>
        {inLibrary.size > 0 && (
          <>
            <Link href={`/playbooks/${RAMS_2022_PLAYBOOK_ID}`} className={btn}>Open the playbook</Link>
            <button className={`${btn} text-red-700`} disabled={!!busy} onClick={() => void removeUnedited()}>Remove the Rams plays I have not edited</button>
          </>
        )}
        {msg && <span className="text-neutral-600">{msg}</span>}
        {error && <span className="text-red-700">Could not load the book: {error}</span>}
      </div>

      {!pack && !error && <div className="text-neutral-500">Loading the book…</div>}
      {pack && filtered.length === 0 && <div className="text-neutral-500">No diagram matches.</div>}
      {grouped.map((s) => (
        <section key={s.title} className="mb-6">
          <h2 className="text-base font-bold border-b border-neutral-300 pb-1 mb-2">
            {s.title} <span className="text-xs font-normal text-neutral-500">{[...s.concepts.values()].flat().length}</span>
          </h2>
          {[...s.concepts.entries()].map(([ck, list]) => (
            <div key={ck} className="mb-3">
              <h3 className="text-xs font-semibold uppercase text-neutral-600 mb-1">
                {ck} <span className="font-normal normal-case">· {list[0].spec.family} p.{list[0].spec.conceptPage ?? list[0].spec.page}{list[0].spec.systemConcept ? ` · ${list[0].spec.systemConcept}` : ''}</span>
              </h3>
              <div className="grid gap-2 grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {list.map((r) => (
                  <button key={r.play.id} className={`text-left border rounded overflow-hidden bg-white hover:border-black ${inLibrary.has(r.play.id) ? 'border-emerald-400' : 'border-neutral-300'}`} onClick={() => setOpen(r.play.id)}>
                    <div className="px-2 py-1 border-b text-center leading-tight">
                      <div className="text-[10px] font-bold uppercase text-neutral-600 truncate">{playHeaderLine1(r.play) || ' '}</div>
                      <div className="text-xs font-bold uppercase truncate">{r.play.name}</div>
                    </div>
                    <LazyThumb play={r.play} />
                    <div className="flex items-center gap-1 px-1.5 py-1 border-t border-neutral-200 text-[10px] text-neutral-600">
                      <span className="truncate">{r.play.defense?.front ? `vs ${r.play.defense.front}` : r.play.alias ?? ''}</span>
                      <span className="ml-auto shrink-0">p.{r.spec.page}</span>
                      {r.play.confidence === 'needs-review' && <span className="shrink-0 rounded bg-amber-100 text-amber-900 px-1" title={(r.play.reviewNotes ?? []).join('\n')}>check</span>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
      {current && <Detail row={current} inLibrary={inLibrary.has(current.play.id)} onClose={() => setOpen(null)} onOpen={() => void openInEditor(current)} />}
    </main>
  );
}
