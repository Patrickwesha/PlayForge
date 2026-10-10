import type { Annotation, Formation, Path, PathPoint, Play, Player, PlayerMotion, Point, TextAnnotation } from '@/model/types';
import { SEED_TIME } from '@/model/seedRules';
import { applyCallTags, assertSevenOnLine } from '@/geometry/formationTags';
import { flipPlayer } from '@/geometry/flip';
import { fieldLandmarks, nearestLandmark } from '@/geometry/landmarks';
import { PACKERS_2019_FORMATIONS, PACKERS_2019_ID_PREFIX } from '@/seeds/packers2019';
import type { RamsPath, RamsPlaySpec, RamsSpot } from './types';

/**
 * A Rams 2022 cell -> a PlayForge play in the Eagles / Green Bay system.
 *
 *  1. The offense stands on the pack formation (the Rams picture read onto the editor's landmarks) when the
 *     call names one, else on the base formation with the call's tags applied by the tag engine, else on the
 *     drawing's own spots snapped to the nearest landmark (flagged needs-review).
 *  2. The drawing is then warped onto that formation: a monotone x map built from every drawn player's spot
 *     to his final spot (so a crosser still crosses between the same men and a sideline route still widens
 *     with the split), and each player's lines ride with his own depth.
 *  3. Routes, blocks, fakes and motions come from the drawing's line work, the labels become annotations,
 *     the defenders keep their alignment over the line, and the page's paraphrased rules go on the players.
 */
export const RAMS_2022_PLAY_ID_PREFIX = 'rams22-';
export const RAMS_2022_PLAYBOOK_ID = 'rams-2022-book';
export const RAMS_2022_TAG = 'rams-2022';
export const RAMS_2022_SOURCE = 'Rams 2022 (McVay), rebuilt in the Eagles 2026 system';

const OL: RamsSpot[] = ['LT', 'LG', 'C', 'RG', 'RT'];
const PACK = new Map(PACKERS_2019_FORMATIONS.map((f) => [f.id, f]));
const FORMATION_WORDS = [...new Set(PACKERS_2019_FORMATIONS.map((f) => f.name.toUpperCase().split(' RT')[0]))];
const LANDMARKS = fieldLandmarks('nfl');
const r2 = (n: number) => Math.round(n * 100) / 100 + 0;

type Placed = { players: Player[]; how: 'pack' | 'tags' | 'drawing'; review: string[]; applied: string[]; notes: string[] };

/** Spot name of a pack player (ids end in -lt, -y, -qb ...). */
function spotOf(p: Player): RamsSpot {
  const tail = p.id.split('-').pop()?.toUpperCase() ?? '';
  if (tail === 'QB') return 'Q';
  return (tail as RamsSpot) || 'U';
}

function packPlayers(key: string, playId: string): Player[] | undefined {
  const f = PACK.get(`${PACKERS_2019_ID_PREFIX}${key}`);
  if (!f) return undefined;
  return Object.values(f.players).map((p) => ({ ...p, id: `${playId}-${spotOf(p).toLowerCase()}` }));
}

/** Which side of the quarterback the back stands on in the drawing, in strong-right space. */
function gunBackSide(spec: RamsPlaySpec): '(+)' | '(-)' | null {
  const h = spec.offense.H;
  const q = spec.offense.Q;
  if (!h || !q || q[1] > -3) return null;
  if (Math.abs(h[0] - q[0]) < 0.6) return null;
  const strong = spec.formation?.direction === 'LT' ? -1 : 1;
  return (h[0] - q[0]) * strong > 0 ? '(+)' : '(-)';
}

function placeFromDrawing(spec: RamsPlaySpec, playId: string): Placed {
  const players: Player[] = [];
  const review: string[] = ['The call names no pack formation, so every man stands on the drawing’s spot snapped to the nearest landmark. Check the alignment.'];
  const off = spec.offense;
  const mk = (spot: RamsSpot, x: number, y: number): Player => ({
    id: `${playId}-${spot.toLowerCase()}`,
    side: 'offense',
    symbol: spot === 'C' ? 'square' : 'circle',
    label: OL.includes(spot) ? '' : spot,
    x: r2(x),
    y: r2(y),
    role: spot === 'C' ? 'C' : OL.includes(spot) ? 'OL' : spot === 'Q' ? 'QB' : spot === 'H' ? 'RB' : spot === 'Y' ? 'TE' : spot === 'F' ? (spec.personnel?.startsWith('1') ? 'WR' : 'RB') : 'WR',
  });
  for (const [spot, x] of [['LT', -2], ['LG', -1], ['C', 0], ['RG', 1], ['RT', 2]] as [RamsSpot, number][]) players.push(mk(spot, x, 0));
  const q = off.Q;
  const gun = !!q && q[1] < -3;
  players.push(mk('Q', 0, gun ? -5 : -1));
  const h = off.H;
  if (h) players.push(mk('H', gun ? (Math.abs(h[0]) < 0.6 ? 0 : Math.sign(h[0]) * 1.5) : Math.abs(h[0]) < 1 ? 0 : Math.sign(h[0]) * 2, gun ? (Math.abs(h[0]) < 0.6 ? -7 : -6) : Math.abs(h[0]) < 1 ? -7.5 : -5));
  for (const spot of ['X', 'Y', 'Z', 'F'] as RamsSpot[]) {
    const s = off[spot];
    if (!s) continue;
    const [dx, dy] = s;
    let x: number;
    if (dy < -2.5) {
      // a back
      players.push(mk(spot, Math.abs(dx) < 1 ? 0 : Math.sign(dx) * 2, -5));
      continue;
    }
    if (Math.abs(dx) <= 3.4) x = Math.sign(dx || 1) * 3;
    else if (Math.abs(dx) <= 4.4) x = Math.sign(dx) * 4;
    else {
      const lm = nearestLandmark(
        LANDMARKS.filter((l) => Math.sign(l.x) === Math.sign(dx) && Math.abs(l.x) >= 6),
        dx * 2.6,
      );
      x = lm ? lm.x : Math.sign(dx) * 18.67;
    }
    players.push(mk(spot, x, Math.abs(dy) < 0.5 ? 0 : -1));
  }
  // seven on the line: the engine's rule; if the drawing breaks it, say so rather than throw
  const onLine = players.filter((p) => p.y > -0.5).length;
  if (onLine !== 7) review.push(`${onLine} men on the line in the drawing, not 7: check who is on and off the ball.`);
  return { players, how: 'drawing', review, applied: [], notes: [] };
}

/**
 * Some cells draw the mirror of their header (a left-side run drawn with the bunch on the right under the same
 * "Bunch L" line). The drawing is the truth for the picture, so the placed formation flips to match it.
 */
function matchDrawingSide(placed: Placed, spec: RamsPlaySpec): Placed {
  const skill: RamsSpot[] = ['X', 'Y', 'Z', 'F', 'U', 'H'];
  const bySpot = new Map(placed.players.map((p) => [p.label as RamsSpot, p]));
  let agree = 0;
  let disagree = 0;
  for (const s of skill) {
    const d = spec.offense[s];
    const p = bySpot.get(s);
    if (!d || !p || Math.abs(d[0]) < 1 || Math.abs(p.x) < 1) continue;
    if (Math.sign(d[0]) === Math.sign(p.x)) agree++;
    else disagree++;
  }
  if (disagree <= agree) return placed;
  return {
    ...placed,
    players: placed.players.map((p) => flipPlayer(p, { landmarks: LANDMARKS })),
    review: [...placed.review, 'The book draws this cell as the mirror of its formation line; the picture follows the drawing.'],
  };
}

/** The book draws a gun look the call line does not name: the QB goes to gun depth and the back beside him. */
function matchDrawingDepth(placed: Placed, spec: RamsPlaySpec): Placed {
  const q = spec.offense.Q;
  const qp = placed.players.find((p) => p.label === 'Q');
  if (!q || !qp || q[1] > -3 || qp.y < -3) return placed;
  const players = placed.players.map((p) => {
    if (p.label === 'Q') return { ...p, y: -5 };
    const d = p.label ? spec.offense[p.label as RamsSpot] : undefined;
    if (d && d[1] < -2.5 && p.y < -2.5 && Math.abs(d[1] - q[1]) < 1.2) return { ...p, x: r2(d[0] - q[0]), y: -5 };
    return p;
  });
  return { ...placed, players, review: [...placed.review, 'Drawn from the gun; the formation line does not say Gun.'] };
}

function placeFormation(spec: RamsPlaySpec, playId: string): Placed {
  return matchDrawingDepth(matchDrawingSide(placeFormationAsCalled(spec, playId), spec), spec);
}

function placeFormationAsCalled(spec: RamsPlaySpec, playId: string): Placed {
  const f = spec.formation;
  const direction = f?.direction ?? 'RT';
  const mirror = (ps: Player[]) => (direction === 'LT' ? ps.map((p) => flipPlayer(p, { landmarks: LANDMARKS })) : ps);
  const gun = !!f?.gun || (spec.runNumber ?? 0) >= 30 || (spec.offense.Q?.[1] ?? 0) < -3;
  const side = gunBackSide(spec);
  // exact pack formation
  if (spec.packKey) {
    const base = packPlayers(spec.packKey, playId);
    if (base) {
      const extra = [...(gun && !base.some((p) => p.role === 'QB' && p.y < -4) ? ['GUN'] : []), ...(gun && side ? [side] : [])];
      if (extra.length) {
        try {
          const t = applyCallTags(base, { pre: null, post: extra, direction, personnel: spec.packPersonnel ?? undefined, formationWords: FORMATION_WORDS });
          return { players: mirror(t.players), how: 'pack', review: t.review, applied: t.applied.map((a) => a.tag), notes: t.notes };
        } catch {
          /* fall through to the plain pack */
        }
      }
      return { players: mirror(base), how: 'pack', review: [], applied: [], notes: [] };
    }
  }
  // base formation plus the call's tags
  if (spec.baseKey && f) {
    const base = packPlayers(spec.baseKey, playId);
    if (base) {
      const post = [...f.tags.map((t) => t.toUpperCase()), ...(gun ? ['GUN'] : []), ...(gun && side ? [side] : [])];
      try {
        const t = applyCallTags(base, { pre: null, post, direction, personnel: spec.personnel ?? undefined, formationWords: FORMATION_WORDS });
        const review = [...t.review];
        if (t.ignored.length) review.push(`Words the tag engine does not know: ${t.ignored.join(', ')}. The drawing shows the spot; check the alignment.`);
        return { players: mirror(t.players), how: 'tags', review, applied: t.applied.map((a) => (a.player ? `${a.player} ${a.tag}` : a.tag)), notes: t.notes };
      } catch (e) {
        const d = placeFromDrawing(spec, playId);
        d.review.unshift(`Tags could not be applied to ${f.base}: ${e instanceof Error ? e.message : String(e)}`);
        return d;
      }
    }
  }
  return placeFromDrawing(spec, playId);
}

/** Final players by drawing spot: linemen by x order, the rest by letter. */
function bySpot(players: Player[]): Map<RamsSpot, Player> {
  const m = new Map<RamsSpot, Player>();
  const line = players.filter((p) => p.role === 'OL' || p.role === 'C').sort((a, b) => a.x - b.x);
  OL.forEach((s, i) => line[i] && m.set(s, line[i]));
  for (const p of players) {
    if (p.role === 'QB') m.set('Q', p);
    else if (p.label && /^[XYZFH]$/.test(p.label)) m.set(p.label as RamsSpot, p);
  }
  return m;
}

/** Monotone piecewise-linear x map from the drawing's frame to the field. */
function makeWarp(spec: RamsPlaySpec, final: Map<RamsSpot, Player>): (x: number) => number {
  const knots: [number, number][] = [];
  for (const [spot, pos] of Object.entries(spec.offense) as [RamsSpot, [number, number]][]) {
    const p = final.get(spot);
    if (!p || !pos) continue;
    if (pos[1] < -2.5 || p.y < -2.5) continue; // backs do not stretch the field
    knots.push([pos[0], p.x]);
  }
  knots.sort((a, b) => a[0] - b[0]);
  // keep the map monotone: drop a knot that goes backwards
  const keep: [number, number][] = [];
  for (const k of knots) {
    if (keep.length && (k[0] - keep[keep.length - 1][0] < 0.2 || k[1] <= keep[keep.length - 1][1])) continue;
    keep.push(k);
  }
  if (keep.length < 2) return (x) => x;
  // the drawing is compressed sideways only out where the wide receivers stand: line work near the formation's
  // core (blocks, bars, backfield tracks) keeps its true length for a yard past the last man in the core
  const buffered: [number, number][] = [...keep];
  for (let i = 0; i < keep.length - 1; i++) {
    const [a, b] = [keep[i], keep[i + 1]];
    const stretched = b[0] - a[0] > 2 && (b[1] - a[1]) / (b[0] - a[0]) > 1.6;
    if (!stretched) continue;
    // the knot nearer the ball is the core side: a yard of true length past it, then the stretch out to the wide man
    if (Math.abs(a[0]) <= Math.abs(b[0])) buffered.push([a[0] + 1, a[1] + 1]);
    else buffered.push([b[0] - 1, b[1] - 1]);
  }
  const dedup: [number, number][] = [];
  for (const k of buffered.sort((a, b) => a[0] - b[0])) if (!dedup.length || (k[0] - dedup[dedup.length - 1][0] > 0.2 && k[1] > dedup[dedup.length - 1][1])) dedup.push(k);
  keep.splice(0, keep.length, ...dedup);
  return (x: number) => {
    if (x <= keep[0][0]) return keep[0][1] + (x - keep[0][0]);
    const last = keep[keep.length - 1];
    if (x >= last[0]) return last[1] + (x - last[0]);
    for (let i = 0; i < keep.length - 1; i++) {
      const [a, fa] = keep[i];
      const [b, fb] = keep[i + 1];
      if (x >= a && x <= b) return fa + ((x - a) / (b - a)) * (fb - fa);
    }
    return x;
  };
}

// The front seven stand where the book drew them (their letters sit just above the bars the blocks end on);
// the drawing's secondary is shallow, so the backs go deeper.
const DEF_Y = (role: 'DL' | 'LB' | 'DB', y: number) => (role === 'DL' ? Math.max(1.8, y) : role === 'LB' ? Math.max(1.8, Math.min(7, y)) : Math.max(4.5, y * 1.3));

function pathFrom(spec: RamsPlaySpec, rp: RamsPath, owner: Player | undefined, warp: (x: number, y: number) => number, yMap: (y: number) => number, id: string): Path | null {
  const pts = rp.pts.map(([x, y, smooth]) => ({ x: warp(x, y), y: yMap(y), smooth: smooth === 1 }));
  if (pts.length < 2) return null;
  const length = pts.reduce((n, p, i) => (i ? n + Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) : 0), 0);
  if (length < 0.4) return null;
  const end: Path['end'] = rp.end === 'arrow' ? 'arrow' : rp.end === 'tbar' ? 'tbar' : rp.end === 'dot' ? 'dot' : 'none';
  const role: Path['role'] = rp.role === 'ball' ? 'ball' : rp.role === 'block' ? 'block' : rp.role === 'route' ? 'route' : 'free';
  if (!owner) {
    // a bar several stems meet (a double team) is a block line of its own, with no end mark
    return { id, anchor: { kind: 'free' }, points: pts.map((p, i) => ({ x: r2(p.x), y: r2(p.y), ...(p.smooth && i > 0 && i < pts.length - 1 ? { smooth: true } : {}) })), end: rp.role === 'bar' ? 'none' : end, line: rp.dashed ? 'dashed' : 'solid', role: rp.role === 'bar' ? 'block' : 'free' };
  }
  // the book's curves stay curves: a point sampled from a bezier is smooth (never the two ends of the line)
  const rel: PathPoint[] = pts.map((p, i) => ({ x: r2(p.x - owner.x), y: r2(p.y - owner.y), ...(p.smooth && i > 0 && i < pts.length - 1 ? { smooth: true } : {}) }));
  // a line that starts at the man starts at his center (the symbol hides the stub)
  if (!rp.branch && Math.hypot(rel[0].x, rel[0].y) < 2) rel[0] = { x: 0, y: 0 };
  return { id, anchor: { kind: 'player', playerId: owner.id }, points: rel, end, line: rp.dashed ? 'dashed' : 'solid', role, ...(role === 'ball' ? { primary: true } : {}) };
}

/** The book's boxed notes are short lines; a long note wraps so it stays inside the picture. */
function wrapNote(text: string, width = 22): string {
  if (text.length <= width) return text;
  const lines: string[] = [];
  let line = '';
  for (const w of text.split(/\s+/)) {
    if (line && (line + ' ' + w).length > width) {
      lines.push(line);
      line = w;
    } else line = line ? line + ' ' + w : w;
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

function motionTag(spec: RamsPlaySpec, spot: RamsSpot): string {
  const m = spec.formation?.motions.find((x) => x.player === spot) ?? spec.formation?.motions.find((x) => !x.player);
  if (!m) return 'MOTION';
  const w = m.word === 'across' ? (spec.formation?.direction === 'LT' ? 'RT' : 'LT') : m.word;
  return w.toUpperCase();
}

const LABEL_STYLE: Record<RamsPlaySpec['labels'][number]['kind'], Partial<TextAnnotation>> = {
  block: { style: 'redCaps', size: 'sm' },
  route: { style: 'plain', size: 'sm' },
  depth: { style: 'plain', size: 'sm', color: 'brown' },
  progression: { style: 'bold', size: 'sm', color: 'blue' },
  note: { style: 'plain', size: 'sm', color: 'blue' },
};

export function composeRamsPlay(spec: RamsPlaySpec): Play {
  const id = `${RAMS_2022_PLAY_ID_PREFIX}${spec.key}`;
  const placed = placeFormation(spec, id);
  const players = placed.players.map((p) => ({ ...p, x: r2(p.x), y: r2(p.y) }));
  const final = bySpot(players);
  const warp = makeWarp(spec, final);
  // The drawing's backfield is shallower than the real alignment (the book's HB stands at 7.5, drawn about 4.7):
  // a back's line keeps its crossing point and everything past the line, and its backfield part stretches to
  // start at the man. Men on or near the line keep the drawing's depths as they are.
  // The drawing squeezes the wide men in; the field warp stretches them back out. A man's own line work keeps
  // its drawn shape within a few yards of him (a 3-yard hook stays 3 yards), and only further off follows the
  // field warp, so a crossing route still reaches the middle of the field.
  const warpFor = (spot: RamsSpot | null): ((x: number) => number) => {
    if (!spot) return warp;
    const p = final.get(spot);
    const d = spec.offense[spot];
    if (!p || !d) return warp;
    const ox = d[0];
    const fx = p.x;
    return (x) => {
      const w = Math.min(1, Math.max(0, (Math.abs(x - ox) - 4) / 4));
      return w * warp(x) + (1 - w) * (fx + (x - ox));
    };
  };
  // A shared bar (a double team, the dashed bar at the backer) stays one straight bar of its drawn length, placed
  // by the field warp at its middle; every line point on the bar (the stems' ends, the climbs' starts) maps in the
  // bar's frame, so the combo stays connected and straight and a stem bends a little instead.
  const bars = spec.freePaths
    .filter((fp) => fp.role === 'bar' && fp.pts.length >= 2)
    .map((fp) => {
      const cx = (fp.pts[0][0] + fp.pts[fp.pts.length - 1][0]) / 2;
      const wx = warp(cx);
      return { pts: fp.pts, frame: (x: number) => wx + (x - cx) };
    });
  const onBar = (x: number, y: number) => {
    for (const b of bars) {
      for (let i = 0; i + 1 < b.pts.length; i++) {
        const [ax, ay] = b.pts[i];
        const [bx, by] = b.pts[i + 1];
        const dx = bx - ax;
        const dy = by - ay;
        const n2 = dx * dx + dy * dy || 1e-9;
        const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / n2));
        if (Math.hypot(x - (ax + t * dx), y - (ay + t * dy)) < 0.45) return b;
      }
    }
    return null;
  };
  const withBars = (f: (x: number) => number) => (x: number, y: number) => {
    const b = onBar(x, y);
    return b ? b.frame(x) : f(x);
  };
  const yMapOf = (spot: RamsSpot | null): ((y: number) => number) => {
    if (!spot) return (y) => y;
    const p = final.get(spot);
    const d = spec.offense[spot];
    if (!p || !d || d[1] > -0.5 || p.y > -0.5) return (y) => y;
    const k = p.y / d[1];
    return (y) => (y < 0 ? y * k : y);
  };
  const paths: Record<string, Path> = {};
  const annotations: Record<string, Annotation> = {};
  let n = 0;
  const review = [...placed.review, ...spec.warnings];
  for (const rp of spec.paths) {
    const owner = rp.spot ? final.get(rp.spot) : undefined;
    if (rp.role === 'motion' && owner && rp.ghost) {
      const from: Point = { x: r2(warp(rp.ghost[0])), y: r2(Math.min(-1, yMapOf(rp.spot)(rp.ghost[1]))) };
      const inner = rp.pts.slice(1, -1).map(([x, y]) => ({ x: r2(warp(x)), y: r2(Math.min(-1, yMapOf(rp.spot)(y))) }));
      const motion: PlayerMotion = { from, tag: motionTag(spec, rp.spot as RamsSpot), kind: 'motion', ...(inner.length ? { via: inner } : {}) };
      owner.motion = motion;
      continue;
    }
    const path = pathFrom(spec, rp, owner, withBars(warpFor(rp.spot)), yMapOf(rp.spot), `${id}-p${n++}`);
    if (path) paths[path.id] = path;
  }
  for (const rp of spec.freePaths) {
    const path = pathFrom(spec, rp, undefined, withBars(warp), (y) => y, `${id}-p${n++}`);
    if (path) paths[path.id] = path;
  }
  // a ghost with no motion line: still a pre-snap spot worth showing
  for (const g of spec.ghosts) {
    const taken = players.some((p) => p.motion && Math.hypot(p.motion.from.x - warp(g.x), p.motion.from.y - g.y) < 1.5);
    if (taken) continue;
    const near = [...final.entries()].filter(([s]) => !OL.includes(s) && s !== 'Q').sort((a, b) => Math.hypot(a[1].x - warp(g.x), a[1].y - g.y) - Math.hypot(b[1].x - warp(g.x), b[1].y - g.y))[0];
    if (near && !near[1].motion) near[1].motion = { from: { x: r2(warp(g.x)), y: r2(Math.min(-1, g.y)) }, tag: motionTag(spec, near[0]), kind: 'motion' };
  }
  let a = 0;
  for (const l of spec.labels) {
    const style = LABEL_STYLE[l.kind];
    // a label keeps its printed offset from the nearest point of its man's line work, so it moves with the line
    let x = r2(warp(l.x));
    let y = r2(yMapOf(l.spot)(l.y));
    if (l.spot) {
      let near: { d: number; x: number; y: number } | null = null;
      for (const rp of spec.paths) {
        if (rp.spot !== l.spot) continue;
        for (const [px, py] of rp.pts) {
          const d = Math.hypot(px - l.x, py - l.y);
          if (!near || d < near.d) near = { d, x: px, y: py };
        }
      }
      if (near && near.d < 4) {
        x = r2(warpFor(l.spot)(near.x) + (l.x - near.x));
        y = r2(yMapOf(l.spot)(near.y) + (l.y - near.y));
      }
    }
    const text = l.kind === 'note' ? wrapNote(l.text) : l.text;
    // the print is smaller than the editor's type: a word beside a man moves out until it clears his symbol
    const owner = l.spot ? final.get(l.spot) : undefined;
    if (owner) {
      const lines = text.split('\n');
      const halfW = 0.31 * Math.max(...lines.map((t) => t.length)) + 0.1;
      const halfH = 0.42 * lines.length;
      const dx = x - owner.x;
      const dy = y - owner.y;
      if (Math.abs(dx) < halfW + 0.65 && Math.abs(dy) < halfH + 0.55) {
        if (Math.abs(dy) > 0.45 && Math.abs(dx) < 0.8) y = r2(owner.y + Math.sign(dy) * (halfH + 0.6));
        else x = r2(owner.x + (dx < 0 ? -1 : 1) * (halfW + 0.7));
      }
    }
    annotations[`${id}-a${a++}`] = { id: `${id}-a${a}`, kind: 'text', x, y, text, style: style.style ?? 'plain', size: style.size, ...(style.color ? { color: style.color } : {}) } as TextAnnotation;
  }
  // two words printed close together stay apart in the editor's larger type: the lower one steps down
  const texts = Object.values(annotations).filter((an): an is TextAnnotation => an.kind === 'text');
  const box = (t: TextAnnotation) => {
    const lines = t.text.split('\n');
    return { hw: 0.31 * Math.max(...lines.map((l) => l.length)) + 0.1, hh: 0.42 * lines.length };
  };
  texts.sort((p, q) => q.y - p.y);
  for (let i = 0; i < texts.length; i++) {
    for (let j = 0; j < i; j++) {
      const a = texts[j];
      const b = texts[i];
      const ba = box(a);
      const bb = box(b);
      const dx = Math.abs(a.x - b.x);
      const dy = a.y - b.y;
      if (dx < ba.hw + bb.hw && dy < ba.hh + bb.hh + 0.1 && dy > -0.5) b.y = r2(a.y - (ba.hh + bb.hh + 0.15));
    }
  }
  // the defense over the line
  const defense: Player[] = spec.defenders.map((d, i) => ({
    id: `${id}-d${i}`,
    side: 'defense',
    symbol: 'letter',
    label: d.label,
    x: r2(warp(d.x)),
    y: r2(DEF_Y(d.role, d.y)),
    role: d.role,
  }));
  const diagram = { players: Object.fromEntries([...players, ...defense].map((p) => [p.id, p])), paths, annotations };

  // words on the players
  const positionNotes: Record<string, string> = {};
  for (const [spot, text] of Object.entries(spec.positionNotes) as [RamsSpot, string][]) {
    const p = final.get(spot);
    if (p && text) positionNotes[p.id] = text;
  }
  const routeTags: Record<string, string> = {};
  for (const [spot, words] of Object.entries(spec.routeWords) as [RamsSpot, string[]][]) {
    const p = final.get(spot);
    if (p && words?.length) routeTags[p.id] = words[0];
  }
  const noteLines = [
    spec.notes.summary,
    spec.conceptMeans && `Concept: ${spec.conceptMeans}`,
    spec.notes.qb && `QB: ${spec.notes.qb}`,
    spec.notes.hb && `HB: ${spec.notes.hb}`,
    spec.notes.criteria && `Criteria: ${spec.notes.criteria}`,
    spec.notes.progression && `Progression: ${spec.notes.progression}`,
    spec.notes.alerts?.length ? `Alerts: ${spec.notes.alerts.join(' ')}` : undefined,
    spec.notes.can && `Can: ${spec.notes.can}`,
    spec.frontNote && `Front note: ${spec.frontNote}`,
    ...placed.notes,
  ].filter((s): s is string => !!s);
  if (placed.how === 'drawing' && spec.section !== 'pass-pro') review.push('Formation built from the drawing, not from the pack.');
  const formationLabel = spec.section === 'pass-pro' ? (spec.front ? `vs ${spec.front}` : '') : (spec.formation?.name ?? spec.rawCall.split(' / ')[0]).toUpperCase();
  const tags = [...new Set([RAMS_2022_TAG, ...spec.tags, `install-${spec.install ?? '?'}`, ...(placed.how === 'drawing' ? ['alignment-check'] : []), ...(spec.formation?.motions.map((m) => `motion:${m.word}`) ?? [])])];
  return {
    id,
    name: spec.name || spec.rawCall,
    formationId: spec.packKey ? `${PACKERS_2019_ID_PREFIX}${spec.packKey}` : spec.baseKey ? `${PACKERS_2019_ID_PREFIX}${spec.baseKey}` : undefined,
    formationLabel,
    personnel: spec.personnel ?? undefined,
    category: spec.category,
    tags,
    notes: noteLines.join('\n') || undefined,
    positionNotes,
    defense: spec.front ? { front: spec.front } : undefined,
    diagram,
    source: `${RAMS_2022_SOURCE}: ${spec.family ?? spec.section}`,
    sourcePage: spec.page,
    sourceCell: `c${spec.cell}`,
    install: spec.install ?? undefined,
    rawCall: spec.rawCall,
    alias: spec.alias && spec.alias !== spec.name ? spec.alias : undefined,
    protection: spec.protection ?? undefined,
    concept: spec.systemConcept ?? spec.concept ?? undefined,
    routeTags: Object.keys(routeTags).length ? routeTags : undefined,
    alternate: spec.can ? { name: spec.can === 'game plan' ? 'Can (game plan)' : `Can: ${spec.can}`, trigger: spec.notes.criteria ?? spec.notes.can } : undefined,
    appliedTags: placed.applied.length ? placed.applied : undefined,
    confidence: review.length ? 'needs-review' : 'derived',
    reviewNotes: review.length ? review : undefined,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  };
}

/** The whole pack, composed. */
export function composeRamsPlays(specs: RamsPlaySpec[]): Play[] {
  return specs.map(composeRamsPlay);
}

/** Every searchable word of a composed play, lower case, in one string. */
export function playSearchText(p: Play, extra: string[] = []): string {
  return [p.name, p.alias, p.formationLabel, p.personnel, p.category, p.concept, p.protection, p.rawCall, p.defense?.front, p.defense?.coverage, p.notes, ...p.tags, ...Object.values(p.positionNotes), ...(p.appliedTags ?? []), ...Object.values(p.routeTags ?? {}), p.alternate?.name, ...extra]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** A Formation-shaped view of the composed offense, for pages that want a formation thumbnail. */
export function offenseOnly(play: Play): Formation['players'] {
  return Object.fromEntries(Object.entries(play.diagram.players).filter(([, p]) => p.side === 'offense'));
}

export { assertSevenOnLine };
