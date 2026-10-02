/**
 * Positions for the Green Bay 2019 book rebuild: every formation line the book prints, composed from the
 * formation pack by the tag engine, and every route of the route library drawn for a receiver / a back.
 * The book builder (scripts/playbook/build_book.py) uses these to complete diagrams the scan cuts off.
 *
 *   npx vitest run --config vitest.render.config.mts scripts/compose-book.render.tsx
 *
 * In:  source/book/compose-requests.json  { formations: [{ key, formationKey, preTag, postTags, direction, personnel }] }
 * Out: source/book/compositions.json      { formations: { key: { players, review } | { error } }, routes: { key: { wr?, hb? } } }
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { it } from 'vitest';
import type { Path, Player } from '@/model/types';
import { applyCallTags } from '@/geometry/formationTags';
import { flipPlayer } from '@/geometry/flip';
import { routeDefPath } from '@/geometry/routeLibrary';
import { HASH_PRESETS } from '@/model/constants';
import { PACKERS_2019_FORMATIONS, PACKERS_2019_ID_PREFIX, PACKERS_2019_ROUTES } from '@/seeds';

const ROOT = path.resolve(import.meta.dirname, '../source/book');
const FORMATION_WORDS = [...new Set(PACKERS_2019_FORMATIONS.map((f) => f.name.split(' ')[0].toUpperCase()))];

type Req = { key: string; formationKey: string; preTag: string | null; postTags: string[]; direction: 'RT' | 'LT'; personnel?: string };

const r2 = (n: number) => Math.round(n * 100) / 100;

it('composes every formation line and every route for the book', () => {
  const req = JSON.parse(readFileSync(path.join(ROOT, 'compose-requests.json'), 'utf8')) as { formations: Req[] };
  const byId = new Map(PACKERS_2019_FORMATIONS.map((f) => [f.id, f]));
  const formations: Record<string, unknown> = {};
  let ok = 0;
  for (const q of req.formations) {
    const f = byId.get(`${PACKERS_2019_ID_PREFIX}${q.formationKey}`);
    if (!f) {
      formations[q.key] = { error: `no pack formation ${q.formationKey}` };
      continue;
    }
    const base: Player[] = Object.values(f.players).map((p) => ({ ...p }));
    try {
      const tagged = applyCallTags(base, { pre: q.preTag, post: q.postTags, direction: q.direction, personnel: q.personnel, formationWords: FORMATION_WORDS });
      const players = tagged.players.map((p) => (q.direction === 'LT' ? flipPlayer(p) : p)).map((p) => ({ ...p, x: r2(p.x), y: r2(p.y) }));
      formations[q.key] = {
        players: players.map((p) => ({ label: p.label, x: p.x, y: p.y, symbol: p.symbol, role: p.role, outline: p.outline, motion: p.motion ? { from: { x: r2(p.motion.from.x), y: r2(p.motion.from.y) }, tag: p.motion.tag } : undefined })),
        review: tagged.review,
      };
      ok++;
    } catch (e) {
      // the tags broke the formation: fall back to the base alone, mirrored for Lt
      const players = base.map((p) => (q.direction === 'LT' ? flipPlayer(p) : p));
      formations[q.key] = { players: players.map((p) => ({ label: p.label, x: r2(p.x), y: r2(p.y), symbol: p.symbol, role: p.role })), review: [`tags not applied: ${e instanceof Error ? e.message : String(e)}`], baseOnly: true };
    }
  }
  // routes: a right-side receiver 12 yards out (and a back 5 yards deep): the path points are relative to him
  const routes: Record<string, { wr?: Path; hb?: Path }> = {};
  const wr: Player = { id: 'wr', side: 'offense', symbol: 'circle', label: 'Z', x: 12, y: 0, role: 'WR' };
  const hb: Player = { id: 'hb', side: 'offense', symbol: 'circle', label: 'H', x: 0, y: -5, role: 'RB' };
  for (const def of PACKERS_2019_ROUTES) {
    const entry = (routes[def.key] ??= {});
    try {
      const p = def.frame === 'back' ? hb : wr;
      const path = routeDefPath(def, p, { id: `r-${def.key}`, side: 1, hashX: HASH_PRESETS.nfl, fieldSide: 1, tackleX: 2 });
      entry[def.frame === 'back' ? 'hb' : 'wr'] = path;
    } catch (e) {
      entry.wr = undefined;
    }
  }
  writeFileSync(path.join(ROOT, 'compositions.json'), JSON.stringify({ formations, routes, routeNames: PACKERS_2019_ROUTES.map((r) => ({ key: r.key, name: r.name, variant: r.variant ?? null, group: r.group })) }));
  console.log(`composed ${ok}/${req.formations.length} formation lines, ${Object.keys(routes).length} routes`);
});
