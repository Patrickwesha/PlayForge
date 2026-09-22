import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FORMATION_FIT, MAX_READABLE_WIDTH_YD, diagramBounds, fitReport, fitWindow } from '@/geometry/bounds';
import { UNITS_PER_YARD } from '@/model/constants';
import type { Diagram } from '@/model/types';
import { DEFENSE_FORMATIONS, DEMO_PLAYS, OFFENSE_FORMATIONS, PACKERS_2019_FORMATIONS, PACKERS_2019_PLAYS } from '@/seeds';
import { PlayThumb } from './PlayThumb';

/**
 * Walk the rendered SVG and return the box every drawn element occupies, in viewBox units.
 * Handles the transforms the renderer uses (translate on groups, rotate on annotation text, which
 * is measured as if unrotated) and every element type it emits. Text width is estimated.
 */
function drawnBox(svg: string): { minX: number; maxX: number; minY: number; maxY: number; count: number } {
  const box = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, count: 0 };
  const stack: { x: number; y: number }[] = [{ x: 0, y: 0 }];
  const num = (attrs: string, name: string) => {
    const m = new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(attrs);
    return m ? Number(m[1]) : undefined;
  };
  const add = (x: number, y: number) => {
    const t = stack[stack.length - 1];
    const px = x + t.x;
    const py = y + t.y;
    box.minX = Math.min(box.minX, px);
    box.maxX = Math.max(box.maxX, px);
    box.minY = Math.min(box.minY, py);
    box.maxY = Math.max(box.maxY, py);
  };
  const pairs = (list: string) => {
    const n = list.match(/-?\d*\.?\d+(?:e-?\d+)?/g)?.map(Number) ?? [];
    for (let i = 0; i + 1 < n.length; i += 2) add(n[i], n[i + 1]);
  };
  const tagRe = /<(\/?)([a-zA-Z]+)([^>]*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  let inMask = false; // mask cut-outs are wider copies of the lines and are never drawn
  while ((m = tagRe.exec(svg))) {
    const [, closing, tag, attrs, selfClosing] = m;
    if (tag === 'mask') {
      inMask = !closing;
      continue;
    }
    if (inMask) continue;
    if (closing) {
      if (tag === 'g' || tag === 'svg') stack.pop();
      continue;
    }
    if (tag === 'g' || tag === 'svg') {
      const t = /translate\(\s*(-?[\d.]+)[ ,]+(-?[\d.]+)\s*\)/.exec(attrs);
      const cur = stack[stack.length - 1];
      stack.push(t ? { x: cur.x + Number(t[1]), y: cur.y + Number(t[2]) } : { ...cur });
      if (selfClosing) stack.pop();
      continue;
    }
    if (tag === 'defs' || tag === 'mask' || tag === 'style' || tag === 'title') continue;
    box.count += 1;
    switch (tag) {
      case 'circle': {
        const cx = num(attrs, 'cx') ?? 0;
        const cy = num(attrs, 'cy') ?? 0;
        const r = num(attrs, 'r') ?? 0;
        add(cx - r, cy - r);
        add(cx + r, cy + r);
        break;
      }
      case 'ellipse': {
        const cx = num(attrs, 'cx') ?? 0;
        const cy = num(attrs, 'cy') ?? 0;
        add(cx - (num(attrs, 'rx') ?? 0), cy - (num(attrs, 'ry') ?? 0));
        add(cx + (num(attrs, 'rx') ?? 0), cy + (num(attrs, 'ry') ?? 0));
        break;
      }
      case 'rect': {
        if (/width="[^"]*%"/.test(attrs)) break; // the paper background fills the viewport by definition
        const x = num(attrs, 'x') ?? 0;
        const y = num(attrs, 'y') ?? 0;
        add(x, y);
        add(x + (num(attrs, 'width') ?? 0), y + (num(attrs, 'height') ?? 0));
        break;
      }
      case 'line':
        add(num(attrs, 'x1') ?? 0, num(attrs, 'y1') ?? 0);
        add(num(attrs, 'x2') ?? 0, num(attrs, 'y2') ?? 0);
        break;
      case 'polyline':
      case 'polygon':
        pairs(/points="([^"]*)"/.exec(attrs)?.[1] ?? '');
        break;
      case 'path': {
        // control points are not drawn: sample each cubic along its curve
        const d = /\sd="([^"]*)"/.exec(attrs)?.[1] ?? '';
        let cur = { x: 0, y: 0 };
        for (const cmd of d.match(/[MLCQTAHVZ][^MLCQTAHVZ]*/gi) ?? []) {
          const letter = cmd[0].toUpperCase();
          const n = cmd.slice(1).match(/-?\d*\.?\d+(?:e-?\d+)?/g)?.map(Number) ?? [];
          if (letter === 'A') {
            for (let i = 5; i + 1 < n.length; i += 7) add(n[i], n[i + 1]);
            if (n.length >= 7) cur = { x: n[n.length - 2], y: n[n.length - 1] };
          } else if (letter === 'C') {
            for (let i = 0; i + 5 < n.length; i += 6) {
              const [x1, y1, x2, y2, x, y] = n.slice(i, i + 6);
              for (let k = 0; k <= 16; k++) {
                const t = k / 16;
                const u = 1 - t;
                add(u * u * u * cur.x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x, u * u * u * cur.y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y);
              }
              cur = { x, y };
            }
          } else if (letter === 'M' || letter === 'L' || letter === 'T') {
            pairs(cmd.slice(1));
            if (n.length >= 2) cur = { x: n[n.length - 2], y: n[n.length - 1] };
          }
        }
        break;
      }
      case 'text': {
        const x = num(attrs, 'x') ?? 0;
        const y = num(attrs, 'y') ?? 0;
        const size = num(attrs, 'font-size') ?? 0;
        const text = svg.slice(tagRe.lastIndex, svg.indexOf('</text>', tagRe.lastIndex));
        const w = text.replace(/<[^>]*>/g, '').length * size * 0.62;
        add(x - w / 2, y - size / 2);
        add(x + w / 2, y + size / 2);
        break;
      }
      default:
        box.count -= 1;
    }
  }
  return box;
}

const formationDiagram = (players: Diagram['players']): Diagram => ({ players, paths: {}, annotations: {} });
const LIBRARY: { name: string; diagram: Diagram; fit?: typeof FORMATION_FIT }[] = [
  ...DEMO_PLAYS.map((p) => ({ name: p.name, diagram: p.diagram })),
  ...PACKERS_2019_PLAYS.map((p) => ({ name: p.rawCall ?? p.name, diagram: p.diagram })),
  ...[...OFFENSE_FORMATIONS, ...DEFENSE_FORMATIONS, ...PACKERS_2019_FORMATIONS].map((f) => ({ name: `${f.name} [${f.personnel ?? f.side}]`, diagram: formationDiagram(f.players), fit: FORMATION_FIT })),
];
const ASPECTS = [4 / 3, 1.5, 1.6, 1];

describe('every play in the library fits its thumbnail', () => {
  it(`renders ${LIBRARY.length} diagrams at ${ASPECTS.length} aspects with every drawn element inside the viewBox`, () => {
    const tolerance = 0.02 * UNITS_PER_YARD; // half a stroke
    const failures: string[] = [];
    for (const { name, diagram, fit } of LIBRARY) {
      for (const aspect of ASPECTS) {
        const view = fitWindow(diagramBounds(diagram), aspect, fit);
        const svg = renderToStaticMarkup(<PlayThumb diagram={diagram} aspect={aspect} view={view} />);
        const vb = /viewBox="([^"]+)"/.exec(svg)![1].split(/\s+/).map(Number);
        const [vx, vy, vw, vh] = vb;
        const box = drawnBox(svg);
        expect(box.count, name).toBeGreaterThan(5);
        const out = [];
        if (box.minX < vx - tolerance) out.push(`left by ${((vx - box.minX) / UNITS_PER_YARD).toFixed(2)} yd`);
        if (box.maxX > vx + vw + tolerance) out.push(`right by ${((box.maxX - vx - vw) / UNITS_PER_YARD).toFixed(2)} yd`);
        if (box.minY < vy - tolerance) out.push(`top by ${((vy - box.minY) / UNITS_PER_YARD).toFixed(2)} yd`);
        if (box.maxY > vy + vh + tolerance) out.push(`bottom by ${((box.maxY - vy - vh) / UNITS_PER_YARD).toFixed(2)} yd`);
        if (out.length) failures.push(`${name} @ ${aspect.toFixed(2)}: ${out.join(', ')}`);
      }
    }
    expect(failures, failures.join('\n')).toEqual([]);
  });

  it('keeps the aspect ratio exactly and never goes below the minimum window', () => {
    for (const { diagram, fit } of LIBRARY) {
      const v = fitWindow(diagramBounds(diagram), 4 / 3, fit);
      expect((v.maxX - v.minX) / (v.maxY - v.minY)).toBeCloseTo(4 / 3, 6);
      expect(v.minX).toBeLessThanOrEqual(-18);
      expect(v.maxX).toBeGreaterThanOrEqual(18);
      expect(v.minY).toBeLessThanOrEqual(-8);
      expect(v.maxY).toBeGreaterThanOrEqual(fit ? 5 : 15);
    }
  });

  it('samples the curve, not the control points: a bent route can overshoot them', () => {
    const d: Diagram = {
      players: { a: { id: 'a', side: 'offense', symbol: 'circle', label: 'Z', x: 10, y: 0 } },
      paths: { r: { id: 'r', anchor: { kind: 'player', playerId: 'a' }, points: [{ x: 0, y: 0 }, { x: 0, y: 10, bend: { x: 9, y: 5 } }], end: 'arrow', line: 'solid', role: 'route' } },
      annotations: {},
    };
    const b = diagramBounds(d)!;
    expect(b.maxX).toBeGreaterThan(10 + 4); // the quadratic through a control point at +9 bows out past x = 14
    expect(b.maxY).toBeGreaterThan(10.3); // the arrowhead reaches past the end point
  });

  it('reports the plays whose line ends up too small to read instead of squashing them', () => {
    const wide = PACKERS_2019_PLAYS.filter((p) => fitReport(p.diagram, 4 / 3).lineTooSmall).map((p) => p.rawCall);
    // this list is the report, not a limit: it is printed by `npm run render:plays` (compose-report.json)
    expect(wide.length).toBeLessThan(PACKERS_2019_PLAYS.length / 10);
    for (const p of PACKERS_2019_PLAYS) {
      const r = fitReport(p.diagram, 4 / 3);
      expect(r.lineTooSmall).toBe(r.widthYd > MAX_READABLE_WIDTH_YD);
    }
  });
});
