import type { Player, Point } from '@/model/types';

/**
 * One mechanism for every word in a call that changes where a player lines up:
 *   - ALIGNMENT tags come after the formation and direction (Close, Off, Book ...) and change where a
 *     player STARTS.
 *   - SHIFT and MOTION tags come before the formation (Y Mo, F Sh) or after it (Hax, Z Lt, F Ctr ...)
 *     and change where a player ENDS UP, so the player gets a pre-snap spot, a final spot, and a path.
 *
 * Everything works in "strong right" space: +x is the side of the call. The caller mirrors the result
 * for a Lt call. Effects come from the 2019 Packers playbook pages 13-24 (alignments) and 30-37
 * (motions). `basis` says how: 'words' = the page states it (a split, "inside WR on", a motion rule),
 * 'diagram' = the page only draws it, so the play is flagged needs-review, 'pack' = taken from a
 * hand-corrected formation in the pack.
 */
export type TagBasis = 'words' | 'diagram' | 'pack';
export type AppliedTag = { tag: string; player?: string; kind: 'alignment' | 'motion' | 'shift'; basis: TagBasis; page: number; effect: string };
export type TagResult = { players: Player[]; applied: AppliedTag[]; review: string[]; ignored: string[]; notes: string[] };
export type CallTags = {
  /** Base formation names of the pack ("STACK", "SWAMP" ...). One of these after the direction is not a tag. */
  formationWords?: string[];
  /** e.g. "Y MO", "F SH", "Y-F MO": the words before the formation name. */
  pre?: string | null;
  /** The words after the direction, e.g. ['BOOK', 'F', 'LT'] or ['GUN', 'OUT', 'HAX']. */
  post: string[];
  direction: 'RT' | 'LT';
  personnel?: string;
};

const LETTERS = ['X', 'Y', 'Z', 'F', 'H'];
/**
 * The book's "-5-" marker: a 5 yard split from the end man on the line. The hand-corrected pack draws
 * that at 4.5 yards between centres (Stack, Sink, Snug, Red Rt Ace all put the man at 6.5 off a tackle at 2),
 * so the engine uses the same number and a tagged formation lands exactly on its pack twin.
 */
const SPLIT = 4.5;

/**
 * Build rules printed on p-017: a family member is another member plus a tag. The engine has to
 * reproduce these (see the tests), which is what lets a tagged call be derived instead of flagged.
 */
export const FORMATION_BUILD_RULES: { base: string; tag: string; result: string; page: number }[] = [
  { base: 'Stack', tag: 'CLAMP', result: 'Stamp', page: 17 },
  { base: 'South', tag: 'CLAMP', result: 'Swamp', page: 17 },
  { base: 'Sink', tag: 'CLAMP', result: 'Snug', page: 17 },
  { base: 'Dice', tag: 'OPEN', result: 'Dyno', page: 17 },
];
const NUMBERS = 18;
const SLOT = 12.55; // the formation pack's slot constant
const WIDE = 20;
const OFF_BALL = -1;
const GUN = { qb: { x: 0, y: -5 }, back: { x: -1.5, y: -6 } }; // from the hand-corrected Trio Rt (gun)

const isLine = (p: Player) => p.role === 'OL' || p.role === 'C';
const eligible = (p: Player) => !isLine(p) && p.role !== 'QB';
const onBall = (p: Player) => p.y > -0.5;
const inBackfield = (p: Player) => p.y < -2.5;

export const menOnLine = (players: Player[]) => players.filter(onBall);

/** Seven on the line, always. A tag that breaks this is a bug in the tag, so it throws. */
export function assertSevenOnLine(players: Player[], context: string): void {
  const n = menOnLine(players).length;
  if (n !== 7) throw new Error(`${context}: ${n} men on the line of scrimmage, must be 7 (${menOnLine(players).map((p) => p.label || p.role).join(' ')})`);
}

class Board {
  players: Player[];
  applied: AppliedTag[] = [];
  review: string[] = [];
  ignored: string[] = [];
  constructor(players: Player[]) {
    this.players = players.map((p) => ({ ...p }));
  }
  get(label: string) {
    return this.players.find((p) => p.label === label);
  }
  tackle(side: 1 | -1) {
    return Math.max(...this.players.filter((p) => isLine(p)).map((p) => side * p.x));
  }
  /** x of the end man on the line on a side: the attached tight end if there is one, else the tackle. */
  emol(side: 1 | -1, ignore?: Player) {
    const t = this.tackle(side);
    const te = this.players.find((p) => eligible(p) && p !== ignore && onBall(p) && side * p.x > t && side * p.x <= t + 1.2);
    return te ? side * te.x : t;
  }
  attachedTe(side: 1 | -1) {
    const t = this.tackle(side);
    return this.players.find((p) => eligible(p) && onBall(p) && side * p.x > t && side * p.x <= t + 1.2);
  }
  /** Receivers on a side, outside first (backs in the backfield are not receivers yet). */
  receivers(side: 1 | -1, except?: Player) {
    return this.players.filter((p) => eligible(p) && p !== except && !inBackfield(p) && side * p.x > 0.5).sort((a, b) => side * b.x - side * a.x);
  }
  outside(side: 1 | -1) {
    return this.receivers(side).find((p) => p !== this.attachedTe(side));
  }
  /** Slide a spot outward until it is clear of everyone else. */
  clear(spot: Point, mover: Player): Point {
    const out = { ...spot };
    const dir = out.x < 0 ? -1 : 1;
    // taken = someone in the same column within a yard (you cannot stack right behind a man), or shoulder to shoulder in the same row
    const hits = () => this.players.some((p) => p !== mover && ((Math.abs(p.x - out.x) < 0.5 && Math.abs(p.y - out.y) <= 1.05) || (Math.abs(p.y - out.y) < 0.5 && Math.abs(p.x - out.x) < 1.0)));
    for (let i = 0; i < 12 && hits(); i++) out.x += dir;
    return out;
  }
  /**
   * "Any tag that takes a man off the line has to put another man on." After a move, trade the nearest
   * receiver on that side across the line so the count is 7 again. `keep` are the players the tag placed.
   */
  rebalance(tag: string, side: 1 | -1, keep: Player[]) {
    const n = menOnLine(this.players).length;
    if (n === 7) return;
    const pool = this.receivers(side).filter((p) => !keep.includes(p));
    // no one else on that side to trade with (a 1x3 set's lone tight end, say): the tagged player keeps his own row
    const pick = (n < 7 ? pool.find((p) => !onBall(p)) : pool.find((p) => onBall(p))) ?? (n < 7 ? keep.find((p) => !onBall(p) && !inBackfield(p)) : keep.find((p) => onBall(p)));
    if (pick) pick.y = n < 7 ? 0 : OFF_BALL;
    assertSevenOnLine(this.players, `after ${tag}`);
  }
  note(a: AppliedTag) {
    this.applied.push(a);
    if (a.basis === 'diagram') this.review.push(`${a.tag}${a.player ? ` (${a.player})` : ''} is only drawn in the book (p-0${a.page}), never put in words: ${a.effect}`);
  }
}

type Align = (b: Board) => Omit<AppliedTag, 'tag' | 'kind'> | null;

const ALIGNMENT: Record<string, Align> = {
  CLOSE: (b) => {
    const r = b.outside(1);
    if (!r) return null;
    r.x = b.emol(1, r) + SPLIT;
    return { basis: 'words', page: 14, effect: `${r.label} takes a 5 yard split from the end man on the strong side` };
  },
  CLOSER: (b) => {
    const r = b.outside(1);
    if (!r) return null;
    r.x = b.emol(1, r) + 1;
    r.y = OFF_BALL;
    b.rebalance('CLOSER', 1, [r]);
    return { basis: 'diagram', page: 14, effect: `${r.label} on the hip of the end man on the strong side, off the ball` };
  },
  OFF: (b) => {
    const te = b.attachedTe(1);
    if (!te) return null;
    te.y = OFF_BALL;
    b.rebalance('OFF', 1, [te]);
    const up = b.receivers(1).find((p) => p !== te && onBall(p));
    return { basis: 'words', page: 14, effect: `${te.label} off the ball next to the tackle, ${up?.label ?? 'a receiver'} steps onto the line to keep seven` };
  },
  CLAMP: (b) => {
    const te = b.attachedTe(1);
    const r = b.outside(1);
    if (!te || !r) return null;
    te.y = OFF_BALL;
    r.x = b.tackle(1) + SPLIT;
    r.y = 0;
    b.rebalance('CLAMP', 1, [te, r]);
    return { basis: 'words', page: 14, effect: `${r.label} on the ball at a 5 yard split from the tackle, ${te.label} off the ball inside him` };
  },
  CLICK: (b) => {
    const te = b.attachedTe(1);
    const r = b.outside(1);
    if (!te || !r) return null;
    r.x = b.tackle(1) + SPLIT;
    r.y = 0;
    te.x = r.x + 1;
    te.y = OFF_BALL;
    b.rebalance('CLICK', 1, [te, r]);
    return { basis: 'words', page: 14, effect: `${r.label} on the ball at a 5 yard split from the tackle, ${te.label} off the ball outside him` };
  },
  OPEN: (b) => {
    const te = b.attachedTe(1);
    if (!te) return null;
    const wide = b.receivers(1).find((p) => p !== te);
    if (wide) {
      // p-017: "Dice with Open = Dyno". The Y flexes off the ball into the strong slot, the same width as
      // the weak slot when there is one, and the outside receiver steps onto the line.
      const weakSlot = b.receivers(-1)[1];
      te.x = weakSlot ? Math.abs(weakSlot.x) : (b.tackle(1) + wide.x) / 2;
      te.y = OFF_BALL;
      b.rebalance('OPEN', 1, [te]);
      return { basis: 'words', page: 17, effect: `${te.label} flexes off the ball into the strong slot and ${wide.label} steps onto the line (Dice with Open = Dyno)` };
    }
    // p-024 (Crack Rt Open): alone on his side, he takes the 5 yard split and stays on the ball
    te.x = b.tackle(1) + SPLIT;
    return { basis: 'words', page: 24, effect: `${te.label} flexes to a 5 yard split from the tackle, staying on the ball because no one else is on his side` };
  },
  OUT: (b) => {
    const te = b.attachedTe(1);
    const r = b.outside(1);
    if (!te || !r) return null;
    const wide = Math.max(r.x, SLOT + 3);
    r.x = Math.min(SLOT, wide - 4);
    r.y = OFF_BALL;
    te.x = wide;
    te.y = 0;
    b.rebalance('OUT', 1, [te, r]);
    return { basis: 'diagram', page: 14, effect: `${te.label} goes outside on the ball, ${r.label} comes inside to the slot (drawn, no splits given)` };
  },
  TIGHT: (b) => {
    const r = b.outside(-1);
    if (!r) return null;
    r.x = -(b.emol(-1, r) + SPLIT);
    return { basis: 'words', page: 14, effect: `${r.label} takes a 5 yard split from the end man on the weak side` };
  },
  TIGHTER: (b) => {
    const r = b.outside(-1);
    if (!r) return null;
    r.x = -(b.tackle(-1) + 1);
    r.y = 0;
    b.rebalance('TIGHTER', -1, [r]);
    return { basis: 'diagram', page: 14, effect: `${r.label} on the ball next to the weak tackle` };
  },
  SLOT: (b) => {
    const z = b.get('Z') ?? b.outside(1);
    if (!z) return null;
    z.x = -SLOT;
    z.y = OFF_BALL;
    b.rebalance('SLOT', 1, [z]);
    return { basis: 'diagram', page: 15, effect: `${z.label} comes across into the weak slot, off the ball (drawn, no split given)` };
  },
  ZOOM: (b) => {
    const z = b.get('Z') ?? b.outside(1);
    const x = b.outside(-1);
    if (!z || !x || z === x) return null;
    z.x = -WIDE;
    z.y = 0;
    x.x = -SLOT;
    x.y = OFF_BALL;
    b.rebalance('ZOOM', 1, [z, x]);
    return { basis: 'diagram', page: 15, effect: `${z.label} goes wide to the weak side on the ball, ${x.label} slides into the slot off it (drawn, no splits given)` };
  },
  HIP: (b) => twoWeak(b, 'HIP'),
  HOP: (b) => twoWeak(b, 'HOP'),
  ACE: (b) => {
    const a = ALIGNMENT.CLOSE(b);
    const t = ALIGNMENT.TIGHT(b);
    return a && t ? { basis: 'words', page: 15, effect: `Close and Tight: ${a.effect}; ${t.effect}` } : null;
  },
  BOOK: (b) => {
    const s = b.outside(1);
    const w = b.outside(-1);
    if (!s || !w) return null;
    s.x = NUMBERS - 2;
    w.x = -(NUMBERS - 1);
    return { basis: 'words', page: 15, effect: `field receiver ${s.label} 2 yards inside the numbers, boundary receiver ${w.label} 1 yard inside (strength assumed to the field)` };
  },
  NUMBERS: (b) => {
    const s = b.outside(1);
    const w = b.outside(-1);
    if (!s || !w) return null;
    s.x = NUMBERS;
    w.x = -NUMBERS;
    return { basis: 'words', page: 15, effect: `${s.label} and ${w.label} on the numbers` };
  },
  GUN: (b) => {
    const qb = b.players.find((p) => p.role === 'QB');
    if (!qb || qb.y <= -4.5) return { basis: 'pack', page: 21, effect: 'already in the gun' };
    qb.y = GUN.qb.y;
    const back = b.players.filter((p) => p.role === 'RB' && inBackfield(p) && Math.abs(p.x) < 1).sort((a, c) => a.y - c.y)[0];
    if (back) Object.assign(back, GUN.back);
    return { basis: 'pack', page: 21, effect: `QB at 5 yards${back ? `, ${back.label} beside him on the weak side` : ''} (same spots as the corrected Trio Rt)` };
  },
  '(+)': (b) => gunBack(b, 1),
  '(-)': (b) => gunBack(b, -1),
};
ALIGNMENT['#S'] = ALIGNMENT.NUMBERS;

/** Hip and Hop: both receivers to the weak side at a 5 yard split. Hip = inside man on the ball, Hop = outside man on. */
function twoWeak(b: Board, tag: 'HIP' | 'HOP'): ReturnType<Align> {
  const z = b.get('Z') ?? b.outside(1);
  const x = b.outside(-1);
  if (!z || !x || z === x) return null;
  const at = b.tackle(-1) + SPLIT;
  if (tag === 'HIP') {
    Object.assign(z, { x: -at, y: 0 });
    Object.assign(x, { x: -(at + 1), y: OFF_BALL });
  } else {
    Object.assign(x, { x: -at, y: 0 });
    Object.assign(z, { x: -(at - 1), y: OFF_BALL });
  }
  b.rebalance(tag, -1, [z, x]);
  return { basis: 'words', page: 15, effect: tag === 'HIP' ? `${z.label} and ${x.label} to the weak side at a 5 yard split, inside receiver ${z.label} on the ball` : `${x.label} and ${z.label} to the weak side at a 5 yard split, outside receiver ${x.label} on the ball` };
}

function gunBack(b: Board, side: 1 | -1): ReturnType<Align> {
  const qb = b.players.find((p) => p.role === 'QB');
  const back = b.players.filter((p) => p.role === 'RB' && inBackfield(p)).sort((a, c) => Math.abs(a.x) - Math.abs(c.x))[0];
  if (!qb || !back || qb.y > -4.5) return null;
  back.x = side * Math.abs(GUN.back.x);
  back.y = GUN.back.y;
  return { basis: 'diagram', page: 21, effect: `${back.label} beside the QB to the ${side > 0 ? 'strong' : 'weak'} side (drawn, no depth given)` };
}

/** Empty alignments for the H (p-024): letters A to G are only drawn, strength to the right. */
const H_LETTER: Record<string, (b: Board) => Point> = {
  A: (b) => ({ x: Math.min(23, (b.receivers(1)[0]?.x ?? WIDE - 2) + 2), y: OFF_BALL }),
  B: (b) => ({ x: (b.emol(1) + (b.receivers(1)[0]?.x ?? WIDE)) / 2, y: OFF_BALL }),
  C: (b) => ({ x: b.emol(1) + 1, y: OFF_BALL }),
  D: (b) => ({ x: -(b.emol(-1) + 1), y: OFF_BALL }),
  E: (b) => ({ x: -(b.emol(-1) + Math.abs(b.receivers(-1)[0]?.x ?? -WIDE)) / 2, y: OFF_BALL }),
  G: (b) => ({ x: -Math.min(23, Math.abs(b.receivers(-1)[0]?.x ?? -(WIDE - 2)) + 2), y: OFF_BALL }),
};

const MOTION_WORDS = ['MO', 'LT', 'RT', 'RIGHTY', 'LEFTY', 'SHORT', 'SHORTY', 'SH', 'CTR', 'COUNTER', 'FLY', 'HOME', 'BEHIND'];
const BACK_WORDS: Record<string, { back: 'H' | 'F'; side: 1 | -1 }> = { HAY: { back: 'H', side: 1 }, HAX: { back: 'H', side: -1 }, FOY: { back: 'F', side: 1 }, FOX: { back: 'F', side: -1 } };
const ALERT_WORDS = ['AL', 'ALERT', 'MAYBE', 'MIGHT', 'CAN'];

type Step = { tag: string; player?: string };

/** Split the words of a call into alignment steps, then motion steps (motions act on the aligned formation). */
export function readCallTags(call: CallTags): { alignment: Step[]; motion: Step[]; ignored: string[]; formationWords: string[] } {
  const alignment: Step[] = [];
  const motion: Step[] = [];
  const ignored: string[] = [];
  const formationWords: string[] = [];
  const pre = (call.pre ?? '').toUpperCase().replace(/[()]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (pre.length >= 2) for (const who of pre[0].split('-')) motion.push({ tag: pre[1], player: who });
  const t = call.post.map((w) => w.toUpperCase());
  for (let i = 0; i < t.length; i++) {
    const w = t[i];
    const next = t[i + 1];
    if (ALERT_WORDS.includes(w)) {
      ignored.push(...t.slice(i));
      break;
    }
    // "ZRT" / "YLT": OCR often drops the space between the letter and the word
    const glued = /^([XYZFH])(LT|RT|CTR)$/.exec(w);
    if (glued) motion.push({ tag: glued[2], player: glued[1] });
    else if (LETTERS.includes(w) && next && MOTION_WORDS.includes(next)) {
      motion.push({ tag: next, player: w });
      i += 1;
    } else if (w in ALIGNMENT) alignment.push({ tag: w });
    else if (w in BACK_WORDS || ['BUMP', 'LAB', 'RAT', 'TRIXIE'].includes(w)) motion.push({ tag: w });
    else if (w in H_LETTER && call.post.length > 0) alignment.push({ tag: w, player: 'H' });
    else if (call.formationWords?.includes(w)) formationWords.push(w);
    else ignored.push(w);
  }
  return { alignment, motion, ignored, formationWords };
}

/** Apply every tag of a call to a formation (strong-right space). Throws if a tag leaves anything but 7 men on the line. */
export function applyCallTags(base: Player[], call: CallTags): TagResult {
  const b = new Board(base);
  assertSevenOnLine(b.players, 'base formation');
  const steps = readCallTags(call);
  const dirSide = (word: 'LT' | 'RT') => ((word === call.direction ? 1 : -1) as 1 | -1);

  for (const s of steps.alignment) {
    if (s.player === 'H' && s.tag in H_LETTER) {
      const h = b.get('H');
      if (!h) continue;
      Object.assign(h, b.clear(H_LETTER[s.tag](b), h));
      b.note({ tag: s.tag, player: 'H', kind: 'alignment', basis: 'diagram', page: 24, effect: `H lines up at empty spot ${s.tag}` });
      assertSevenOnLine(b.players, `after H ${s.tag}`);
      continue;
    }
    const res = ALIGNMENT[s.tag](b);
    if (!res) b.review.push(`${s.tag} could not be applied: the formation has no player in the spot it moves`);
    else b.note({ tag: s.tag, kind: 'alignment', ...res });
    assertSevenOnLine(b.players, `after ${s.tag}`);
  }

  for (const s of steps.motion) {
    const tag = s.tag === 'SH' ? 'SHORT' : s.tag === 'CTR' ? 'COUNTER' : s.tag;
    const who = s.player ?? BACK_WORDS[tag]?.back ?? (tag === 'BUMP' ? (/^(21|12|22|23)/.test(call.personnel ?? '') && b.get('F') && inBackfield(b.get('F')!) ? 'F' : 'H') : tag === 'LAB' || tag === 'RAT' ? 'H' : undefined);
    const p = who ? b.get(who) : undefined;
    if (!p) {
      b.review.push(`${[s.player, s.tag].filter(Boolean).join(' ')}: no such player in this formation`);
      continue;
    }
    const spot = { x: p.x, y: p.y };
    const sign = (p.x < 0 ? -1 : 1) as 1 | -1;
    const offBall = (pt: Point): Point => ({ x: pt.x, y: Math.min(pt.y, OFF_BALL) });
    let from: Point = spot;
    let to: Point = spot;
    let via: Point[] | undefined;
    let basis: TagBasis = 'words';
    let page = 33;
    let effect = '';
    let kind: 'motion' | 'shift' = 'motion';

    if (tag === 'MO') {
      to = offBall(spot);
      from = b.clear({ x: -to.x, y: to.y }, p);
      effect = `${p.label} lines up away from the call and motions across into the called formation`;
    } else if (tag === 'LT' || tag === 'RT') {
      const side = dirSide(tag);
      from = offBall(spot);
      if (inBackfield(p)) {
        to = b.clear({ x: side * (b.emol(side) + 1.5), y: -1.5 }, p);
        basis = 'diagram';
        page = 31;
        effect = `${p.label} motions out of the backfield to the ${tag === 'LT' ? 'left' : 'right'}; the book says the landmark is specific to the play`;
      } else {
        const across = sign !== side;
        to = b.clear({ x: across ? -from.x : side * (Math.abs(b.receivers(side, p)[0]?.x ?? from.x) + 2), y: from.y }, p);
        effect = `${p.label} motions across the formation to the ${tag === 'LT' ? 'left' : 'right'}`;
      }
    } else if (tag === 'RIGHTY' || tag === 'LEFTY') {
      const side = dirSide(tag === 'RIGHTY' ? 'RT' : 'LT');
      from = offBall(spot);
      to = b.clear({ x: side * Math.min(23, Math.max(8, Math.abs(b.receivers(side, p)[0]?.x ?? 6) + 2)), y: OFF_BALL }, p);
      effect = `${p.label} motions across to an outside alignment on the ${tag === 'RIGHTY' ? 'right' : 'left'}`;
    } else if (tag === 'SHORTY') {
      from = offBall(spot);
      const two = b.receivers(sign, p)[1] ?? b.receivers(sign, p)[0];
      to = b.clear({ x: sign * Math.max(b.tackle(sign) + 1, Math.abs(two?.x ?? from.x) - 1), y: OFF_BALL }, p);
      effect = `${p.label} starts off the ball and motions toward the core, all the way inside the #2 receiver`;
    } else if (tag === 'SHORT') {
      from = offBall(spot);
      to = b.clear({ x: sign * Math.max(b.emol(sign, p) + 1.5, Math.abs(from.x) / 2), y: OFF_BALL }, p);
      basis = 'diagram';
      effect = `${p.label} starts off the ball and motions toward the core; the book says the landmark is specific to the play`;
    } else if (tag === 'COUNTER') {
      from = offBall(spot);
      to = from;
      via = [{ x: -sign * 1, y: Math.min(from.y, -1.5) }];
      basis = 'diagram';
      effect = `${p.label} motions across to the guard and counters back; the book says the landmark is specific to the play`;
    } else if (tag in BACK_WORDS) {
      const side = BACK_WORDS[tag].side;
      page = 32;
      to = b.clear({ x: side * Math.min(23, Math.abs(b.receivers(side)[0]?.x ?? WIDE - 2) + 2), y: OFF_BALL }, p);
      effect = `${p.label} lines up in the backfield and motions outside the farthest receiver on the ${side > 0 ? 'Y (strong)' : 'X (weak)'} side`;
    } else if (tag === 'HOME') {
      page = 32;
      from = offBall(spot);
      to = { x: 0, y: p.label === 'H' ? -7.5 : -5 };
      effect = `${p.label} motions home to the I in the backfield`;
    } else if (tag === 'FLY') {
      page = 34;
      const qb = b.players.find((q) => q.role === 'QB');
      from = offBall(spot);
      to = { x: sign * 1.5, y: qb && qb.y <= -4.5 ? qb.y + 1.5 : -3 };
      effect = `${p.label} starts off the ball and motions at full speed: in front of the QB in the gun, behind him at 3 yards under center`;
    } else if (tag === 'LAB' || tag === 'RAT') {
      page = 36;
      kind = 'shift';
      const side = dirSide(tag === 'LAB' ? 'LT' : 'RT');
      from = b.clear({ x: side * Math.min(23, Math.abs(b.receivers(side)[0]?.x ?? WIDE - 2) + 2), y: OFF_BALL }, p);
      effect = `${p.label} lines up empty as the widest receiver on the ${tag === 'LAB' ? 'left' : 'right'} and shifts back to the backfield`;
    } else {
      // BUMP, BEHIND, TRIXIE: the book gives no landmark in words (or it is a multi-step shift)
      b.review.push(`${[s.player, s.tag].filter(Boolean).join(' ')} is recorded but not drawn: the book gives no landmark for it (p-031 to p-037 say it is specific to the play)`);
      b.applied.push({ tag, player: p.label, kind: 'motion', basis: 'diagram', page: 31, effect: 'not drawn' });
      continue;
    }

    // a man in motion is never on the line: if he came off it, someone on his side steps up
    p.x = from.x;
    p.y = from.y;
    b.rebalance(`${p.label} ${tag}`, sign, [p]);
    p.x = to.x;
    p.y = to.y;
    if (Math.abs(from.x - to.x) > 0.01 || Math.abs(from.y - to.y) > 0.01 || via) p.motion = { from, tag, kind, ...(via ? { via } : {}) };
    b.note({ tag, player: p.label, kind, basis, page, effect });
    assertSevenOnLine(b.players, `after ${p.label} ${tag}`);
  }

  b.ignored = steps.ignored;
  const firstAlert = steps.ignored.findIndex((w) => ALERT_WORDS.includes(w));
  const unknown = firstAlert < 0 ? steps.ignored : steps.ignored.slice(0, firstAlert);
  for (const w of unknown) b.review.push(`${w} is not a tag this importer knows; nothing was moved for it`);
  // a formation-family name after the direction (p-149 prints "SWAMP RT STACK D") is the book's wording, not a tag
  const notes = steps.formationWords.map((w) => `The page prints the formation name ${w} after the direction; it is not a tag, so nothing was moved for it.`);
  return { players: b.players, applied: b.applied, review: b.review, ignored: b.ignored, notes };
}
