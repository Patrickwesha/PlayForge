import { describe, expect, it } from 'vitest';
import { placePlayers, type AlignedPlayer } from '@/importers/snapChart/alignment';
import { matchFormation } from './matchFormation';

const drawn = (pos: 'TE' | 'WR', side: 'L' | 'R', order: number, x: number, y: number, label: string): AlignedPlayer => ({ pos, side, align: 'tight', on_line: y === 0, order, at: { x, y }, label });
const uc: AlignedPlayer[] = [{ pos: 'QB', side: 'C', align: 'under_center' }, { pos: 'RB', side: 'C', align: 'deep' }];
const name = (personnel: string, players: AlignedPlayer[]) => {
  const { placed } = placePlayers(players, { hash: 'Middle', strength: 'Rt', backfield: 'Under Center', idPrefix: 't' });
  return matchFormation({ personnel, backfield: 'Under Center', strength: 'Rt', placed });
};

describe('matchFormation: a call is a formation plus the tags that explain the picture', () => {
  it('two tight ends off the ball with the Z on it at a reduced split is West + Clamp', () => {
    const m = name('12', [...uc, drawn('TE', 'R', 1, 3, -1, 'F'), drawn('TE', 'R', 2, 4.083, -1, 'Y'), drawn('WR', 'R', 3, 6.083, 0, 'Z'), drawn('WR', 'L', 1, -14.667, 0, 'X')]);
    expect(m?.name).toBe('West Rt Clamp');
    expect(m?.byJob).toBe(false); // the drawing has the F inside the Y; West has the Y inside
  });

  it('a tight end each side, Y off the ball with the Z down on it, X reduced: Deuce + Clamp + Tight', () => {
    const m = name('12', [...uc, drawn('TE', 'R', 1, 3, -1, 'Y'), drawn('WR', 'R', 2, 8.083, 0, 'Z'), drawn('TE', 'L', 1, -3, 0, 'F'), drawn('WR', 'L', 2, -7.083, -1, 'X')]);
    expect(m?.name).toBe('Deuce Rt Clamp Tight');
  });

  it('a bunch in 12 personnel is still Bunch: the word follows the jobs, the F is just a tight end body', () => {
    const m = name('12', [...uc, drawn('TE', 'R', 1, 3.083, -1, 'Y'), drawn('TE', 'R', 2, 4.083, 0, 'F'), drawn('WR', 'R', 3, 5.083, -1, 'Z'), drawn('WR', 'L', 1, -14.667, 0, 'X')]);
    expect(m).toMatchObject({ name: 'Bunch Rt', byJob: true });
  });

  it('returns nothing when no formation plus tags draws the picture', () => {
    expect(name('11', [...uc, drawn('TE', 'R', 1, 11, -1, 'Y'), drawn('WR', 'R', 2, 12, -1, 'Z'), drawn('WR', 'R', 3, 13, -1, 'F'), drawn('WR', 'R', 4, 14, -1, 'X')])).toBeUndefined();
  });
});
