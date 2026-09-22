import { ANNOTATION_SIZE, ARROW_HALF_W, ARROW_LEN, LETTER_SIZE, SQUARE_SIDE, SQUIGGLE_AMP, STROKE, SYMBOL_R, SYMBOL_STROKE, TBAR_HALF_W } from '@/model/constants';
import type { Diagram, Path, Player, ViewWindow } from '@/model/types';
import { motionPoints } from './motion';
import { resolvePoints, samplePolyline, toSegments } from './path';
import { estimateTextWidth } from '@/render/svgText';

export type BBox = { minX: number; maxX: number; minY: number; maxY: number };

/** How far a player's symbol reaches from its centre, in yards, stroke included. */
export function symbolExtent(p: Player): { x: number; y: number } {
  const half = SYMBOL_STROKE / 2;
  switch (p.symbol) {
    case 'letter': {
      const size = p.label.length > 2 ? LETTER_SIZE * 0.72 : p.label.length > 1 ? LETTER_SIZE * 0.85 : LETTER_SIZE;
      return { x: Math.max(estimateTextWidth(p.label || 'X', size) / 2, LETTER_SIZE * 0.35), y: size / 2 };
    }
    case 'square':
      return { x: SQUARE_SIDE / 2 + half, y: SQUARE_SIDE / 2 + half };
    case 'triangle':
      return { x: SYMBOL_R * 1.1 + half, y: SYMBOL_R * 1.15 + half };
    case 'diamond':
      return { x: SYMBOL_R * 1.2 + half, y: SYMBOL_R * 1.2 + half };
    case 'oval':
      return { x: SYMBOL_R * 1.25 + half, y: SYMBOL_R * 0.8 + half };
    default:
      return { x: SYMBOL_R + half, y: SYMBOL_R + half };
  }
}

/** How far a path's end marker can reach from the end point, in yards. */
function markerReach(path: Path): number {
  const scale = STROKE[path.width ?? 'normal'] / STROKE.normal;
  switch (path.end) {
    case 'arrow':
      return Math.max(ARROW_LEN * scale, ARROW_HALF_W * scale) + STROKE.normal;
    case 'openArrow':
      return Math.max(ARROW_LEN * 1.1 * scale, 0.34 * scale) + STROKE.normal;
    case 'tbar':
      return TBAR_HALF_W * Math.max(1, scale * 0.9) + STROKE.normal;
    case 'tbarAngled':
    case 'tbarAngledL':
      return TBAR_HALF_W * 1.15 + STROKE.normal;
    case 'dot':
      return 0.25;
    default:
      return STROKE.thick / 2;
  }
}

/**
 * The box every drawn thing fits in: player symbols and labels, ghosts and motion paths, every path
 * sampled along its real curve (not its control points) plus its stroke, squiggle, inserts and end
 * marker, and annotations. Null for an empty diagram.
 */
export function diagramBounds(d: Diagram): BBox | null {
  let b: BBox | null = null;
  const grow = (x: number, y: number, padX = 0, padY = padX) => {
    if (!b) b = { minX: x - padX, maxX: x + padX, minY: y - padY, maxY: y + padY };
    else {
      b.minX = Math.min(b.minX, x - padX);
      b.maxX = Math.max(b.maxX, x + padX);
      b.minY = Math.min(b.minY, y - padY);
      b.maxY = Math.max(b.maxY, y + padY);
    }
  };
  for (const p of Object.values(d.players)) {
    const e = symbolExtent(p);
    grow(p.x, p.y, e.x, e.y);
    if (p.motion) {
      grow(p.motion.from.x, p.motion.from.y, e.x, e.y);
      for (const m of motionPoints(p)) grow(m.x, m.y, STROKE.normal);
    }
  }
  for (const path of Object.values(d.paths)) {
    const pts = resolvePoints(path, d.players);
    if (pts.length === 0) continue;
    const width = STROKE[path.width ?? 'normal'];
    // stroke, the yellow underlay, a squiggle's swing, and an insert glyph can all sit off the centre line
    const side = width / 2 + (path.primary ? 0.32 : 0) + (path.line === 'squiggle' ? SQUIGGLE_AMP : 0) + (path.inserts?.length ? 0.35 : 0);
    for (const s of samplePolyline(toSegments(pts), 0.1)) grow(s.x, s.y, side);
    const end = pts[pts.length - 1];
    grow(end.x, end.y, markerReach(path));
  }
  for (const a of Object.values(d.annotations)) {
    if (a.kind === 'text') {
      const size = ANNOTATION_SIZE[a.size ?? 'md'];
      const w = estimateTextWidth(a.text, size);
      if (a.rotate) grow(a.x, a.y, size / 2 + 0.1, w / 2 + 0.1);
      else grow(a.x, a.y, w / 2 + 0.1, size / 2 + 0.1);
    } else if (a.mark === 'zoneBubble') {
      const r = a.r ?? 2.5;
      grow(a.x, a.y, r + 0.1, r * 0.75 + 0.1);
    } else grow(a.x, a.y, 0.75);
  }
  return b;
}

export type FitOptions = {
  /** Clear space between the outermost drawn thing and the edge, in yards. */
  pad?: number;
  /** The window always shows at least this much: behind the line, downfield, and either side of the ball. */
  minBack?: number;
  minDown?: number;
  minSide?: number;
};

/** The window every thumbnail starts from (yards). Formations use a shallower one. */
export const FIT_DEFAULTS = { pad: 1.25, minBack: 8, minDown: 15, minSide: 18 } as const;
export const FORMATION_FIT: FitOptions = { minDown: 5, minBack: 8, minSide: 18 };

/**
 * Choose a view window that shows everything in the bbox at the requested aspect (w/h).
 * Starts from the minimum window around the ball, grows to fit the content plus padding, then widens
 * or deepens (never crops, never stretches) to reach the aspect.
 */
export function fitWindow(bbox: BBox | null, aspect: number, opts: FitOptions = {}): ViewWindow {
  const pad = opts.pad ?? FIT_DEFAULTS.pad;
  const side = opts.minSide ?? FIT_DEFAULTS.minSide;
  const b: BBox = {
    minX: Math.min(-side, bbox ? bbox.minX - pad : 0),
    maxX: Math.max(side, bbox ? bbox.maxX + pad : 0),
    minY: Math.min(-(opts.minBack ?? FIT_DEFAULTS.minBack), bbox ? bbox.minY - pad : 0),
    maxY: Math.max(opts.minDown ?? FIT_DEFAULTS.minDown, bbox ? bbox.maxY + pad : 0),
  };
  let w = b.maxX - b.minX;
  let h = b.maxY - b.minY;
  if (w / h < aspect) w = h * aspect;
  else h = w / aspect;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return { minX: cx - w / 2, maxX: cx + w / 2, minY: cy - h / 2, maxY: cy + h / 2 };
}

/**
 * The offensive line has to stay readable: when one long path (a screen, a jet motion) makes the window
 * this wide, a lineman's circle is under 1.5% of the card and the play should be looked at, not squashed.
 */
export const MAX_READABLE_WIDTH_YD = 56;

export type FitReport = { view: ViewWindow; widthYd: number; heightYd: number; lineTooSmall: boolean };

/** Fit a diagram and say whether the line ends up too small to read. */
export function fitReport(d: Diagram, aspect: number, opts: FitOptions = {}): FitReport {
  const view = fitWindow(diagramBounds(d), aspect, opts);
  const widthYd = view.maxX - view.minX;
  return { view, widthYd, heightYd: view.maxY - view.minY, lineTooSmall: widthYd > MAX_READABLE_WIDTH_YD };
}
