/**
 * Write a Film Lab import file for a charted week: every play of the split video with its start and end,
 * and the chart filled in for the Eagles' offensive snaps (system formation word, strength, adjust tags,
 * motion word, backfield, plus the game columns the workbook already had).
 *
 *   node scripts/film/filmlab_export.mjs 1 source/film/w1 "GAME.mp4 file name" OUT.json
 *
 * In Film Lab: load the video, then Import and pick OUT.json. Film Lab must have the video loaded first.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [week, dir, videoFileName, out] = process.argv.slice(2);
const wk = Number(week);
const seed = JSON.parse(readFileSync('src/seeds/data/eagles2026.json', 'utf8'));
const { plays } = JSON.parse(readFileSync(path.join(dir, 'plays.json'), 'utf8'));
const map = JSON.parse(readFileSync(path.join(dir, 'map.json'), 'utf8'));

const formations = new Map(seed.formations.map((f) => [f.id, f]));
const snaps = new Map(seed.snaps.filter((s) => s.week === wk).map((s) => [s.playId, s]));
const byPlay = new Map(map.snaps.filter((m) => m.play != null).map((m) => [m.play, m.id]));
// a play number can hold two snaps (a false start and the replayed down share a clip): keep the first, note the rest
const extra = new Map();
for (const m of map.snaps) {
  if (m.play == null) continue;
  if (byPlay.get(m.play) !== m.id) extra.set(m.play, [...(extra.get(m.play) ?? []), m.id]);
}

const str = (v) => (v === undefined || v === null ? '' : String(v));
const ADJUST_WORDS = new Set(['Close', 'Closer', 'Clamp', 'Click', 'Open', 'Out', 'Off', 'Tight', 'Tighter', 'Slot', 'Zoom', 'Hip', 'Hop', 'Ace', 'Numbers', 'Edge', 'Extend']);

function chartFor(id) {
  const s = snaps.get(id);
  if (!s) return { wk: str(wk), side: 'Offense', notes: `${id}: not in the PlayForge chart` };
  const f = formations.get(s.formationId);
  const sys = f?.system;
  const tags = (sys?.tags ?? []).filter((t) => ADJUST_WORDS.has(t));
  const letter = (sys?.tags ?? []).find((t) => /^[A-G]$/.test(t));
  const notes = [
    id,
    f ? `Call: ${f.name}${sys?.back ? ` (back ${sys.back})` : ''}` : '',
    letter ? `Empty, back at ${letter}` : '',
    s.motion ? `Motion: ${s.motion}` : '',
    sys?.alternates?.length ? `Same picture: ${sys.alternates.join(', ')}` : '',
    sys?.confidence === 'closest' ? 'Closest word, check' : '',
    s.notes ? s.notes.split(' | ')[0] : '',
  ].filter(Boolean);
  return {
    wk: str(wk),
    side: 'Offense',
    qtr: str(s.quarter),
    down: str(s.down),
    dist: str(s.distance),
    fieldZone: str(s.fieldZone),
    hash: str(s.hash),
    personnel: str(s.personnel),
    formFamily: str(sys?.family ?? s.formFamily),
    formation: str(sys?.base),
    strength: str(sys?.strength ?? s.strength),
    adjust: tags.length > 1 ? tags.join(' ') : (tags[0] ?? ''),
    motion: str(s.motionCall),
    backfield: letter ? 'Empty' : str(s.backfield),
    playType: /^(run|pass|other)$/.test(str(s.playType)) ? '' : str(s.playType),
    target: str(s.target),
    result: str(s.result),
    yds: str(s.yards),
    pfLink: f ? `/formations/${f.id}` : '',
    notes: notes.join(' | '),
  };
}

let drive = 0;
let inDrive = false;
const rows = plays.map((p) => {
  const id = byPlay.get(p.n);
  if (id && !inDrive) drive++;
  inDrive = !!id;
  const chart = id ? chartFor(id) : { wk: str(wk) };
  if (id && extra.has(p.n)) chart.notes += ` | also in this clip: ${extra.get(p.n).join(', ')}`;
  for (const k of Object.keys(chart)) if (chart[k] === '') delete chart[k];
  return { playNumber: p.n, startTime: p.sl[0], endTime: (p.ez ?? p.sl)[1], driveNumber: Math.max(1, drive), chart };
});

writeFileSync(out, JSON.stringify({ videoFileName, plays: rows, timestamp: new Date().toISOString() }, null, 2));
const charted = rows.filter((r) => r.chart.side === 'Offense').length;
console.log(`${rows.length} plays (${charted} Eagles offensive snaps charted, ${drive} drives) -> ${out}`);
