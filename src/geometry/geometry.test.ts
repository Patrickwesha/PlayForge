import { describe, expect, it } from 'vitest';
import { fromSvg, toSvg, viewBox, zoomWindow } from './transform';
import { buildD, endTangent, shortenEnd, toSegments, trimStart } from './path';
import { arrowHead, tBar } from './markers';
import { flipDiagram, flipLabel, flipName } from './flip';
import { applyRouteTree } from './routeTree';
import { diagramBounds, fitWindow } from './bounds';
import { LAYOUTS, paginate, perPage, sheetMetrics } from './layout';
import { UNITS_PER_YARD } from '@/model/constants';
import type { Diagram, Player } from '@/model/types';
import { OFFENSE_FORMATIONS, DEFENSE_FORMATIONS, DEMO_PLAYS } from '@/seeds';
import { formationSchema, playSchema } from '@/model/schema';

const W = { minX: -20, maxX: 20, minY: -10, maxY: 15 };

describe('transform', () => {
  it('round-trips yards <-> svg', () => {
    const p = { x: 3.25, y: -4.5 };
    const s = toSvg(p, W);
    expect(fromSvg(s, W)).toEqual(p);
  });
  it('puts the ball at the horizontal center and flips y', () => {
    const s = toSvg({ x: 0, y: 0 }, W);
    expect(s.x).toBeCloseTo(20 * UNITS_PER_YARD);
    expect(s.y).toBeCloseTo(15 * UNITS_PER_YARD);
    expect(toSvg({ x: 0, y: 5 }, W).y).toBeLessThan(s.y);
  });
  it('viewBox matches window size', () => {
    expect(viewBox(W)).toBe(`0 0 ${(40 * UNITS_PER_YARD).toFixed(3)} ${(25 * UNITS_PER_YARD).toFixed(3)}`);
  });
  it('zoom keeps the anchor fixed', () => {
    const about = { x: 5, y: 2 };
    const z = zoomWindow(W, 2, about);
    const before = toSvg(about, W);
    const after = toSvg(about, z);
    expect(after.x / (z.maxX - z.minX)).toBeCloseTo(before.x / (W.maxX - W.minX));
    expect(z.maxX - z.minX).toBeCloseTo(20);
  });
});

describe('path', () => {
  const id = (p: { x: number; y: number }) => p;
  it('builds straight lines for corner points', () => {
    const d = buildD(toSegments([{ x: 0, y: 0 }, { x: 0, y: 5 }, { x: 3, y: 5 }]), id);
    expect(d).toBe('M 0.00 0.00 L 0.00 5.00 L 3.00 5.00');
  });
  it('emits cubic segments around smooth points', () => {
    const d = buildD(toSegments([{ x: 0, y: 0 }, { x: 0, y: 5, smooth: true }, { x: 5, y: 5 }]), id);
    expect(d.split(' C ').length).toBe(3);
    expect(d.startsWith('M 0.00 0.00 C')).toBe(true);
  });
  it('end tangent is the last segment direction', () => {
    expect(endTangent([{ x: 0, y: 0 }, { x: 0, y: 5 }])).toEqual({ x: 0, y: 1 });
    const t45 = endTangent([{ x: 0, y: 0 }, { x: 0, y: 5 }, { x: 5, y: 10 }]);
    expect(t45.x).toBeCloseTo(Math.SQRT1_2);
    expect(t45.y).toBeCloseTo(Math.SQRT1_2);
    expect(endTangent([{ x: 0, y: 0 }, { x: 5, y: 0 }])).toEqual({ x: 1, y: 0 });
  });
  it('trims the start by the symbol radius', () => {
    const t = trimStart([{ x: 0, y: 0 }, { x: 0, y: 5 }], 0.5);
    expect(t[0]).toEqual({ x: 0, y: 0.5 });
    expect(trimStart([{ x: 0, y: 0 }, { x: 0, y: 0.6 }], 0.5)[0]).toEqual({ x: 0, y: 0 });
  });
  it('shortens the end along the tangent', () => {
    const s = shortenEnd([{ x: 0, y: 0 }, { x: 0, y: 5 }], 1);
    expect(s[1].y).toBeCloseTo(4);
  });
});

describe('markers', () => {
  it('arrowhead points for a vertical path', () => {
    const [tip, l, r] = arrowHead({ x: 0, y: 10 }, { x: 0, y: 1 }, 1, 0.5);
    expect(tip).toEqual({ x: 0, y: 10 });
    expect(l.y).toBeCloseTo(9);
    expect(Math.abs(l.x)).toBeCloseTo(0.5);
    expect(r.x).toBeCloseTo(-l.x);
  });
  it('t-bar is perpendicular', () => {
    const [a, b] = tBar({ x: 0, y: 2 }, { x: 0, y: 1 }, 0.5);
    expect(a.y).toBeCloseTo(2);
    expect(b.y).toBeCloseTo(2);
    expect(Math.abs(a.x - b.x)).toBeCloseTo(1);
  });
});

describe('flip', () => {
  const players: Record<string, Player> = {
    lt: { id: 'lt', side: 'offense', symbol: 'circle', label: 'LT', x: -2, y: 0 },
    x: { id: 'x', side: 'offense', symbol: 'circle', label: 'X', x: -12, y: 0, shade: 'left' },
  };
  const d: Diagram = {
    players,
    paths: { r: { id: 'r', anchor: { kind: 'player', playerId: 'x' }, points: [{ x: 0, y: 0 }, { x: 3, y: 5, smooth: true }, { x: 6, y: 5 }], end: 'arrow', line: 'solid', role: 'route' } },
    annotations: { a: { id: 'a', kind: 'text', x: 4, y: -2, text: 'PIN', style: 'redCaps' } },
  };
  it('mirrors x, swaps LT/RT and shades', () => {
    const f = flipDiagram(d);
    expect(f.players.lt.x).toBe(2);
    expect(f.players.lt.label).toBe('RT');
    expect(f.players.x.shade).toBe('right');
    expect(f.paths.r.points[1]).toEqual({ x: -3, y: 5, smooth: true });
    expect(f.annotations.a.x).toBe(-4);
  });
  it('is an involution', () => {
    expect(flipDiagram(flipDiagram(d))).toEqual(d);
  });
  it('swaps X/Z only when asked', () => {
    expect(flipLabel('X')).toBe('X');
    expect(flipLabel('X', { swapXZ: true })).toBe('Z');
  });
  it('flips names', () => {
    expect(flipName('BEAST RIGHT')).toBe('BEAST LEFT');
    expect(flipName('TRIPS RT')).toBe('TRIPS LT');
    expect(flipName('Beast Left (Base)')).toBe('Beast Right (Base)');
    expect(flipName('SNUG')).toBe('SNUG');
  });
});

describe('routeTree', () => {
  const right: Player = { id: 'z', side: 'offense', symbol: 'circle', label: 'Z', x: 12, y: -1 };
  const left: Player = { ...right, id: 'x', label: 'X', x: -12 };
  it('mirrors for left-side receivers', () => {
    const r = applyRouteTree(5, right);
    const l = applyRouteTree(5, left);
    expect(r.points[2].x).toBeGreaterThan(0);
    expect(l.points[2].x).toBeLessThan(0);
    expect(l.points[2].x).toBe(-r.points[2].x);
    expect(l.anchor).toEqual({ kind: 'player', playerId: 'x' });
  });
  it('scales depth', () => {
    expect(applyRouteTree(9, right, { scale: 0.5 }).points[1].y).toBe(9);
  });
});

describe('bounds', () => {
  it('fitWindow keeps the LOS band and matches aspect', () => {
    const w = fitWindow({ minX: -5, maxX: 5, minY: 5, maxY: 12 }, 2);
    expect(w.minY).toBeLessThanOrEqual(-3);
    expect((w.maxX - w.minX) / (w.maxY - w.minY)).toBeCloseTo(2, 6);
    expect((w.minX + w.maxX) / 2).toBeCloseTo(0);
  });
  it('bounds cover players and routes', () => {
    const b = diagramBounds(DEMO_PLAYS[0].diagram)!;
    expect(b.minX).toBeLessThan(-10);
    expect(b.maxY).toBeGreaterThan(3);
  });
});

describe('layout', () => {
  it('paginates 14 plays into 6/6/2 for 6up', () => {
    const pages = paginate(Array.from({ length: 14 }, (_, i) => i), perPage('6up'));
    expect(pages.map((p) => p.length)).toEqual([6, 6, 2]);
  });
  it('computes positive cell metrics for every layout and paper', () => {
    for (const id of Object.keys(LAYOUTS) as (keyof typeof LAYOUTS)[]) {
      for (const paper of ['letter', 'a4'] as const) {
        const m = sheetMetrics(id, paper);
        expect(m.svgW).toBeGreaterThan(1);
        expect(m.svgH).toBeGreaterThan(0.8);
        expect(m.aspect).toBeGreaterThan(0.5);
      }
    }
    expect(sheetMetrics('4up', 'letter').pageW).toBe(11);
  });
});

describe('seeds', () => {
  it('formations validate and have the right player counts', () => {
    for (const f of [...OFFENSE_FORMATIONS, ...DEFENSE_FORMATIONS]) {
      expect(formationSchema.safeParse(f).success, f.name).toBe(true);
      expect(Object.keys(f.players).length, f.name).toBe(f.playersPerSide);
    }
  });
  it('demo plays validate and every path anchor resolves', () => {
    for (const p of DEMO_PLAYS) {
      const r = playSchema.safeParse(p);
      expect(r.success, p.name + JSON.stringify(r.success ? '' : r.error.issues[0])).toBe(true);
      for (const path of Object.values(p.diagram.paths)) {
        if (path.anchor.kind === 'player') expect(p.diagram.players[path.anchor.playerId], `${p.name} ${path.id}`).toBeDefined();
      }
    }
  });
});
