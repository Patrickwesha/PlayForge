import { describe, expect, it } from 'vitest';
import { formationSchema, playSchema, playbookSchema } from '@/model/schema';
import { diagramBounds } from '@/geometry/bounds';
import { CALL_SHEET, CONCEPTS, IF_THEN, INSTALL, SCRIPT, conceptByKey } from './content';
import { BEAST_FORMATIONS, BEAST_PLAYBOOK, BEAST_PLAYS, DRAWINGS, beastPlay, coachCall } from './plays';

const OL = ['LT', 'LG', 'C', 'RG', 'RT'];
const onLine = (players: { y: number }[]) => players.filter((p) => Math.abs(p.y) < 0.01).length;

describe('beast 2026 language', () => {
  it('has ten wristband numbers, one per concept, in the Call Sheet V3 order', () => {
    expect(CONCEPTS.map((c) => c.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(CONCEPTS.map((c) => c.coach)).toEqual(['ISO', 'Blast', 'Sweep', 'GH Counter', 'Buck', 'Flood Pass', 'Sweep Pass', 'TE Pop Pass', 'Reverse', 'ICE']);
  });

  it('every kid name starts with a different letter, and every city starts with that letter', () => {
    const letters = CONCEPTS.map((c) => c.kid[0]);
    expect(new Set(letters).size).toBe(CONCEPTS.length);
    for (const c of CONCEPTS) for (const city of c.cities) expect(city[0], `${c.kid}: ${city}`).toBe(c.kid[0]);
  });

  it('keeps the hole rule: even numbers go right with the wings, odd go left', () => {
    for (const c of CONCEPTS) {
      if (!c.numbers.right) continue;
      const ballGoesRight = c.withWings; // Red = wings right
      expect(c.numbers.right % 2 === 0, `${c.kid} red`).toBe(ballGoesRight);
      expect(c.numbers.left % 2 === 0, `${c.kid} yellow`).toBe(!ballGoesRight);
    }
  });

  it('call sheet, script, IF/THEN and install only name real concepts', () => {
    const keys = [...CALL_SHEET.flatMap((s) => s.rows.map((r) => r[1])), ...SCRIPT.map((s) => s.entry[1]), ...IF_THEN.flatMap((r) => r.call), ...INSTALL.flatMap((w) => w.adds)];
    for (const k of keys) expect(conceptByKey.has(k), k).toBe(true);
    // every concept is installed exactly once
    const installed = INSTALL.flatMap((w) => w.adds).sort();
    expect(installed).toEqual(CONCEPTS.map((c) => c.key).sort());
    for (const c of CONCEPTS) expect(INSTALL.find((w) => w.adds.includes(c.key))?.week, c.key).toBe(c.week);
  });

  it('call sheet sections match V3 play for play', () => {
    const first10 = CALL_SHEET.find((s) => s.id === 'first10')!.rows.map(([side, key]) => coachCall(side, conceptByKey.get(key)!));
    expect(first10).toEqual([
      'Beast Right (Base) 14 Blast', 'Beast Right (Base) Sweep Pass', 'Beast Right (Base) 18 Sweep', 'Beast Right (Base) Flood Pass',
      'Beast Right (Base) 15 GH Counter', 'Beast Right (Base) 23 Buck', 'Beast Right (Base) TE Pop Pass', 'Beast Right (Base) 47 Reverse',
      'Beast Right (Base) ICE', 'Beast Left (Base) 13 Blast', 'Beast Left (Base) 17 Sweep',
    ]);
  });
});

describe('beast 2026 formations', () => {
  it('pass the schema, have 11 players and exactly 7 on the line', () => {
    expect(BEAST_FORMATIONS).toHaveLength(9);
    for (const f of BEAST_FORMATIONS) {
      const r = formationSchema.safeParse(f);
      expect(r.success, `${f.name} ${r.success ? '' : JSON.stringify(r.error.issues[0])}`).toBe(true);
      const ps = Object.values(f.players);
      expect(ps, f.name).toHaveLength(11);
      expect(onLine(ps), f.name).toBe(7);
    }
  });

  it('Left is the mirror of Right', () => {
    const pairs = [['beast-right', 'beast-left'], ['beast-wide-right', 'beast-wide-left'], ['pistol-right', 'pistol-left'], ['tank-right', 'tank-left']];
    for (const [r, l] of pairs) {
      const R = BEAST_FORMATIONS.find((f) => f.id.endsWith(`f-${r}`))!;
      const L = BEAST_FORMATIONS.find((f) => f.id.endsWith(`f-${l}`))!;
      const key = (p: { label: string; x: number; y: number }) => `${p.label}@${p.x.toFixed(2)},${p.y.toFixed(2)}`;
      const flipped = Object.values(R.players).map((p) => key({ label: ({ LT: 'RT', RT: 'LT', LG: 'RG', RG: 'LG' } as Record<string, string>)[p.label] ?? p.label, x: -p.x, y: p.y }));
      expect(Object.values(L.players).map(key).sort(), l).toEqual(flipped.sort());
    }
  });
});

describe('beast 2026 plays', () => {
  it('20 plays, unique ids, all pass the schema', () => {
    expect(BEAST_PLAYS).toHaveLength(20);
    expect(new Set(BEAST_PLAYS.map((p) => p.id)).size).toBe(20);
    for (const p of BEAST_PLAYS) {
      const r = playSchema.safeParse(p);
      expect(r.success, `${p.name} ${r.success ? '' : JSON.stringify(r.error.issues[0])}`).toBe(true);
    }
    expect(playbookSchema.safeParse(BEAST_PLAYBOOK).success).toBe(true);
  });

  it('every player has a job and every lineman has one written (GOD or the named exception)', () => {
    for (const p of BEAST_PLAYS) {
      const players = Object.values(p.diagram.players);
      expect(players, p.name).toHaveLength(11);
      expect(onLine(players), p.name).toBe(7);
      for (const pl of players) expect(p.positionNotes[pl.id], `${p.name} ${pl.label}`).toBeTruthy();
      for (const label of OL) {
        const pl = players.find((x) => x.label === label)!;
        expect(p.positionNotes[pl.id], `${p.name} ${label}`).toMatch(/GOD|OUT|PULL|BLOCK BACK|Freeze/);
      }
    }
  });

  it('every path hangs off a player in its own play', () => {
    for (const p of BEAST_PLAYS)
      for (const path of Object.values(p.diagram.paths)) if (path.anchor.kind === 'player') expect(p.diagram.players[path.anchor.playerId], `${p.name} ${path.id}`).toBeTruthy();
  });

  it('Yellow is the mirror of Red, with the words flipped', () => {
    for (const c of CONCEPTS) {
      const red = beastPlay('right', c.key)!;
      const yellow = beastPlay('left', c.key)!;
      const rb = diagramBounds(red.diagram)!;
      const yb = diagramBounds(yellow.diagram)!;
      expect(yb.minX, c.key).toBeCloseTo(-rb.maxX, 3);
      expect(yb.maxX, c.key).toBeCloseTo(-rb.minX, 3);
      const one = (p: typeof red) => p.positionNotes[Object.values(p.diagram.players).find((x) => x.label === '1')!.id];
      const raw = DRAWINGS[c.key].notes['1'];
      if (raw.includes('{wing}')) {
        expect(one(red), c.key).toContain(raw.replace(/\{wing\}/g, 'right').replace(/\{away\}/g, 'left'));
        expect(one(yellow), c.key).toContain(raw.replace(/\{wing\}/g, 'left').replace(/\{away\}/g, 'right'));
      }
    }
  });

  it('the ball carrier line is red on every run', () => {
    for (const p of BEAST_PLAYS.filter((x) => x.category === 'Run')) {
      const carriers = Object.values(p.diagram.paths).filter((x) => x.color === 'red' && x.role === 'route');
      expect(carriers, p.name).toHaveLength(1);
    }
  });
});
