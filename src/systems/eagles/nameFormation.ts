/**
 * Eagles 2026 system: turn a charted alignment (labels, never coordinates) into a formation call.
 *
 * The words are the LaFleur / McVay family's (Green Bay 2019 book pp. 9-28, Rams 2022 general section
 * pp. 13-32). In those books a formation word says which JOB (Y, Z, X, F) stands where. Film shows
 * bodies, not jobs, so the namer goes by what the eye can see:
 *   - strength is the Y's side (the attached tight end), not the passing strength the chart uses
 *   - the word is picked from the picture: how many receivers each side, who is attached, who is
 *     reduced, who is stacked or bunched
 *   - words that differ only by which receiver is the F (Trips / Trio / Trax, Dice / Dixie,
 *     Stack / South, Bunch / Box) come back as `alternates`
 * Every guess is written into `notes` so nothing is silently assumed.
 */
import type { SnapBackfield, SnapStrength } from '@/model/types';
import { isBackfieldPlayer, isOnLine, type AlignedPlayer, type AlignedSide } from '@/importers/snapChart/alignment';

export type SystemFormationName = {
  /** The call as it would be said: "Gun Trips Rt Close". */
  name: string;
  /** The formation word alone: "Trips". */
  base: string;
  /** Book family: "3x1 'T'", "2x2 'D'", "2x2 Stack 'S'", "1x3 'F'", "1x3 Bunch 'CR'", "Bunch 'B'", "2 Back", "Empty". */
  family: string;
  /** Call strength = the Y's side. */
  strength: SnapStrength;
  backfield: '' | 'Gun' | 'Pistol';
  /** Variation words after the strength: Close, Tight, Open, Off ... and the empty letter. */
  tags: string[];
  /** Gun only: which side of the quarterback the back stands on, relative to the call strength. Charting note, not a call word. */
  back?: 'strong' | 'weak';
  /** Same picture, different jobs. */
  alternates: string[];
  notes: string[];
  /** 'rule' = the picture matches a book definition; 'closest' = nearest word, check it. */
  confidence: 'rule' | 'closest';
};

export type NameInput = {
  personnel: string;
  backfield: SnapBackfield;
  /** The chart's family, used only as a hint for Bunch and Stack. */
  formFamily?: string;
  /** The chart's strength (passing strength on 3x1). */
  strength?: SnapStrength;
  players: AlignedPlayer[];
};

type Zone = 'in' | 'wing' | 't5' | 'slot' | 'out';
type Rcv = { p: AlignedPlayer; zone: Zone; on: boolean; te: boolean; rb: boolean; stacked: boolean; job?: string };

const ZONE: Record<string, Zone> = { inline: 'in', wing: 'wing', tight: 't5', slot: 'slot', numbers: 'out', wide: 'out' };
const other = (s: AlignedSide): AlignedSide => (s === 'R' ? 'L' : 'R');
const attached = (r: Rcv) => r.zone === 'in' || r.zone === 'wing';
const reduced = (r: Rcv) => r.zone === 't5' || r.zone === 'wing';

function toRcv(p: AlignedPlayer): Rcv {
  const on = isOnLine(p);
  let zone = ZONE[p.align] ?? 'slot';
  if (zone === 'in' && !on) zone = 'wing';
  return { p, zone, on, te: p.pos === 'TE', rb: p.pos === 'RB', stacked: !!p.stack_behind, job: p.label ? p.label.toUpperCase() : undefined };
}

function sideOf(rcvs: Rcv[], side: AlignedSide): Rcv[] {
  return rcvs
    .map((r, i) => ({ r, i }))
    .filter(({ r }) => r.p.side === side)
    .sort((a, b) => (a.r.p.order ?? 99) - (b.r.p.order ?? 99) || a.i - b.i)
    .map(({ r }) => r);
}

/** The Y's side: attached tight ends first, any tight end next, then the chart, then the bigger side. */
function callSide(rcvs: Rcv[], chart: SnapStrength | undefined, notes: string[]): AlignedSide {
  const chartSide: AlignedSide | undefined = chart === 'Lt' ? 'L' : chart === 'Rt' ? 'R' : undefined;
  const count = (list: Rcv[], side: AlignedSide) => list.filter((r) => r.p.side === side).length;
  for (const pool of [rcvs.filter((r) => r.te && attached(r)), rcvs.filter((r) => r.te)]) {
    const l = count(pool, 'L');
    const r = count(pool, 'R');
    if (l !== r) return l > r ? 'L' : 'R';
    if (l > 0) break; // a tight end each side: the chart decides
  }
  if (chartSide) return chartSide;
  const l = count(rcvs, 'L');
  const r = count(rcvs, 'R');
  if (l !== r) return l > r ? 'L' : 'R';
  notes.push('No Y and no charted strength: called Rt.');
  return 'R';
}

/**
 * When the job letters are known (a hand-drawn alignment carries them) the exact word can be picked: the
 * books name these pictures by which job stands where, inside to outside.
 */
const jobs = (list: Rcv[]) => (list.every((r) => r.job) ? list.map((r) => r.job).join('') : null);
const BUNCH_BY_JOBS: Record<string, string> = { YFZ: 'Bunch', FYZ: 'Bin', FZY: 'Buddy', YZX: 'Box', YZF: 'Bundle', ZYF: 'Bowl' };
const TRIPS_BY_JOBS: Record<string, string> = { YFZ: 'Trips', YZF: 'Trio', YZX: 'Trax' };
const FAST_BY_JOBS: Record<string, string> = { FZX: 'Fast', ZFX: 'Fit', ZXF: 'Foot' };
const CRIP_BY_JOBS: Record<string, string> = { FZX: 'Crip', ZFX: 'Crack', ZXF: 'Crush', XFZ: 'Cruz' };

type Core = { base: string; family: string; tags: string[]; alternates: string[]; closest?: boolean };

/** One back, four receivers. `S` and `W` are inside-out. */
function oneBack(S: Rcv[], W: Rcv[], input: NameInput, notes: string[]): Core {
  const tags: string[] = [];
  const hint = input.formFamily ?? '';
  const y = S.find((r) => r.te);
  const yi = y ? S.indexOf(y) : -1;

  if (S.length === 3 && W.length === 1) {
    const x = W[0];
    if (x.zone === 't5') tags.push('Tight');
    else if (attached(x)) tags.push('Tighter');
    const cluster = /bunch/i.test(hint) || S.every(reduced);
    if (cluster) {
      const known = BUNCH_BY_JOBS[jobs(S) ?? ''];
      if (known) return { base: known, family: "Bunch 'B'", tags, alternates: [] };
      if (yi < 0) notes.push('No tight end read in the bunch: called Bunch (Y inside). Bin = Y at the point, Buddy = Y outside.');
      const base = yi === 1 ? 'Bin' : yi === 2 ? 'Buddy' : 'Bunch';
      return { base, family: "Bunch 'B'", tags, alternates: ['Bunch', 'Bin', 'Buddy', 'Box'].filter((b) => b !== base) };
    }
    const two = S.filter((r) => r.te).length >= 2;
    if (two && attached(S[0]) && attached(S[1])) {
      // two tight ends together: the second one is the F
      const fInside = S[0].zone === 'wing' && S[1].zone === 'in';
      if (!fInside && S[1].zone === 'in') notes.push('Second tight end charted ON the line outside the Y, which covers the Y: called West, check who is off the ball.');
      if (S[2].zone === 't5') tags.unshift('Close');
      return { base: fInside ? 'East' : 'West', family: "3x1 'T'", tags, alternates: [] };
    }
    if (yi === 1) return { base: 'Train', family: "3x1 'T'", tags, alternates: [] };
    if (yi === 2) return { base: 'Trout', family: "3x1 'T'", tags, alternates: [] };
    if (yi < 0) notes.push('No tight end on the three-receiver side: called Trips with the Y flexed.');
    if (S[0].zone === 'wing') tags.unshift('Off');
    else if (S[0].zone !== 'in') tags.unshift('Open');
    if (S[2].zone === 't5' && S[0].zone === 'in') tags.unshift('Close');
    const trips = TRIPS_BY_JOBS[jobs(S) ?? ''];
    if (trips) return { base: trips, family: "3x1 'T'", tags, alternates: [] };
    return { base: 'Trips', family: "3x1 'T'", tags, alternates: ['Trio', 'Trax'], closest: yi < 0 };
  }

  if (S.length === 1 && W.length === 3) {
    if (S[0].zone === 'wing') tags.push('Off');
    else if (S[0].zone !== 'in') tags.push('Open');
    const cluster = /bunch/i.test(hint) || W.every(reduced);
    const weakJobs = jobs(W) ?? '';
    if (cluster) return CRIP_BY_JOBS[weakJobs] ? { base: CRIP_BY_JOBS[weakJobs], family: "1x3 Bunch 'CR'", tags, alternates: [] } : { base: 'Crip', family: "1x3 Bunch 'CR'", tags, alternates: ['Crack', 'Crush', 'Cruz'] };
    return FAST_BY_JOBS[weakJobs] ? { base: FAST_BY_JOBS[weakJobs], family: "1x3 'F'", tags, alternates: [] } : { base: 'Fast', family: "1x3 'F'", tags, alternates: ['Fit', 'Foot'] };
  }

  if (S.length === 2 && W.length === 2) {
    const [wIn, wOut] = W;
    const wTe = W.find((r) => r.te);
    const z = S[yi === 0 ? 1 : 0];
    let base = 'Dice';
    let family = "2x2 'D'";
    let alternates = ['Dixie'];
    const weakJobs = jobs(W);
    if (weakJobs === 'XF') base = 'Dixie'; // X in the slot, F outside
    if (weakJobs) alternates = [];
    const stack = /stack/i.test(hint) || W.some((r) => r.stacked) || W.every(reduced);

    if (S.every((r) => r.te && attached(r))) {
      // both tight ends on the call side, both receivers away: the 3x1 word plus Slot (Z goes weak, inside the X)
      const fInside = S[0].zone === 'wing' && S[1].zone === 'in';
      if (!fInside && S[1].zone === 'in') notes.push('Second tight end charted ON the line outside the Y, which covers the Y: called West, check who is off the ball.');
      tags.push('Slot');
      if (wTe && attached(wTe)) tags.push('Tighter');
      return { base: fInside ? 'East' : 'West', family: "3x1 'T'", tags, alternates: [] };
    }

    if (wTe && attached(wTe) && y && attached(y)) {
      base = 'Deuce';
      alternates = [];
      if (wTe.zone === 'wing') notes.push('Weak-side tight end (F) is off the ball.');
    } else if (stack) {
      family = "2x2 Stack 'S'";
      if (wOut.on && !wIn.on) {
        base = 'Sink';
        alternates = [];
      } else {
        // Stack = F on the ball with the X behind him; South = X on the ball with the F behind him
        const front = W.find((r) => r.on);
        base = front?.job === 'X' ? 'South' : 'Stack';
        alternates = front?.job ? [] : ['South'];
      }
    }

    if (!y) {
      notes.push('No tight end on the call side: called Dyno (Dice with the Y flexed).');
      return { base: base === 'Dice' ? 'Dyno' : base, family, tags, alternates: base === 'Dice' ? [] : alternates, closest: true };
    }
    if (yi === 1) {
      // Y is the outside man
      if (S[0].zone === 't5' && S[0].on) tags.push('Click');
      else tags.push('Out');
    } else if (y.zone === 'in') {
      if (z.zone === 't5') tags.push('Close');
      else if (attached(z)) tags.push('Closer');
    } else if (y.zone === 'wing') {
      if (z.zone === 't5' && z.on) {
        const clamp: Record<string, string> = { Stack: 'Stamp', Sink: 'Snug' };
        if (clamp[base]) {
          alternates = base === 'Stack' ? ['Swamp'] : [];
          base = clamp[base];
        } else tags.push('Clamp');
      } else tags.push('Off');
    } else if (base === 'Dice') {
      base = 'Dyno';
      alternates = [];
    } else tags.push('Open');

    if (!stack) {
      if (wOut.zone === 't5') tags.push('Tight');
      else if (attached(wOut)) tags.push('Tighter');
    }
    if (tags.includes('Close') && tags.includes('Tight')) return { base, family, tags: tags.filter((t) => t !== 'Close' && t !== 'Tight').concat('Ace'), alternates };
    return { base, family, tags, alternates };
  }

  notes.push(`${S.length} strong and ${W.length} weak receivers with one back is not a book picture: closest word used.`);
  return { base: S.length >= W.length ? 'Trips' : 'Fast', family: S.length >= W.length ? "3x1 'T'" : "1x3 'F'", tags, alternates: [], closest: true };
}

/** Two backs: the word comes from where the second back (F) stands. */
function twoBack(S: Rcv[], W: Rcv[], backs: AlignedPlayer[], strong: AlignedSide, input: NameInput, notes: string[]): Core {
  const tags: string[] = [];
  const f = backs.find((b) => b.align === 'fb' || b.align === 'offset' || b.align === 'wing_back') ?? backs.find((b) => b.align === 'gun_offset') ?? backs[1];
  let base = 'I';
  let alternates: string[] = [];
  if (f && f.align === 'wing_back' && f.side !== 'C') {
    base = f.side === strong ? 'Strong' : 'Weak';
    notes.push(`Second back is an H-back off the ${f.side === strong ? 'strong' : 'weak'} tackle's hip: called ${base}.`);
  } else if (input.backfield === 'Gun') {
    base = 'Red';
    alternates = ['Change'];
    notes.push('Two backs beside the quarterback in the gun: Red = F strong, Change = F weak. Which back is the F is not on the chart.');
  } else if (f && f.side !== 'C') base = f.side === strong ? 'Strong' : 'Weak';
  const y = S.find((r) => r.te);
  const z = S.filter((r) => r !== y).pop();
  const x = W[W.length - 1];
  if (W.length >= 2 && S.length <= 1) tags.push('Slot');
  if (z && y) {
    if (z.zone === 't5') tags.push('Close');
    else if (attached(z)) tags.push('Closer');
  }
  if (x && W.length === 1) {
    if (x.zone === 't5') tags.push('Tight');
    else if (attached(x)) tags.push('Tighter');
  }
  if (y && y.zone === 'wing') tags.push('Off');
  const ace = tags.includes('Close') && tags.includes('Tight');
  return { base, family: '2 Back', tags: ace ? tags.filter((t) => t !== 'Close' && t !== 'Tight').concat('Ace') : tags, alternates };
}

/** Green Bay p. 24: where the back lines up in an empty set. A, B, C strong side from the outside in; D, E, G weak side from the inside out. */
function emptyLetter(h: Rcv, side: Rcv[], isStrong: boolean): string {
  const outermost = side[side.length - 1] === h;
  if (isStrong) return outermost && side.length > 1 ? 'A' : reduced(h) || h.zone === 'in' ? 'C' : outermost ? 'A' : 'B';
  return outermost && side.length > 1 ? 'G' : reduced(h) || h.zone === 'in' ? 'D' : outermost ? 'G' : 'E';
}

export function nameFormation(input: NameInput): SystemFormationName {
  const notes: string[] = [];
  const rcvs = input.players.filter((p) => !isBackfieldPlayer(p)).map(toRcv);
  const backs = input.players.filter((p) => isBackfieldPlayer(p) && p.pos !== 'QB');
  const strong = callSide(rcvs, input.strength, notes);
  const strength: SnapStrength = strong === 'L' ? 'Lt' : 'Rt';
  if (input.strength && input.strength !== strength) notes.push(`Charted strength ${input.strength} is the passing strength. The call goes to the Y: ${strength}.`);
  let S = sideOf(rcvs, strong);
  let W = sideOf(rcvs, other(strong));
  const backfield = input.backfield === 'Gun' ? 'Gun' : input.backfield === 'Pistol' ? 'Pistol' : '';

  let core: Core;
  let back: SystemFormationName['back'];
  if (backs.length >= 2) core = twoBack(S, W, backs, strong, input, notes);
  else if (backs.length === 1) {
    core = oneBack(S, W, input, notes);
    const b = backs[0];
    if (backfield === 'Gun' && b.side !== 'C') back = b.side === strong ? 'strong' : 'weak';
  } else {
    // empty: take the back out, name the other four, add his letter
    let h = rcvs.find((r) => r.rb);
    if (!h) {
      const big = S.length >= W.length ? S : W;
      h = big[big.length - 1];
      notes.push('Empty with no back identified among the receivers: the widest man on the bigger side is treated as the H.');
    }
    const hStrong = h.p.side === strong;
    const letter = emptyLetter(h, hStrong ? S : W, hStrong);
    S = S.filter((r) => r !== h);
    W = W.filter((r) => r !== h);
    core = oneBack(S, W, input, notes);
    core.tags.push(letter);
    core.family = 'Empty';
  }

  const words = [backfield, core.base, strength, ...core.tags].filter(Boolean);
  return {
    name: words.join(' '),
    base: core.base,
    family: core.family,
    strength,
    backfield,
    tags: core.tags,
    back,
    alternates: core.alternates,
    notes,
    confidence: core.closest ? 'closest' : 'rule',
  };
}
