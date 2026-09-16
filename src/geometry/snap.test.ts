import { describe, expect, it } from 'vitest';
import { snapPoint, snapWaypoint } from './snap';

describe('snapPoint', () => {
  const others = [{ x: 3, y: 0 }, { x: -12, y: -1 }];
  it('aligns to another player before the grid', () => {
    const r = snapPoint({ x: 3.2, y: -0.9 }, { others });
    expect(r.point).toEqual({ x: 3, y: -1 });
    expect(r.guides.map((g) => g.kind)).toEqual(['align', 'align']);
  });
  it('falls back to the grid', () => {
    const r = snapPoint({ x: 7.3, y: -4.4 }, { others, grid: 0.5 });
    expect(r.point).toEqual({ x: 7.5, y: -4.5 });
    expect(r.guides).toEqual([]);
  });
  it('snaps to hashes and mirrored players', () => {
    expect(snapPoint({ x: 6.5, y: 5 }, { others: [], hashX: 6.667 }).guides[0].kind).toBe('hash');
    expect(snapPoint({ x: 11.8, y: 5 }, { others, symmetry: true }).point.x).toBe(12);
  });
  it('snaps y to the LOS', () => {
    expect(snapPoint({ x: 20, y: 0.2 }, { others: [] }).guides.find((g) => g.axis === 'y')?.kind).toBe('los');
  });
  it('honors disabled and axis lock', () => {
    expect(snapPoint({ x: 3.2, y: -0.9 }, { others, disabled: true }).point).toEqual({ x: 3.2, y: -0.9 });
    const r = snapPoint({ x: 5, y: 1 }, { others: [], axisLock: { origin: { x: 0, y: 0 } }, disabled: true });
    expect(r.point).toEqual({ x: 5, y: 0 });
  });
});

describe('snapWaypoint', () => {
  it('aligns with the previous point, else grid', () => {
    expect(snapWaypoint({ x: 0.2, y: 5.3 }, { x: 0, y: 0 }).point).toEqual({ x: 0, y: 5.5 });
    expect(snapWaypoint({ x: 2.2, y: 5.3 }, null).point).toEqual({ x: 2, y: 5.5 });
  });
});
