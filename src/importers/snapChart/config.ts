/**
 * Every constant the snap-chart import uses to turn alignment labels into yards, in one place.
 * Units are yards. x = 0 at the ball, + right (offense's view). y = 0 at the line of scrimmage;
 * the offense sits at negative y, so a depth of 5 is stored as y = -5.
 */
import { FIELD_WIDTH_YD, OL_SPACING } from '@/model/constants';

/** NFL field: hashes 23.6 yd from each sideline (18'6" apart), numbers 12 yd from the sideline. */
export const FIELD = {
  widthYd: FIELD_WIDTH_YD,
  hashFromSidelineYd: 23.6,
  numbersFromSidelineYd: 12,
} as const;

/** The standard five-man line: centers OL_SPACING apart, tackles at 2 * OL_SPACING. */
export const LINE = {
  spacing: OL_SPACING,
  tackleX: 2 * OL_SPACING,
} as const;

/** Receiver alignment labels (the JSON's `align` values). Distances in yards. */
export const RECEIVER = {
  /** inline = this far outside the current end man, on the line */
  inlineOutsideEndMan: 1,
  /** wing = this far outside the end man and this far off the ball */
  wingOutsideEndMan: 1,
  wingOffBall: 1,
  /** tight = this far outside the end man */
  tightOutsideEndMan: 3,
  /** slot = halfway between the tackle and the numbers (a fraction of that gap, 0.5 = halfway) */
  slotFractionTackleToNumbers: 0.5,
  /** wide = this far outside the numbers */
  wideOutsideNumbers: 3,
  /** on_line false */
  offBallDepth: 1,
  /** stack_behind = this far directly behind the player in front */
  stackBehindDepth: 2,
  /** A second player given the same field label on the same side (bunch, trips) lines up this far outside the previous one. */
  sameLabelStep: 1.5,
  /** Two symbols on the same row closer than this are nudged apart (outward), in steps of `nudgeStep`. */
  minGap: 1,
  nudgeStep: 1,
} as const;

/** Quarterback depth by backfield / align label. */
export const QB_DEPTH = {
  under_center: 1,
  pistol: 4,
  gun: 5,
} as const;

/** Backs: lateral offset from the ball (toward their side) and depth. */
export const BACK_SPOT = {
  deep: { x: 0, depth: 7 },
  offset: { x: 1.5, depth: 7 },
  gun_offset: { x: 1.5, depth: QB_DEPTH.gun },
  pistol_back: { x: 0, depth: 7 },
  fb: { x: 0, depth: 4.5 },
  /** H-back off the tackle's hip (the JSON's `wing_back`). */
  wing_back: { x: LINE.tackleX + 1, depth: 1.5 },
} as const;
export type BackAlign = keyof typeof BACK_SPOT;

export const RECEIVER_ALIGNS = ['inline', 'wing', 'tight', 'slot', 'numbers', 'wide'] as const;
export type ReceiverAlign = (typeof RECEIVER_ALIGNS)[number];

/** Short words used in generated formation names: "11 Gun 2x2 Rt". */
export const FAMILY_SHORT: Record<string, string> = {
  "2x2 'D'": '2x2',
  "3x1 'T'": '3x1',
  "Bunch 'B'": 'Bunch',
  Big: 'Big',
  Empty: 'Empty',
  '2 Back': '2 Back',
  "2x2 Stack 'S'": 'Stack',
};
export const BACKFIELD_SHORT = { 'Under Center': 'UC', Gun: 'Gun', Pistol: 'Pistol' } as const;

/** Player labels. Spots are jobs: Y is the TE, Z the strong outside receiver, X the weak one, H the back. */
export const LABELS = {
  qb: 'Q',
  tightEnds: ['Y', 'U', 'V'],
  backs: ['H', 'F'],
  /** Outermost strong receiver, outermost weak receiver, then the inside receivers from the ball out. */
  strongOutside: 'Z',
  weakOutside: 'X',
  insideReceivers: ['F', 'W', 'E', 'A'],
} as const;

export const TAGS = {
  /** Every formation whose only snaps were built from a template (no exact alignment seen on film). */
  templateVerify: 'template, verify',
  /** Source tag on everything the Eagles import creates. */
  pack: 'eagles-2026',
} as const;

/** Formation ids are `${FORMATION_ID_PREFIX}${hash(signature)}`; snap ids are `${team}-${season}-${playId}`. */
export const FORMATION_ID_PREFIX = 'snapform-';
