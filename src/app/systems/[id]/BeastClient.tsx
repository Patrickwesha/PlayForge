'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { repo } from '@/store/repo';
import { FORMATION_FIT } from '@/geometry/bounds';
import { PlayThumb } from '@/render/PlayThumb';
import { HoleChart } from '@/systems/beast/HoleChart';
import {
  BEAST_PLAYBOOK_ID, CADENCE, COLORS, CONCEPTS, DAYS, GOD, IF_THEN, INSTALL, LEGEND, POSITIONS, PRACTICE_70, SCRIPT, WATCHERS, conceptByKey, type Concept, type Side,
} from '@/systems/beast/content';
import { BEAST_FIT, BEAST_FORMATIONS, BEAST_PACK, DRAWINGS, FORMATION_SPECS, beastFormationByKey, beastPlay, coachCall, jobOf, kidCall } from '@/systems/beast/plays';

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
  ['callsheet', 'Call sheet', 'Landscape. V3 sections with kid names, the no-huddle table, IF / THEN, and every play.'],
  ['wristband', 'Wristbands', 'Cut-out cards: numbers and names, and a picture card for 1.'],
  ['jobs', 'Player cards', 'One card per position with his job on every play, Red and Yellow.'],
  ['install', 'Install plan', 'Twelve weeks, with the checks to pass before you add more.'],
  ['teach', 'Teaching sheet', 'One page for kids and parents: colors, numbers, holes, GOD.'],
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

function AddToLibrary() {
  const inLibrary = useLiveQuery(async () => !!(await repo.getPlaybook(BEAST_PLAYBOOK_ID)), []);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    try {
      const r = await repo.addPack(BEAST_PACK);
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
        {inLibrary ? 'Add anything missing to my library' : 'Add the Beast playbook to my library'}
      </button>
      {inLibrary && (
        <>
          <Link className="rounded border border-black px-3 py-1.5 text-sm font-semibold" href={`/playbooks/${BEAST_PLAYBOOK_ID}`}>
            Open the playbook
          </Link>
          <Link className="rounded border border-black px-3 py-1.5 text-sm font-semibold" href={`/print?playbook=${BEAST_PLAYBOOK_ID}&layout=6up&cover=1`}>
            Print it 6-up
          </Link>
        </>
      )}
      <span className="text-xs text-neutral-600">{msg ?? '9 formations, 20 plays, 1 playbook. Your edits are never overwritten.'}</span>
    </div>
  );
}

function Thumb({ side, c }: { side: Side; c: Concept }) {
  const p = beastPlay(side, c.key)!;
  return (
    <div className="border border-neutral-300 rounded overflow-hidden bg-white">
      <div className="flex items-center justify-between px-2 py-1 border-b border-neutral-200 text-xs">
        <Chip side={side}>
          {COLORS[side].word.toUpperCase()} {c.n}
        </Chip>
        <span className="font-bold">{kidCall(side, c)}</span>
      </div>
      <PlayThumb diagram={p.diagram} aspect={1.5} fit={BEAST_FIT} />
      <div className="px-2 py-1 text-[11px] text-neutral-500 border-t border-neutral-200">{coachCall(side, c)}</div>
    </div>
  );
}

const ROW_ORDER = ['1', '2', '3', '4', 'Y', 'F', 'LT', 'LG', 'C', 'RG', 'RT'];

function ConceptCard({ c }: { c: Concept }) {
  const red = beastPlay('right', c.key)!;
  return (
    <div className="border border-neutral-300 bg-white rounded p-3 space-y-2 break-inside-avoid">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-2xl font-black">{c.n}</span>
        <span className="text-xl font-bold">{c.kid}</span>
        <span className="text-sm text-neutral-500">{c.coach} on Call Sheet V3</span>
        <span className="text-xs rounded bg-neutral-200 px-1.5 py-0.5">Week {c.week}</span>
        <span className="text-xs rounded bg-neutral-200 px-1.5 py-0.5">{c.kind === 'run' ? `${c.carrier} carries` : c.kind === 'pass' ? 'pass' : 'freeze'}</span>
        {!c.withWings && <span className="text-xs rounded bg-amber-200 px-1.5 py-0.5">goes AWAY from the wings</span>}
      </div>
      <p className="text-base">&ldquo;{c.kidSays}&rdquo;</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Thumb side="right" c={c} />
        <Thumb side="left" c={c} />
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
            {ROW_ORDER.map((l) => (
              <tr key={l} className="border-t border-neutral-200 align-top">
                <td className="py-1 pr-2 font-bold w-10">{l}</td>
                <td className="py-1">{jobOf(red, l)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export function BeastClient() {
  const review = CONCEPTS.flatMap((c) => (DRAWINGS[c.key].review ?? []).map((r) => ({ c, r })));
  return (
    <main className="max-w-6xl mx-auto p-4 sm:p-6 space-y-4 text-neutral-900">
      <header className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-black">Beast Offense 2026 · 2nd & 3rd grade</h1>
        <p className="max-w-3xl">
          My Beast playbook rebuilt for 7 and 8 year olds. Ten plays, two colors, one blocking rule. The wristband number is the play, the color is the side,
          and the line blocks GOD on every run.
        </p>
        <AddToLibrary />
        <nav className="flex flex-wrap gap-1 pt-1 text-sm">
          {NAV.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded border border-neutral-300 px-2 py-0.5 hover:border-black">
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
            <Chip side="right">RED</Chip> = Beast Right: the Y and both wings line up on the right. <Chip side="left">YELLOW</Chip> = Beast Left: they line up on the left.
          </p>
          <p className="text-sm">Train, Hammer and Rocket go the way the wings are. Crossover, Limo and Boomerang go the other way. That is the trick.</p>
          <h3 className="font-bold pt-1">Number = the play</h3>
          <p className="text-sm">&ldquo;Red 2&rdquo; = play 2 (Hammer) to the Red side. Same number both colors, so the wristband only has 10 rows.</p>
          <h3 className="font-bold pt-1">Play number = who and where</h3>
          <p className="text-sm">First number = who gets the ball (1, 2 or 4). Second number = the hole. Even right, odd left. 14 Hammer: 1 carries over hole 4.</p>
        </div>
        <div className="border border-neutral-300 rounded bg-white p-3 flex flex-col items-center gap-1">
          <h3 className="font-bold self-start">Gaps and holes</h3>
          <HoleChart />
        </div>
        <div className="border border-neutral-300 rounded bg-white p-3 space-y-2">
          <h3 className="font-bold">{GOD.title}</h3>
          <ol className="space-y-1.5">
            {GOD.steps.map((s) => (
              <li key={s.letter} className="text-sm flex gap-2">
                <span className="text-2xl font-black leading-none w-6">{s.letter}</span>
                <span>
                  <span className="font-semibold">{s.word}. </span>
                  {s.ask} {s.then}
                </span>
              </li>
            ))}
          </ol>
          <p className="text-sm text-neutral-700">{GOD.inside}</p>
          <h3 className="font-bold pt-1">Pass GOD</h3>
          <p className="text-sm">{GOD.pass.map((s) => `${s.letter} = ${s.word}`).join(' · ')}. {GOD.pass[2].then}</p>
          <h3 className="font-bold pt-1">The only blocks that are not GOD</h3>
          <ul className="text-sm space-y-1">
            {GOD.exceptions.map((e) => (
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
              {POSITIONS.map((p) => (
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
            {LEGEND.map((l) => (
              <li key={l.mark}>
                <span className="font-semibold">{l.mark}:</span> {l.means}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <H2 id="plays" sub="Red is drawn from my Playmaker sheets, Yellow is its exact mirror. Open a card for every player's job.">Plays</H2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {CONCEPTS.map((c) => (
          <ConceptCard key={c.key} c={c} />
        ))}
      </div>

      <H2 id="formations" sub="The plays are all drawn from Beast. The other looks run the same plays once the kids are ready (see the install plan).">Formations</H2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {FORMATION_SPECS.map((s) => {
          const f = beastFormationByKey.get(s.key)!;
          return (
            <div key={s.key} className="border border-neutral-300 rounded bg-white overflow-hidden">
              <div className="px-2 py-1 border-b border-neutral-200 text-sm font-bold flex items-center gap-2">
                {s.side && <Chip side={s.side}>{COLORS[s.side].word.toUpperCase()}</Chip>}
                {s.name}
              </div>
              <PlayThumb diagram={{ players: f.players, paths: {}, annotations: {} }} aspect={1.8} fit={FORMATION_FIT} />
              <p className="px-2 py-1 text-xs text-neutral-700 border-t border-neutral-200">{s.cue}</p>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-neutral-500">{BEAST_FORMATIONS.length} formations. Beast Wide puts the Y on Hash +5 (NFL field level in Settings).</p>

      <H2 id="install" sub="Do not add a week until the team passes the checks at the bottom of the last one. A slow week is fine: every later play reuses the same colors, numbers and GOD.">Install plan</H2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {INSTALL.map((w) => (
          <div key={w.week} className="border border-neutral-300 rounded bg-white p-3 space-y-1.5 text-sm break-inside-avoid">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-lg font-black">Week {w.week}</span>
              <span className="font-bold">{w.title}</span>
              {w.adds.map((k) => (
                <span key={k} className="text-xs rounded bg-black text-white px-1.5 py-0.5">
                  {conceptByKey.get(k)!.n} {conceptByKey.get(k)!.kid}
                </span>
              ))}
              {w.formations.map((k) => (
                <span key={k} className="text-xs rounded border border-black px-1.5 py-0.5">
                  {FORMATION_SPECS.find((f) => f.key === k)!.name}
                </span>
              ))}
            </div>
            <p><span className="font-semibold">Line: </span>{w.line}</p>
            <p><span className="font-semibold">Backs and ends: </span>{w.skill}</p>
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
          {PRACTICE_70.map((p) => (
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
            <li>Coach: &ldquo;Beast Red, check with me!&rdquo; Kids sprint to Beast Red, get their splits, two-point stance, and look at the coach.</li>
            <li>Coach looks for where we have more blockers, better angles, or a weaker player. Then calls City + Color + Day.</li>
            <li>The city&apos;s first letter is the play. The color is the side. The day is the snap.</li>
          </ol>
          <p className="font-semibold">Cadence: {CADENCE}</p>
          <ul>
            {DAYS.map((d) => (
              <li key={d.day}>
                <span className="font-bold">{d.day}:</span> {d.means} <span className="text-neutral-500">{d.why}</span>
              </li>
            ))}
          </ul>
          <p>
            <span className="font-semibold">Examples: </span>&ldquo;Tyler Red Monday&rdquo; = Train to the Red side on the first GO. &ldquo;Carrollton Yellow Friday&rdquo; = Crossover from Yellow, fake count, snap on the second GO. &ldquo;Plano Red Saturday&rdquo; = Pop from Red on SET.
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
              {CONCEPTS.map((c) => (
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
              {SCRIPT.map(({ entry: [side, key], asks }) => (
                <li key={`${side}${key}`}>
                  <Chip side={side}>
                    {COLORS[side].word.toUpperCase()} {conceptByKey.get(key)!.n}
                  </Chip>{' '}
                  <span className="font-semibold">{conceptByKey.get(key)!.kid}</span> {asks}
                </li>
              ))}
            </ol>
          </div>
          <div className="border border-neutral-300 rounded bg-white p-3">
            <h3 className="font-bold">IF you see, THEN call</h3>
            <ul>
              {IF_THEN.map((r) => (
                <li key={r.see}>
                  {r.see} &rarr; <span className="font-bold">{r.call.map((k) => conceptByKey.get(k)!.kid).join(' or ')}</span>
                </li>
              ))}
            </ul>
            <p className="text-neutral-600 pt-1">Two-for-one: run the same look twice before the fake off it (two Rockets, then Magic). Throw on run downs.</p>
          </div>
          <div className="border border-neutral-300 rounded bg-white p-3">
            <h3 className="font-bold">Sideline watchers</h3>
            {WATCHERS.map((w) => (
              <p key={w.who}>
                <span className="font-semibold">{w.who}:</span> {w.tally.join(' · ')}
              </p>
            ))}
          </div>
        </div>
      </div>

      <H2 id="print" sub="Each one opens a print-ready page. Use the browser's Print, landscape for the call sheet.">Print</H2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {PRINTS.map(([sheet, label, what]) => (
          <Link key={sheet} href={`/systems/beast-2026/print?sheet=${sheet}`} className="border border-neutral-300 rounded bg-white p-3 hover:border-black">
            <div className="font-bold">{label}</div>
            <div className="text-sm text-neutral-600">{what}</div>
          </Link>
        ))}
      </div>

      <H2 id="review" sub="Places where my Playmaker sheets disagree with themselves, and what I drew. These plays are marked needs-review in the library.">Check these</H2>
      <ul className="text-sm space-y-1 list-disc pl-5">
        <li>
          <span className="font-semibold">Beast Left:</span> the formation sheet kept the Y on the right with the wings on the left, but every Beast Left play puts the Y with the wings. I used the plays, so Yellow is a true mirror of Red.
        </li>
        <li>
          <span className="font-semibold">Colors:</span> V3 used GREEN / BLUE on the wristband and Red / Yellow in the no-huddle. Everything is Red / Yellow now so the kids learn one color word per side.
        </li>
        <li>
          <span className="font-semibold">Cities:</span> V3 had Boston (Blast) and Buffalo (Buck) both on B, and Syracuse (Sweep) and Seattle (Sweep Pass) both on S. The kid names all start with different letters, so the city words changed.
        </li>
        <li>
          <span className="font-semibold">Cadence:</span> &ldquo;Red, Set, Go&rdquo; became &ldquo;Ready, Set, Go&rdquo; because Red now means right.
        </li>
        {review.map(({ c, r }) => (
          <li key={r}>
            <span className="font-semibold">{c.kid}:</span> {r}
          </li>
        ))}
      </ul>
    </main>
  );
}
