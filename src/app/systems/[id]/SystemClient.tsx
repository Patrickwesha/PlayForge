'use client';

import Link from 'next/link';
import { useMemo, useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { repo } from '@/store/repo';
import { FORMATION_FIT } from '@/geometry/bounds';
import { PlayThumb } from '@/render/PlayThumb';
import { EAGLES_2026_FORMATIONS, EAGLES_2026_SNAPS } from '@/seeds/eagles2026';
import { PACKERS_2019_FORMATIONS, PACKERS_2019_ID_PREFIX } from '@/seeds/packers2019';
import { eaglesCore as core, eaglesPass as pass, eaglesRuns as runs, sourceHref, sourceLabel, toTerm, type SourceRef, type Term } from '@/systems/eagles/system';

type Loose = Record<string, unknown>;
type Section = { id: string; title: string; intro?: ReactNode; groups: { title?: string; note?: string; terms: Term[] }[]; extra?: ReactNode };

const list = (v: unknown) => (Array.isArray(v) ? (v as Loose[]) : []);
const packById = new Map(PACKERS_2019_FORMATIONS.map((f) => [f.id, f]));

function Sources({ sources }: { sources?: SourceRef[] }) {
  if (!sources?.length) return null;
  return (
    <span className="text-[11px] text-neutral-500">
      {sources.map((s, i) => {
        const href = sourceHref(s);
        const label = sourceLabel(s);
        return (
          <span key={i}>
            {i > 0 && ', '}
            {href ? (
              <Link className="underline decoration-dotted" href={href}>
                {label}
              </Link>
            ) : (
              label
            )}
          </span>
        );
      })}
    </span>
  );
}

function TermCard({ t }: { t: Term }) {
  const f = t.packKey ? packById.get(`${PACKERS_2019_ID_PREFIX}${t.packKey}`) : undefined;
  return (
    <div className={`border border-neutral-300 bg-white rounded p-2.5 flex gap-2 break-inside-avoid ${f ? 'flex-col' : ''}`}>
      {f && (
        <Link href={`/formations/${f.id}`} className="block border border-neutral-200 rounded overflow-hidden hover:border-black" title={`Open ${f.name} in the formation editor`}>
          <PlayThumb diagram={{ players: f.players, paths: {}, annotations: {} }} aspect={2.6} fit={FORMATION_FIT} />
        </Link>
      )}
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-bold">{t.term}</span>
          {t.meta && <span className="text-xs text-neutral-500">{t.meta}</span>}
          {t.sameAs && <span className="text-[11px] rounded bg-neutral-200 px-1">same picture as {t.sameAs}</span>}
          {t.basis && t.basis !== 'both' && <span className="text-[11px] rounded bg-neutral-200 px-1">{t.basis === 'gb-2019' ? 'Green Bay only' : 'Rams only'}</span>}
          {t.low && <span className="text-[11px] rounded bg-amber-200 px-1">unclear in the book, check it</span>}
        </div>
        <p className="text-sm">{t.means}</p>
        {t.onFilm && (
          <p className="text-sm text-neutral-700">
            <span className="font-semibold">On film: </span>
            {t.onFilm}
          </p>
        )}
        {!!t.aliases?.length && (
          <p className="text-xs text-neutral-600">
            <span className="font-semibold">Also called: </span>
            {t.aliases.map((a) => `${a.term} (${a.book === 'rams-2022' ? 'Rams' : 'Green Bay'})`).join(', ')}
          </p>
        )}
        <Sources sources={t.sources} />
      </div>
    </div>
  );
}

/** This season's charted snaps, counted by formation word. */
function useSeason() {
  // the library on this device once it has loaded (so a new week's import shows up), the seeds until then
  const live = useLiveQuery(async () => ({ formations: await repo.listFormations('offense'), snaps: await repo.listSnaps() }), []);
  return useMemo(() => {
    const formations = live ? live.formations.filter((f) => f.system) : EAGLES_2026_FORMATIONS;
    const snaps = live ? live.snaps : EAGLES_2026_SNAPS;
    const used = new Map<string, number>();
    for (const s of snaps) used.set(s.formationId, (used.get(s.formationId) ?? 0) + 1);
    const byWord = new Map<string, { snaps: number; names: Set<string> }>();
    for (const f of formations) {
      const word = f.system?.base ?? 'Unnamed';
      const row = byWord.get(word) ?? { snaps: 0, names: new Set<string>() };
      row.snaps += used.get(f.id) ?? f.usage?.count ?? 0;
      row.names.add(f.name.replace(/ #[0-9]+$/, ''));
      byWord.set(word, row);
    }
    const motions = new Map<string, number>();
    for (const s of snaps) if (s.motionCall) motions.set(s.motionCall, (motions.get(s.motionCall) ?? 0) + 1);
    return {
      words: [...byWord].sort((a, b) => b[1].snaps - a[1].snaps),
      motions: [...motions].sort((a, b) => b[1] - a[1]),
      snaps: snaps.length,
      weeks: [...new Set(snaps.map((s) => s.week))].sort((a, b) => a - b),
    };
  }, [live]);
}

function buildSections(): Section[] {
  const fam = new Map(core.families.map((f) => [f.id, f]));
  const formationGroups = core.families
    .map((f) => ({
      title: f.name,
      note: f.means,
      terms: core.formations.filter((x) => x.family === f.id).map((x): Term => ({ term: x.term, means: x.means, onFilm: x.onFilm, meta: `[${x.personnel}]`, aliases: x.aliases, sources: x.sources, packKey: x.packKey, sameAs: (x as Loose).sameAs as string | undefined })),
    }))
    .filter((g) => g.terms.length || fam.get('empty')?.name === g.title);

  const runFamilies = list(runs.families);
  const passFamilies = list(pass.families);
  const byFamily = (items: Loose[], families: Loose[]) => {
    const groups = families.map((f) => ({ title: String(f.name), note: [f.means, f.onFilm && `On film: ${f.onFilm}`, f.numbers && `Numbers: ${f.numbers}`].filter(Boolean).join(' '), terms: items.filter((c) => c.family === f.id).map((c) => toTerm(c)) }));
    const known = new Set(families.map((f) => f.id));
    const rest = items.filter((c) => !known.has(c.family));
    if (rest.length) groups.push({ title: 'Other', note: '', terms: rest.map((c) => toTerm(c, String(c.family ?? ''))) });
    return groups.filter((g) => g.terms.length);
  };

  return [
    {
      id: 'call',
      title: 'How a call is built',
      intro: <p>{core.callOrder.means}</p>,
      groups: [{ terms: core.callOrder.parts.map((p) => ({ term: `${p.n}. ${p.part}`, means: `Example: ${p.example}`, sources: p.n === 1 ? core.callOrder.sources : undefined })) }],
    },
    {
      id: 'people',
      title: 'Positions and personnel',
      groups: [
        { title: 'The five jobs', terms: core.positions.map((p) => ({ term: p.term, means: p.means })) },
        { title: 'Personnel groups', terms: core.personnel.map((p, i) => ({ term: p.term, means: p.means, sources: i === 0 ? core.personnelSources : undefined })) },
        { title: 'Splits and depths', note: core.alignment.means, terms: core.alignment.rules.map((r, i) => ({ term: `Rule ${i + 1}`, means: r, sources: i === 0 ? core.alignment.sources : undefined })) },
        { title: 'Backfield words', terms: core.backfield.map((b) => ({ term: b.term, means: b.means, meta: `chart: ${b.chart}${(b as Loose).own ? ' · my own convention' : ''}` })) },
      ],
    },
    { id: 'formations', title: 'Formations', intro: <p>Every word is drawn strong right. Say Lt and the whole picture flips. Click a drawing to open it in the editor.</p>, groups: formationGroups },
    {
      id: 'variations',
      title: 'Variations',
      intro: <p>One word after the strength that moves one or two players. Strong side words talk to the Z and Y, weak side words to the X and Z.</p>,
      groups: (['strong', 'weak', 'both'] as const).map((side) => ({
        title: side === 'both' ? 'Both sides' : `${side[0].toUpperCase()}${side.slice(1)} side`,
        terms: core.variations.filter((v) => v.side === side).map((v, i) => ({ term: v.term, means: v.means, onFilm: v.onFilm, meta: `moves ${v.who}`, aliases: v.aliases, sources: side === 'strong' && i === 0 ? core.variationSources : undefined })),
      })),
    },
    {
      id: 'empty',
      title: 'Empty',
      intro: <p>{core.empty.means}</p>,
      groups: [{ terms: core.empty.letters.map((l, i) => ({ term: l.term, means: l.means, aliases: i === 0 ? core.empty.aliases : undefined, sources: i === 0 ? core.empty.sources : undefined })) }],
    },
    {
      id: 'motions',
      title: 'Motions and shifts',
      groups: [
        { title: 'Motions', terms: core.motions.map((m) => ({ term: m.term, means: m.means, onFilm: m.onFilm, meta: m.who, aliases: m.aliases, sources: m.sources, basis: (m as Loose).from as string | undefined })) },
        { title: 'Shifts', terms: core.shifts.map((m) => ({ term: m.term, means: m.means, onFilm: m.onFilm, aliases: m.aliases, sources: m.sources })) },
        { title: 'At the line', terms: core.lineWords.map((m, i) => ({ term: m.term, means: m.means, sources: i === 0 ? core.lineSources : undefined })) },
      ],
    },
    {
      id: 'runs',
      title: 'Run game',
      intro: <p>{String((runs.numbering as Loose).means ?? '')}</p>,
      groups: [
        ...byFamily(list(runs.concepts), runFamilies),
        { title: 'Run tags', terms: list(runs.modifiers).map((m) => toTerm(m)) },
        { title: 'Blocking words', terms: list(runs.blocking).map((m) => toTerm(m)) },
        { title: 'Run alerts', terms: list(runs.alerts).map((m) => toTerm(m)) },
      ],
    },
    {
      id: 'pass',
      title: 'Pass game',
      intro: <p>{String((pass.callStructure as Loose)?.means ?? '')}</p>,
      groups: [
        { title: 'Protections', terms: list(pass.protections).map((m) => toTerm(m)) },
        ...byFamily(list(pass.concepts), passFamilies),
        { title: 'Pass tags', terms: list(pass.tags).map((m) => toTerm(m)) },
        {
          title: 'Route names',
          note: 'The name map between the two books. The shapes are in the route library.',
          terms: list(pass.routes).map((r) => ({ ...toTerm(r), means: r.libraryKey ? 'In the PlayForge route library.' : 'Name only: not in the route library yet.' })),
        },
      ],
    },
    { id: 'charting', title: 'Charting rules', intro: <p>How film turns into these words.</p>, groups: [{ terms: core.chartRules.map((r) => ({ term: r.title, means: r.means })) }] },
  ];
}

const hit = (t: Term, q: string) => `${t.term} ${t.means} ${t.onFilm ?? ''} ${t.meta ?? ''} ${(t.aliases ?? []).map((a) => a.term).join(' ')}`.toLowerCase().includes(q);

export function SystemClient() {
  const [q, setQ] = useState('');
  const season = useSeason();
  const sections = useMemo(() => buildSections(), []);
  const needle = q.trim().toLowerCase();
  const shown = useMemo(
    () =>
      sections
        .map((s) => ({ ...s, groups: s.groups.map((g) => ({ ...g, terms: needle ? g.terms.filter((t) => hit(t, needle)) : g.terms })).filter((g) => g.terms.length) }))
        .filter((s) => s.groups.length),
    [sections, needle],
  );
  const total = shown.reduce((n, s) => n + s.groups.reduce((m, g) => m + g.terms.length, 0), 0);

  return (
    <div className="flex-1 bg-neutral-100">
      <div className="max-w-6xl mx-auto p-4 lg:flex lg:gap-6">
        <nav className="lg:w-52 shrink-0 lg:sticky lg:top-4 self-start space-y-2 mb-4">
          <input className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm bg-white" placeholder="Search a word: Dyno, Zac, Fly, Sift" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search the system" />
          {needle && <div className="text-xs text-neutral-500">{total} match{total === 1 ? '' : 'es'}</div>}
          <ul className="flex flex-wrap lg:block gap-x-3 text-sm">
            {!needle && (
              <li>
                <a className="hover:underline" href="#overview">
                  Overview
                </a>
              </li>
            )}
            {!needle && (
              <li>
                <a className="hover:underline font-semibold" href="#flow">
                  Day-after film flow
                </a>
              </li>
            )}
            {shown.map((s) => (
              <li key={s.id}>
                <a className="hover:underline" href={`#${s.id}`}>
                  {s.title}
                </a>
              </li>
            ))}
            {!needle && (
              <li>
                <a className="hover:underline" href="#season">
                  This season so far
                </a>
              </li>
            )}
          </ul>
        </nav>

        <main className="min-w-0 flex-1 space-y-8">
          {!needle && (
            <section id="overview" className="space-y-3">
              <h1 className="text-2xl font-bold">{core.name}</h1>
              <p>{core.summary}</p>
              <p className="text-sm border-l-4 border-amber-400 bg-amber-50 px-3 py-2">{core.honesty}</p>
              <div className="grid gap-2 md:grid-cols-2">
                {core.lineage.map((l) => (
                  <div key={l.years} className="border border-neutral-300 bg-white rounded p-2.5 text-sm">
                    <div className="font-bold">
                      {l.years} · {l.team}
                    </div>
                    <div className="text-neutral-600">
                      {l.role}. {l.system}.
                    </div>
                    <div>{l.why}</div>
                  </div>
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {core.principles.map((p) => (
                  <div key={p.title} className="border border-neutral-300 bg-white rounded p-2.5 text-sm space-y-1">
                    <div className="font-bold">{p.title}</div>
                    <div>{p.means}</div>
                    <div className="text-neutral-700">
                      <span className="font-semibold">When charting: </span>
                      {p.chart}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!needle && (
            <section id="flow" className="space-y-3 scroll-mt-4">
              <h2 className="text-xl font-bold border-b border-neutral-400 pb-1">Day-after film flow</h2>
              <p className="text-sm">{core.workflow.means}</p>
              <ul className="text-sm list-disc pl-5">
                {core.workflow.rules.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <div className="space-y-2">
                {core.workflow.passes.map((p) => (
                  <div key={p.n} className="border border-neutral-300 bg-white rounded p-3 break-inside-avoid">
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <span className="font-bold">
                        {p.n}. {p.title}
                      </span>
                      <span className="text-xs text-neutral-500">{p.time}</span>
                      <span className="text-sm italic">{p.question}</span>
                    </div>
                    <ul className="mt-1.5 space-y-1 text-sm">
                      {p.steps.map((st) => (
                        <li key={st} className="flex gap-2">
                          <span className="mt-1 h-3 w-3 shrink-0 border border-neutral-500 rounded-sm" aria-hidden />
                          <span>{st}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>
          )}

          {shown.map((s) => (
            <section key={s.id} id={s.id} className="space-y-3 scroll-mt-4">
              <h2 className="text-xl font-bold border-b border-neutral-400 pb-1">{s.title}</h2>
              {!needle && s.intro && <div className="text-sm">{s.intro}</div>}
              {s.groups.map((g, i) => (
                <div key={g.title ?? i} className="space-y-2">
                  {g.title && <h3 className="font-bold uppercase text-sm tracking-wide">{g.title}</h3>}
                  {!needle && g.note && <p className="text-sm text-neutral-700">{g.note}</p>}
                  <div className="grid gap-2 md:grid-cols-2">
                    {g.terms.map((t, j) => (
                      <TermCard key={`${t.term}-${j}`} t={t} />
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}

          {!needle && (
            <section id="season" className="space-y-3 scroll-mt-4">
              <h2 className="text-xl font-bold border-b border-neutral-400 pb-1">This season so far</h2>
              <p className="text-sm">
                {season.snaps} charted snaps, week{season.weeks.length === 1 ? '' : 's'} {season.weeks.join(', ')}, named in the system.{' '}
                <Link className="underline" href="/formations">
                  Open the formations
                </Link>
                .
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                <div className="border border-neutral-300 bg-white rounded p-2.5 text-sm">
                  <div className="font-bold mb-1">Formation words by snaps</div>
                  {season.words.map(([word, row]) => (
                    <div key={word} className="flex gap-2">
                      <span className="w-8 text-right font-semibold">{row.snaps}</span>
                      <span className="w-16 font-semibold">{word}</span>
                      <span className="text-neutral-600 truncate" title={[...row.names].join(', ')}>
                        {[...row.names].slice(0, 4).join(', ')}
                        {row.names.size > 4 ? ` +${row.names.size - 4}` : ''}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="border border-neutral-300 bg-white rounded p-2.5 text-sm">
                  <div className="font-bold mb-1">Motion words by snaps</div>
                  {season.motions.map(([word, n]) => (
                    <div key={word} className="flex gap-2">
                      <span className="w-8 text-right font-semibold">{n}</span>
                      <span>{word}</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </main>
      </div>
    </div>
  );
}
