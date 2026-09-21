import { FIELD_PRESETS, FIELD_WIDTH_FT, HASH_PRESETS } from '@/model/constants';
import type { HashPreset } from '@/model/types';

/**
 * Horizontal alignment landmarks: real field spots that WR / TE / slot alignments snap to.
 * Add or remove a landmark by editing LANDMARK_DEFS; the snapping, flip, guides and readout all
 * read the resolved list and never look at a specific entry.
 *
 * Each definition is measured ONE way:
 *   yardsFromHash      + = outside the hash (toward the sideline), - = inside (toward the ball)
 *   yardsFromSideline  yards in from the sideline
 *   numbers            an edge of the painted numbers, taken from the active field preset
 *   side 'center'      the middle of the field
 * side 'both' generates a left and a right landmark ("hash+3-left", "hash+3-right").
 */
export type LandmarkDef = {
  id: string;
  label: string;
  side: 'both' | 'center';
  yardsFromHash?: number;
  yardsFromSideline?: number;
  numbers?: 'top' | 'mid' | 'bottom';
};

export const LANDMARK_DEFS: LandmarkDef[] = [
  { id: 'middle', label: 'Middle', side: 'center' },
  { id: 'hash-2', label: 'Hash -2', side: 'both', yardsFromHash: -2 },
  { id: 'hash-1', label: 'Hash -1', side: 'both', yardsFromHash: -1 },
  { id: 'hash', label: 'Hash', side: 'both', yardsFromHash: 0 },
  { id: 'hash+1', label: 'Hash +1', side: 'both', yardsFromHash: 1 },
  { id: 'hash+2', label: 'Hash +2', side: 'both', yardsFromHash: 2 },
  { id: 'hash+3', label: 'Hash +3', side: 'both', yardsFromHash: 3 },
  { id: 'hash+4', label: 'Hash +4', side: 'both', yardsFromHash: 4 },
  { id: 'hash+5', label: 'Hash +5', side: 'both', yardsFromHash: 5 },
  { id: 'numbers-top', label: 'Top #s', side: 'both', numbers: 'top' },
  { id: 'numbers-mid', label: 'Mid #s', side: 'both', numbers: 'mid' },
  { id: 'numbers-bottom', label: 'Bottom #s', side: 'both', numbers: 'bottom' },
  { id: 'sideline-4', label: '4 from SL', side: 'both', yardsFromSideline: 4 },
  { id: 'sideline-2', label: '2 from SL', side: 'both', yardsFromSideline: 2 },
];

export type LandmarkSide = 'left' | 'right' | 'center';

/** A landmark resolved for one field level. x is in yards from the middle of the field (the ball), + right. */
export type Landmark = {
  /** Stored on the player: "hash+3-right", "numbers-mid-left", "middle". */
  id: string;
  defId: string;
  label: string;
  side: LandmarkSide;
  x: number;
};

const round3 = (n: number) => Math.round(n * 1000) / 1000;
const HALF_FIELD_YD = FIELD_WIDTH_FT / 3 / 2;

/** Distance from the middle of the field, in yards, for one definition at one field level. */
function distanceFromMiddle(def: LandmarkDef, preset: HashPreset): number {
  const field = FIELD_PRESETS[preset];
  if (def.side === 'center') return 0;
  if (def.yardsFromHash !== undefined) return HASH_PRESETS[preset] + def.yardsFromHash;
  if (def.yardsFromSideline !== undefined) return HALF_FIELD_YD - def.yardsFromSideline;
  if (def.numbers) {
    const fromTop = def.numbers === 'top' ? 0 : def.numbers === 'mid' ? field.numbersHeightYd / 2 : field.numbersHeightYd;
    return HALF_FIELD_YD - (field.numbersTopYd - fromTop);
  }
  return 0;
}

const cache = new Map<HashPreset, Landmark[]>();

/** Every landmark for a field level, left to right. */
export function fieldLandmarks(preset: HashPreset): Landmark[] {
  const hit = cache.get(preset);
  if (hit) return hit;
  const out: Landmark[] = [];
  // two definitions that land on the same spot at this level: the first one listed keeps it
  const taken = (x: number) => out.some((l) => Math.abs(l.x - x) < 0.01);
  for (const def of LANDMARK_DEFS) {
    const d = round3(distanceFromMiddle(def, preset));
    if (d < 0 || d > HALF_FIELD_YD || taken(d)) continue;
    if (def.side === 'center' || d === 0) {
      out.push({ id: def.id, defId: def.id, label: def.label, side: 'center', x: 0 });
      continue;
    }
    out.push({ id: `${def.id}-left`, defId: def.id, label: def.label, side: 'left', x: -d });
    out.push({ id: `${def.id}-right`, defId: def.id, label: def.label, side: 'right', x: d });
  }
  out.sort((a, b) => a.x - b.x);
  cache.set(preset, out);
  return out;
}

export function landmarkById(landmarks: Landmark[], id: string | undefined): Landmark | undefined {
  return id ? landmarks.find((l) => l.id === id) : undefined;
}

/** The landmark a player at x is sitting on, if any. */
export function landmarkAtX(landmarks: Landmark[], x: number, eps = 0.005): Landmark | undefined {
  return landmarks.find((l) => Math.abs(l.x - x) <= eps);
}

export function nearestLandmark(landmarks: Landmark[], x: number): Landmark | undefined {
  let best: Landmark | undefined;
  for (const l of landmarks) if (!best || Math.abs(l.x - x) < Math.abs(best.x - x)) best = l;
  return best;
}

/** "hash+3-right" <-> "hash+3-left"; centre landmarks mirror onto themselves. */
export function mirrorLandmarkId(id: string): string {
  if (id.endsWith('-right')) return `${id.slice(0, -'-right'.length)}-left`;
  if (id.endsWith('-left')) return `${id.slice(0, -'-left'.length)}-right`;
  return id;
}

const sideTag = (l: Landmark) => (l.side === 'left' ? ' (L)' : l.side === 'right' ? ' (R)' : '');
const yards = (n: number) => String(Math.round(n * 100) / 100);

export type LandmarkReadout = {
  /** "Hash +3 (R)" when on a landmark, else "0.5 yd outside Bottom #s (L)". */
  text: string;
  aligned: boolean;
  landmark: Landmark | undefined;
  /** Yards off the landmark: + = toward the sideline (for Middle: + = right). */
  offset: number;
};

/** Where a player at x sits relative to the landmarks: the landmark's name, or the nearest one plus an offset. */
export function landmarkReadout(landmarks: Landmark[], x: number): LandmarkReadout {
  const on = landmarkAtX(landmarks, x);
  if (on) return { text: `${on.label}${sideTag(on)}`, aligned: true, landmark: on, offset: 0 };
  const near = nearestLandmark(landmarks, x);
  if (!near) return { text: `${yards(x)} yd from the ball`, aligned: false, landmark: undefined, offset: 0 };
  if (near.side === 'center') {
    return { text: `${yards(Math.abs(x))} yd ${x > 0 ? 'right' : 'left'} of ${near.label}`, aligned: false, landmark: near, offset: round3(x) };
  }
  const offset = round3(Math.abs(x) - Math.abs(near.x));
  return { text: `${yards(Math.abs(offset))} yd ${offset > 0 ? 'outside' : 'inside'} ${near.label}${sideTag(near)}`, aligned: false, landmark: near, offset };
}
