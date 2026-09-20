import { ANNOTATION_SIZE, LETTER_SIZE, SYMBOL_R } from '@/model/constants';
import type { Diagram, ViewWindow } from '@/model/types';
import { resolvePoints } from './path';
import { estimateTextWidth } from '@/render/svgText';

export type BBox = { minX: number; maxX: number; minY: number; maxY: number };

export function diagramBounds(d: Diagram): BBox | null {
  let b: BBox | null = null;
  const grow = (x: number, y: number, pad = 0) => {
    if (!b) b = { minX: x - pad, maxX: x + pad, minY: y - pad, maxY: y + pad };
    else {
      b.minX = Math.min(b.minX, x - pad);
      b.maxX = Math.max(b.maxX, x + pad);
      b.minY = Math.min(b.minY, y - pad);
      b.maxY = Math.max(b.maxY, y + pad);
    }
  };
  for (const p of Object.values(d.players)) {
    grow(p.x, p.y, p.symbol === 'letter' ? LETTER_SIZE / 2 : SYMBOL_R);
    if (p.motion) for (const m of [p.motion.from, ...(p.motion.via ?? [])]) grow(m.x, m.y, SYMBOL_R);
  }
  for (const path of Object.values(d.paths)) for (const pt of resolvePoints(path, d.players)) grow(pt.x, pt.y, 0.4);
  for (const a of Object.values(d.annotations)) {
    if (a.kind === 'text') {
      const size = ANNOTATION_SIZE[a.size ?? 'md'];
      const w = estimateTextWidth(a.text, size);
      grow(a.x - w / 2, a.y - size / 2);
      grow(a.x + w / 2, a.y + size / 2);
    } else grow(a.x, a.y, a.r ?? 0.6);
  }
  return b;
}

export type FitOptions = {
  pad?: number;
  minW?: number;
  minH?: number;
  /** Content beyond these limits is cropped rather than shrinking the symbols. */
  maxW?: number;
  maxH?: number;
  /** Depth limits (yards) applied to the content before fitting. */
  maxDown?: number;
  maxBack?: number;
  losBand?: number;
};

/**
 * Choose a view window that contains the bbox at the requested aspect (w/h).
 * Keeps x = 0 centered when possible and always shows the LOS band.
 */
export function fitWindow(bbox: BBox | null, aspect: number, opts: FitOptions = {}): ViewWindow {
  const pad = opts.pad ?? 1.5;
  const minW = opts.minW ?? 26;
  const minH = opts.minH ?? 14;
  const maxW = opts.maxW ?? 44;
  const maxH = opts.maxH ?? 28;
  const maxDown = opts.maxDown ?? 15;
  const maxBack = opts.maxBack ?? 9;
  const band = opts.losBand ?? 3;
  const b: BBox = bbox ? { ...bbox } : { minX: -10, maxX: 10, minY: -5, maxY: 10 };
  b.minY = Math.max(Math.min(b.minY, -band), -maxBack);
  b.maxY = Math.min(Math.max(b.maxY, band), maxDown);
  let w = Math.min(Math.max(b.maxX - b.minX + 2 * pad, minW), maxW);
  let h = Math.min(Math.max(b.maxY - b.minY + 2 * pad, minH), maxH);
  if (w / h < aspect) w = h * aspect; else h = w / aspect;
  const bcx = (b.minX + b.maxX) / 2;
  const cx = Math.abs(b.minX) + pad <= w / 2 && Math.abs(b.maxX) + pad <= w / 2 ? 0 : bcx;
  const cy = (b.minY + b.maxY) / 2;
  return { minX: cx - w / 2, maxX: cx + w / 2, minY: cy - h / 2, maxY: cy + h / 2 };
}
