import { describe, expect, it } from 'vitest';
import { formationSchema, playSchema, playbookSchema } from '@/model/schema';
import { diagramBounds } from '@/geometry/bounds';
import { YOUTH_SYSTEMS } from './registry';

const OL = ['LT', 'LG', 'C', 'RG', 'RT'];
const onLine = (players: { y: number }[]) => players.filter((p) => Math.abs(p.y) < 0.01).length;
const systems = Object.values(YOUTH_SYSTEMS);

describe.each(systems.map((s) => [s.id, s] as const))('%s', (_id, sys) => {
  it('has ten wristband numbers, one per concept', () => {
    expect(sys.concepts.map((c) => c.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('every kid name starts with a different letter, and every check-with-me word starts with it', () => {
    expect(new Set(sys.concepts.map((c) => c.kid[0])).size).toBe(10);
    for (const c of sys.concepts) for (const w of c.cities) expect(w[0], `${c.kid}: ${w}`).toBe(c.kid[0]);
  });

  it('play numbers follow the hole rule: even right, odd left, with or away from the color side', () => {
    for (const c of sys.concepts) {
      if (!c.numbers.right) continue;
      expect(c.numbers.right % 2 === 0, `${c.kid} red`).toBe(c.withWings);
      expect(c.numbers.left % 2 === 0, `${c.kid} yellow`).toBe(!c.withWings);
    }
  });

  it('call sheet, script, IF / THEN and install only name real concepts; each concept installs once, in its week', () => {
    const keys = [...sys.callSheet.flatMap((s) => s.rows.map((r) => r[1])), ...sys.script.map((s) => s.entry[1]), ...sys.ifThen.flatMap((r) => r.call), ...sys.install.flatMap((w) => w.adds)];
    for (const k of keys) expect(sys.conceptByKey.has(k), k).toBe(true);
    expect(sys.install.flatMap((w) => w.adds).sort()).toEqual(sys.concepts.map((c) => c.key).sort());
    for (const c of sys.concepts) expect(sys.install.find((w) => w.adds.includes(c.key))?.week, c.key).toBe(c.week);
    for (const w of sys.install) for (const f of w.formations) expect(sys.specByKey.has(f), f).toBe(true);
  });

  it('formations pass the schema, have 11 players and exactly 7 on the line', () => {
    for (const f of sys.formationRows) {
      const r = formationSchema.safeParse(f);
      expect(r.success, `${f.name} ${r.success ? '' : JSON.stringify(r.error.issues[0])}`).toBe(true);
      const ps = Object.values(f.players);
      expect(ps, f.name).toHaveLength(11);
      expect(onLine(ps), f.name).toBe(7);
    }
  });

  it('20 plays and a playbook that pass the schema', () => {
    expect(sys.plays).toHaveLength(20);
    expect(new Set(sys.plays.map((p) => p.id)).size).toBe(20);
    for (const p of sys.plays) {
      const r = playSchema.safeParse(p);
      expect(r.success, `${p.name} ${r.success ? '' : JSON.stringify(r.error.issues[0])}`).toBe(true);
    }
    expect(playbookSchema.safeParse(sys.playbook).success).toBe(true);
  });

  it('every player has a job, every lineman a blocking word, 7 on the line at the snap', () => {
    for (const p of sys.plays) {
      const players = Object.values(p.diagram.players);
      expect(players, p.name).toHaveLength(11);
      expect(onLine(players), p.name).toBe(7);
      for (const pl of players) expect(p.positionNotes[pl.id], `${p.name} ${pl.label}`).toBeTruthy();
      for (const label of OL) {
        const pl = players.find((x) => x.label === label)!;
        expect(p.positionNotes[pl.id], `${p.name} ${label}`).toMatch(/GOD|OUT|PULL|BLOCK BACK|Freeze|ZONE|WEB/);
      }
      for (const path of Object.values(p.diagram.paths)) if (path.anchor.kind === 'player') expect(p.diagram.players[path.anchor.playerId], `${p.name} ${path.id}`).toBeTruthy();
    }
  });

  it('Yellow is the mirror of Red', () => {
    for (const c of sys.concepts) {
      const rb = diagramBounds(sys.play('right', c.key)!.diagram)!;
      const yb = diagramBounds(sys.play('left', c.key)!.diagram)!;
      expect(yb.minX, c.key).toBeCloseTo(-rb.maxX, 3);
      expect(yb.maxX, c.key).toBeCloseTo(-rb.minX, 3);
    }
  });

  it('exactly one red ball-carrier line on every run', () => {
    for (const p of sys.plays.filter((x) => x.category === 'Run')) {
      expect(Object.values(p.diagram.paths).filter((x) => x.color === 'red' && x.role === 'route'), p.name).toHaveLength(1);
    }
  });
});

describe('youth systems together', () => {
  it('no two systems share an id', () => {
    const ids = systems.flatMap((s) => [...s.plays.map((p) => p.id), ...s.formationRows.map((f) => f.id), s.playbook.id]);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
