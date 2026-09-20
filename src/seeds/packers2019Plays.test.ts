import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { FIELD_WIDTH_YD } from '@/model/constants';
import { backupV2Schema, playSchema, routeDefSchema } from '@/model/schema';
import { DEFAULT_SETTINGS, type Play, type Player } from '@/model/types';
import { menOnLine } from '@/geometry/formationTags';
import { routeDefPath, routeDepths } from '@/geometry/routeLibrary';
import { motionPoints } from '@/render/MotionLayer';
import { PlayThumb } from '@/render/PlayThumb';
import { resolvePoints } from '@/geometry/path';
import { DEMO_PLAYS } from './demoPlays';
import { PACKERS_2019_PLAYS, PACKERS_2019_PLAY_ID_PREFIX, PACKERS_2019_ROUTES, routeByName } from './packers2019Plays';
import routePack from './data/packers2019Routes.json';
import playPack from './data/packers2019Plays.json';

const receiver = (x: number, y = 0): Player => ({ id: 'wr', side: 'offense', symbol: 'circle', label: 'Z', x, y, role: 'WR' });
const byCall = (needle: string): Play => {
  const p = PACKERS_2019_PLAYS.find((q) => (q.rawCall ?? '').includes(needle));
  if (!p) throw new Error(`no play with "${needle}" in its call`);
  return p;
};
const label = (p: Play, l: string) => {
  const hit = Object.values(p.diagram.players).find((q) => q.label === l);
  if (!hit) throw new Error(`${p.rawCall}: no ${l}`);
  return hit;
};

describe('packers 2019 route library', () => {
  it('has every route from the tree, each passing the schema without losing a field', () => {
    expect(PACKERS_2019_ROUTES.length).toBe(routePack.routes.length);
    expect(PACKERS_2019_ROUTES.length).toBeGreaterThanOrEqual(150);
    for (const r of PACKERS_2019_ROUTES) {
      const parsed = routeDefSchema.safeParse(r);
      expect(parsed.success, `${r.key} ${parsed.success ? '' : JSON.stringify(parsed.error.issues[0])}`).toBe(true);
      if (parsed.success) expect(parsed.data).toEqual(r);
      expect(r.points[0]).toMatchObject({ x: 0, y: 0 });
      expect(r.sourcePage).toBeGreaterThanOrEqual(71);
      expect(r.sourcePage).toBeLessThanOrEqual(103);
    }
    expect(new Set(PACKERS_2019_ROUTES.map((r) => r.key)).size).toBe(PACKERS_2019_ROUTES.length);
  });

  it('the stated break depth is the midpoint of the stated range', () => {
    expect(routeByName('BASIC')).toMatchObject({ depthRange: [12, 14], breakDepthYards: 13, breakDirection: 'in', sourcePage: 72 });
    expect(routeByName('DIG')).toMatchObject({ breakDepthYards: 18, sourcePage: 75 });
    expect(routeByName('DEEP THRU')).toMatchObject({ breakDepthYards: 15, sourcePage: 75 });
    expect(routeByName('ARROW')).toMatchObject({ depthRange: [4, 6], breakDepthYards: 5, sourcePage: 71 });
    expect(routeByName('ATTACK')).toMatchObject({ breakDepthYards: 10, sourcePage: 71 });
    expect(routeByName('CHECK THRU', undefined, 'HB')).toMatchObject({ group: 'HB', frame: 'back', sourcePage: 100 });
  });

  it('every drawn route has a vertex at the depth its record states, on and off the ball', () => {
    for (const r of PACKERS_2019_ROUTES) {
      if (r.breakDepthYards === null) continue;
      for (const p of [receiver(12, 0), receiver(-12, -1), receiver(3, -6)]) {
        const path = routeDefPath(r, p, { id: 't' });
        expect(routeDepths(path, p), `${r.key} from y=${p.y}`).toContain(r.breakDepthYards);
      }
    }
  });

  it('mirrors for the left side and never leaves the field', () => {
    const basic = routeByName('BASIC')!;
    const right = routeDefPath(basic, receiver(14), { id: 'r' });
    const left = routeDefPath(basic, receiver(-14), { id: 'l' });
    expect(right.points.map((p) => p.x)).toEqual(left.points.map((p) => -p.x + 0));
    expect(right.points[2].x).toBeLessThan(0); // breaks inside
    for (const r of PACKERS_2019_ROUTES)
      for (const p of [receiver(22), receiver(-22)])
        for (const pt of routeDefPath(r, p, { id: 'x' }).points) expect(Math.abs(pt.x + p.x)).toBeLessThanOrEqual(FIELD_WIDTH_YD / 2);
  });

  it('aims landmark routes at the field, not at the player', () => {
    const attack = routeDefPath(routeByName('ATTACK')!, receiver(15), { id: 'a' });
    expect(attack.points[1].x + 15).toBeCloseTo(0, 5); // ends over the ball
    const seam = routeDefPath(routeByName('SEAM')!, receiver(8), { id: 's' });
    expect(seam.points[seam.points.length - 1].x + 8).toBeCloseTo(16, 5); // 2 yards inside the numbers
  });
});

describe('packers 2019 plays', () => {
  it('every play passes the real schema and keeps its provenance fields', () => {
    expect(PACKERS_2019_PLAYS.length).toBe(playPack.plays.length);
    for (const p of PACKERS_2019_PLAYS) {
      const parsed = playSchema.safeParse(p);
      expect(parsed.success, `${p.rawCall} ${parsed.success ? '' : JSON.stringify(parsed.error.issues[0])}`).toBe(true);
      // zod strips unknown keys, so equality proves install, sourcePage, rawCall, confidence are real schema fields
      if (parsed.success) expect(parsed.data).toEqual(JSON.parse(JSON.stringify(p)));
      expect(p.install && p.sourcePage && p.rawCall && p.confidence && p.personnel).toBeTruthy();
      if (p.confidence === 'needs-review') expect(p.reviewNotes?.length).toBeGreaterThan(0);
    }
  });

  it('survives a Settings backup round trip', () => {
    const backup = { app: 'playforge', version: 2, exportedAt: '2026-01-01T00:00:00.000Z', formations: [], plays: PACKERS_2019_PLAYS, playbooks: [], settings: DEFAULT_SETTINGS };
    const parsed = backupV2Schema.parse(JSON.parse(JSON.stringify(backup)));
    expect(parsed.plays).toEqual(JSON.parse(JSON.stringify(PACKERS_2019_PLAYS)));
  });

  it('ids are unique, deterministic, and clear of the demo plays', () => {
    const ids = PACKERS_2019_PLAYS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => id.startsWith(PACKERS_2019_PLAY_ID_PREFIX))).toBe(true);
    expect(DEMO_PLAYS.some((p) => p.id.startsWith(PACKERS_2019_PLAY_ID_PREFIX))).toBe(false);
    for (const p of PACKERS_2019_PLAYS) {
      for (const path of Object.values(p.diagram.paths)) if (path.anchor.kind === 'player') expect(p.diagram.players[path.anchor.playerId], `${p.rawCall}: ${path.id}`).toBeDefined();
      expect(Object.keys(p.diagram.players).length).toBeGreaterThanOrEqual(10);
    }
  });

  it('offense sits at negative y: in an I formation both backs are BEHIND the quarterback', () => {
    const iPlays = PACKERS_2019_PLAYS.filter((p) => /^I (RT|LT)\b/.test(p.formationLabel ?? ''));
    expect(iPlays.length).toBeGreaterThan(5);
    for (const p of iPlays) {
      const qb = label(p, 'Q');
      for (const b of [label(p, 'F'), label(p, 'H')]) {
        // where he lines up: a back sent in motion (Foy, F Lt ...) still STARTS behind the quarterback
        const start = b.motion?.from ?? b;
        expect(start.y, `${p.rawCall}: ${b.label}`).toBeLessThan(qb.y);
        expect(b.y).toBeLessThan(0);
      }
      for (const q of Object.values(p.diagram.players)) expect(q.y).toBeLessThanOrEqual(0);
    }
  });

  it('a Lt call is the mirror of the Rt formation', () => {
    const lt = PACKERS_2019_PLAYS.find((p) => / LT\b/.test(p.formationLabel ?? '') && /^I /.test(p.formationLabel ?? ''))!;
    expect(label(lt, 'Y').x).toBeLessThan(0);
  });

  it('routes in a play break at the depth their library record states', () => {
    let checked = 0;
    for (const p of PACKERS_2019_PLAYS) {
      for (const [playerId, key] of Object.entries(p.routeTags ?? {})) {
        const def = PACKERS_2019_ROUTES.find((r) => r.key === key)!;
        if (def.breakDepthYards === null) continue;
        const player = p.diagram.players[playerId];
        const path = Object.values(p.diagram.paths).find((q) => q.role === 'route' && q.anchor.kind === 'player' && q.anchor.playerId === playerId)!;
        const depths = resolvePoints(path, p.diagram.players).map((pt) => Math.round(pt.y * 4) / 4);
        expect(depths, `${p.rawCall}: ${player.label} ${def.name}`).toContain(def.breakDepthYards);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(200);
  });

  it('binds the calls it should', () => {
    const omaha = byCall('DEUCE RT / 200 JET BOTH OMAHA');
    expect(omaha).toMatchObject({ personnel: '12', protection: '200 JET', category: 'Pass', install: 1, sourcePage: 135 });
    expect(Object.values(omaha.routeTags ?? {}).sort()).toEqual(['hb-check-thru', 'wr-coin', 'wr-coin', 'wr-omaha', 'wr-omaha']);
    const pa = byCall('I RT BOOK / P15 WEAK Z STRIKE X BLAZE OUT');
    expect(pa).toMatchObject({ category: 'PA', confidence: 'derived', appliedTags: ['BOOK'] });
    expect(label(pa, 'Z').x).toBe(16); // Book: field receiver 2 inside the numbers
    const oz = byCall('DEUCE RT / 18 STRUCTURE SIFT');
    expect(oz.tags).toContain('outside-zone');
    expect(Object.values(oz.diagram.paths).filter((q) => q.role === 'ball')).toHaveLength(1);
    expect(byCall('14 WEAK').tags).toContain('inside-zone');
  });

  it('seven men on the line in every composed play, tagged or not', () => {
    for (const p of PACKERS_2019_PLAYS) expect(menOnLine(Object.values(p.diagram.players)), p.rawCall).toHaveLength(7);
  });

  it('no play is flagged for an unapplied alignment tag or an undrawn Mo any more', () => {
    const notes = PACKERS_2019_PLAYS.flatMap((p) => p.reviewNotes ?? []);
    expect(notes.some((n) => /tags not applied|MO is recorded but not drawn/.test(n))).toBe(false);
    // the 100 formation-caused flags: every corrected formation cleared; Red Rt [21] is the one still marked needs-review in the pack
    expect(notes.filter((n) => /is itself needs-review/.test(n)).every((n) => n.includes('Red Rt [21]'))).toBe(true);
  });

  it('every Mo play has a ghost, a motion path behind the line, and a solid final spot that the routes hang off', () => {
    const mo = PACKERS_2019_PLAYS.filter((p) => /\bMO\b/.test(p.formationLabel ?? ''));
    expect(mo.length).toBeGreaterThanOrEqual(10);
    for (const p of mo) {
      const movers = Object.values(p.diagram.players).filter((q) => q.motion?.tag === 'MO');
      expect(movers.length, p.rawCall).toBeGreaterThan(0);
      for (const m of movers) {
        const from = m.motion!.from;
        // two different positions, the ghost away from the call (other side of the ball)
        expect(Math.sign(from.x), `${p.rawCall}: ghost side`).toBe(-Math.sign(m.x));
        expect(Math.hypot(from.x - m.x, from.y - m.y)).toBeGreaterThan(3);
        // the path starts at the ghost, ends at the final spot, and never crosses the line of scrimmage
        const pts = motionPoints(m);
        expect(pts[0]).toEqual(from);
        expect(pts[pts.length - 1]).toEqual({ x: m.x, y: m.y });
        for (const pt of pts) expect(pt.y, `${p.rawCall}: motion path`).toBeLessThanOrEqual(-1);
        // a route drawn off the ghost would still look plausible, so check the origin in yards
        for (const path of Object.values(p.diagram.paths)) {
          if (path.anchor.kind !== 'player' || path.anchor.playerId !== m.id) continue;
          const origin = resolvePoints(path, p.diagram.players)[0];
          expect(origin, `${p.rawCall}: ${m.label} ${path.role} origin`).toEqual({ x: m.x, y: m.y });
          expect(Math.hypot(origin.x - from.x, origin.y - from.y)).toBeGreaterThan(3);
        }
      }
      // and it really renders: one ghost glyph and one dotted path per mover, under the solid players
      const svg = renderToStaticMarkup(createElement(PlayThumb, { diagram: p.diagram, aspect: 4 / 3 }));
      for (const m of movers) {
        expect(svg).toContain(`data-ghost="${m.id}"`);
        expect(svg).toContain(`data-motion="${m.id}"`);
        expect(svg.indexOf(`data-motion="${m.id}"`)).toBeLessThan(svg.indexOf(`data-hit="player:${m.id}"`));
      }
    }
  });

  it('Off plays show the swap by row: the tight end off the ball, a receiver up on the line in his place', () => {
    const off = PACKERS_2019_PLAYS.filter((p) => p.appliedTags?.includes('OFF'));
    for (const p of off) {
      expect(label(p, 'Y').y, p.rawCall).toBe(-1);
      expect(menOnLine(Object.values(p.diagram.players))).toHaveLength(7);
    }
  });

  it('a back the call splits out (Hax, Hay, Foy) is out wide at the snap, not in the backfield', () => {
    const wide = PACKERS_2019_PLAYS.filter((p) => (p.appliedTags ?? []).some((t) => /^(H HAX|H HAY|F FOY|F FOX)$/.test(t)));
    expect(wide.length).toBeGreaterThan(5);
    for (const p of wide) {
      const back = label(p, p.appliedTags!.some((t) => t.startsWith('H ')) ? 'H' : 'F');
      expect(back.y, p.rawCall).toBe(-1);
      expect(back.motion?.from.y).toBeLessThan(-3);
      expect((p.reviewNotes ?? []).some((n) => /still in the backfield/.test(n) && n.startsWith(back.label))).toBe(false);
    }
  });

  it('a Can call draws the primary and stores the alternate with its trigger', () => {
    const cans = PACKERS_2019_PLAYS.filter((p) => p.alternate);
    expect(cans.length).toBeGreaterThanOrEqual(30);
    for (const p of cans) {
      expect(p.name).toMatch(/\(CAN\)/);
      expect(p.alternate!.name.length).toBeGreaterThan(1);
      expect(p.tags).toContain('can');
    }
    const mike = byCall('I RT BOOK / 18 MIKE (CAN) 19 WEAK');
    expect(mike).toMatchObject({ category: 'Run', concept: '18 MIKE', alternate: { name: '19 WEAK', trigger: 'unblockable support', runNumber: 19, runFamily: 'outside-zone' } });
    expect(Object.values(mike.diagram.paths).filter((q) => q.role === 'ball')).toHaveLength(1); // the primary is what is drawn
    const canPass = byCall('I RT BOOK / 15 WEAK (CAN) PASS X STRIKE');
    expect(canPass.category).toBe('Run');
    expect(canPass.alternate).toMatchObject({ name: 'PASS X STRIKE', trigger: 'shell: middle of the field closed' });
    expect(Object.values(canPass.alternate!.routeTags ?? {}).sort()).toEqual(['hb-check-flat', 'hb-check-thru', 'wr-streak', 'wr-strike']);
    expect(PACKERS_2019_PLAYS.some((p) => /ALAKSA/.test(p.name))).toBe(false); // the book's own typo on p-131
  });
});

