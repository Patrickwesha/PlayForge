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

describe('row spacing', () => {
  const line = [{ x: -2, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }];
  it('offers the next slot at the row gap', () => {
    const r = snapPoint({ x: 2.2, y: 0.1 }, { others: line });
    expect(r.point).toEqual({ x: 2, y: 0 });
    expect(r.guides.find((g) => g.axis === 'x')).toMatchObject({ kind: 'spacing', ref: 1 });
  });
  it('prefers the open slot beside a row mate over aligning on top of it', () => {
    const r = snapPoint({ x: 1.7, y: 0.05 }, { others: line });
    expect(r.point).toEqual({ x: 2, y: 0 });
    expect(r.guides.find((g) => g.axis === 'x')?.kind).toBe('spacing');
    // mirrored positions that are already occupied are not offered either
    const s = snapPoint({ x: 1.2, y: 0.05 }, { others: [{ x: -1, y: 0 }, { x: 1, y: 0 }], symmetry: true, grid: 0 });
    expect(s.guides.find((g) => g.axis === 'x')?.kind).not.toBe('symmetry');
  });
  it('uses a 1 yd gap when there is a single neighbour, and midpoints of wide gaps', () => {
    expect(snapPoint({ x: 4.1, y: 0 }, { others: [{ x: 3, y: 0 }] }).point.x).toBe(4);
    expect(snapPoint({ x: 3.1, y: 0 }, { others: [{ x: 0, y: 0 }, { x: 6, y: 0 }] }).point.x).toBe(3);
  });
});

describe('evenly between', () => {
  // Trio Rt shape: end man on the ball at x=3, receiver on the numbers off the ball at x=18
  const team = [{ x: -2, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }, { x: 18, y: -1 }, { x: 0, y: -5 }, { x: 1, y: -6 }];
  it('centres a slot between an on-the-ball end man and an off-the-ball receiver', () => {
    const r = snapPoint({ x: 10.1, y: -1.05 }, { others: team, teammates: team });
    expect(r.point).toEqual({ x: 10.5, y: -1 });
    expect(r.guides.find((g) => g.axis === 'x')).toMatchObject({ kind: 'between', ref: 3, ref2: 18, at: -1 });
  });
  it('has a wider catch than the other snaps and works from either side', () => {
    expect(snapPoint({ x: 11.0, y: -1 }, { others: team, teammates: team }).point.x).toBe(10.5);
    expect(snapPoint({ x: 9.98, y: -1 }, { others: team, teammates: team }).point.x).toBe(10.5);
    expect(snapPoint({ x: 8.9, y: -1 }, { others: team, teammates: team }).point.x).toBe(9);
  });
  it('ignores the defense and deep backs when finding neighbours', () => {
    const defense = [{ x: 9, y: 1.2 }, { x: 12, y: 0.5 }];
    const r = snapPoint({ x: 10.3, y: -1 }, { others: [...team, ...defense], teammates: team });
    expect(r.point.x).toBe(10.5);
    expect(r.guides.find((g) => g.axis === 'x')?.kind).toBe('between');
  });
  it('stays out of the way inside the box', () => {
    const r = snapPoint({ x: 1.5, y: -1 }, { others: team, teammates: team });
    expect(r.guides.find((g) => g.axis === 'x')?.kind).not.toBe('between');
  });
});

describe('snapWaypoint angle snap', () => {
  it('snaps to 45 degree increments and keeps the length', () => {
    const r = snapWaypoint({ x: 1.9, y: 2.1 }, { x: 0, y: 0 }, { angleSnap: 45 });
    expect(r.point.x).toBeCloseTo(r.point.y, 5);
    expect(Math.hypot(r.point.x, r.point.y)).toBeCloseTo(Math.hypot(1.9, 2.1), 2);
    expect(snapWaypoint({ x: 0.2, y: 5.3 }, { x: 0, y: 0 }).point).toEqual({ x: 0.2, y: 5.3 });
    const up = snapWaypoint({ x: 0.2, y: 3 }, { x: 0, y: 0 }, { angleSnap: 45 });
    expect(up.point.x).toBeCloseTo(0, 5);
  });
});

describe('snapWaypoint', () => {
  it('aligns with the previous point, else grid', () => {
    expect(snapWaypoint({ x: 0.2, y: 5.3 }, { x: 0, y: 0 }, { grid: 0.5, threshold: 0.3 }).point).toEqual({ x: 0, y: 5.5 });
    expect(snapWaypoint({ x: 2.2, y: 5.3 }, null, { grid: 0.5 }).point).toEqual({ x: 2, y: 5.5 });
  });
});
