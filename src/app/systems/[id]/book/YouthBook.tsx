'use client';

import Link from 'next/link';
import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { PlayThumb } from '@/render/PlayThumb';
import { HoleChart } from '@/systems/youth/HoleChart';
import { COLORS, type Concept, type Side } from '@/systems/youth/types';
import { youthSystem } from '@/systems/youth/registry';
import { CallSheet, Install, SysContext, useSys } from '../print/YouthPrint';

/**
 * A youth playbook as a book, laid out like the Rams 2022 sections: a framed cover per section (gold wordmark,
 * blue title), a contents page (CONCEPT / PAGE #), then framed pages with a navy title bar, underlined labels and
 * numbered diagram cells. Runs are portrait, passes landscape, same as the Rams book. Printed to PDF by
 * scripts/export-beast-book.mjs (any system: pass its /book url).
 */

const NAVY = '#0B2D7A';
const GOLD = '#FFD100';
const BLUE = '#003594';
const COND = "'Bahnschrift Condensed', 'Arial Narrow', 'Roboto Condensed', Impact, sans-serif";
const BODY = "Calibri, 'Segoe UI', Arial, sans-serif";
const OL = ['LT', 'LG', 'C', 'RG', 'RT'];

// ---------------------------------------------------------------- page shell

type PageSpec = { key: string; land?: boolean; render: () => ReactNode };

function Sheet({ land, n, children }: { land?: boolean; n: number; children: ReactNode }) {
  return (
    <section className={`sheet${land ? ' land' : ''}`} style={{ width: `${land ? 11 : 8.5}in`, height: `${land ? 8.5 : 11}in`, padding: '0.3in 0.32in 0.22in', fontFamily: BODY, color: '#000', position: 'relative' }}>
      {children}
      <div style={{ position: 'absolute', bottom: '0.06in', left: 0, right: 0, textAlign: 'center', fontSize: '7.5pt', fontFamily: 'Arial' }}>{n}</div>
    </section>
  );
}

function Badge() {
  const sys = useSys();
  return (
    <svg viewBox="0 0 40 40" width={28} height={28} aria-hidden>
      <circle cx={20} cy={20} r={18} fill={GOLD} stroke="#fff" strokeWidth={2.5} />
      <text x={20} y={27} textAnchor="middle" fontFamily="Arial Black, Arial" fontWeight={900} fontSize={21} fill={NAVY}>{sys.badge}</text>
    </svg>
  );
}

/** Navy-bordered frame with the title bar, like every Rams content page. */
function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ flex: 1, minHeight: 0, border: `3px solid ${NAVY}`, boxShadow: '4px 4px 0 #9aa3b5', display: 'flex', flexDirection: 'column' }}>
      <div style={{ background: `linear-gradient(180deg, #1C4BB0 0%, ${NAVY} 100%)`, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '3px 6px', borderBottom: `2px solid ${NAVY}` }}>
        <Badge />
        <div style={{ fontFamily: COND, fontSize: '17pt', fontWeight: 700, letterSpacing: 0.3, textAlign: 'center', flex: 1, textTransform: 'uppercase' }}>{title}</div>
        <Badge />
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
    </div>
  );
}

const Label = ({ children }: { children: ReactNode }) => <span style={{ fontWeight: 800, textDecoration: 'underline' }}>{children}</span>;
const P = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => <p style={{ margin: '0 0 5px', fontSize: '10pt', lineHeight: 1.28, fontWeight: 600, ...style }}>{children}</p>;

function Wordmark() {
  const sys = useSys();
  const long = Math.max(...sys.wordmark.map((w) => w.length));
  const size = long > 8 ? Math.max(38, Math.round(64 * (8 / long))) : 64;
  return (
    <div style={{ fontFamily: "'Arial Black', 'Segoe UI Black', Arial", fontWeight: 900, color: GOLD, fontSize: `${size}pt`, lineHeight: 0.92, letterSpacing: 2, transform: 'scaleX(1.12)', transformOrigin: 'left' }}>
      {sys.wordmark[0]}
      <br />
      {sys.wordmark[1]}
    </div>
  );
}

function SectionCover({ title, sub }: { title: string; sub?: string }) {
  return (
    <div style={{ flex: 1, border: `3px solid ${NAVY}`, boxShadow: '5px 5px 0 #9aa3b5', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '1.6in 0.25in 0.9in' }}>
      <Wordmark />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'Segoe UI', Calibri, Arial", fontWeight: 800, color: BLUE, fontSize: '34pt', lineHeight: 1.15 }}>{title}</div>
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
      <div style={{ textAlign: 'center', fontStyle: 'italic', fontWeight: 800, fontSize: '10.5pt', lineHeight: 1.1, padding: '2px 26px', borderBottom: '1.5px solid #000', fontFamily: 'Cambria, Georgia, serif' }}>
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

const sideChip = (side: Side, text: ReactNode) => <span style={{ background: COLORS[side].hex, color: COLORS[side].ink, padding: '0 5px', fontWeight: 900 }}>{text}</span>;

// ---------------------------------------------------------------- content pages

function Terminology() {
  const sys = useSys();
  const first = sys.concepts.find((c) => c.numbers.right) ?? sys.concepts[0];
  return (
    <Frame title="Terminology: colors, numbers & holes">
      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <P><Label>COLOR = SIDE:</Label> {sideChip('right', 'RED')} {sys.colorMeans.right}. {sideChip('left', 'YELLOW')} {sys.colorMeans.left}.</P>
        <P><Label>NUMBER = THE PLAY:</Label> &ldquo;Red 2&rdquo; is play 2 ({sys.concepts[1].kid}) to the Red side. Same number both colors, so the wristband has 10 rows.</P>
        <P><Label>PLAY NUMBER = WHO & WHERE:</Label> First number = who gets the ball. Second number = the hole. Even right, odd left. {first.numbers.right} {first.kid}: {first.carrier} carries over hole {first.numbers.right % 10}.</P>
        <P><Label>WITH OR AWAY:</Label> {sys.withAway}</P>
        <div style={{ display: 'flex', justifyContent: 'center', margin: '4px 0' }}>
          <HoleChart width={560} />
        </div>
        <div style={{ borderTop: '1.5px solid #000', paddingTop: 6 }}>
          <Label>WHO IS WHO</Label>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt', marginTop: 4 }}>
            <tbody>
              {sys.positions.map((p) => (
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
            {sys.legend.map((l) => (
              <div key={l.mark}><b>{l.mark}:</b> {l.means}</div>
            ))}
          </div>
        </div>
      </div>
    </Frame>
  );
}

function Cadence() {
  const sys = useSys();
  const first = sys.concepts[0];
  return (
    <Frame title="Verbal cadence & check with me">
      <div style={{ padding: '10px 14px', fontSize: '10pt' }}>
        <Label>CADENCE</Label>
        <ul style={{ margin: '4px 0 8px 18px', fontWeight: 600 }}>
          <li>The QB starts the count: <b>&ldquo;{sys.cadence}&rdquo;</b> Everyone must be set.</li>
          {sys.days.map((d) => (
            <li key={d.day}><b>{d.day}:</b> {d.means} <i>({d.why})</i></li>
          ))}
          {sys.cadenceNote && <li>{sys.cadenceNote}</li>}
        </ul>
        <div style={{ borderTop: '1.5px solid #000', paddingTop: 6 }}>
          <Label>NO-HUDDLE: CHECK WITH ME</Label>
          <ol style={{ margin: '4px 0 8px 18px', fontWeight: 600 }}>
            <li>Coach: &ldquo;{sys.checkWithMe}&rdquo; Sprint to the formation, get your splits, two-point stance, eyes on the coach.</li>
            <li>Coach finds where we have more blockers, better angles, or a weaker player.</li>
            <li>Coach calls <b>City + Color + Day</b>. The city&apos;s first letter is the play. The color is the side. The day is the snap.</li>
            <li>Get set and go on the day. &ldquo;{first.cities[0]} Red Monday&rdquo; = {first.kid}, Red, snap on the first GO.</li>
          </ol>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #000' }}>
              <th>#</th><th>PLAY</th><th>CITY WORDS</th><th>HAND SIGNAL</th>
            </tr>
          </thead>
          <tbody>
            {sys.concepts.map((c) => (
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
          <P style={{ marginTop: 3 }}>&ldquo;Ice&rdquo; (play 10) and &ldquo;Friday&rdquo; both mean nobody moves on the first count. On Ice, only the center can snap it, and only if a defender jumps across.</P>
        </div>
      </div>
    </Frame>
  );
}

function FormationsPage({ keys, first }: { keys: string[]; first: number }) {
  const sys = useSys();
  const qbWord = { under: 'UNDER CENTER', pistol: 'PISTOL', gun: 'GUN' } as const;
  return (
    <Frame title="Formations">
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: `repeat(${Math.ceil(keys.length / 2)}, 1fr)`, minHeight: 0 }}>
        {keys.map((k, i) => {
          const s = sys.specByKey.get(k)!;
          const f = sys.formationByKey.get(k)!;
          return (
            <Cell key={k} line1={s.side ? `${s.name.toUpperCase()} (${COLORS[s.side].word.toUpperCase()})` : s.name.toUpperCase()} line2={`${s.family.toUpperCase()} · ${qbWord[s.qb]}`} n={first + i}>
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

function BlockingPage() {
  const sys = useSys();
  return (
    <Frame title={`OL terminology: ${sys.blocking.rules.map((r) => r.title.split(':')[0]).join(' · ')}`}>
      <div style={{ padding: '10px 14px' }}>
        <P><Label>CONCEPT:</Label> Every lineman has a rule. Ask the questions in order and block the first answer that is yes. The five linemen are the wall: nobody comes through an inside gap.</P>
        {sys.blocking.rules.map((rule) => (
          <div key={rule.key} style={{ border: '2px solid #000', padding: 8, margin: '6px 0' }}>
            <div style={{ fontWeight: 900, fontSize: '12pt' }}>
              {rule.title.toUpperCase()} <span style={{ fontWeight: 600, fontSize: '9.5pt' }}>({rule.usedOn})</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rule.steps.length}, 1fr)`, gap: 10 }}>
              {rule.steps.map((s) => (
                <div key={s.letter + s.word}>
                  <div style={{ fontFamily: COND, fontSize: '32pt', fontWeight: 900, color: BLUE, lineHeight: 1 }}>{s.letter}</div>
                  <div style={{ fontWeight: 900, fontSize: '11pt' }}>{s.word.toUpperCase()}</div>
                  {s.ask && <div style={{ fontSize: '9.5pt', fontWeight: 600 }}>{s.ask}</div>}
                  <div style={{ fontSize: '9.5pt', fontWeight: 800, marginTop: 2 }}>{s.then}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
        <P><Label>INSIDE:</Label> {sys.blocking.inside}</P>
        <div style={{ marginTop: 6 }}>
          <Label>THE SPECIAL BLOCKS</Label>
          <ul style={{ margin: '4px 0 0 18px', fontSize: '10pt', fontWeight: 600 }}>
            {sys.blocking.exceptions.map((e) => (
              <li key={e.word}><b>{e.word}</b> ({e.who}) {e.means}</li>
            ))}
          </ul>
        </div>
      </div>
    </Frame>
  );
}

/** A lineman's job in one or two words, for the line chart. */
function shortJob(text: string): string {
  if (/PULL and kick/i.test(text)) return 'PULL: KICK OUT';
  if (/PULL and lead|PULL and wrap/i.test(text)) return 'PULL: LEAD';
  if (/BLOCK BACK/.test(text)) return 'BLOCK BACK';
  if (/^OUT!/.test(text)) return 'OUT';
  if (/^WEB/.test(text)) return 'WEB: RELEASE';
  if (/Pass GOD/i.test(text)) return 'PASS GOD';
  if (/Freeze/i.test(text)) return 'FREEZE';
  if (/^ZONE|Step, Hit, Up/i.test(text)) return 'STEP-HIT-UP';
  if (/double/i.test(text)) return 'GOD: DOUBLE';
  if (/Down/.test(text)) return 'GOD: DOWN';
  if (/toward the ball|Cut off|chase/i.test(text)) return 'GOD: CUT OFF';
  return 'GOD';
}
const SPECIAL = (s: string) => s.startsWith('PULL') || s === 'OUT' || s === 'BLOCK BACK' || s.startsWith('WEB');

function LineChart() {
  const sys = useSys();
  const table = (side: Side) => (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt', marginBottom: 10 }}>
      <thead>
        <tr style={{ background: COLORS[side].hex, color: COLORS[side].ink }}>
          <th style={{ textAlign: 'left', padding: '2px 4px' }}>{COLORS[side].word.toUpperCase()}</th>
          {OL.map((l) => <th key={l} style={{ padding: '2px 4px' }}>{l}</th>)}
        </tr>
      </thead>
      <tbody>
        {sys.concepts.map((c) => (
          <tr key={c.key} style={{ borderBottom: '0.5px solid #999' }}>
            <td style={{ fontWeight: 800, padding: '2px 4px' }}>{c.n} {c.kid.toUpperCase()}</td>
            {OL.map((l) => {
              const j = sys.jobsFor(l).find((x) => x.concept.key === c.key)!;
              const s = shortJob(side === 'right' ? j.red : (j.yellow ?? j.red));
              return <td key={l} style={{ textAlign: 'center', fontWeight: SPECIAL(s) ? 900 : 600, color: SPECIAL(s) ? '#B00020' : '#000', padding: '2px 3px' }}>{s}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <Frame title="Line jobs on every play">
      <div style={{ padding: '10px 14px' }}>
        <P><Label>HOW TO READ IT:</Label> Every lineman follows the rule in his box. Red words are the jobs that change: learn those first. On Yellow the left and right linemen trade jobs.</P>
        {table('right')}
        {table('left')}
      </div>
    </Frame>
  );
}

function ConceptText({ c, compact }: { c: Concept; compact?: boolean }) {
  const sys = useSys();
  const jobs = new Map(sys.jobLabels.map((l) => [l, sys.jobsFor(l).find((j) => j.concept.key === c.key)!]));
  const carrier = c.kind === 'run' && jobs.has(c.carrier) ? c.carrier : sys.qbLabel;
  const kidName = sys.positions.find((p) => p.label === carrier)?.kid;
  const fs = compact ? '9.5pt' : '10pt';
  return (
    <div style={{ padding: compact ? '6px 10px' : '8px 12px', fontSize: compact ? '9pt' : '9.5pt' }}>
      <P style={{ fontSize: fs }}><Label>CONCEPT:</Label> {c.coachNote} {c.withWings ? 'The ball goes to the color side.' : 'The ball goes AWAY from the color side.'}</P>
      <P style={{ fontSize: fs }}><Label>KIDS SAY IT:</Label> &ldquo;{c.kidSays}&rdquo;</P>
      <P style={{ fontSize: fs }}><Label>{carrier}{kidName ? ` (${kidName.replace(/^The /, '').toUpperCase()})` : ''} FOOTWORK:</Label> {jobs.get(carrier)?.red}</P>
      <P style={{ fontSize: fs }}><Label>CALL IT:</Label> Wristband {sideChip('right', `RED ${c.n}`)} {sideChip('left', `YELLOW ${c.n}`)} · Signal: {c.signal} · Check with me: {c.cities.join(' / ')}</P>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 4 }}>
        <tbody>
          {sys.jobLabels.filter((l) => l !== carrier).map((l) => {
            const j = jobs.get(l)!;
            if (!j.red && !j.yellow) return null;
            return (
              <tr key={l} style={{ borderTop: '0.5px solid #bbb', verticalAlign: 'top' }}>
                <td style={{ fontWeight: 900, width: 22, padding: '1px 0' }}>{l}</td>
                <td style={{ fontWeight: 600, padding: '1px 0' }}>
                  {j.yellow ? <>{sideChip('right', 'RED')} {j.red} {sideChip('left', 'YEL')} {j.yellow}</> : j.red}
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
  const sys = useSys();
  return (
    <>
      {(['right', 'left'] as Side[]).map((side, i) => {
        const play = sys.play(side, c.key)!;
        const num = c.numbers[side];
        return (
          <Cell key={side} line1={play.formationLabel ?? ''} line2={`${sys.kidCall(side, c)} · ${num ? `${num} ` : ''}${c.coach.toUpperCase()}`} n={first + i} footer={sideChip(side, `${COLORS[side].word.toUpperCase()} ${c.n}`)}>
            <PlayThumb diagram={play.diagram} aspect={aspect} fit={sys.fit} />
          </Cell>
        );
      })}
    </>
  );
}

function RunPage({ c, first }: { c: Concept; first: number }) {
  const sys = useSys();
  const nums = c.numbers.right ? `${c.numbers.right}-${c.numbers.left} ` : '';
  return (
    <Frame title={`[${sys.short}] ${nums}${c.kid} (${c.coach})`}>
      <ConceptText c={c} />
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', borderTop: '1.5px solid #000' }}>
        <PlayCells c={c} first={first} aspect={0.88} />
      </div>
    </Frame>
  );
}

function PassPage({ c, first }: { c: Concept; first: number }) {
  const sys = useSys();
  return (
    <Frame title={c.kind === 'special' ? `[${sys.short}] ${c.kid} (freeze play)` : `[${sys.short}] ${c.kid} (${c.coach})`}>
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
  const sys = useSys();
  const k = (key: string) => sys.conceptByKey.get(key)!;
  return (
    <Frame title="Game day: script, if / then, watchers">
      <div style={{ padding: '10px 14px', fontSize: '10pt' }}>
        <Label>OPENING SCRIPT: EVERY PLAY ASKS A QUESTION</Label>
        <ol style={{ margin: '4px 0 8px 18px', fontWeight: 600 }}>
          {sys.script.map(({ entry: [side, key], asks }) => (
            <li key={`${side}${key}`}>{sideChip(side, `${COLORS[side].word.toUpperCase()} ${k(key).n}`)} <b>{k(key).kid.toUpperCase()}</b>: {asks}</li>
          ))}
        </ol>
        <div style={{ borderTop: '1.5px solid #000', paddingTop: 6 }}>
          <Label>IF YOU SEE, THEN CALL</Label>
          <ul style={{ margin: '4px 0 8px 18px', fontWeight: 600 }}>
            {sys.ifThen.map((r) => (
              <li key={r.see}>{r.see} &rarr; <b>{r.call.map((key) => k(key).kid.toUpperCase()).join(' or ')}</b></li>
            ))}
            <li><b>Two-for-one:</b> run the same look twice before the fake off it. Throw on run downs.</li>
          </ul>
        </div>
        <div style={{ borderTop: '1.5px solid #000', paddingTop: 6 }}>
          <Label>SIDELINE WATCHERS</Label>
          {sys.watchers.map((w) => (
            <P key={w.who} style={{ marginTop: 3 }}><b>{w.who}:</b> {w.tally.join(' · ')}</P>
          ))}
        </div>
        <div style={{ borderTop: '1.5px solid #000', paddingTop: 6 }}>
          <Label>70-MINUTE PRACTICE</Label>
          {sys.practice.map((p) => (
            <P key={p.time} style={{ marginTop: 3 }}><b>{p.time}</b> {p.what}</P>
          ))}
        </div>
      </div>
    </Frame>
  );
}

// ---------------------------------------------------------------- the book

function buildPages(sys: NonNullable<ReturnType<typeof youthSystem>>): PageSpec[] {
  const pages: PageSpec[] = [];
  const master: { label: string; page: number }[] = [];
  const at = () => pages.length + 1;
  let cell = 1;
  const runs = sys.concepts.filter((c) => c.kind === 'run');
  const passes = sys.concepts.filter((c) => c.kind !== 'run');
  const ruleNames = sys.blocking.rules.map((r) => r.title.split(':')[0]).join(' · ');

  pages.push({ key: 'cover', render: () => <SectionCover title="2026 PLAYBOOK" sub={`${sys.subtitle} · Red right, Yellow left · ${ruleNames}`} /> });
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

  const fKeys = sys.formationSpecs.map((f) => f.key);
  const fPages: string[][] = [];
  for (let i = 0; i < fKeys.length; i += 6) fPages.push(fKeys.slice(i, i + 6));
  let fFirst = 1;
  section('FORMATIONS', 'FORMATIONS', [...new Set(sys.formationSpecs.map((f) => f.family))].join(' · '),
    fPages.map((keys, i) => ({ label: keys.map((k) => sys.specByKey.get(k)!.name.toUpperCase()).join(' · '), key: `f-${i}` })),
    fPages.map((keys, i) => {
      const first = fFirst;
      fFirst += keys.length;
      return { key: `f-${i}`, render: () => <FormationsPage keys={keys} first={first} /> };
    }));

  section('OL TERMINOLOGY', 'OL TERMINOLOGY', ruleNames, [
    { label: `BLOCKING RULES: ${ruleNames.toUpperCase()}`, key: 'rules' },
    { label: 'LINE JOBS ON EVERY PLAY (RED AND YELLOW)', key: 'line' },
  ], [
    { key: 'rules', render: () => <BlockingPage /> },
    { key: 'line', render: () => <LineChart /> },
  ]);

  section('RUN GAME', 'RUN GAME', runs.map((c) => c.kid).join(' · '),
    runs.map((c) => ({ label: `${c.numbers.right}-${c.numbers.left} ${c.kid.toUpperCase()} (${c.coach.toUpperCase()})`, key: c.key })),
    runs.map((c) => {
      const first = cell;
      cell += 2;
      return { key: c.key, render: () => <RunPage c={c} first={first} /> };
    }));

  section('PASS GAME & ICE', 'PASS GAME & ICE', passes.map((c) => c.kid).join(' · '),
    passes.map((c) => ({ label: `${c.kid.toUpperCase()} (${c.coach.toUpperCase()})`, key: c.key })),
    passes.map((c) => {
      const first = cell;
      cell += 2;
      return { key: c.key, land: true, render: () => <PassPage c={c} first={first} /> };
    }), true);

  section('GAME DAY', 'GAME DAY', 'Call sheet · script · if / then', [
    { label: 'CALL SHEET', key: 'callsheet' },
    { label: 'SCRIPT, IF / THEN, WATCHERS, PRACTICE', key: 'gameday' },
  ], [
    { key: 'callsheet', land: true, render: () => <CallSheet /> },
    { key: 'gameday', render: () => <GameDay /> },
  ]);

  section('INSTALL PLAN', 'INSTALL PLAN', '12 weeks · add a week only when the checks pass', [
    { label: 'WEEKS 1-12, WITH THE CHECKS', key: 'install' },
  ], [{ key: 'install', render: () => <Install /> }]);

  pages[masterIndex] = { key: 'master', render: () => <Contents title={sys.title.toUpperCase()} rows={master} /> };
  return pages;
}

export function YouthBook({ id }: { id: string }) {
  const sys = youthSystem(id)!;
  const pages = buildPages(sys);
  return (
    <SysContext.Provider value={sys}>
      <div className="book-root" style={{ background: '#e5e5e5', minHeight: '100vh', paddingBottom: '0.5in' }}>
        <style>{`
          @page { size: letter portrait; margin: 0; }
          @page land { size: letter landscape; margin: 0; }
          .sheet.land { page: land; }
          @media print { .book-root { padding: 0 !important; min-height: 0 !important; background: #fff !important; } }
        `}</style>
        <div className="no-print" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 12px', background: '#000', color: '#fff', marginBottom: 12 }}>
          <Link href={`/systems/${sys.id}`} style={{ fontWeight: 700 }}>&larr; {sys.title}</Link>
          <span>The whole playbook, laid out like the Rams 2022 book. Print to PDF (Letter).</span>
          <button onClick={() => window.print()} style={{ marginLeft: 'auto', background: '#fff', color: '#000', fontWeight: 700, padding: '2px 10px', borderRadius: 4 }}>Print</button>
        </div>
        {pages.map((p, i) => {
          // the call sheet and install plan bring their own sheets
          if (p.key === 'callsheet' || p.key === 'install') return <Fragment key={p.key}>{p.render()}</Fragment>;
          return (
            <Sheet key={p.key} land={p.land} n={i + 1}>
              {p.render()}
            </Sheet>
          );
        })}
      </div>
    </SysContext.Provider>
  );
}
