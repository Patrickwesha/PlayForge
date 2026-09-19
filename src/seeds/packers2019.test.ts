import { describe, expect, it } from 'vitest';
import { OL_SPACING } from '@/model/constants';
import { backupV2Schema, formationSchema } from '@/model/schema';
import { DEFAULT_SETTINGS, type Formation } from '@/model/types';
import { OFFENSE_FORMATIONS } from './offense';
import { DEFENSE_FORMATIONS } from './defense';
import { PACKERS_2019_FORMATIONS, PACKERS_2019_ID_PREFIX } from './packers2019';
import pack from './data/packers2019.json';

const find = (name: string, personnel: string): Formation => {
  const f = PACKERS_2019_FORMATIONS.find((g) => g.name === name && g.personnel === personnel);
  if (!f) throw new Error(`${name} [${personnel}] not in the pack`);
  return f;
};
const spot = (f: Formation, s: string) => {
  const p = f.players[`${f.id}-${s.toLowerCase()}`];
  if (!p) throw new Error(`${f.name}: no ${s}`);
  return p;
};

describe('packers 2019 pack', () => {
  it('every formation passes the real schema and loses nothing to it', () => {
    expect(PACKERS_2019_FORMATIONS.length).toBe(pack.formations.length);
    for (const f of PACKERS_2019_FORMATIONS) {
      const r = formationSchema.safeParse(f);
      expect(r.success, `${f.name} [${f.personnel}] ${r.success ? '' : JSON.stringify(r.error.issues[0])}`).toBe(true);
      // zod strips unknown keys, so equality proves family, note, confidence etc. are real schema fields
      if (r.success) expect(r.data).toEqual(f);
    }
  });

  it('survives a Settings backup round trip with its metadata', () => {
    const backup = { app: 'playforge', version: 2, exportedAt: '2026-01-01T00:00:00.000Z', formations: PACKERS_2019_FORMATIONS, plays: [], playbooks: [], settings: DEFAULT_SETTINGS };
    const parsed = backupV2Schema.parse(JSON.parse(JSON.stringify(backup)));
    expect(parsed.formations).toEqual(JSON.parse(JSON.stringify(PACKERS_2019_FORMATIONS)));
    expect(parsed.formations.every((f) => f.family && f.confidence && f.sourcePage)).toBe(true);
  });

  it('ids are unique, deterministic, and clear of the other built-ins', () => {
    const ids = PACKERS_2019_FORMATIONS.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith(PACKERS_2019_ID_PREFIX))).toBe(true);
    const others = new Set([...OFFENSE_FORMATIONS, ...DEFENSE_FORMATIONS].map((f) => f.id));
    expect(ids.filter((id) => others.has(id))).toEqual([]);
  });

  it('the line uses OL_SPACING with the center on the ball, and nobody is downfield', () => {
    for (const f of PACKERS_2019_FORMATIONS) {
      const line = ['LT', 'LG', 'C', 'RG', 'RT'].map((s) => spot(f, s));
      expect(line.map((p) => p.x), f.name).toEqual([-2, -1, 0, 1, 2].map((n) => n * OL_SPACING));
      expect(line.every((p) => p.y === 0), f.name).toBe(true);
      expect(spot(f, 'C').symbol).toBe('square');
      for (const p of Object.values(f.players)) expect(p.y, `${f.name} ${p.id}`).toBeLessThanOrEqual(0);
    }
  });

  it('only needs-review entries may be short of 11 players', () => {
    for (const f of PACKERS_2019_FORMATIONS) {
      const n = Object.keys(f.players).length;
      if (n !== f.playersPerSide) expect(f.confidence, `${f.name} [${f.personnel}] has ${n} players`).toBe('needs-review');
    }
  });

  it('I Rt: backs stack behind the quarterback', () => {
    const f = find('I Rt', '21');
    const [q, fb, hb] = ['QB', 'F', 'H'].map((s) => spot(f, s));
    expect([q.x, fb.x, hb.x]).toEqual([0, 0, 0]);
    expect(q.y).toBeLessThan(0);
    expect(fb.y).toBeLessThan(q.y);
    expect(hb.y).toBeLessThan(fb.y);
  });

  it('I Rt Ace: Z and X both take a 5 yard split from the end man, Z off the ball and X on it', () => {
    const f = find('I Rt Ace', '21');
    expect(spot(f, 'Y').x).toBe(3 * OL_SPACING);
    expect(spot(f, 'Z').x - spot(f, 'Y').x).toBe(5);
    expect(spot(f, 'Z').y).toBe(-1);
    expect(spot(f, 'LT').x - spot(f, 'X').x).toBe(5);
    expect(spot(f, 'X').y).toBe(0);
  });
});
