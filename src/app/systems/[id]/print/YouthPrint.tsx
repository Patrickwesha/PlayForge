'use client';

import Link from 'next/link';
import { createContext, useContext, type CSSProperties, type ReactNode } from 'react';
import { FONT_STACK } from '@/model/constants';
import { PlayThumb } from '@/render/PlayThumb';
import { HoleChart } from '@/systems/youth/HoleChart';
import { COLORS, type Side } from '@/systems/youth/types';
import type { YouthSystem } from '@/systems/youth/build';
import { youthSystem } from '@/systems/youth/registry';

export type YouthSheet = 'callsheet' | 'wristband' | 'jobs' | 'install' | 'teach';

/** The system being printed; set by YouthPrint and YouthBook. */
export const SysContext = createContext<YouthSystem | null>(null);
export const useSys = () => {
  const s = useContext(SysContext);
  if (!s) throw new Error('no youth system in context');
  return s;
};

const LANDSCAPE: YouthSheet[] = ['callsheet'];
const SHEET_NAMES: Record<YouthSheet, string> = { callsheet: 'Call sheet', wristband: 'Wristbands', jobs: 'Player cards', install: 'Install plan', teach: 'Teaching sheet' };

export function Page({ landscape, children, pad = 0.35 }: { landscape?: boolean; children: ReactNode; pad?: number }) {
  const w = landscape ? 11 : 8.5;
  const h = landscape ? 8.5 : 11;
  return (
    <section className={`sheet${landscape ? ' land' : ''}`} style={{ width: `${w}in`, height: `${h}in`, padding: `${pad}in`, fontFamily: FONT_STACK, fontSize: '9pt', lineHeight: 1.25 }}>
      {children}
    </section>
  );
}

export function TitleBar({ title, right }: { title: string; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#000', color: '#fff', padding: '4px 8px', marginBottom: 6 }}>
      <div style={{ fontSize: '14pt', fontWeight: 900, letterSpacing: 0.5 }}>{title}</div>
      <div style={{ fontSize: '8.5pt', fontWeight: 700 }}>{right}</div>
    </div>
  );
}

const sideChip = (side: Side, text: ReactNode, style?: CSSProperties) => (
  <span style={{ background: COLORS[side].hex, color: COLORS[side].ink, fontWeight: 800, padding: '0 4px', borderRadius: 2, whiteSpace: 'nowrap', ...style }}>{text}</span>
);

// ---------------------------------------------------------------- call sheet

/** The call sheet sections in two columns, about the same height each (section order kept). */
function callColumns(sys: YouthSystem): string[][] {
  const total = sys.callSheet.reduce((n, s) => n + s.rows.length + 1.5, 0);
  const cols: string[][] = [[], []];
  let h = 0;
  for (const s of sys.callSheet) {
    cols[h < total / 2 ? 0 : 1].push(s.id);
    h += s.rows.length + 1.5;
  }
  return cols;
}

function CallSection({ id }: { id: string }) {
  const sys = useSys();
  const s = sys.callSheet.find((x) => x.id === id)!;
  return (
    <div style={{ marginBottom: 5, breakInside: 'avoid' }}>
      <div style={{ background: s.color, color: s.ink, fontWeight: 800, textAlign: 'center', fontSize: '9pt', padding: '1px 0', textTransform: 'uppercase' }}>{s.title}</div>
      {s.rows.map(([side, key], i) => {
        const c = sys.conceptByKey.get(key)!;
        return (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '0.2in 0.75in 1fr', alignItems: 'center', borderBottom: '0.5px solid #bbb', padding: '0.5px 0', whiteSpace: 'nowrap' }}>
            <span style={{ background: s.color, color: s.ink, textAlign: 'center', fontWeight: 800 }}>{i + 1}</span>
            <span style={{ paddingLeft: 3 }}>{sideChip(side, `${COLORS[side].word.toUpperCase()} ${c.n}`, { fontSize: '7.5pt' })}</span>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
              <b>{sys.kidCall(side, c)}</b> <span style={{ color: '#666', fontSize: '6.5pt' }}>{sys.coachCall(side, c).replace(' (Base)', '')}</span>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function CallSheet() {
  const sys = useSys();
  return (
    <Page landscape pad={0.3}>
      <TitleBar
        title={`${sys.title.toUpperCase()} · CALL SHEET`}
        right={
          <>
            {sideChip('right', 'RED = RIGHT')} {sideChip('left', 'YELLOW = LEFT')} &nbsp; Cadence: {sys.cadence}
          </>
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.25fr', gap: 8, flex: 1, minHeight: 0 }}>
        {callColumns(sys).map((col, i) => (
          <div key={i}>
            {col.map((id) => (
              <CallSection key={id} id={id} />
            ))}
          </div>
        ))}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div>
            <div style={{ background: '#2E9E4F', color: '#fff', fontWeight: 800, textAlign: 'center', padding: '1px 0' }}>NO-HUDDLE: CHECK WITH ME</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '7.5pt' }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid #000' }}>
                  <th>#</th>
                  <th>Play</th>
                  <th>Words</th>
                  <th>Red call</th>
                  <th>Yellow call</th>
                </tr>
              </thead>
              <tbody>
                {sys.concepts.map((c) => (
                  <tr key={c.key} style={{ borderBottom: '0.5px solid #bbb' }}>
                    <td style={{ fontWeight: 800 }}>{c.n}</td>
                    <td style={{ fontWeight: 800 }}>{c.kid}</td>
                    <td>{c.cities.join(', ')}</td>
                    <td>{c.cities[0]} Red {c.kind === 'pass' ? 'Saturday' : 'Monday'}</td>
                    <td>{c.cities[0]} Yellow {c.kind === 'pass' ? 'Saturday' : 'Monday'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ fontSize: '7.5pt', marginTop: 2 }}>
              {sys.days.map((d) => (
                <div key={d.day}>
                  <b>{d.day}:</b> {d.means}
                </div>
              ))}
              <div>
                <b>Line up:</b> &ldquo;{sys.checkWithMe}&rdquo; Two-point stance, eyes on the coach. Then City + Color + Day.
              </div>
            </div>
          </div>
          <div>
            <div style={{ background: '#444', color: '#fff', fontWeight: 800, textAlign: 'center', padding: '1px 0' }}>IF YOU SEE &rarr; CALL</div>
            <div style={{ fontSize: '7.5pt' }}>
              {sys.ifThen.map((r) => (
                <div key={r.see}>
                  {r.see} &rarr; <b>{r.call.map((k) => sys.conceptByKey.get(k)!.kid).join(' / ')}</b>
                </div>
              ))}
              <div style={{ marginTop: 2 }}>
                <b>Script:</b> {sys.script.map(({ entry: [side, key] }) => `${COLORS[side].word[0]}${sys.conceptByKey.get(key)!.n} ${sys.conceptByKey.get(key)!.kid}`).join(' · ')}
              </div>
            </div>
          </div>
          <div style={{ flex: 1, border: '1px solid #000', minHeight: '0.6in' }}>
            <div style={{ background: '#888', color: '#fff', fontWeight: 800, textAlign: 'center' }}>NOTES</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(10, 1fr)', gap: 3, marginTop: 5 }}>
        {(['right', 'left'] as Side[]).flatMap((side) =>
          sys.concepts.map((c) => (
            <div key={`${side}${c.key}`} style={{ border: '1px solid #000' }}>
              <div style={{ fontSize: '6.5pt', fontWeight: 800, textAlign: 'center', background: COLORS[side].hex, color: COLORS[side].ink }}>
                {COLORS[side].word.toUpperCase()} {c.n} {c.kid.toUpperCase()}
              </div>
              <PlayThumb diagram={sys.play(side, c.key)!.diagram} aspect={1.7} fit={sys.fit} />
            </div>
          )),
        )}
      </div>
    </Page>
  );
}

// ---------------------------------------------------------------- wristbands

const CARD: CSSProperties = { width: '3.7in', height: '2.45in', border: '1.5px dashed #000', padding: '0.08in', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' };

function TextCard() {
  const sys = useSys();
  return (
    <div style={CARD}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 900, fontSize: '9pt', borderBottom: '1.5px solid #000' }}>
        <span>{sys.short}</span>
        <span>
          {sideChip('right', 'RED = RIGHT')} {sideChip('left', 'YELLOW = LEFT')}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: 'repeat(5, 1fr)', gridAutoFlow: 'column', flex: 1, columnGap: 6 }}>
        {sys.concepts.map((c) => (
          <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 4, borderBottom: '0.5px solid #ccc' }}>
            <span style={{ fontSize: '15pt', fontWeight: 900, width: '0.32in', textAlign: 'right' }}>{c.n}</span>
            <span style={{ lineHeight: 1.05 }}>
              <span style={{ fontSize: '10.5pt', fontWeight: 900 }}>{c.kid.toUpperCase()}</span>
              <br />
              <span style={{ fontSize: '6.5pt' }}>{c.kind === 'run' ? `${c.carrier} carries${c.withWings ? '' : ', away side'}` : c.kind === 'pass' ? 'pass' : 'freeze'}</span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PictureCard({ side }: { side: Side }) {
  const sys = useSys();
  return (
    <div style={CARD}>
      <div style={{ fontWeight: 900, fontSize: '8.5pt', borderBottom: '1.5px solid #000', display: 'flex', justifyContent: 'space-between' }}>
        <span>{sys.short} · PICTURES</span>
        {sideChip(side, `${COLORS[side].word.toUpperCase()} SIDE`)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gridTemplateRows: 'repeat(2, 1fr)', flex: 1, gap: 2, marginTop: 2 }}>
        {sys.concepts.map((c) => (
          <div key={c.key} style={{ border: '0.5px solid #999', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ fontSize: '6.5pt', fontWeight: 900, textAlign: 'center' }}>
              {c.n} {c.kid.toUpperCase()}
            </div>
            <div style={{ flex: 1, minHeight: 0 }}>
              <PlayThumb diagram={sys.play(side, c.key)!.diagram} aspect={1.05} fit={sys.fit} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoachCard() {
  const sys = useSys();
  return (
    <div style={CARD}>
      <div style={{ fontWeight: 900, fontSize: '8.5pt', borderBottom: '1.5px solid #000' }}>COACH · CHECK WITH ME</div>
      <div style={{ fontSize: '7pt', flex: 1 }}>
        {sys.concepts.map((c) => (
          <div key={c.key}>
            <b>
              {c.n} {c.kid}
            </b>{' '}
            {c.cities.join(', ')}
          </div>
        ))}
        <div style={{ marginTop: 2 }}>
          <b>Days:</b> Monday = first GO · Saturday = SET · Friday = fake count, second GO
        </div>
        <div>
          <b>Freeze:</b> Ice and Friday. <b>Cadence:</b> {sys.cadence}
        </div>
      </div>
    </div>
  );
}

function Wristbands() {
  const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, 3.7in)', gridAutoRows: '2.45in', gap: '0.1in', justifyContent: 'center' };
  return (
    <>
      <Page pad={0.4}>
        <TitleBar title="WRISTBANDS: WORDS" right="Cut on the dashed lines. Every player wears one." />
        <div style={grid}>
          {Array.from({ length: 8 }, (_, i) => (
            <TextCard key={i} />
          ))}
        </div>
      </Page>
      <Page pad={0.4}>
        <TitleBar title="WRISTBANDS: PICTURES" right="For the QB and the coaches. Red on the left, Yellow on the right." />
        <div style={grid}>
          {Array.from({ length: 3 }, (_, i) => [<PictureCard key={`r${i}`} side="right" />, <PictureCard key={`l${i}`} side="left" />])}
          <CoachCard />
          <CoachCard />
        </div>
      </Page>
    </>
  );
}

// ---------------------------------------------------------------- player cards

function JobCard({ label }: { label: string }) {
  const sys = useSys();
  const pos = sys.positions.find((p) => p.label === label) ?? sys.positions.find((p) => (label.endsWith('G') ? p.label === 'G' : label.endsWith('T') ? p.label === 'T' : false));
  const rows = sys.jobsFor(label);
  return (
    <div style={{ border: '1.5px dashed #000', padding: '0.1in', breakInside: 'avoid', height: '4.85in', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, borderBottom: '1.5px solid #000', marginBottom: 3 }}>
        <span style={{ fontSize: '20pt', fontWeight: 900 }}>{label}</span>
        <span style={{ fontSize: '11pt', fontWeight: 800 }}>{pos?.kid}</span>
        <span style={{ fontSize: '7.5pt', color: '#444' }}>{pos?.lineup}</span>
      </div>
      {rows.map(({ concept: c, red, yellow }) => (
        <div key={c.key} style={{ display: 'grid', gridTemplateColumns: '1.2in 1fr', borderBottom: '0.5px solid #ccc', padding: '2px 0', fontSize: '10pt', lineHeight: 1.3 }}>
          <b>
            {c.n} {c.kid}
          </b>
          <span>
            {yellow ? (
              <>
                {sideChip('right', 'RED')} {red} <br />
                {sideChip('left', 'YELLOW')} {yellow}
              </>
            ) : (
              red
            )}
          </span>
        </div>
      ))}
    </div>
  );
}

function PlayerCards() {
  const sys = useSys();
  const pages: string[][] = [];
  for (let i = 0; i < sys.jobLabels.length; i += 2) pages.push(sys.jobLabels.slice(i, i + 2));
  return (
    <>
      {pages.map((labels) => (
        <Page key={labels.join()} pad={0.4}>
          <TitleBar title={`${sys.short} · MY JOBS`} right={`"${sys.sideWords.wing} side" = the color side. ${sys.blocking.rules.map((r) => r.title).join(" · ")}`} />
          <div style={{ display: 'grid', gridTemplateRows: `repeat(${labels.length}, auto)`, gap: 8 }}>
            {labels.map((l) => (
              <JobCard key={l} label={l} />
            ))}
          </div>
        </Page>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- install plan

export function Install() {
  const sys = useSys();
  const chunks = [sys.install.slice(0, 4), sys.install.slice(4, 8), sys.install.slice(8)];
  return (
    <>
      {chunks.map((weeks, i) => (
        <Page key={i} pad={0.4}>
          <TitleBar title={`${sys.short} · INSTALL PLAN (${i + 1}/${chunks.length})`} right="Do not add the next week until the checks pass." />
          <div style={{ display: 'grid', gridTemplateRows: 'repeat(4, 1fr)', gap: 6, flex: 1, minHeight: 0 }}>
            {weeks.map((w) => (
              <div key={w.week} style={{ border: '1.5px solid #000', padding: '0.06in', overflow: 'hidden', fontSize: '8.5pt' }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'baseline', borderBottom: '1px solid #000', marginBottom: 2, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '13pt', fontWeight: 900 }}>WEEK {w.week}</span>
                  <span style={{ fontWeight: 800 }}>{w.title}</span>
                  {w.adds.map((k) => (
                    <span key={k} style={{ background: '#000', color: '#fff', padding: '0 4px', fontWeight: 800 }}>
                      {sys.conceptByKey.get(k)!.n} {sys.conceptByKey.get(k)!.kid}
                    </span>
                  ))}
                  {w.formations.map((k) => (
                    <span key={k} style={{ border: '1px solid #000', padding: '0 4px' }}>
                      {sys.formationSpecs.find((f) => f.key === k)!.name}
                    </span>
                  ))}
                </div>
                <div><b>Line:</b> {w.line}</div>
                <div><b>Backs and receivers:</b> {w.skill}</div>
                <div><b>Calling:</b> {w.calling}</div>
                <div><b>Drills:</b> {w.drills.join(' · ')}</div>
                <div>
                  <b>Ready when:</b> {w.readyWhen.map((r) => <span key={r}>&#9744; {r} &nbsp;</span>)}
                </div>
              </div>
            ))}
            {weeks.length < 4 && <div />}
          </div>
        </Page>
      ))}
    </>
  );
}

// ---------------------------------------------------------------- teaching sheet

function Teach() {
  const sys = useSys();
  return (
    <Page pad={0.4}>
      <TitleBar title={`${sys.title.toUpperCase()} · HOW WE TALK`} right={sys.subtitle} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, fontSize: '9.5pt' }}>
        <div>
          <h3 style={{ fontSize: '12pt', fontWeight: 900 }}>1. Color = side</h3>
          <p>{sideChip('right', 'RED')} {sys.colorMeans.right}.</p>
          <p>{sideChip('left', 'YELLOW')} {sys.colorMeans.left}.</p>
          <h3 style={{ fontSize: '12pt', fontWeight: 900, marginTop: 6 }}>2. Number = the play</h3>
          <p>&ldquo;Red 2&rdquo; = {sys.concepts[1].kid} to the Red side. Look at your wristband.</p>
          <h3 style={{ fontSize: '12pt', fontWeight: 900, marginTop: 6 }}>3. Play number = who and where</h3>
          <p>First number = who gets the ball. Second number = the hole. Even right, odd left.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <HoleChart width={340} />
        </div>
      </div>
      {sys.blocking.rules.map((rule) => (
        <div key={rule.key} style={{ border: '2px solid #000', padding: 5, margin: '6px 0' }}>
          <div style={{ fontSize: '12pt', fontWeight: 900 }}>
            LINEMEN: {rule.title.toUpperCase()} <span style={{ fontSize: '8.5pt', fontWeight: 600 }}>({rule.usedOn})</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${rule.steps.length}, 1fr)`, gap: 8 }}>
            {rule.steps.map((st) => (
              <div key={st.letter + st.word}>
                <div style={{ fontSize: '22pt', fontWeight: 900, lineHeight: 1 }}>{st.letter}</div>
                <div style={{ fontWeight: 800 }}>{st.word}</div>
                {st.ask && <div>{st.ask}</div>}
                <div style={{ fontWeight: 700 }}>{st.then}</div>
              </div>
            ))}
          </div>
        </div>
      ))}
      <div style={{ fontSize: '9pt', marginBottom: 6 }}>{sys.blocking.inside}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 10, fontSize: '8.5pt' }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: '11pt' }}>WHO IS WHO</div>
          {sys.positions.map((p) => (
            <div key={p.label}>
              <b>
                {p.label} {p.kid}:
              </b>{' '}
              {p.job}
            </div>
          ))}
        </div>
        <div>
          <div style={{ fontWeight: 900, fontSize: '11pt' }}>THE 10 PLAYS</div>
          {sys.concepts.map((c) => (
            <div key={c.key}>
              <b>
                {c.n} {c.kid}:
              </b>{' '}
              {c.kidSays}
            </div>
          ))}
          <div style={{ fontWeight: 900, fontSize: '11pt', marginTop: 6 }}>READING A PICTURE</div>
          {sys.legend.map((l) => (
            <div key={l.mark}>
              <b>{l.mark}:</b> {l.means}
            </div>
          ))}
          <div style={{ fontWeight: 900, fontSize: '11pt', marginTop: 6 }}>SNAP COUNT</div>
          <div>{sys.cadence}</div>
          {sys.days.map((d) => (
            <div key={d.day}>
              <b>{d.day}:</b> {d.means}
            </div>
          ))}
        </div>
      </div>
    </Page>
  );
}

// ---------------------------------------------------------------- page

export function YouthPrint({ id, sheet }: { id: string; sheet: YouthSheet }) {
  const sys = youthSystem(id)!;
  const landscape = LANDSCAPE.includes(sheet);
  return (
    <SysContext.Provider value={sys}>
    <div style={{ background: '#e5e5e5', minHeight: '100vh', paddingBottom: '0.5in' }}>
      <style>{`@media print { @page { size: letter ${landscape ? 'landscape' : 'portrait'}; margin: 0; } }`}</style>
      <div className="no-print" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', background: '#000', color: '#fff', marginBottom: 12, flexWrap: 'wrap' }}>
        <Link href={`/systems/${sys.id}#print`} style={{ fontWeight: 700 }}>
          &larr; {sys.title}
        </Link>
        {(Object.keys(SHEET_NAMES) as YouthSheet[]).map((s) => (
          <Link key={s} href={`/systems/${sys.id}/print?sheet=${s}`} style={{ padding: '2px 8px', borderRadius: 4, background: s === sheet ? '#fff' : 'transparent', color: s === sheet ? '#000' : '#ddd' }}>
            {SHEET_NAMES[s]}
          </Link>
        ))}
        <button onClick={() => window.print()} style={{ marginLeft: 'auto', background: '#fff', color: '#000', fontWeight: 700, padding: '2px 10px', borderRadius: 4 }}>
          Print ({landscape ? 'landscape' : 'portrait'})
        </button>
      </div>
      {sheet === 'callsheet' && <CallSheet />}
      {sheet === 'wristband' && <Wristbands />}
      {sheet === 'jobs' && <PlayerCards />}
      {sheet === 'install' && <Install />}
      {sheet === 'teach' && <Teach />}
    </div>
    </SysContext.Provider>
  );
}
