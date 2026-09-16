import { UNITS_PER_YARD as U } from '@/model/constants';
import type { Point, ViewWindow } from '@/model/types';

/** Yards -> SVG user units. */
export const yd = (n: number) => n * U;

export function windowWidth(w: ViewWindow) { return w.maxX - w.minX; }
export function windowHeight(w: ViewWindow) { return w.maxY - w.minY; }
export function windowAspect(w: ViewWindow) { return windowWidth(w) / windowHeight(w); }

/** SVG viewBox string for a window. Origin is the top-left of the window. */
export function viewBox(w: ViewWindow): string {
  return `0 0 ${(windowWidth(w) * U).toFixed(3)} ${(windowHeight(w) * U).toFixed(3)}`;
}

/** Yards -> SVG units inside a window. y is flipped: downfield is up on paper. */
export function toSvg(p: Point, w: ViewWindow): Point {
  return { x: (p.x - w.minX) * U, y: (w.maxY - p.y) * U };
}

/** SVG units -> yards. */
export function fromSvg(p: Point, w: ViewWindow): Point {
  return { x: p.x / U + w.minX, y: w.maxY - p.y / U };
}

export function windowFromCenter(cx: number, cy: number, width: number, height: number): ViewWindow {
  return { minX: cx - width / 2, maxX: cx + width / 2, minY: cy - height / 2, maxY: cy + height / 2 };
}

export function panWindow(w: ViewWindow, dxYd: number, dyYd: number): ViewWindow {
  return { minX: w.minX + dxYd, maxX: w.maxX + dxYd, minY: w.minY + dyYd, maxY: w.maxY + dyYd };
}

/** Zoom by factor (>1 zooms in) keeping the given yard point fixed on screen. */
export function zoomWindow(w: ViewWindow, factor: number, about: Point): ViewWindow {
  const nw = windowWidth(w) / factor;
  const nh = windowHeight(w) / factor;
  const fx = (about.x - w.minX) / windowWidth(w);
  const fy = (about.y - w.minY) / windowHeight(w);
  const minX = about.x - fx * nw;
  const minY = about.y - fy * nh;
  return { minX, maxX: minX + nw, minY, maxY: minY + nh };
}

/** Expand or shrink a window so its aspect (w/h) matches, keeping the center. */
export function matchAspect(w: ViewWindow, aspect: number): ViewWindow {
  const cw = windowWidth(w);
  const ch = windowHeight(w);
  const cx = (w.minX + w.maxX) / 2;
  const cy = (w.minY + w.maxY) / 2;
  let nw = cw;
  let nh = ch;
  if (cw / ch < aspect) nw = ch * aspect; else nh = cw / aspect;
  return windowFromCenter(cx, cy, nw, nh);
}
