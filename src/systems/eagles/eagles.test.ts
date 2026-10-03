import { describe, expect, it } from 'vitest';
import type { AlignedPlayer } from '@/importers/snapChart/alignment';
import { nameFormation } from './nameFormation';
import { nameMotion } from './nameMotion';

const qb = (align = 'under_center'): AlignedPlayer => ({ pos: 'QB', side: 'C', align });
const back = (align = 'deep', side: 'L' | 'R' | 'C' = 'C'): AlignedPlayer => ({ pos: 'RB', side, align });
const r = (pos: 'TE' | 'WR' | 'RB', side: 'L' | 'R', order: number, align: string, on = true): AlignedPlayer => ({ pos, side, align, on_line: on, order });
const call = (players: AlignedPlayer[], backfield: 'Under Center' | 'Gun' | 'Pistol' = 'Under Center', extra: { strength?: 'Rt' | 'Lt'; formFamily?: string; personnel?: string } = {}) =>
  nameFormation({ personnel: extra.personnel ?? '11', backfield, players, ...extra });

describe('nameFormation', () => {
  it('Y inline with two receivers outside him is Trips; the lone receiver away reduced is Tight', () => {
    const c = call([qb(), back(), r('TE', 'R', 1, 'inline'), r('WR', 'R', 2, 'slot', false), r('WR', 'R', 3, 'wide', false), r('WR', 'L', 1, 'tight')]);
    expect(c.name).toBe('Trips Rt Tight');
    expect(c.alternates).toEqual(['Trio', 'Trax']);
  });

  it('the call goes to the Y, not to the passing strength', () => {
    const c = call([qb('gun'), back('gun_offset', 'L'), r('TE', 'L', 1, 'inline'), r('WR', 'R', 1, 'slot', false), r('WR', 'R', 2, 'slot', false), r('WR', 'R', 3, 'wide')], 'Gun', { strength: 'Rt' });
    expect(c.name).toBe('Gun Fast Lt');
    expect(c.back).toBe('strong');
    expect(c.notes.join(' ')).toMatch(/passing strength/);
  });

  it('2x2: Dice, Dyno when the Y is flexed, Close when the Z is reduced, Deuce with a tight end each side', () => {
    const weak = [r('WR', 'L', 1, 'slot', false), r('WR', 'L', 2, 'wide')];
    expect(call([qb(), back(), r('TE', 'R', 1, 'inline'), r('WR', 'R', 2, 'wide', false), ...weak]).name).toBe('Dice Rt');
    expect(call([qb(), back(), r('TE', 'R', 1, 'tight'), r('WR', 'R', 2, 'wide', false), ...weak]).name).toBe('Dyno Rt');
    expect(call([qb(), back(), r('TE', 'R', 1, 'inline'), r('WR', 'R', 2, 'tight', false), ...weak]).name).toBe('Dice Rt Close');
    expect(call([qb(), back(), r('TE', 'R', 1, 'inline'), r('WR', 'R', 2, 'wide', false), r('TE', 'L', 1, 'inline'), r('WR', 'L', 2, 'wide')], 'Under Center', { strength: 'Rt', personnel: '12' }).name).toBe('Deuce Rt');
  });

  it('two tight ends together: West when the second is a wing outside the Y, plus Slot when both receivers are away', () => {
    const tes = [r('TE', 'R', 1, 'inline'), r('TE', 'R', 2, 'wing', false)];
    expect(call([qb(), back(), ...tes, r('WR', 'R', 3, 'wide'), r('WR', 'L', 1, 'wide')], 'Under Center', { personnel: '12' }).name).toBe('West Rt');
    expect(call([qb(), back(), ...tes, r('WR', 'L', 1, 'slot', false), r('WR', 'L', 2, 'wide')], 'Under Center', { personnel: '12' }).name).toBe('West Rt Slot');
  });

  it('bunch words follow the tight end: inside Bunch, point Bin, outside Buddy', () => {
    const x = r('WR', 'L', 1, 'wide');
    const b = (te: number) => [1, 2, 3].map((o) => r(o === te ? 'TE' : 'WR', 'R', o, 'tight', o === 2));
    expect(call([qb(), back(), ...b(1), x]).base).toBe('Bunch');
    expect(call([qb(), back(), ...b(2), x]).base).toBe('Bin');
    expect(call([qb(), back(), ...b(3), x]).base).toBe('Buddy');
  });

  it('empty: the other four are named and the back gets his letter (A widest strong ... G widest weak)', () => {
    const c = call([qb('gun'), r('TE', 'L', 1, 'inline'), r('WR', 'L', 2, 'slot', false), r('WR', 'L', 3, 'wide'), r('WR', 'R', 1, 'slot', false), r('RB', 'R', 2, 'wide')], 'Gun');
    expect(c.name).toBe('Gun Trips Lt G');
    expect(c.family).toBe('Empty');
  });

  it('two backs under center: I, Strong, Weak by where the second back stands', () => {
    const rest = [r('TE', 'R', 1, 'inline'), r('WR', 'R', 2, 'wide', false), r('WR', 'L', 1, 'wide')];
    expect(call([qb(), back(), back('fb'), ...rest], 'Under Center', { personnel: '21' }).name).toBe('I Rt');
    expect(call([qb(), back(), back('offset', 'R'), ...rest], 'Under Center', { personnel: '21' }).name).toBe('Strong Rt');
    expect(call([qb(), back(), back('offset', 'L'), ...rest], 'Under Center', { personnel: '21' }).name).toBe('Weak Rt');
  });
});

describe('nameMotion', () => {
  it('reads who / from / path / timing', () => {
    expect(nameMotion('M.Brown / wide R / jet across the formation toward L / at snap', 'Under Center')?.call).toBe('WR Fly');
    expect(nameMotion('D.Goedert / inline R / across the formation to L (behind LT-LG) / at snap', 'Gun')?.call).toBe('Y Lt');
    expect(nameMotion('Lemon / L slot / across backfield to R / at snap.', 'Gun')?.call).toBe('WR Behind');
    expect(nameMotion('Lemon / outside R / across to slot L / at snap', 'Gun')?.call).toBe('WR Lefty');
    expect(nameMotion('Wicks / wide L / in tight to LT / at snap.', 'Under Center')?.call).toBe('WR Short');
    expect(nameMotion('T.Bigsby / off the ball wide R / into the backfield beside QB / at snap', 'Gun')).toMatchObject({ call: 'H Rat', kind: 'shift' });
    expect(nameMotion('R slot / in toward box / at snap', 'Gun')?.call).toBe('WR Short');
    expect(nameMotion(undefined, 'Gun')).toBeUndefined();
  });
});
