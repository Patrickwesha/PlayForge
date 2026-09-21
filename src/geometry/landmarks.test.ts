import { describe, expect, it } from 'vitest';
import { FIELD_PRESETS, FIELD_WIDTH_FT, HASH_PRESETS } from '@/model/constants';
import type { Player } from '@/model/types';
import { playerSchema, settingsSchema } from '@/model/schema';
import { flipPlayer } from './flip';
import { LANDMARK_DEFS, fieldLandmarks, landmarkAtX, landmarkById, landmarkReadout, mirrorLandmarkId } from './landmarks';
import { snapPoint } from './snap';

const HALF = FIELD_WIDTH_FT / 3 / 2;
const nfl = fieldLandmarks('nfl');
const x = (id: string, set = nfl) => landmarkById(set, id)!.x;

describe('field presets', () => {
  it('derive the hash from the distance to the sideline', () => {
    expect(HASH_PRESETS.nfl).toBe(3.083); // 70'9" from the sideline, 18'6" apart
    expect(HASH_PRESETS.ncaa).toBe(6.667); // 60' from the sideline, 40' apart
    expect(HASH_PRESETS.hs).toBe(8.889); // thirds
    expect(HALF - FIELD_PRESETS.nfl.hashFromSidelineFt / 3).toBeCloseTo(HASH_PRESETS.nfl, 3);
  });
});

describe('fieldLandmarks', () => {
  it('builds both sides of every definition plus the middle, mirrored about the ball', () => {
    expect(nfl).toHaveLength((LANDMARK_DEFS.length - 1) * 2 + 1);
    for (const l of nfl) expect(x(mirrorLandmarkId(l.id))).toBeCloseTo(-l.x, 6);
    expect(x('middle')).toBe(0);
  });
  it('NFL: each yard around the hash, the three numbers edges, and the sideline spots', () => {
    expect(x('hash-right')).toBe(3.083);
    expect(x('hash+3-right')).toBe(6.083);
    expect(x('hash+5-left')).toBe(-8.083);
    expect(x('hash-2-right')).toBe(1.083);
    expect(x('numbers-top-right')).toBeCloseTo(HALF - 12, 3);
    expect(x('numbers-mid-right')).toBeCloseTo(HALF - 11, 3);
    expect(x('numbers-bottom-left')).toBeCloseTo(-(HALF - 10), 3);
    expect(x('sideline-2-right')).toBeCloseTo(HALF - 2, 3);
    expect(x('sideline-4-left')).toBeCloseTo(-(HALF - 4), 3);
  });
  it('recomputes for the college and high school levels', () => {
    expect(x('hash+3-right', fieldLandmarks('ncaa'))).toBe(9.667);
    expect(x('hash+3-right', fieldLandmarks('hs'))).toBe(11.889);
    expect(x('numbers-top-right', fieldLandmarks('ncaa'))).toBeCloseTo(HALF - 9, 3);
  });
});

describe('landmark snap', () => {
  const ctx = { others: [], landmarks: nfl };
  it('snaps x to Top / Mid / Bottom #s on both sides and names the spot', () => {
    for (const side of [1, -1]) {
      for (const [id, label] of [['numbers-top', 'Top #s'], ['numbers-mid', 'Mid #s'], ['numbers-bottom', 'Bottom #s']] as const) {
        const full = `${id}-${side === 1 ? 'right' : 'left'}`;
        const r = snapPoint({ x: x(full) + 0.3 * side, y: -1 }, ctx);
        expect(r.point.x).toBe(x(full));
        expect(r.landmarkId).toBe(full);
        expect(r.guides.find((g) => g.kind === 'landmark')).toMatchObject({ axis: 'x', id: full, label, at: -1 });
      }
    }
  });
  it('snaps at each yard outside the hash from +1 to +5', () => {
    for (let n = 1; n <= 5; n++) {
      expect(snapPoint({ x: HASH_PRESETS.nfl + n - 0.35, y: -1 }, ctx).landmarkId).toBe(`hash+${n}-right`);
      expect(snapPoint({ x: -(HASH_PRESETS.nfl + n) + 0.35, y: -1 }, ctx).landmarkId).toBe(`hash+${n}-left`);
    }
  });
  it('leaves depth to the row snap, and both apply at once', () => {
    const r = snapPoint({ x: 6.2, y: -0.9 }, { others: [{ x: -4, y: -1 }], landmarks: nfl });
    expect(r.point).toEqual({ x: 6.083, y: -1 });
    expect(r.guides.map((g) => g.kind).sort()).toEqual(['align', 'landmark']);
  });
  it('lets go past the threshold, and Alt turns it off', () => {
    expect(snapPoint({ x: 11.4, y: -1 }, ctx).landmarkId).toBeUndefined();
    const free = snapPoint({ x: 6.2, y: -1.13 }, { ...ctx, disabled: true });
    expect(free.point).toEqual({ x: 6.2, y: -1.13 });
    expect(free.guides).toEqual([]);
  });
  it('Shift-locking the sideways axis keeps x where the drag started', () => {
    const r = snapPoint({ x: 5.1, y: 3 }, { ...ctx, axisLock: { origin: { x: 5, y: -1 } } });
    expect(r.point.x).toBe(5);
    expect(r.landmarkId).toBeUndefined();
  });
  it('a closer next-to-me slot still beats the landmark', () => {
    const line = [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 }];
    expect(snapPoint({ x: 4.01, y: 0 }, { others: line, landmarks: nfl }).point.x).toBe(4);
    expect(snapPoint({ x: 4.07, y: 0 }, { others: line, landmarks: nfl }).landmarkId).toBe('hash+1-right');
  });
});

describe('landmark vs the evenly-between snap', () => {
  // QB under center and Z on the bottom of the numbers share a row: their midpoint (8.334) sits next to Hash +5 (8.083)
  const row = [{ x: 0, y: -1 }, { x: 16.667, y: -1 }];
  it('a landmark in range wins over the midpoint', () => {
    const r = snapPoint({ x: 8.38, y: -1 }, { others: row, teammates: row, landmarks: nfl });
    expect(r.landmarkId).toBe('hash+5-right');
    expect(r.point.x).toBe(8.083);
  });
  it('the midpoint still works where no landmark is in range', () => {
    const wide = [{ x: 3, y: 0 }, { x: 18, y: -1 }];
    const r = snapPoint({ x: 10.4, y: -1 }, { others: wide, teammates: wide, landmarks: nfl });
    expect(r.point.x).toBe(10.5);
    expect(r.guides.find((g) => g.axis === 'x')?.kind).toBe('between');
  });
});

describe('flip', () => {
  const base: Player = { id: 'p', side: 'offense', symbol: 'circle', label: 'Z', x: 6.083, y: -1 };
  it('mirrors an aligned player onto the matching landmark on the other side', () => {
    const f = flipPlayer({ ...base, alignment: 'hash+3-right' }, { landmarks: nfl });
    expect(f).toMatchObject({ x: -6.083, alignment: 'hash+3-left' });
    expect(flipPlayer(f, { landmarks: nfl })).toMatchObject({ x: 6.083, alignment: 'hash+3-right' });
  });
  it('uses the landmark of the active level, not the raw coordinate', () => {
    expect(flipPlayer({ ...base, alignment: 'hash+3-right' }, { landmarks: fieldLandmarks('ncaa') })).toMatchObject({ x: -9.667, alignment: 'hash+3-left' });
  });
  it('players without alignment data flip exactly as before', () => {
    const f = flipPlayer({ ...base, x: 18 }, { landmarks: nfl });
    expect(f.x).toBe(-18);
    expect('alignment' in f).toBe(false);
  });
});

describe('readout', () => {
  it('names the landmark, or the nearest one with an offset', () => {
    expect(landmarkReadout(nfl, 6.083).text).toBe('Hash +3 (R)');
    expect(landmarkReadout(nfl, -(HASH_PRESETS.nfl + 5 + 1.5)).text).toBe('1.5 yd outside Hash +5 (L)');
    expect(landmarkReadout(nfl, x('numbers-bottom-right') + 0.5).text).toBe('0.5 yd outside Bottom #s (R)');
    expect(landmarkReadout(nfl, x('numbers-top-left') + 0.25).text).toBe('0.25 yd inside Top #s (L)');
    expect(landmarkReadout(nfl, 0.5).text).toBe('0.5 yd right of Middle');
    expect(landmarkAtX(nfl, 18)).toBeUndefined();
  });
});

describe('saved data', () => {
  it('old players and settings parse unchanged; alignment survives a round trip', () => {
    const old = { id: 'a', side: 'offense', symbol: 'circle', label: 'X', x: -18, y: 0 };
    expect(playerSchema.parse(old)).toEqual(old);
    expect(playerSchema.parse({ ...old, alignment: 'numbers-mid-left' }).alignment).toBe('numbers-mid-left');
    expect(settingsSchema.parse({ hashPreset: 'ncaa', theme: 'plain', paper: 'letter', defaultPlayersPerSide: 11, flipSwapsXZ: false }).showLandmarks).toBe(false);
  });
});
