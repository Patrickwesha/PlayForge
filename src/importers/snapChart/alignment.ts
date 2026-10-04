/**
 * Alignment labels -> yards. The one place a charted label ("slot", "gun_offset", "wing") becomes a
 * player position. Every distance comes from ./config.
 */
import type { Player, SnapHash, SnapStrength } from '@/model/types';
import { BACK_SPOT, FIELD, LABELS, LINE, QB_DEPTH, RECEIVER, type BackAlign } from './config';

export type AlignedPos = 'QB' | 'RB' | 'TE' | 'WR';
export type AlignedSide = 'L' | 'R' | 'C';

/** A charted player: labels only, no coordinates. The JSON's player shape, normalized. */
export type AlignedPlayer = {
  pos: AlignedPos;
  name?: string | null;
  side: AlignedSide;
  align: string;
  on_line?: boolean | null;
  order?: number | null;
  stack_behind?: number | boolean | null;
  id_unknown?: boolean | null;
  /** Exact spot (yards from the ball): overrides the label placement. */
  at?: { x: number; y: number } | null;
  /** Job letter to draw instead of the importer's pick. */
  label?: string | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100 + 0;
const HALF_FIELD = FIELD.widthYd / 2;
/** Hash marks this far from the middle of the field (unrounded; 3.07 in the NFL). */
export const HASH_FROM_MIDDLE = HALF_FIELD - FIELD.hashFromSidelineYd;
/** Numbers this far from the middle of the field (unrounded; 14.67 in the NFL). */
export const NUMBERS_FROM_MIDDLE = HALF_FIELD - FIELD.numbersFromSidelineYd;

/** Where the numbers are, in yards from the BALL, on each side, for a ball on the given hash. Rounded once, here. */
export function numbersForHash(hash: SnapHash | undefined): { L: number; R: number } {
  // Left hash: the ball is HASH_FROM_MIDDLE left of the middle, so the left numbers are near and the right far.
  if (hash === 'Left') return { L: r2(NUMBERS_FROM_MIDDLE - HASH_FROM_MIDDLE), R: r2(NUMBERS_FROM_MIDDLE + HASH_FROM_MIDDLE) };
  if (hash === 'Right') return { L: r2(NUMBERS_FROM_MIDDLE + HASH_FROM_MIDDLE), R: r2(NUMBERS_FROM_MIDDLE - HASH_FROM_MIDDLE) };
  return { L: r2(NUMBERS_FROM_MIDDLE), R: r2(NUMBERS_FROM_MIDDLE) };
}

export const isBackAlign = (align: string): align is BackAlign => align in BACK_SPOT;

/** Backs and the quarterback are placed from the backfield table; everyone else is a receiver. */
export function isBackfieldPlayer(p: AlignedPlayer): boolean {
  if (p.pos === 'QB') return true;
  if (isBackAlign(p.align)) return true;
  return p.side === 'C' && !p.order;
}

/** on_line defaults to true, except a wing is always off the ball. */
export function isOnLine(p: AlignedPlayer): boolean {
  if (p.align === 'wing') return false;
  return p.on_line ?? true;
}

export type PlacedPlayer = { p: AlignedPlayer; x: number; y: number };

const strongSide = (strength: SnapStrength | undefined): AlignedSide => (strength === 'Lt' ? 'L' : 'R');

/** Order receivers on one side: by `order` (1 = closest to the ball), then as listed. */
function sideOrder(players: AlignedPlayer[], side: AlignedSide): AlignedPlayer[] {
  return players
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.side === side)
    .sort((a, b) => (a.p.order ?? 99) - (b.p.order ?? 99) || a.i - b.i)
    .map(({ p }) => p);
}

/**
 * Place one side's receivers, as distances from the ball (positive). The end man starts at the tackle
 * and moves out as inline / tight players are put on the line; slot / numbers / wide are field spots.
 */
function placeSide(receivers: AlignedPlayer[], numbersX: number, warnings: string[], label: string): PlacedPlayer[] {
  const placed: PlacedPlayer[] = [];
  let endMan = LINE.tackleX;
  const lastWithLabel = new Map<string, PlacedPlayer>();
  const deferredStacks: AlignedPlayer[] = [];
  for (const p of receivers) {
    if (p.stack_behind) {
      deferredStacks.push(p);
      continue;
    }
    const onLine = isOnLine(p);
    let x: number;
    let y = onLine ? 0 : -RECEIVER.offBallDepth;
    let fieldSpot = false;
    switch (p.align) {
      case 'inline':
        x = endMan + RECEIVER.inlineOutsideEndMan;
        if (onLine) endMan = x;
        break;
      case 'wing':
        x = endMan + RECEIVER.wingOutsideEndMan;
        y = -RECEIVER.wingOffBall;
        break;
      case 'tight':
        x = endMan + RECEIVER.tightOutsideEndMan;
        if (onLine) endMan = x;
        break;
      case 'slot':
        x = LINE.tackleX + (numbersX - LINE.tackleX) * RECEIVER.slotFractionTackleToNumbers;
        fieldSpot = true;
        break;
      case 'numbers':
        x = numbersX + RECEIVER.numbersMidFromTop;
        fieldSpot = true;
        break;
      case 'wide':
        x = numbersX + RECEIVER.wideOutsideNumbers;
        fieldSpot = true;
        break;
      default:
        warnings.push(`${label}: alignment "${p.align}" is not known, placed in the slot`);
        x = LINE.tackleX + (numbersX - LINE.tackleX) * RECEIVER.slotFractionTackleToNumbers;
        fieldSpot = true;
    }
    // a second slot / numbers / wide on the same side (bunch, trips) steps outside the previous one
    if (fieldSpot) {
      const prev = lastWithLabel.get(p.align);
      if (prev) x = Math.max(x, prev.x + RECEIVER.sameLabelStep);
      lastWithLabel.set(p.align, { p, x, y });
    }
    // never draw two symbols on top of each other: nudge outward along the row
    while (placed.some((q) => Math.abs(q.y - y) < 0.5 && Math.abs(q.x - x) < RECEIVER.minGap)) x += RECEIVER.nudgeStep;
    const pp = { p, x, y };
    if (fieldSpot) lastWithLabel.set(p.align, pp);
    placed.push(pp);
  }
  for (const p of deferredStacks) {
    const target =
      typeof p.stack_behind === 'number'
        ? placed.find((q) => q.p.order === p.stack_behind)
        : [...placed].reverse().find((q) => (q.p.order ?? 0) < (p.order ?? 99)) ?? placed[placed.length - 1];
    if (!target) {
      warnings.push(`${label}: stack_behind with nobody in front, placed in the slot`);
      placed.push({ p, x: LINE.tackleX + (numbersX - LINE.tackleX) * RECEIVER.slotFractionTackleToNumbers, y: -RECEIVER.offBallDepth });
      continue;
    }
    placed.push({ p, x: target.x, y: target.y - RECEIVER.stackBehindDepth });
  }
  return placed;
}

function placeBacks(backs: AlignedPlayer[], backfieldAlign: keyof typeof QB_DEPTH, warnings: string[], label: string): PlacedPlayer[] {
  const placed: PlacedPlayer[] = [];
  for (const p of backs) {
    let x = 0;
    let y: number;
    if (p.pos === 'QB') {
      const depth = (QB_DEPTH as Record<string, number>)[p.align] ?? QB_DEPTH[backfieldAlign];
      if (!(p.align in QB_DEPTH)) warnings.push(`${label}: QB alignment "${p.align}" is not known, used the backfield (${backfieldAlign})`);
      y = -depth;
    } else {
      const spot = isBackAlign(p.align) ? BACK_SPOT[p.align] : undefined;
      if (!spot) warnings.push(`${label}: back alignment "${p.align}" is not known, placed deep`);
      const s = spot ?? BACK_SPOT.deep;
      const sign = p.side === 'L' ? -1 : p.side === 'R' ? 1 : 0;
      x = sign * s.x;
      y = -s.depth;
    }
    while (placed.some((q) => Math.hypot(q.x - x, q.y - y) < RECEIVER.minGap)) y -= 1.5;
    placed.push({ p, x, y });
  }
  return placed;
}

/** Spot letters for the skill players: Y/U/V tight ends, H/F backs, Z strong outside, X weak outside, F/W inside. */
function assignLabels(placed: PlacedPlayer[], strength: SnapStrength | undefined): Map<PlacedPlayer, string> {
  const labels = new Map<PlacedPlayer, string>();
  const used = new Set<string>();
  const take = (pref: readonly string[], i: number) => {
    const want = pref[Math.min(i, pref.length - 1)];
    let l = want;
    let n = 2;
    while (used.has(l)) l = `${want}${n++}`;
    used.add(l);
    return l;
  };
  const strong = strongSide(strength);
  // Y = the strong-side tight end nearest the ball (the inline one), then U, V outward and to the weak side
  const bySideThenIn = (a: PlacedPlayer, b: PlacedPlayer) => Number(b.p.side === strong) - Number(a.p.side === strong) || Math.abs(a.x) - Math.abs(b.x) || b.y - a.y;
  for (const q of placed.filter((q) => q.p.pos === 'QB')) labels.set(q, LABELS.qb);
  used.add(LABELS.qb);
  const tes = placed.filter((q) => q.p.pos === 'TE').sort(bySideThenIn);
  tes.forEach((q, i) => labels.set(q, take(LABELS.tightEnds, i)));
  const backs = placed.filter((q) => q.p.pos === 'RB' && isBackfieldPlayer(q.p)).sort((a, b) => b.y - a.y);
  backs.forEach((q, i) => labels.set(q, take(LABELS.backs, i)));
  // a back split out as a receiver keeps a back's letter
  const splitBacks = placed.filter((q) => q.p.pos === 'RB' && !isBackfieldPlayer(q.p));
  splitBacks.forEach((q, i) => labels.set(q, take(LABELS.backs, backs.length + i)));
  const wrs = placed.filter((q) => q.p.pos === 'WR');
  const strongWrs = wrs.filter((q) => q.p.side === strong).sort((a, b) => Math.abs(b.x) - Math.abs(a.x));
  const weakWrs = wrs.filter((q) => q.p.side !== strong).sort((a, b) => Math.abs(b.x) - Math.abs(a.x));
  const rest: PlacedPlayer[] = [];
  if (strongWrs.length) labels.set(strongWrs[0], take([LABELS.strongOutside], 0));
  if (weakWrs.length) labels.set(weakWrs[0], take([LABELS.weakOutside], 0));
  rest.push(...strongWrs.slice(1), ...weakWrs.slice(1));
  rest.sort((a, b) => Math.abs(a.x) - Math.abs(b.x));
  rest.forEach((q, i) => labels.set(q, take(LABELS.insideReceivers, i)));
  return labels;
}

export type PlaceOptions = {
  hash?: SnapHash;
  strength?: SnapStrength;
  backfield: 'Under Center' | 'Gun' | 'Pistol';
  /** Player ids are `${idPrefix}-${spot}`. */
  idPrefix: string;
  /** For warnings. */
  label?: string;
};

const BACKFIELD_QB: Record<PlaceOptions['backfield'], keyof typeof QB_DEPTH> = { 'Under Center': 'under_center', Gun: 'gun', Pistol: 'pistol' };

/**
 * Build the eleven players of a formation from charted labels: the standard five-man line, then every
 * charted player (a null name or id_unknown still gets drawn, labelled by position). If no QB was
 * charted one is drawn from the backfield.
 */
export function placePlayers(charted: AlignedPlayer[], opts: PlaceOptions): { players: Record<string, Player>; placed: PlacedPlayer[]; warnings: string[] } {
  const warnings: string[] = [];
  const label = opts.label ?? opts.idPrefix;
  const numbers = numbersForHash(opts.hash);
  const list = charted.some((p) => p.pos === 'QB') ? charted : [...charted, { pos: 'QB' as const, side: 'C' as const, align: BACKFIELD_QB[opts.backfield] }];
  const backs = list.filter(isBackfieldPlayer);
  const receivers = list.filter((p) => !isBackfieldPlayer(p));
  const placed: PlacedPlayer[] = [
    ...placeBacks(backs, BACKFIELD_QB[opts.backfield], warnings, label),
    ...placeSide(sideOrder(receivers, 'R'), numbers.R, warnings, label),
    ...placeSide(sideOrder(receivers, 'L'), numbers.L, warnings, label).map((q) => ({ ...q, x: -q.x })),
  ];
  const centre = receivers.filter((p) => p.side === 'C');
  if (centre.length) {
    warnings.push(`${label}: ${centre.length} receiver(s) with side C placed on the right`);
    placed.push(...placeSide(centre, numbers.R, warnings, label));
  }
  // a hand-drawn alignment wins over the label placement
  for (const q of placed) {
    if (q.p.at) {
      q.x = q.p.at.x;
      q.y = q.p.at.y;
    }
  }
  const labels = assignLabels(placed, opts.strength);
  const forced = new Set(placed.map((q) => q.p.label).filter((l): l is string => !!l));
  for (const q of placed) {
    if (q.p.label) labels.set(q, q.p.label);
    else if (forced.has(labels.get(q) ?? '')) labels.set(q, `${labels.get(q)}2`);
  }

  const players: Record<string, Player> = {};
  const line: [string, number][] = [
    ['lt', -2 * LINE.spacing],
    ['lg', -LINE.spacing],
    ['c', 0],
    ['rg', LINE.spacing],
    ['rt', 2 * LINE.spacing],
  ];
  for (const [spot, x] of line) {
    const id = `${opts.idPrefix}-${spot}`;
    players[id] = { id, side: 'offense', symbol: spot === 'c' ? 'square' : 'circle', label: '', x, y: 0, role: spot === 'c' ? 'C' : 'OL' };
  }
  for (const q of placed) {
    const l = labels.get(q) ?? q.p.pos;
    const id = `${opts.idPrefix}-${l.toLowerCase()}`;
    players[id] = { id, side: 'offense', symbol: 'circle', label: l, x: r2(q.x), y: r2(q.y), role: q.p.pos };
  }
  return { players, placed, warnings };
}
