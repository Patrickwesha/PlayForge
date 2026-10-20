/**
 * Dump the Beast Offense 2026 playbook as animation-ready JSON for the teaching videos (HyperFrames):
 * every formation and play with absolute player spots and absolute path points in yards, plus every job.
 *
 *   npx tsx scripts/export-beast-video-data.ts [out.json]
 *
 * Coordinates: yards, x = 0 at the ball (+ = the offense's right), y = 0 at the line of scrimmage (+ = downfield).
 */
import { writeFileSync } from 'node:fs';
import { resolvePoints } from '@/geometry/path';
import { CADENCE, COLORS, CONCEPTS, DAYS, GOD, HOLES, INSTALL, POSITIONS } from '@/systems/beast/content';
import { BEAST_FORMATIONS, BEAST_PLAYS, FORMATION_SPECS, jobsFor } from '@/systems/beast/plays';

const out = process.argv[2] ?? 'renders/beast-2026/beast-2026.video-data.json';
const r = (n: number) => Math.round(n * 100) / 100;

const kindOf = (p: { role: string; end: string; line: string; color?: string; primary?: boolean }) =>
  p.role === 'ball' ? 'throw' : p.color === 'red' ? 'ball-carrier' : p.line === 'dashed' ? 'fake' : p.role === 'block' ? (p.end === 'arrow' ? 'pull-lead' : 'block') : p.end === 'dot' ? 'qb-action' : p.primary ? 'route-first-look' : 'route';

const data = {
  about: 'Beast Offense 2026, 2nd and 3rd grade. Yards: x = 0 at the ball (+ right), y = 0 at the line (+ downfield).',
  language: {
    colors: { right: COLORS.right.word, left: COLORS.left.word, rule: 'The color is the side the Y and both wings line up on.' },
    numbers: HOLES.rule,
    holes: HOLES,
    cadence: CADENCE,
    days: DAYS,
    god: GOD,
    positions: POSITIONS,
  },
  formations: FORMATION_SPECS.map((s, i) => ({
    key: s.key,
    name: BEAST_FORMATIONS[i].name,
    cue: s.cue,
    players: Object.values(BEAST_FORMATIONS[i].players).map((p) => ({ label: p.label, x: r(p.x), y: r(p.y), role: p.role })),
  })),
  concepts: CONCEPTS.map((c) => ({
    number: c.n,
    kidName: c.kid,
    coachName: c.coach,
    kind: c.kind,
    carrier: c.carrier,
    where: c.where,
    goesWithTheWings: c.withWings,
    kidsSay: c.kidSays,
    coachNote: c.coachNote,
    handSignal: c.signal,
    checkWithMeWords: c.cities,
    installWeek: c.week,
    jobs: Object.fromEntries(['1', '2', '3', '4', 'Y', 'F', 'LT', 'LG', 'C', 'RG', 'RT'].map((l) => {
      const j = jobsFor(l).find((x) => x.concept.key === c.key)!;
      return [l, j.yellow ? { red: j.red, yellow: j.yellow } : j.red];
    })),
    plays: BEAST_PLAYS.filter((p) => p.tags.includes(c.key)).map((p) => ({
      color: p.tags.includes('red') ? 'Red' : 'Yellow',
      call: p.name,
      wristband: p.wristband,
      players: Object.values(p.diagram.players).map((pl) => ({ label: pl.label, x: r(pl.x), y: r(pl.y) })),
      paths: Object.values(p.diagram.paths).map((path) => {
        const who = path.anchor.kind === 'player' ? p.diagram.players[path.anchor.playerId] : undefined;
        return {
          who: who?.label,
          kind: kindOf(path),
          end: path.end,
          curved: path.points.some((pt) => pt.smooth),
          points: resolvePoints(path, p.diagram.players).map((pt) => ({ x: r(pt.x), y: r(pt.y) })),
        };
      }),
      text: Object.values(p.diagram.annotations).map((a) => (a.kind === 'text' ? a.text : '')).filter(Boolean),
    })),
  })),
  install: INSTALL,
};

writeFileSync(out, JSON.stringify(data, null, 1));
console.log(`${out}: ${data.formations.length} formations, ${data.concepts.length} concepts, ${data.concepts.reduce((n, c) => n + c.plays.length, 0)} plays`);
