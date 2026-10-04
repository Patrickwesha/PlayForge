/**
 * Eagles 2026 system: name an alignment the way a coach calls it, BASE FORMATION + TAGS.
 *
 * A formation word puts every job in a spot. When the picture on film differs from the word (the Z is
 * on the ball and the Y is off it, a receiver is cut down to 5 yards, the X is attached), the playbook
 * has a tag that says so: Off, Close, Closer, Clamp, Click, Open, Out, Tight, Tighter, Slot, Zoom, Hip,
 * Hop, Ace. So the name is found by building, not guessing: take every formation in the pack for the
 * personnel, apply every tag (and pair of tags) with the same tag engine that draws a call
 * (geometry/formationTags), and keep the call whose picture IS the charted picture. The simplest call
 * wins: no tag before one tag before two.
 *
 * Film shows bodies, not jobs. A tight end is the Y (and the F in 12), a receiver is some of Z / X / F.
 * So pictures are compared by body type unless the alignment carries job letters (a hand-drawn one),
 * and calls that draw the same picture come back as `alternates`.
 */
import type { Player, SnapBackfield, SnapStrength } from '@/model/types';
import { applyCallTags } from '@/geometry/formationTags';
import { PACKERS_2019_FORMATIONS } from '@/seeds/packers2019';
import type { PlacedPlayer } from '@/importers/snapChart/alignment';

type Zone = 'att' | 'adj' | 'red' | 'slot' | 'out';
type Cls = 'TE' | 'WR' | 'RB';
type Spot = { side: 1 | -1; zone: Zone; on: boolean; cls: Cls; job?: string };

/** Tags tried on every base formation, in the order they are said. */
const STRONG_TAGS = ['CLOSE', 'CLOSER', 'CLAMP', 'CLICK', 'OPEN', 'OUT', 'OFF'] as const; // talk to the Z and the Y
const WEAK_TAGS = ['TIGHT', 'TIGHTER', 'SLOT', 'ZOOM', 'HIP', 'HOP'] as const; // talk to the X (and a Z sent weak)
const TAGS = [...STRONG_TAGS, ...WEAK_TAGS, 'ACE'] as const;
const TITLE: Record<string, string> = Object.fromEntries(TAGS.map((t) => [t, t[0] + t.slice(1).toLowerCase()]));
/** Two tags in one call: one for each side, or Off with a split for the Z (Y backs off, Z comes down on the ball). */
const PAIRS: [string, string][] = [...STRONG_TAGS.flatMap((a) => WEAK_TAGS.map((b) => [a, b] as [string, string])), ['OFF', 'CLOSE'], ['OFF', 'CLOSER']];
/** Words tried first when two calls draw the same picture: the everyday ones before the job-swap twins and the Rams-only words. */
const PRIORITY = ['I', 'Strong', 'Weak', 'Red', 'Trips', 'Dice', 'Deuce', 'West', 'East', 'Bunch', 'Stack', 'Sink', 'South', 'Snug', 'Dyno', 'Fast', 'Crip', 'Train', 'Trout', 'Trio', 'Dixie', 'Bin', 'Buddy', 'Fit', 'Foot'];
const rank = (base: string) => {
  const i = PRIORITY.indexOf(base);
  return i < 0 ? PRIORITY.length : i;
};

const zoneOfX = (x: number): Zone => {
  const a = Math.abs(x);
  // attached to the tackle / touching the next man (a wing, a bunch) / reduced (Hash +3 to +5 and a stacked partner) / slot / outside
  return a <= 3.6 ? 'att' : a <= 5.6 ? 'adj' : a <= 9.6 ? 'red' : a <= 13.6 ? 'slot' : 'out';
};
const LABEL_ZONE: Record<string, Zone> = { tight: 'red', slot: 'slot', numbers: 'out', wide: 'out' };

/** Which body plays each job in a personnel group ("12": Y and F are tight ends). */
function jobClass(personnel: string): Record<string, Cls> {
  const p = personnel.toUpperCase();
  const base: Record<string, Cls> = { Y: 'TE', Z: 'WR', X: 'WR', F: 'WR', H: 'RB' };
  if (/^(21|22|23|20)/.test(p)) base.F = 'RB';
  if (/^(12|13)/.test(p)) base.F = 'TE';
  if (/^(20|10)/.test(p)) base.Y = 'WR';
  if (/^22X|^13X/.test(p)) base.Z = 'TE';
  if (/^22Z|^13Z/.test(p)) base.X = 'TE';
  if (/^23/.test(p)) {
    base.X = 'TE';
    base.Z = 'TE';
  }
  return base;
}

const inBackfield = (y: number, x: number) => y < -2.5 && Math.abs(x) < 3;

/** A composed formation (strong right) as spots, inside to outside on each side. */
function spotsOfPlayers(players: Player[], cls: Record<string, Cls>): Spot[] {
  return players
    .filter((p) => p.role !== 'OL' && p.role !== 'C' && p.role !== 'QB' && !inBackfield(p.y, p.x))
    .map((p) => ({ side: (p.x < 0 ? -1 : 1) as 1 | -1, zone: zoneOfX(p.x), on: p.y > -0.5, cls: cls[p.label] ?? 'WR', job: p.label, x: Math.abs(p.x) }))
    .sort((a, b) => a.side - b.side || a.x - b.x)
    .map(({ side, zone, on, cls: c, job }) => ({ side, zone, on, cls: c, job }));
}

/** The charted alignment as spots. A hand-drawn spot is read by where it is; a label by what it says. */
function spotsOfSnap(placed: PlacedPlayer[], mirror: boolean): { spots: Spot[]; jobs: boolean } {
  const rows = placed
    .filter((q) => q.p.pos !== 'QB' && !inBackfield(q.y, q.x))
    .map((q) => {
      const x = mirror ? -q.x : q.x;
      const on = q.y > -0.5;
      let zone: Zone;
      if (q.p.at) zone = zoneOfX(x);
      else zone = LABEL_ZONE[q.p.align] ?? zoneOfX(x);
      return { side: (x < 0 ? -1 : 1) as 1 | -1, zone, on, cls: (q.p.pos === 'TE' ? 'TE' : q.p.pos === 'RB' ? 'RB' : 'WR') as Cls, job: q.p.label?.toUpperCase(), x: Math.abs(x) };
    })
    .sort((a, b) => a.side - b.side || a.x - b.x);
  return { spots: rows.map(({ side, zone, on, cls, job }) => ({ side, zone, on, cls, job })), jobs: rows.length > 0 && rows.every((r) => !!r.job) };
}

const key = (spots: Spot[], byJob: boolean) => spots.map((s) => `${s.side > 0 ? 'R' : 'L'}${s.zone}${s.on ? '+' : '-'}${byJob ? s.job : s.cls}`).join(' ');

type Candidate = { base: string; family: string; tags: string[]; byClass: string; byJob: string; backs: number; group: string };
const cache = new Map<string, Candidate[]>();

/** Every call the system can make for a personnel group: each pack formation, bare and with one or two tags. */
function candidates(personnel: string): Candidate[] {
  const hit = cache.get(personnel);
  if (hit) return hit;
  const cls = jobClass(personnel);
  const out: Candidate[] = [];
  const seen = new Set<string>();
  // A formation word is not tied to one personnel group: Bunch is Bunch in 11 or 12 (the F is just a tight end body).
  // The big-personnel entries (22X, 13Z, 23) only apply to their own group.
  const big = (g: string) => /^(22|13|23)/.test(g);
  const bases = PACKERS_2019_FORMATIONS.filter((f) => {
    const g = (f.personnel ?? '').toUpperCase();
    return big(g) || big(personnel) ? g.slice(0, 2) === personnel.slice(0, 2) && (personnel.length === 2 || g === personnel.toUpperCase()) : true;
  });
  for (const f of bases) {
    const players = Object.values(f.players);
    const words = f.name.split(' ');
    const rt = words.indexOf('Rt');
    if (rt < 0) continue;
    const base = words.slice(0, rt).join(' ');
    const own = words.slice(rt + 1);
    const backs = players.filter((p) => p.role !== 'QB' && p.role !== 'OL' && p.role !== 'C' && inBackfield(p.y, p.x)).length;
    const add = (ps: Player[], tags: string[]) => {
      const spots = spotsOfPlayers(ps, cls);
      const c = { base, family: f.family ?? '', tags, byClass: key(spots, false), byJob: key(spots, true), backs, group: (f.personnel ?? '').slice(0, 2) };
      const id = `${base}|${tags.join(' ')}|${c.byJob}`;
      if (!seen.has(id)) {
        seen.add(id);
        out.push(c);
      }
    };
    add(players, own);
    if (own.length) continue; // tags are applied to bare formations only: "Dice Rt Close" is Dice + Close
    const tryTags = (tags: string[]) => {
      try {
        const r = applyCallTags(players, { post: tags, direction: 'RT', personnel });
        if (r.applied.length === tags.length && !r.review.some((x) => /could not be applied/.test(x))) add(r.players, tags.map((t) => TITLE[t]));
      } catch {
        // the tag does not fit this formation (it would leave the line illegal)
      }
    };
    for (const a of TAGS) tryTags([a]);
    for (const pair of PAIRS) tryTags(pair);
  }
  out.sort((a, b) => a.tags.length - b.tags.length || rank(a.base) - rank(b.base));
  cache.set(personnel, out);
  return out;
}

export type FormationMatch = {
  name: string;
  base: string;
  family: string;
  strength: SnapStrength;
  backfield: '' | 'Gun' | 'Pistol';
  tags: string[];
  alternates: string[];
  notes: string[];
  /** true = job letters matched too; false = matched by body type (tight end / receiver). */
  byJob: boolean;
};

/**
 * Find the call whose picture is the charted picture. Returns undefined when no formation + tags in the
 * system draws it; the caller then falls back to the rule namer and flags the formation.
 */
export function matchFormation(input: { personnel: string; backfield: SnapBackfield; strength?: SnapStrength; placed: PlacedPlayer[] }): FormationMatch | undefined {
  const all = candidates(input.personnel);
  if (!all.length) return undefined;
  const backs = input.placed.filter((q) => q.p.pos !== 'QB' && inBackfield(q.y, q.x)).length;
  // a chart label is coarser than a drawn spot, so a label-charted snap only takes the everyday words and one tag
  const drawn = input.placed.filter((q) => q.p.pos !== 'QB' && !inBackfield(q.y, q.x)).every((q) => !!q.p.at);
  const usable = all.filter((c) => c.backs === backs && (drawn || (c.tags.length <= 1 && rank(c.base) < PRIORITY.length)));
  // the formation's own personnel group first; another group's word (Bunch in 12) only when nothing of its own fits
  const own = usable.filter((c) => c.group === input.personnel.slice(0, 2));
  const pools = [own, usable];
  const orientations: { mirror: boolean; strength: SnapStrength }[] = input.strength === 'Lt' ? [{ mirror: true, strength: 'Lt' }, { mirror: false, strength: 'Rt' }] : [{ mirror: false, strength: 'Rt' }, { mirror: true, strength: 'Lt' }];
  let best: { hits: Candidate[]; strength: SnapStrength; byJob: boolean } | undefined;
  for (const o of orientations) {
    const snap = spotsOfSnap(input.placed, o.mirror);
    for (const byJob of snap.jobs ? [true, false] : [false]) {
      const want = key(snap.spots, byJob);
      const hits = pools.map((pool) => pool.filter((c) => (byJob ? c.byJob : c.byClass) === want)).find((h) => h.length) ?? [];
      if (!hits.length) continue;
      const better = !best || (byJob && !best.byJob) || (byJob === best.byJob && hits[0].tags.length < best.hits[0].tags.length);
      if (better) best = { hits, strength: o.strength, byJob };
    }
  }
  if (!best) return undefined;
  const top = best.hits[0];
  const same = best.hits.filter((c) => c.tags.length === top.tags.length && c !== top);
  const backfield = input.backfield === 'Gun' ? 'Gun' : input.backfield === 'Pistol' ? 'Pistol' : '';
  const call = (c: Candidate) => [c.base, best!.strength, ...c.tags].join(' ');
  const notes: string[] = [];
  if (input.strength && input.strength !== best.strength) notes.push(`Charted strength ${input.strength} is the passing strength. The call goes to the Y: ${best.strength}.`);
  if (!best.byJob && spotsOfSnap(input.placed, false).jobs) notes.push('The picture matches this call by tight end / receiver, but the job letters drawn do not match the book for it. Check which tight end is the Y.');
  return {
    name: [backfield, call(top)].filter(Boolean).join(' '),
    base: top.base,
    family: top.family,
    strength: best.strength,
    backfield,
    tags: top.tags,
    // same picture, a different formation word (a job swap): tag variants of the same word are not listed
    alternates: [...new Set(same.filter((c) => c.base !== top.base).map(call))].slice(0, 4),
    notes,
    byJob: best.byJob,
  };
}
