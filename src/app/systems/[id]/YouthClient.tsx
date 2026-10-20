'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { repo } from '@/store/repo';
import { PlayThumb } from '@/render/PlayThumb';
import { HoleChart } from '@/systems/youth/HoleChart';
import { COLORS, type Concept, type Side } from '@/systems/youth/types';
import { youthSystem } from '@/systems/youth/registry';
import type { YouthSystem } from '@/systems/youth/build';

const NAV = [
  ['language', 'How we talk'],
  ['plays', 'Plays'],
  ['formations', 'Formations'],
  ['install', 'Install plan'],
  ['gameday', 'Game day'],
  ['print', 'Print'],
  ['review', 'Check these'],
] as const;

const PRINTS = [
  ['callsheet', 'Call sheet', 'Landscape. Sections with kid names, the no-huddle table, IF / THEN, and every play.'],
  ['wristband', 'Wristbands', 'Cut-out cards: numbers and names, and a picture card for the QB.'],
  ['jobs', 'Player cards', 'One card per position with his job on every play, Red and Yellow.'],
  ['install', 'Install plan', 'Twelve weeks, with the checks to pass before you add more.'],
  ['teach', 'Teaching sheet', 'One page for kids and parents: colors, numbers, holes, blocking.'],
] as const;

function Chip({ side, children }: { side: Side; children: ReactNode }) {
  const c = COLORS[side];
  return (
    <span className="inline-block rounded px-1.5 py-0.5 text-xs font-bold" style={{ background: c.hex, color: c.ink }}>
      {children}
    </span>
  );
}

function H2({ id, children, sub }: { id: string; children: ReactNode; sub?: ReactNode }) {
  return (
    <div id={id} className="scroll-mt-14 pt-6 border-t border-neutral-300">
      <h2 className="text-xl font-bold">{children}</h2>
      {sub && <p className="text-sm text-neutral-600 mt-1 max-w-3xl">{sub}</p>}
    </div>
  );
}

function AddToLibrary({ sys }: { sys: YouthSystem }) {
  const inLibrary = useLiveQuery(async () => !!(await repo.getPlaybook(sys.playbookId)), [sys.playbookId]);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    try {
      const r = await repo.addPack(sys.pack);
      setMsg(r.added ? `Added ${r.added} rows${r.kept ? `, kept ${r.kept} you already had` : ''}.` : `All ${r.kept} rows are already in your library. Nothing changed.`);
    } catch (e) {
      setMsg(`Could not add: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={add} disabled={busy} className="rounded bg-black text-white px-3 py-1.5 text-sm font-semibold disabled:opacity-50">
        {inLibrary ? 'Add anything missing to my library' : `Add the ${sys.short.toLowerCase().replace(/^\w/, (m) => m.toUpperCase())} playbook to my library`}
      </button>
      {inLibrary && (
        <>
          <Link className="rounded border border-black px-3 py-1.5 text-sm font-semibold" href={`/playbooks/${sys.playbookId}`}>
            Open the playbook
          </Link>
          <Link className="rounded border border-black px-3 py-1.5 text-sm font-semibold" href={`/print?playbook=${sys.playbookId}&layout=6up&cover=1`}>
            Print it 6-up
          </Link>
        </>
      )}
      <span className="text-xs text-neutral-600">{msg ?? `${sys.formationRows.length} formations, ${sys.plays.length} plays, 1 playbook. Your edits are never overwritten.`}</span>
    </div>
  );
}

function Thumb({ sys, side, c }: { sys: YouthSystem; side: Side; c: Concept }) {
  const p = sys.play(side, c.key)!;
  return (
    <div className="border border-neutral-300 rounded overflow-hidden bg-white">
      <div className="flex items-center justify-between px-2 py-1 border-b border-neutral-200 text-xs">
        <Chip side={side}>
          {COLORS[side].word.toUpperCase()} {c.n}
        </Chip>
        <span className="font-bold">{sys.kidCall(side, c)}</span>
      </div>
      <PlayThumb diagram={p.diagram} aspect={1.5} fit={sys.fit} />
      <div className="px-2 py-1 text-[11px] text-neutral-500 border-t border-neutral-200">{sys.coachCall(side, c)}</div>
    </div>
  );
}

function ConceptCard({ sys, c }: { sys: YouthSystem; c: Concept }) {
  const red = sys.play('right', c.key)!;
  return (
    <div className="border border-neutral-300 bg-white rounded p-3 space-y-2 break-inside-avoid">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-black">{c.n}</span>
        <span className="text-xl font-bold">{c.kid}</span>
        <span className="text-sm text-neutral-500">
          {c.coach} {sys.coachWordFrom}
        </span>
        <span className="text-xs rounded bg-neutral-200 px-1.5 py-0.5">Week {c.week}</span>
        <span className="text-xs rounded bg-neutral-200 px-1.5 py-0.5">{c.kind === 'run' ? `${c.carrier} carries` : c.kind === 'pass' ? 'pass' : 'freeze'}</span>
        {!c.withWings && <span className="text-xs rounded bg-amber-200 px-1.5 py-0.5">{sys.awayWord}</span>}
      </div>
      <p className="text-base">&ldquo;{c.kidSays}&rdquo;</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Thumb sys={sys} side="right" c={c} />
        <Thumb sys={sys} side="left" c={c} />
      </div>
      <p className="text-sm">
        <span className="font-semibold">Coach: </span>
        {c.coachNote}
      </p>
      <p className="text-sm">
        <span className="font-semibold">Signal: </span>
        {c.signal}. <span className="font-semibold">Check-with-me words: </span>
        {c.cities.join(', ')} (anything that starts with {c.kid[0]}).
      </p>
      <details className="text-sm">
        <summary className="cursor-pointer font-semibold">Every job on Red {c.n} (Yellow is the mirror: left and right swap)</summary>
        <table className="mt-1 w-full text-sm">
          <tbody>
            {sys.jobLabels.map((l) => (
              <tr key={l} className="border-t border-neutral-200 align-top">
                <td className="py-1 pr-2 font-bold w-10">{l}</td>
                <td className="py-1">{sys.jobOf(red, l)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export function YouthClient({ id }: { id: string }) {
  const sys = youthSystem(id)!;
  const review = sys.concepts.flatMap((c) => (sys.drawings[c.key].review ?? []).map((r) => ({ c, r })));
  const k = (key: string) => sys.conceptByKey.get(key)!;
  const first = sys.concepts[0];
  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4 text-neutral-900">
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black">
          {sys.title} · {sys.subtitle}
        </h1>
        <p className="max-w-3xl">{sys.intro}</p>
        <AddToLibrary sys={sys} />
        <nav className="flex flex-wrap gap-1 pt-1 text-sm">
          {NAV.map(([nid, label]) => (
            <a key={nid} href={`#${nid}`} className="rounded border border-neutral-300 px-2 py-0.5 hover:border-black">
              {label}
            </a>
          ))}
        </nav>
      </header>

      <H2 id="language" sub="Teach these first. Every play after week 1 reuses them.">How we talk</H2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border border-neutral-300 rounded bg-white p-3 space-y-2">
          <h3 className="font-bold">Color = side</h3>
          <p className="text-sm">
            <Chip side="right">RED</Chip> = {sys.colorMeans.right}. <Chip side="left">YELLOW</Chip> = {sys.colorMeans.left}.
          </p>
          <p className="text-sm">{sys.withAway}</p>
          <h3 className="font-bold pt-1">Number = the play</h3>
          <p className="text-sm">
            &ldquo;Red 2&rdquo; = play 2 ({k(sys.concepts[1].key).kid}) to the Red side. Same number both colors, so the wristband only has 10 rows.
          </p>
          <h3 className="font-bold pt-1">Play number = who and where</h3>
          <p className="text-sm">First number = who gets the ball. Second number = the hole. Even right, odd left. {first.numbers.right ? `${first.numbers.right} ${first.kid}: ${first.carrier} carries over hole ${first.numbers.right % 10}.` : ''}</p>
        </div>
        <div className="border border-neutral-300 rounded bg-white p-3 flex flex-col items-center gap-1">
          <h3 className="font-bold self-start">Gaps and holes</h3>
          <HoleChart />
        </div>
        <div className="border border-neutral-300 rounded bg-white p-3 space-y-2">
          {sys.blocking.rules.map((rule) => (
            <div key={rule.key}>
              <h3 className="font-bold">
                {rule.title} <span className="text-xs font-normal text-neutral-600">({rule.usedOn})</span>
              </h3>
              <ol className="space-y-1.5 mt-1">
                {rule.steps.map((s) => (
                  <li key={s.letter + s.word} className="text-sm flex gap-2">
                    <span className="text-2xl font-black leading-none w-6">{s.letter}</span>
                    <span>
                      <span className="font-semibold">{s.word}. </span>
                      {s.ask} {s.then}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
          <p className="text-sm text-neutral-700">{sys.blocking.inside}</p>
          <h3 className="font-bold pt-1">The special blocks</h3>
          <ul className="text-sm space-y-1">
            {sys.blocking.exceptions.map((e) => (
              <li key={e.word}>
                <span className="font-bold">{e.word}</span> ({e.who}) {e.means}
              </li>
            ))}
          </ul>
        </div>
        <div className="border border-neutral-300 rounded bg-white p-3 space-y-2">
          <h3 className="font-bold">Who is who</h3>
          <table className="w-full text-sm">
            <tbody>
              {sys.positions.map((p) => (
                <tr key={p.label} className="border-t border-neutral-200 align-top">
                  <td className="py-1 pr-2 font-black w-8">{p.label}</td>
                  <td className="py-1 pr-2 font-semibold whitespace-nowrap">{p.kid}</td>
                  <td className="py-1">
                    {p.job} <span className="text-neutral-500">{p.lineup}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3 className="font-bold pt-1">Reading a picture</h3>
          <ul className="text-sm">
            {sys.legend.map((l) => (
              <li key={l.mark}>
                <span className="font-semibold">{l.mark}:</span> {l.means}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <H2 id="plays" sub="Red is drawn, Yellow is its exact mirror. Open a card for every player's job.">Plays</H2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {sys.concepts.map((c) => (
          <ConceptCard key={c.key} sys={sys} c={c} />
        ))}
      </div>

      <H2 id="formations" sub="Same plays, different pictures. Add a formation only when the kids line up the base one without thinking.">Formations</H2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {sys.formationSpecs.map((s) => {
          const f = sys.formationByKey.get(s.key)!;
          return (
            <div key={s.key} className="border border-neutral-300 rounded bg-white overflow-hidden">
              <div className="px-2 py-1 border-b border-neutral-200 text-sm font-bold flex items-center gap-2">
                {s.side && <Chip side={s.side}>{COLORS[s.side].word.toUpperCase()}</Chip>}
                {s.name}
              </div>
              <PlayThumb diagram={{ players: f.players, paths: {}, annotations: {} }} aspect={1.8} fit={{ pad: 1.2, minBack: 5.5, minDown: 2, minSide: 7 }} />
              <p className="px-2 py-1 text-xs text-neutral-700 border-t border-neutral-200">{s.cue}</p>
            </div>
          );
        })}
      </div>

      <H2 id="install" sub="Do not add a week until the team passes the checks at the bottom of the last one. A slow week is fine: every later play reuses the same colors, numbers and blocking rules.">Install plan</H2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sys.install.map((w) => (
          <div key={w.week} className="border border-neutral-300 rounded bg-white p-3 space-y-1.5 text-sm break-inside-avoid">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-lg font-black">Week {w.week}</span>
              <span className="font-bold">{w.title}</span>
              {w.adds.map((key) => (
                <span key={key} className="text-xs rounded bg-black text-white px-1.5 py-0.5">
                  {k(key).n} {k(key).kid}
                </span>
              ))}
              {w.formations.map((fk) => (
                <span key={fk} className="text-xs rounded border border-black px-1.5 py-0.5">
                  {sys.specByKey.get(fk)!.name}
                </span>
              ))}
            </div>
            <p><span className="font-semibold">Line: </span>{w.line}</p>
            <p><span className="font-semibold">Backs and receivers: </span>{w.skill}</p>
            <p><span className="font-semibold">Calling: </span>{w.calling}</p>
            <p><span className="font-semibold">Drills: </span>{w.drills.join(' · ')}</p>
            <div>
              <span className="font-semibold">Ready for next week when:</span>
              <ul className="list-none">
                {w.readyWhen.map((r) => (
                  <li key={r}>&#9744; {r}</li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </div>
      <div className="border border-neutral-300 rounded bg-white p-3 text-sm">
        <h3 className="font-bold">70-minute practice</h3>
        <ul>
          {sys.practice.map((p) => (
            <li key={p.time}>
              <span className="font-semibold">{p.time}</span> {p.what}
            </li>
          ))}
        </ul>
      </div>

      <H2 id="gameday" sub="The no-huddle is the check-with-me system: line up, look at the defense, then give the play.">Game day</H2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
        <div className="border border-neutral-300 rounded bg-white p-3 space-y-2">
          <h3 className="font-bold">Check with me (no-huddle)</h3>
          <ol className="list-decimal pl-5 space-y-1">
            <li>Coach: &ldquo;{sys.checkWithMe}&rdquo; Kids sprint to the formation, get their splits, two-point stance, and look at the coach.</li>
            <li>Coach looks for where we have more blockers, better angles, or a weaker player. Then calls City + Color + Day.</li>
            <li>The city&apos;s first letter is the play. The color is the side. The day is the snap.</li>
          </ol>
          <p className="font-semibold">Cadence: {sys.cadence}</p>
          <ul>
            {sys.days.map((d) => (
              <li key={d.day}>
                <span className="font-bold">{d.day}:</span> {d.means} <span className="text-neutral-500">{d.why}</span>
              </li>
            ))}
          </ul>
          <p>
            <span className="font-semibold">Example: </span>&ldquo;{first.cities[0]} Red Monday&rdquo; = {first.kid} to the Red side on the first GO.
          </p>
          <table className="w-full">
            <thead>
              <tr className="text-left border-b-2 border-black">
                <th className="py-1">#</th>
                <th>Play</th>
                <th>Words</th>
                <th>Signal</th>
              </tr>
            </thead>
            <tbody>
              {sys.concepts.map((c) => (
                <tr key={c.key} className="border-t border-neutral-200 align-top">
                  <td className="py-1 font-bold">{c.n}</td>
                  <td className="font-bold">{c.kid}</td>
                  <td>{c.cities.join(', ')}</td>
                  <td className="text-neutral-600">{c.signal}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="space-y-3">
          <div className="border border-neutral-300 rounded bg-white p-3">
            <h3 className="font-bold">Opening script: each play asks a question</h3>
            <ol className="list-decimal pl-5">
              {sys.script.map(({ entry: [side, key], asks }) => (
                <li key={`${side}${key}`}>
                  <Chip side={side}>
                    {COLORS[side].word.toUpperCase()} {k(key).n}
                  </Chip>{' '}
                  <span className="font-semibold">{k(key).kid}</span> {asks}
                </li>
              ))}
            </ol>
          </div>
          <div className="border border-neutral-300 rounded bg-white p-3">
            <h3 className="font-bold">IF you see, THEN call</h3>
            <ul>
              {sys.ifThen.map((r) => (
                <li key={r.see}>
                  {r.see} &rarr; <span className="font-bold">{r.call.map((key) => k(key).kid).join(' or ')}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="border border-neutral-300 rounded bg-white p-3">
            <h3 className="font-bold">Sideline watchers</h3>
            {sys.watchers.map((w) => (
              <p key={w.who}>
                <span className="font-semibold">{w.who}:</span> {w.tally.join(' · ')}
              </p>
            ))}
          </div>
        </div>
      </div>

      <H2 id="print" sub="Each one opens a print-ready page. Use the browser's Print, landscape for the call sheet.">Print</H2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <Link href={`/systems/${sys.id}/book`} className="border-2 border-black rounded bg-white p-3 hover:bg-neutral-50">
          <div className="font-bold">The whole playbook</div>
          <div className="text-sm text-neutral-600">Laid out like the Rams 2022 book: section covers, contents, every play with its jobs, call sheet, install plan. Print to PDF.</div>
        </Link>
        {PRINTS.map(([sheet, label, what]) => (
          <Link key={sheet} href={`/systems/${sys.id}/print?sheet=${sheet}`} className="border border-neutral-300 rounded bg-white p-3 hover:border-black">
            <div className="font-bold">{label}</div>
            <div className="text-sm text-neutral-600">{what}</div>
          </Link>
        ))}
      </div>

      <H2 id="review" sub="Choices to confirm before the kids learn them. Plays with a note are marked needs-review in the library.">Check these</H2>
      <ul className="text-sm space-y-1 list-disc pl-5">
        {sys.checkThese.map((x) => (
          <li key={x.label}>
            <span className="font-semibold">{x.label}:</span> {x.text}
          </li>
        ))}
        {review.map(({ c, r }) => (
          <li key={r}>
            <span className="font-semibold">{c.kid}:</span> {r}
          </li>
        ))}
      </ul>
    </main>
  );
}
