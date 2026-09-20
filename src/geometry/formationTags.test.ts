import { describe, expect, it } from 'vitest';
import type { Player } from '@/model/types';
import { PACKERS_2019_FORMATIONS } from '@/seeds/packers2019';
import { FORMATION_BUILD_RULES, applyCallTags, assertSevenOnLine, menOnLine, readCallTags } from './formationTags';

const base = (name: string, personnel: string): Player[] => {
  const f = PACKERS_2019_FORMATIONS.find((g) => g.name === name && g.personnel === personnel);
  if (!f) throw new Error(`${name} [${personnel}] not in the pack`);
  return Object.values(f.players);
};
const at = (players: Player[], label: string) => {
  const p = players.find((q) => q.label === label);
  if (!p) throw new Error(`no ${label}`);
  return p;
};
const tag = (players: Player[], post: string[], pre: string | null = null, direction: 'RT' | 'LT' = 'RT') => applyCallTags(players, { pre, post, direction, personnel: '21' });

describe('call grammar', () => {
  it('sorts words into alignment steps and motion steps, wherever they sit in the call', () => {
    expect(readCallTags({ pre: 'Y MO', post: ['BOOK', 'F', 'LT'], direction: 'RT' })).toMatchObject({
      alignment: [{ tag: 'BOOK' }],
      motion: [{ tag: 'MO', player: 'Y' }, { tag: 'LT', player: 'F' }],
    });
    expect(readCallTags({ pre: 'Y-F MO', post: ['GUN', 'OUT', 'HAX'], direction: 'RT' }).motion.map((m) => `${m.player ?? ''} ${m.tag}`.trim())).toEqual(['Y MO', 'F MO', 'HAX']);
    expect(readCallTags({ post: ['HOP', 'ZRT'], direction: 'RT' }).motion).toEqual([{ tag: 'RT', player: 'Z' }]); // OCR glued "Z RT"
    expect(readCallTags({ post: ['STACK', 'D'], direction: 'RT' })).toMatchObject({ alignment: [{ tag: 'D', player: 'H' }], ignored: ['STACK'] });
    expect(readCallTags({ post: ['BOOK', 'AL', 'Z', 'MAYBE'], direction: 'RT' })).toMatchObject({ alignment: [{ tag: 'BOOK' }], motion: [], ignored: ['AL', 'Z', 'MAYBE'] });
  });
});

describe('alignment tags (pp. 13-24)', () => {
  it('Close + Tight = Ace: both outside receivers at 5 yard splits (p-021 item 20)', () => {
    const ace = tag(base('I Rt', '21'), ['ACE']).players;
    expect(at(ace, 'Z')).toMatchObject({ x: 7.5, y: -1 }); // the "-5-" split off the attached Y at 3 (4.5 between centres, the corrected pack's convention)
    expect(at(ace, 'X')).toMatchObject({ x: -6.5, y: 0 }); // off the weak tackle at 2, same spot as Red Rt Ace and Sink in the pack
    const two = tag(base('I Rt', '21'), ['CLOSE', 'TIGHT']).players;
    expect(two.map((p) => [p.label, p.x, p.y])).toEqual(ace.map((p) => [p.label, p.x, p.y]));
    const deuce = tag(base('Deuce Rt', '12'), ['ACE']).players;
    expect(at(deuce, 'X').x).toBe(-7.5); // Deuce has a tight end (F) on the weak side too
  });

  it('Book: field receiver at numbers minus 2, boundary receiver at numbers minus 1 (p-021 item 19)', () => {
    const r = tag(base('I Rt', '21'), ['BOOK']);
    expect(at(r.players, 'Z').x).toBe(16);
    expect(at(r.players, 'X').x).toBe(-17);
    expect(r.applied[0]).toMatchObject({ tag: 'BOOK', basis: 'words' });
    expect(r.review).toEqual([]);
  });

  it('Hip = inside receiver on the line, Hop = outside receiver on the line (p-021 items 15-17)', () => {
    const hip = tag(base('I Rt', '21'), ['HIP']).players;
    expect(at(hip, 'Z')).toMatchObject({ x: -6.5, y: 0 });
    expect(at(hip, 'X')).toMatchObject({ x: -7.5, y: -1 });
    const hop = tag(base('I Rt', '21'), ['HOP']).players;
    expect(at(hop, 'X')).toMatchObject({ x: -6.5, y: 0 });
    expect(at(hop, 'Z')).toMatchObject({ x: -5.5, y: -1 });
    for (const p of [hip, hop]) expect(menOnLine(p)).toHaveLength(7);
  });

  it('Off is a swap: Y drops off the ball next to the tackle AND the Z steps onto the line (p-020 item 4)', () => {
    const before = base('I Rt', '21');
    expect(at(before, 'Y').y).toBe(0);
    expect(at(before, 'Z').y).toBe(-1);
    const r = tag(before, ['OFF']);
    expect(at(r.players, 'Y')).toMatchObject({ x: 3, y: -1 });
    expect(at(r.players, 'Z')).toMatchObject({ x: 20, y: 0 });
    expect(menOnLine(r.players)).toHaveLength(7);
  });

  it('Clamp and Click put the Z on the ball at a 5 yard split with the Y off it, inside or outside', () => {
    const clamp = tag(base('I Rt', '21'), ['CLAMP']).players;
    expect(at(clamp, 'Z')).toMatchObject({ x: 6.5, y: 0 });
    expect(at(clamp, 'Y')).toMatchObject({ x: 3, y: -1 });
    const click = tag(base('I Rt', '21'), ['CLICK']).players;
    expect(at(click, 'Z')).toMatchObject({ x: 6.5, y: 0 });
    expect(at(click, 'Y')).toMatchObject({ x: 7.5, y: -1 });
  });

  it('flags a tag the book only draws, and leaves unknown words alone', () => {
    expect(tag(base('I Rt', '21'), ['SLOT']).review[0]).toMatch(/only drawn in the book/);
    const r = tag(base('I Rt', '21'), ['EDGE']);
    expect(r.review[0]).toMatch(/EDGE is not a tag/);
    expect(r.players.map((p) => [p.x, p.y])).toEqual(base('I Rt', '21').map((p) => [p.x, p.y]));
  });

  it('every tag keeps seven on the line, on every base formation that has the players for it', () => {
    const tags = ['CLOSE', 'CLOSER', 'OFF', 'CLAMP', 'CLICK', 'OPEN', 'OUT', 'TIGHT', 'TIGHTER', 'SLOT', 'ZOOM', 'HIP', 'HOP', 'ACE', 'BOOK', 'NUMBERS'];
    let applied = 0;
    for (const f of PACKERS_2019_FORMATIONS) {
      const players = Object.values(f.players);
      if (menOnLine(players).length !== 7) continue; // the five baked [21] copies the engine replaces
      for (const t of tags) {
        const r = applyCallTags(players, { post: [t], direction: 'RT', personnel: f.personnel });
        expect(menOnLine(r.players), `${f.name} [${f.personnel}] ${t}`).toHaveLength(7);
        applied += r.applied.length;
      }
    }
    expect(applied).toBeGreaterThan(500);
  });

  it('reproduces the build rules printed on p-017: Stack+Clamp=Stamp, South+Clamp=Swamp, Sink+Clamp=Snug, Dice+Open=Dyno', () => {
    expect(FORMATION_BUILD_RULES.map((r) => `${r.base}+${r.tag}=${r.result}`)).toEqual(['Stack+CLAMP=Stamp', 'South+CLAMP=Swamp', 'Sink+CLAMP=Snug', 'Dice+OPEN=Dyno']);
    for (const rule of FORMATION_BUILD_RULES) {
      const built = applyCallTags(base(`${rule.base} Rt`, '11'), { post: [rule.tag], direction: 'RT', personnel: '11' });
      const pack = base(`${rule.result} Rt`, '11');
      // the tag only touches the strong side: the tight end and the outside receiver land on the hand-corrected pack formation
      for (const l of ['Y', 'Z']) {
        expect(at(built.players, l).x, `${rule.result}: ${l}.x`).toBeCloseTo(at(pack, l).x, 0);
        expect(at(built.players, l).y, `${rule.result}: ${l} row`).toBe(at(pack, l).y);
      }
      expect(built.review, rule.result).toEqual([]);
    }
  });

  it('a formation name after the direction is how the book words it, not a tag (p-149 prints "SWAMP RT STACK D")', () => {
    const words = ['STACK', 'SWAMP', 'SOUTH'];
    expect(readCallTags({ post: ['STACK', 'D'], direction: 'RT', formationWords: words })).toMatchObject({ alignment: [{ tag: 'D', player: 'H' }], ignored: [], formationWords: ['STACK'] });
    const r = applyCallTags(base('Swamp Rt', '11'), { post: ['GUN', 'STACK', 'D'], direction: 'RT', personnel: '11', formationWords: words });
    expect(r.review.some((n) => /STACK/.test(n))).toBe(false);
    expect(r.notes[0]).toMatch(/STACK after the direction/);
  });

  it('fails loudly when the count is wrong', () => {
    const broken = base('I Rt', '21').map((p) => (p.label === 'X' ? { ...p, y: -1 } : p));
    expect(() => assertSevenOnLine(broken, 'test')).toThrow(/6 men on the line/);
    expect(() => tag(broken, ['BOOK'])).toThrow(/base formation: 6 men/);
  });
});

describe('shift and motion tags (pp. 30-37)', () => {
  it('Wax Rt Off, Y Mo: the hand-built reference', () => {
    const r = applyCallTags(base('Wax Rt', '13Z'), { pre: 'Y MO', post: ['OFF'], direction: 'RT', personnel: '13Z' });
    const y = at(r.players, 'Y');
    // final spot: off the ball at backfield depth next to the tackle. Every assignment hangs off this.
    expect(y).toMatchObject({ x: 3, y: -1 });
    // ghost: away from the call, outside the F, same depth (the reference has it at -5, -1)
    expect(y.motion).toMatchObject({ from: { x: -5, y: -1 }, tag: 'MO', kind: 'motion' });
    // the Off swap is visible by row: Z up on the line, Y off it
    expect(at(r.players, 'Z').y).toBe(0);
    expect(menOnLine(r.players)).toHaveLength(7);
    expect(r.review).toEqual([]);
  });

  it('Mo takes the man off the ball even without Off, and someone on his side steps up', () => {
    const r = tag(base('I Rt', '21'), ['BOOK'], 'Y MO');
    expect(at(r.players, 'Y')).toMatchObject({ x: 3, y: -1 });
    expect(at(r.players, 'Y').motion?.from.x).toBeLessThan(0);
    expect(at(r.players, 'Z').y).toBe(0);
  });

  it('Hax / Hay / Foy send the back outside the farthest receiver and remember where he started', () => {
    const hax = applyCallTags(base('South Rt', '11'), { post: ['GUN', 'OUT', 'HAX'], direction: 'RT', personnel: '11' });
    const h = at(hax.players, 'H');
    expect(h.y).toBe(-1);
    expect(h.x).toBeLessThan(Math.min(...hax.players.filter((p) => p !== h).map((p) => p.x))); // widest man on the X side
    expect(h.motion?.from.y).toBeLessThan(-4); // he started in the backfield
    const foy = tag(base('I Rt', '21'), ['SLOT', 'FOY']);
    expect(at(foy.players, 'F')).toMatchObject({ x: 5, y: -1 }); // Slot sent the Z away, so the farthest receiver on the Y side is the Y himself
    expect(at(foy.players, 'F').motion?.from).toEqual({ x: 0, y: -5 });
  });

  it('a Lt/Rt word is a direction on the field, so it flips with the call', () => {
    const rt = tag(base('I Rt', '21'), ['Y', 'LT']);
    expect(at(rt.players, 'Y').x).toBe(-3); // across the formation, away from the call
    const lt = tag(base('I Rt', '21'), ['Y', 'RT'], null, 'LT'); // in strong-right space "RT" on a Lt call is the weak side too
    expect(at(lt.players, 'Y').x).toBe(-3);
  });

  it('records a motion it cannot place instead of guessing', () => {
    const r = tag(base('I Rt', '21'), ['CLAMP', 'BUMP']);
    expect(at(r.players, 'F').motion).toBeUndefined();
    expect(r.review.join(' ')).toMatch(/BUMP is recorded but not drawn/);
  });
});
