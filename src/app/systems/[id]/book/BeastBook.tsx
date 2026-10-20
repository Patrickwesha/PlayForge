'use client';

import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';
import { PlayThumb } from '@/render/PlayThumb';
import { HoleChart } from '@/systems/beast/HoleChart';
import {
  CADENCE, COLORS, CONCEPTS, DAYS, GOD, IF_THEN, LEGEND, POSITIONS, PRACTICE_70, SCRIPT, WATCHERS, conceptByKey, type Concept, type Side,
} from '@/systems/beast/content';
import { BEAST_FIT, FORMATION_SPECS, beastFormationByKey, beastPlay, coachCall, jobsFor, kidCall } from '@/systems/beast/plays';
import { CallSheet, Install } from '../print/BeastPrint';

/**
 * The Beast playbook as a book, laid out like the Rams 2022 sections: a framed cover per section (gold wordmark,
 * blue title), a contents page (CONCEPT / PAGE #), then framed pages with a navy title bar, underlined labels and
 * numbered diagram cells. Runs are portrait, passes landscape, same as the Rams book. Printed to PDF by
 * scripts/export-beast-book.mjs.
 */

const NAVY = '#0B2D7A';
const GOLD = '#FFD100';
const BLUE = '#003594';
const COND = "'Bahnschrift Condensed', 'Arial Narrow', 'Roboto Condensed', Impact, sans-serif";
const BODY = "Calibri, 'Segoe UI', Arial, sans-serif";

// ---------------------------------------------------------------- page shell

type PageSpec = { key: string; land?: boolean; render: (n: number) => ReactNode };

function Sheet({ land, n, children }: { land?: boolean; n: number; children: ReactNode }) {
  const w = land ? 11 : 8.5;
  const h = land ? 8.5 : 11;
  return (
    <section className={`sheet${land ? ' land' : ''}`} style={{ width: `${w}in`, height: `${h}in`, padding: '0.3in 0.32in 0.22in', fontFamily: BODY, color: '#000', position: 'relative' }}>
      {children}
      <div style={{ position: 'absolute', bottom: '0.06in', left: 0, right: 0, textAlign: 'center', fontSize: '7.5pt', fontFamily: 'Arial' }}>{n}</div>
    </section>
  );
}

function Badge() {
  return (
    <svg viewBox="0 0 40 40" width={28} height={28} aria-hidden>
      <circle cx={20} cy={20} r={18} fill={GOLD} stroke="#fff" strokeWidth={2.5} />
      <text x={20} y={27} textAnchor="middle" fontFamily="Arial Black, Arial" fontWeight={900} fontSize={21} fill={NAVY}>B</text>
    </svg>
  );
}

/** Navy-bordered frame with the title bar, like every Rams content page. */
function Frame({ title, children, style }: { title: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ flex: 1, minHeight: 0, border: `3px solid ${NAVY}`, boxShadow: '4px 4px 0 #9aa3b5', display: 'flex', flexDirection: 'column', ...style }}>
      <div style={{ background: `linear-gradient(180deg, #1C4BB0 0%, ${NAVY} 100%)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 6px', borderBottom: `2px solid ${NAVY}` }}>
        <Badge />
        <div style={{ fontFamily: COND, fontSize: '17pt', fontWeight: 700, letterSpacing: 0.3, textAlign: 'center', flex: 1, textTransform: 'uppercase' }}>{title}</div>
        <Badge />
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  );
}

function Label({ children }: { children: ReactNode }) {
  return <span style={{ fontWeight: 800, textDecoration: 'underline' }}>{children}</span>;
}

const P = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => <p style={{ margin: '0 0 5px', fontSize: '10pt', lineHeight: 1.28, fontWeight: 600, ...style }}>{children}</p>;

function Wordmark({ size = 64 }: { size?: number }) {
  return (
    <div style={{ fontFamily: "'Arial Black', 'Segoe UI Black', Arial", fontWeight: 900, color: GOLD, fontSize: `${size}pt`, lineHeight: 0.92, letterSpacing: 2, transform: 'scaleX(1.12)', transformOrigin: 'left' }}>
      BEAST
      <br />
      OFFENSE
    </div>
  );
}

function SectionCover({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ flex: 1, border: `3px solid ${NAVY}`, boxShadow: '5px 5px 0 #9aa3b5', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.6in 0.25in 0.9in' }}>
      <Wordmark />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'Segoe UI', Calibri, Arial", fontWeight: 800, color: BLUE, fontSize: '36pt', lineHeight: 1.15 }}>{title}</div>
        {sub && <div style={{ fontFamily: "'Segoe UI', Calibri, Arial", fontWeight: 700, color: BLUE, fontSize: '15pt', marginTop: 10 }}>{sub}</div>}
      </div>
    </div>
  );
}

function Contents({ title, rows }: { title: string; rows: { label: string; page: number }[] }) {
  return (
    <div style={{ padding: '0.25in 0.8in', fontFamily: "Cambria, Georgia, 'Times New Roman', serif" }}>
      <h1 style={{ textAlign: 'center', fontSize: '20pt', fontWeight: 800, textDecoration: 'underline', margin: '0 0 22px' }}>{title}</h1>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, textDecoration: 'underline', fontSize: '10.5pt', marginBottom: 14 }}>
        <span>CONCEPT</span>
        <span>PAGE #</span>
      </div>
      {rows.map((r) => (
        <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11pt', fontWeight: 700, margin: '0 0 9px' }}>
          <span>{r.label}</span>
          <span style={{ minWidth: 30, textAlign: 'center' }}>{r.page}</span>
        </div>
      ))}
    </div>
  );
}

/** One diagram cell: two-line italic header, number box, the drawing, footer label bottom left. */
function Cell({ line1, line2, n, footer, children }: { line1: string; line2: string; n: number; footer?: ReactNode; children: ReactNode }) {
  return (
    <div style={{ border: '1.5px solid #000', display: 'flex', flexDirection: 'column', minHeight: 0, position: 'relative' }}>
      <div style={{ textAlign: 'center', fontStyle: 'italic', fontWeight: 800, fontSize: '10.5pt', lineHeight: 1.1, padding: '2px 26px', borderBottom: '1.5px solid #000', fontFamily: "Cambria, Georgia, serif" }}>
        {line1}
        <br />
        {line2}
      </div>
      <div style={{ position: 'absolute', top: 30, right: 3, border: '1px solid #000', background: GOLD, fontWeight: 800, fontSize: '8pt', width: 16, textAlign: 'center', fontStyle: 'italic' }}>{n}</div>
      <div style={{ flex: 1, minHeight: 0 }}>{children}</div>
      {footer && <div style={{ position: 'absolute', bottom: 2, left: 4, fontWeight: 900, fontSize: '9pt', fontFamily: 'Arial' }}>{footer}</div>}
    </div>
  );
}

const sideChip = (side: Side, text: ReactNode) => (
  <span style={{ background: COLORS[side].hex, color: COLORS[side].ink, padding: '0 5px', fontWeight: 900 }}>{text}</span>
);

// ---------------------------------------------------------------- content pages

function Terminology() {
  return (
    <Frame title="Terminology: colors, numbers & holes">
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <P><Label>COLOR = SIDE:</Label> {sideChip('right', 'RED')} Beast Right: Y and both wings line up on the right. {sideChip('left', 'YELLOW')} Beast Left: they line up on the left.</P>
        <P><Label>NUMBER = THE PLAY:</Label> &ldquo;Red 2&rdquo; is play 2 (Hammer) to the Red side. Same number both colors, so the wristband has 10 rows.</P>
        <P><Label>PLAY NUMBER = WHO & WHERE:</Label> First number = who gets the ball (1, 2 or 4). Second number = the hole. Even right, odd left. 14 Hammer: 1 carries over hole 4.</P>
        <P><Label>WITH OR AWAY:</Label> Train, Hammer and Rocket go the way the wings line up. Crossover, Limo and Boomerang go the other way. That is the trick.</P>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
          <HoleChart width={560} />
        </div>
        <div style={{ borderTop: '1.5px solid #000', paddingTop: 6 }}>
          <Label>WHO IS WHO</Label>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt', marginTop: 4 }}>
            <tbody>
              {POSITIONS.map((p) => (
                <tr key={p.label} style={{ borderBottom: '0.5px solid #bbb', verticalAlign: 'top' }}>
                  <td style={{ fontWeight: 900, width: 26, fontSize: '11pt' }}>{p.label}</td>
                  <td style={{ fontWeight: 800, width: 150 }}>{p.kid}</td>
                  <td>{p.job} <i style={{ color: '#444' }}>{p.lineup}</i></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ borderTop: '1.5px solid #000', paddingTop: 6 }}>
          <Label>READING A PLAY</Label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px 14px', fontSize: '9.5pt', marginTop: 3 }}>
            {LEGEND.map((l) => (
              <div key={l.mark}><b>{l.mark}:</b> {l.means}</div>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

function Cadence() {
  return (
    <Frame title="Verbal cadence & check with me">
      <div style={{ padding: '10px 14px', fontSize: '10pt' }}>
        <Label>CADENCE</Label>
        <ul style={{ margin: '4px 0 8px 18px', fontWeight: 600 }}>
          <li>1 starts the count: <b>&ldquo;{CADENCE}&rdquo;</b> Everyone must be set.</li>
          {DAYS.map((d) => (
            <li key={d.day}><b>{d.day}:</b> {d.means} <i>({d.why})</i></li>
          ))}
          <li>We changed &ldquo;Red, Set, Go&rdquo; to &ldquo;Ready, Set, Go&rdquo; because Red means right.</li>
        </ul>
        <div style={{ borderTop: '1.5px solid #000', paddingTop: 6 }}>
          <Label>NO-HUDDLE: CHECK WITH ME</Label>
          <ol style={{ margin: '4px 0 8px 18px', fontWeight: 600 }}>
            <li>Coach: &ldquo;Beast Red, check with me!&rdquo; Sprint to Beast Red, get your splits, two-point stance, eyes on the coach.</li>
            <li>Coach finds where we have more blockers, better angles, or a weaker player.</li>
            <li>Coach calls <b>City + Color + Day</b>. The city&apos;s first letter is the play. The color is the side. The day is the snap.</li>
            <li>Get set and go on the day. &ldquo;Tyler Red Monday&rdquo; = Train, Red, snap on the first GO.</li>
          </ol>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #000' }}>
              <th>#</th><th>PLAY</th><th>CITY WORDS</th><th>HAND SIGNAL</th>
            </tr>
          </thead>
          <tbody>
            {CONCEPTS.map((c) => (
              <tr key={c.key} style={{ borderBottom: '0.5px solid #bbb' }}>
                <td style={{ fontWeight: 900 }}>{c.n}</td>
                <td style={{ fontWeight: 800 }}>{c.kid.toUpperCase()}</td>
                <td>{c.cities.join(', ')}</td>
                <td>{c.signal}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div style={{ borderTop: '1.5px solid #000', paddingTop: 6, marginTop: 8 }}>
          <Label>FREEZE</Label>
          <P style={{ marginTop: 3 }}>&ldquo;Ice&rdquo; (play 10) and &ldquo;Friday&rdquo; both mean nobody moves on the first count. On Ice, only the center can snap it, and only if a defender jumps across. Then 1 runs right behind him.</P>
        </div>
      </div>
    </Frame>
  );
}

function FormationsPage({ keys, first }: { keys: string[]; first: number }) {
  return (
    <Frame title="Formations">
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: `repeat(${Math.ceil(keys.length / 2)}, 1fr)`, minHeight: 0 }}>
        {keys.map((k, i) => {
          const s = FORMATION_SPECS.find((f) => f.key === k)!;
          const f = beastFormationByKey.get(k)!;
          return (
            <Cell key={k} line1={s.side ? `${s.name.toUpperCase()} (${COLORS[s.side].word.toUpperCase()})` : s.name.toUpperCase()} line2={s.family === 'Beast' ? 'UNDER CENTER' : s.family === 'Pistol' ? 'PISTOL' : 'SHORT YARDAGE'} n={first + i}>
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                <div style={{ flex: 1, minHeight: 0 }}>
                  <PlayThumb diagram={{ players: f.players, paths: {}, annotations: {} }} aspect={1.6} fit={{ pad: 1.2, minBack: 5.5, minDown: 2, minSide: 7 }} />
                </div>
                <div style={{ fontSize: '8.5pt', fontWeight: 600, padding: '2px 6px 4px', borderTop: '0.5px solid #999' }}>{s.cue}</div>
              </div>
            </Cell>
          );
        })}
      </div>
    </Frame>
  );
}

function GodPage() {
  return (
    <Frame title="OL terminology: GOD blocking">
      <div style={{ padding: '10px 14px' }}>
        <P><Label>CONCEPT:</Label> One rule for every lineman on every run. Ask three questions in order and block the first answer that is yes. The five linemen are the wall: nobody comes through an inside gap.</P>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, margin: '8px 0', border: '2px solid #000', padding: 8 }}>
          {GOD.steps.map((s) => (
            <div key={s.letter}>
              <div style={{ fontFamily: COND, fontSize: '40pt', fontWeight: 900, color: BLUE, lineHeight: 1 }}>{s.letter}</div>
              <div style={{ fontWeight: 900, fontSize: '12pt' }}>{s.word.toUpperCase()}</div>
              <div style={{ fontSize: '9.5pt', fontWeight: 600 }}>{s.ask}</div>
              <div style={{ fontSize: '9.5pt', fontWeight: 800, marginTop: 2 }}>{s.then}</div>
            </div>
          ))}
        </div>
        <P><Label>INSIDE:</Label> {GOD.inside}</P>
        <P><Label>PASS GOD:</Label> {GOD.pass.map((s) => `${s.letter} = ${s.word}`).join('. ')}. {GOD.pass[2].then}</P>
        <div style={{ marginTop: 6 }}>
          <Label>THE ONLY BLOCKS THAT ARE NOT GOD</Label>
          <ul style={{ margin: '4px 0 0 18px', fontSize: '10pt', fontWeight: 600 }}>
            {GOD.exceptions.map((e) => (
              <li key={e.word}><b>{e.word}</b> ({e.who}) {e.means}</li>
            ))}
          </ul>
        </div>
        <div style={{ marginTop: 10, borderTop: '1.5px solid #000', paddingTop: 6 }}>
          <Label>TEACHING ORDER</Label>
          <ol style={{ margin: '4px 0 0 18px', fontSize: '10pt', fontWeight: 600 }}>
            <li>Stance and splits: one foot apart. Two-point first, then three-point.</li>
            <li>Gap: one defender, one blocker, coach points to a spot. The blocker says &ldquo;Gap!&rdquo; and fits.</li>
            <li>On and Down: add a second defender. The blocker says which letter and why.</li>
            <li>Pulling (week 5) and the OUT block (week 2, wing-side tackle on Hammer).</li>
            <li>Pass GOD (week 6): the whistle blows if anyone crosses the line.</li>
          </ol>
        </div>
      </div>
    </Frame>
  );
}

const OL = ['LT', 'LG', 'C', 'RG', 'RT'];
/** A lineman's job in one or two words, for the line chart. */
function shortJob(text: string): string {
  if (/PULL and kick/i.test(text)) return 'PULL: KICK OUT';
  if (/PULL and lead/i.test(text)) return 'PULL: LEAD';
  if (/BLOCK BACK/.test(text)) return 'BLOCK BACK';
  if (/^OUT!/.test(text)) return 'OUT';
  if (/Pass GOD/i.test(text)) return 'PASS GOD';
  if (/Freeze/i.test(text)) return 'FREEZE';
  if (/double/i.test(text)) return 'GOD: DOUBLE';
  if (/Down/.test(text)) return 'GOD: DOWN';
  if (/toward the ball|Cut off|chase/i.test(text)) return 'GOD: CUT OFF';
  return 'GOD';
}

function LineChart() {
  const table = (side: Side) => (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt', marginBottom: 10 }}>
      <thead>
        <tr style={{ background: COLORS[side].hex, color: COLORS[side].ink }}>
          <th style={{ textAlign: 'left', padding: '2px 4px' }}>{COLORS[side].word.toUpperCase()} ({COLORS[side].formation.toUpperCase()})</th>
          {OL.map((l) => <th key={l} style={{ padding: '2px 4px' }}>{l}</th>)}
        </tr>
      </thead>
      <tbody>
        {CONCEPTS.map((c) => {
          const rows = Object.fromEntries(OL.map((l) => [l, jobsFor(l).find((j) => j.concept.key === c.key)!]));
          return (
            <tr key={c.key} style={{ borderBottom: '0.5px solid #999' }}>
              <td style={{ fontWeight: 800, padding: '2px 4px' }}>{c.n} {c.kid.toUpperCase()}</td>
              {OL.map((l) => {
                const j = rows[l];
                const text = side === 'right' ? j.red : (j.yellow ?? j.red);
                const s = shortJob(text);
                return <td key={l} style={{ textAlign: 'center', fontWeight: s === 'GOD' || s.startsWith('GOD:') ? 600 : 900, color: s.startsWith('PULL') || s === 'OUT' || s === 'BLOCK BACK' ? '#B00020' : '#000', padding: '2px 3px' }}>{s}</td>;
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
  return (
    <Frame title="Line jobs on every play">
      <div style={{ padding: '10px 14px' }}>
        <P><Label>HOW TO READ IT:</Label> Every lineman blocks GOD unless his box says something else. Red words are the jobs that change: learn those first. On Yellow the left and right linemen trade jobs.</P>
        {table('right')}
        {table('left')}
      </div>
    </Frame>
  );
}

const JOB_ORDER = ['1', '2', '3', '4', 'Y', 'F', 'LT', 'LG', 'C', 'RG', 'RT'];

function ConceptText({ c, compact }: { c: Concept; compact?: boolean }) {
  const jobs = new Map(JOB_ORDER.map((l) => [l, jobsFor(l).find((j) => j.concept.key === c.key)!]));
  const carrier = c.kind === 'run' ? c.carrier : '1';
  return (
    <div style={{ padding: compact ? '6px 10px' : '8px 12px', fontSize: compact ? '9pt' : '9.5pt' }}>
      <P style={{ fontSize: compact ? '9.5pt' : '10pt' }}>
        <Label>CONCEPT:</Label> {c.coachNote} {c.withWings ? 'The ball goes the way the wings line up.' : 'The ball goes AWAY from the wings.'}
      </P>
      <P style={{ fontSize: compact ? '9.5pt' : '10pt' }}>
        <Label>KIDS SAY IT:</Label> &ldquo;{c.kidSays}&rdquo;
      </P>
      <P style={{ fontSize: compact ? '9.5pt' : '10pt' }}>
        <Label>{carrier === '1' ? '1 (BOSS)' : `${carrier}`} FOOTWORK:</Label> {jobs.get(carrier)!.red}
      </P>
      <P style={{ fontSize: compact ? '9.5pt' : '10pt' }}>
        <Label>CALL IT:</Label> Wristband {sideChip('right', `RED ${c.n}`)} {sideChip('left', `YELLOW ${c.n}`)} · Signal: {c.signal} · Check with me: {c.cities.join(' / ')}
      </P>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
        <tbody>
          {JOB_ORDER.filter((l) => l !== carrier).map((l) => {
            const j = jobs.get(l)!;
            return (
              <tr key={l} style={{ borderTop: '0.5px solid #bbb', verticalAlign: 'top' }}>
                <td style={{ fontWeight: 900, width: 22, padding: '1px 0' }}>{l}</td>
                <td style={{ fontWeight: 600, padding: '1px 0' }}>
                  {j.yellow ? (
                    <>
                      {sideChip('right', 'RED')} {j.red} {sideChip('left', 'YEL')} {j.yellow}
                    </>
                  ) : (
                    j.red
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function PlayCells({ c, first, aspect }: { c: Concept; first: number; aspect: number }) {
  return (
    <>
      {(['right', 'left'] as Side[]).map((side, i) => {
        const play = beastPlay(side, c.key)!;
        return (
          <Cell key={side} line1={`${COLORS[side].formation.toUpperCase()} (${COLORS[side].word.toUpperCase()})`} line2={`${kidCall(side, c)} · ${coachCall(side, c).replace(/^Beast (Right|Left) \(Base\) /, '').toUpperCase()}`} n={first + i} footer={sideChip(side, `${COLORS[side].word.toUpperCase()} ${c.n}`)}>
            <PlayThumb diagram={play.diagram} aspect={aspect} fit={BEAST_FIT} />
          </Cell>
        );
      })}
    </>
  );
}

function RunPage({ c, first }: { c: Concept; first: number }) {
  const nums = c.numbers.right ? `${c.numbers.right}-${c.numbers.left} ` : '';
  return (
    <Frame title={`[Beast] ${nums}${c.kid} (${c.coach}) run`}>
      <ConceptText c={c} />
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1.5px solid #000' }}>
        <PlayCells c={c} first={first} aspect={0.88} />
      </div>
    </Frame>
  );
}

function PassPage({ c, first }: { c: Concept; first: number }) {
  return (
    <Frame title={c.kind === 'special' ? `[Beast] ${c.kid} (freeze play)` : `[Beast] ${c.kid} (${c.coach})`}>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1.55fr' }}>
        <div style={{ borderRight: '1.5px solid #000', overflow: 'hidden' }}>
          <ConceptText c={c} compact />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0 }}>
          <PlayCells c={c} first={first} aspect={0.62} />
        </div>
      </div>
    </Frame>
  );
}

function GameDay() {
  return (
    <Frame title="Game day: script, if / then, watchers">
      <div style={{ padding: '10px 14px', fontSize: '10pt' }}>
        <Label>OPENING SCRIPT: EVERY PLAY ASKS A QUESTION</Label>
        <ol style={{ margin: '4px 0 8px 18px', fontWeight: 600 }}>
          {SCRIPT.map(({ entry: [side, key], asks }) => (
            <li key={`${side}${key}`}>
              {sideChip(side, `${COLORS[side].word.toUpperCase()} ${conceptByKey.get(key)!.n}`)} <b>{conceptByKey.get(key)!.kid.toUpperCase()}</b>: {asks}
            </li>
          ))}
        </ol>
        <div style={{ borderTop: '1.5px solid #000', paddingTop: 6 }}>
          <Label>IF YOU SEE, THEN CALL</Label>
          <ul style={{ margin: '4px 0 8px 18px', fontWeight: 600 }}>
            {IF_THEN.map((r) => (
              <li key={r.see}>{r.see} &rarr; <b>{r.call.map((k) => conceptByKey.get(k)!.kid.toUpperCase()).join(' or ')}</b></li>
            ))}
            <li><b>Two-for-one:</b> run the same look twice before the fake off it (two Rockets, then Magic). Throw on run downs.</li>
          </ul>
        </div>
        <div style={{ borderTop: '1.5px solid #000', paddingTop: 6 }}>
          <Label>SIDELINE WATCHERS</Label>
          {WATCHERS.map((w) => (
            <P key={w.who} style={{ marginTop: 3 }}><b>{w.who}:</b> {w.tally.join(' · ')}</P>
          ))}
        </div>
        <div style={{ borderTop: '1.5px solid #000', paddingTop: 6 }}>
          <Label>70-MINUTE PRACTICE</Label>
          {PRACTICE_70.map((p) => (
            <P key={p.time} style={{ marginTop: 3 }}><b>{p.time}</b> {p.what}</P>
          ))}
        </div>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- the book

const RUNS = CONCEPTS.filter((c) => c.kind === 'run');
const PASSES = CONCEPTS.filter((c) => c.kind !== 'run');

function buildPages(): { pages: PageSpec[]; master: { label: string; page: number }[] } {
  const pages: PageSpec[] = [];
  const master: { label: string; page: number }[] = [];
  const at = () => pages.length + 1;
  let cell = 1;

  pages.push({ key: 'cover', render: () => <SectionCover title="2026 PLAYBOOK" sub="2nd & 3rd grade · Red right, Yellow left · GOD blocking" /> });
  const masterIndex = pages.length;
  pages.push({ key: 'master', render: () => null });

  const section = (label: string, title: string, sub: string | undefined, contents: { label: string; key: string }[], body: PageSpec[], land = false) => {
    master.push({ label, page: at() });
    pages.push({ key: `${label}-cover`, land, render: () => <SectionCover title={title} sub={sub} /> });
    const tocIndex = pages.length;
    pages.push({ key: `${label}-toc`, land, render: () => null });
    const start = pages.length;
    pages.push(...body);
    const rows = contents.map((r) => ({ label: r.label, page: start + 1 + body.findIndex((b) => b.key === r.key) }));
    pages[tocIndex] = { key: `${label}-toc`, land, render: () => <Contents title={label} rows={rows} /> };
  };

  section('HOW WE TALK', 'HOW WE TALK: COLORS, NUMBERS & CADENCE', undefined, [
    { label: 'TERMINOLOGY: COLORS, NUMBERS & HOLES', key: 'terms' },
    { label: 'VERBAL CADENCE & CHECK WITH ME', key: 'cadence' },
  ], [
    { key: 'terms', render: () => <Terminology /> },
    { key: 'cadence', render: () => <Cadence /> },
  ]);

  const fKeys = FORMATION_SPECS.map((f) => f.key);
  const fPages = [fKeys.slice(0, 6), fKeys.slice(6)];
  let fFirst = 1;
  section('FORMATIONS', 'FORMATIONS', 'Beast · Beast Wide · Pistol · Tank', [
    { label: 'BEAST RIGHT / LEFT · BEAST WIDE RIGHT / LEFT · PISTOL RIGHT / LEFT', key: 'f-0' },
    { label: 'PISTOL SLOT · TANK RIGHT / LEFT', key: 'f-1' },
  ], fPages.map((keys, i) => {
    const first = fFirst;
    fFirst += keys.length;
    return { key: `f-${i}`, render: () => <FormationsPage keys={keys} first={first} /> };
  }));

  section('OL TERMINOLOGY', 'OL TERMINOLOGY: GOD BLOCKING', 'Gap · On · Down', [
    { label: 'GOD: GAP, ON, DOWN', key: 'god' },
    { label: 'LINE JOBS ON EVERY PLAY (RED AND YELLOW)', key: 'line' },
  ], [
    { key: 'god', render: () => <GodPage /> },
    { key: 'line', render: () => <LineChart /> },
  ]);

  section('RUN GAME', 'RUN GAME', 'Train · Hammer · Rocket · Crossover · Limo · Boomerang',
    RUNS.map((c) => ({ label: `${c.numbers.right}-${c.numbers.left} ${c.kid.toUpperCase()} (${c.coach.toUpperCase()})`, key: c.key })),
    RUNS.map((c) => {
      const first = cell;
      cell += 2;
      return { key: c.key, render: () => <RunPage c={c} first={first} /> };
    }));

  section('PLAY ACTION, QUICK GAME & ICE', 'PLAY ACTION, QUICK GAME & ICE', 'Magic · Elevator · Pop · Ice',
    PASSES.map((c) => ({ label: `${c.kid.toUpperCase()} (${c.coach.toUpperCase()})`, key: c.key })),
    PASSES.map((c) => {
      const first = cell;
      cell += 2;
      return { key: c.key, land: true, render: () => <PassPage c={c} first={first} /> };
    }), true);

  section('GAME DAY', 'GAME DAY', 'Call sheet · script · if / then', [
    { label: 'CALL SHEET', key: 'callsheet' },
    { label: 'SCRIPT, IF / THEN, WATCHERS, PRACTICE', key: 'gameday' },
  ], [
    { key: 'callsheet', land: true, render: () => null },
    { key: 'gameday', render: () => <GameDay /> },
  ]);

  section('INSTALL PLAN', 'INSTALL PLAN', '12 weeks · add a week only when the checks pass', [
    { label: 'WEEKS 1-12, WITH THE CHECKS', key: 'install' },
  ], [{ key: 'install', render: () => null }]);

  pages[masterIndex] = { key: 'master', render: () => <Contents title="BEAST OFFENSE 2026" rows={master} /> };
  return { pages, master };
}

export function BeastBook() {
  const { pages } = buildPages();
  return (
    <div className="book-root" style={{ background: '#e5e5e5', minHeight: '100vh', paddingBottom: '0.5in' }}>
      <style>{`
        @page { size: letter portrait; margin: 0; }
        @page land { size: letter landscape; margin: 0; }
        .sheet.land { page: land; }
        @media print { .book-root { padding: 0 !important; min-height: 0 !important; background: #fff !important; } }
      `}</style>
      <div className="no-print" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', background: '#000', color: '#fff', marginBottom: 12 }}>
        <Link href="/systems/beast-2026" style={{ fontWeight: 700 }}>&larr; Beast</Link>
        <span>The whole playbook, laid out like the Rams 2022 book. Print to PDF (Letter).</span>
        <button onClick={() => window.print()} style={{ marginLeft: 'auto', background: '#fff', color: '#000', fontWeight: 700, padding: '2px 10px', borderRadius: 4 }}>Print</button>
      </div>
      {pages.map((p, i) => {
        if (p.key === 'callsheet') return <CallSheet key={p.key} />;
        if (p.key === 'install') return <Install key={p.key} />;
        return (
          <Sheet key={p.key} land={p.land} n={i + 1}>
            {p.render(i + 1)}
          </Sheet>
        );
      })}
    </div>
  );
}
