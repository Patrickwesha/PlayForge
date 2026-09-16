import { FIELD_WIDTH_YD, HASH_PRESETS } from '@/model/constants';
import type { HashPreset, ViewWindow } from '@/model/types';

export const HALF_FIELD = FIELD_WIDTH_YD / 2;

export function hashX(preset: HashPreset): number {
  return HASH_PRESETS[preset];
}

/** Yard-line y values (every 5 yards) visible inside the window. */
export function yardLines(w: ViewWindow, every = 5): number[] {
  const out: number[] = [];
  const start = Math.ceil(w.minY / every) * every;
  for (let y = start; y <= w.maxY; y += every) out.push(y);
  return out;
}

/** One-yard tick y values visible inside the window. */
export function yardTicks(w: ViewWindow): number[] {
  const out: number[] = [];
  const start = Math.ceil(w.minY);
  for (let y = start; y <= w.maxY; y += 1) out.push(y);
  return out;
}

export function sidelinesInWindow(w: ViewWindow): number[] {
  const xs: number[] = [];
  if (-HALF_FIELD >= w.minX && -HALF_FIELD <= w.maxX) xs.push(-HALF_FIELD);
  if (HALF_FIELD >= w.minX && HALF_FIELD <= w.maxX) xs.push(HALF_FIELD);
  return xs;
}
