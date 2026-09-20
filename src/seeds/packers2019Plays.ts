import { HASH_PRESETS } from '@/model/constants';
import type { Annotation, Formation, Path, PathPoint, Play, PlayAlternate, PlayCategory, Player, RouteDef } from '@/model/types';
import { flipPlayer } from '@/geometry/flip';
import { applyCallTags, assertSevenOnLine, type AppliedTag } from '@/geometry/formationTags';
import { baseBlock, passSetBlock, reachBlock, type Playside } from '@/geometry/blockPresets';
import { routeDefPath } from '@/geometry/routeLibrary';
import { PACKERS_2019_FORMATIONS, PACKERS_2019_ID_PREFIX, PACKERS_2019_TAG } from './packers2019';
import routePack from './data/packers2019Routes.json';
import playPack from './data/packers2019Plays.json';

/**
 * 2019 Packers (LaFleur) route library and plays. Both data files are written by
 * `npm run import:plays` (scripts/playbook/build_plays.py). The data only BINDS names: a play is an
 * imported formation + a protection + a route word per receiver (or a run family). Every line drawn
 * here comes from the route library records and the repo's block presets, never from the scans.
 */
type RouteTag = { wr: string; hb: string; startsInBackfield: boolean; isHot?: boolean };

type PlaySpec = {
  key: string;
  name: string;
  formationLabel: string;
  formationKey: string;
  direction: 'RT' | 'LT';
  personnel: string;
  category: PlayCategory;
  install: number;
  sourcePage: number;
  rawCall: string;
  protection: string | null;
  concept: string;
  runNumber: number | null;
  runFamily: 'outside-zone' | 'inside-zone' | 'gap' | null;
  routeTags: Record<string, RouteTag>;
  preTag: string | null;
  postTags: string[];
  alternate: { name: string | null; trigger: string | null; runNumber: number | null; runFamily: string | null; routeTags?: Record<string, RouteTag> } | null;
  notes: string | null;
  reviewNotes: string[];
};

const SEED_TIME = '2026-01-01T00:00:00.000Z';
export const PACKERS_2019_PLAY_ID_PREFIX = 'seed-gb19p-';
export const PACKERS_2019_PLAYS_REVISION: string = `${routePack.revision}.${playPack.revision}`;

export const PACKERS_2019_ROUTES: RouteDef[] = routePack.routes as RouteDef[];
const ROUTE_BY_KEY = new Map(PACKERS_2019_ROUTES.map((r) => [r.key, r]));
const FORMATION_BY_ID = new Map(PACKERS_2019_FORMATIONS.map((f) => [f.id, f]));
/** "STACK", "SWAMP", "PISTOL BONE" ...: the first word(s) of every formation name in the pack. */
const FORMATION_WORDS = [...new Set(PACKERS_2019_FORMATIONS.map((f) => f.name.toUpperCase().split(' RT')[0]))];

/** Look a route word up the way a call names it, e.g. routeByName('BASIC') or routeByName('GO', 'widen'). */
export function routeByName(name: string, variant?: string, group: 'WR' | 'HB' = 'WR'): RouteDef | undefined {
  const hits = PACKERS_2019_ROUTES.filter((r) => r.name === name.toUpperCase() && (variant ? r.variant === variant : true));
  return hits.find((r) => r.group === group && (variant || !r.variant)) ?? hits.find((r) => r.group === group) ?? hits[0];
}

const r2 = (n: number) => Math.round(n * 100) / 100 + 0;
const withId = (p: Path, id: string): Path => ({ ...p, id });

function dropFor(spec: PlaySpec, qb: Player): PathPoint[] {
  const gun = qb.y < -3;
  const quick = /^[23]00\b/.test(spec.protection ?? '');
  const runNo = /(?:^|\D)(1[2-9])(?!\d)/.exec(spec.name)?.[1];
  if (spec.category === 'PA' && runNo) {
    // sell the run to its side first, then set up (play pass) or boot away from it (keeper)
    const s = Number(runNo) % 2 === 0 ? 1 : -1;
    return /KEEP/.test(spec.name)
      ? [{ x: 0, y: 0 }, { x: s * 1.5, y: -2.5, smooth: true }, { x: -s * 5, y: -6, smooth: true }, { x: -s * 9, y: -4.5 }]
      : [{ x: 0, y: 0 }, { x: s * 1.5, y: -2.5, smooth: true }, { x: -s * 1.5, y: -6 }];
  }
  const depth = quick ? 3 : 5;
  return [{ x: 0, y: 0 }, { x: 0, y: -(gun ? Math.max(1, depth - 4) : depth) }];
}

function composeRun(spec: PlaySpec, players: Player[], id: string, paths: Record<string, Path>, annotations: Record<string, Annotation>) {
  const side: Playside = (spec.runNumber ?? 0) % 2 === 0 ? 'R' : 'L';
  const s = side === 'R' ? 1 : -1;
  const oz = spec.runFamily === 'outside-zone';
  const backs = players.filter((p) => p.role === 'RB' && p.y <= -3).sort((a, b) => a.y - b.y);
  const carrier = backs[0];
  const lead = backs[1];
  for (const p of players) {
    const onLine = p.y > -1.5;
    if (p.role === 'OL' || p.role === 'C' || (p.role === 'TE' && onLine && Math.abs(p.x) < 6)) {
      paths[`${id}-b-${p.id}`] = withId(oz ? reachBlock(p, side) : baseBlock(p), `${id}-b-${p.id}`);
    } else if ((p.role === 'WR' || p.role === 'TE' || (p.role === 'RB' && p.y > -3)) && p !== carrier) {
      // perimeter rules (8-9 / 4-5): block the man over you
      paths[`${id}-b-${p.id}`] = withId(baseBlock(p, 2.5), `${id}-b-${p.id}`);
    }
  }
  if (lead) {
    const pts: PathPoint[] = oz
      ? [{ x: 0, y: 0 }, { x: r2(s * 3 - lead.x * 0.5), y: r2(-lead.y - 2), smooth: true }, { x: r2(s * 5 - lead.x), y: r2(-lead.y + 2) }]
      : [{ x: 0, y: 0 }, { x: r2(s * 1.5 - lead.x), y: r2(-lead.y + 3) }];
    paths[`${id}-lead`] = { id: `${id}-lead`, anchor: { kind: 'player', playerId: lead.id }, points: pts, end: 'tbar', line: 'solid', role: 'block' };
  }
  if (carrier) {
    // outside zone: aim at the outside leg of the TE; inside zone: press the playside A/B gap
    const aimX = oz ? s * 4 : s * 1.5;
    const pts: PathPoint[] = oz
      ? [{ x: 0, y: 0 }, { x: r2(aimX - carrier.x), y: r2(-carrier.y - 0.5), smooth: true }, { x: r2(aimX + s * 2.5 - carrier.x), y: r2(-carrier.y + 5) }]
      : [{ x: 0, y: 0 }, { x: r2(aimX - carrier.x), y: r2(-carrier.y - 1), smooth: true }, { x: r2(aimX - carrier.x), y: r2(-carrier.y + 5) }];
    paths[`${id}-ball`] = { id: `${id}-ball`, anchor: { kind: 'player', playerId: carrier.id }, points: pts, end: 'arrow', line: 'solid', role: 'ball', primary: true };
  }
  const qb = players.find((p) => p.role === 'QB');
  if (qb && carrier) {
    const meshY = r2((carrier.y - qb.y) * 0.45);
    paths[`${id}-qb`] = {
      id: `${id}-qb`,
      anchor: { kind: 'player', playerId: qb.id },
      // open playside to the mesh, then the keeper fake away
      points: [{ x: 0, y: 0 }, { x: r2(s * 1.2), y: meshY, smooth: true }, { x: r2(-s * 4.5), y: r2(meshY - 2) }],
      end: 'arrow',
      line: 'dashed',
      role: 'free',
    };
    annotations[`${id}-mesh`] = { id: `${id}-mesh`, kind: 'mark', mark: 'handoffX', x: r2(qb.x + s * 1.2), y: r2(qb.y + meshY) };
  }
}

function composePass(spec: PlaySpec, players: Player[], id: string, paths: Record<string, Path>, routeTags: Record<string, string>, hotRoutes: Record<string, boolean>, review: string[]) {
  // strength is set to the field, the same assumption Book makes, so "Field = X / Boundary = Y" landmarks pick by the call's side
  const fieldSide = spec.direction === 'LT' ? -1 : 1;
  const tagged = new Set<string>();
  const right = players.filter((p) => p.x > 3.5 && p.role !== 'QB').length;
  const left = players.filter((p) => p.x < -3.5 && p.role !== 'QB').length;
  for (const [letter, tag] of Object.entries(spec.routeTags)) {
    const p = players.find((q) => q.label === letter);
    if (!p) continue;
    // after the tags have placed him: a man still in the backfield runs the HB tree, a man split out runs the receiver tree
    const inBackfield = p.y <= -3;
    const def = ROUTE_BY_KEY.get(inBackfield ? tag.hb : tag.wr);
    if (!def) continue;
    if (def.frame === 'receiver' && inBackfield) review.push(`${letter} runs ${def.name} (a receiver route) but is still in the backfield after the call's tags were applied`);
    // a player in the middle of the formation releases to the side with fewer receivers
    const side = Math.abs(p.x) < 0.5 ? (right <= left ? 1 : -1) : undefined;
    const routeSide = side ?? (p.x < 0 ? -1 : 1);
    const tackleX = Math.max(...players.filter((q) => q.role === 'OL').map((q) => routeSide * q.x));
    paths[`${id}-r-${letter}`] = routeDefPath(def, p, { id: `${id}-r-${letter}`, side, hashX: HASH_PRESETS.nfl, fieldSide, tackleX });
    routeTags[p.id] = def.key;
    if (def.isHot === null && tag.isHot !== undefined) hotRoutes[p.id] = tag.isHot;
    else if (def.isHot === null) review.push(`${letter} runs ${def.name}, which the book runs Hot or Late, and the page does not say which`);
    tagged.add(p.id);
  }
  for (const p of players) {
    if (tagged.has(p.id)) continue;
    const onLine = p.y > -1.5;
    if (p.role === 'OL' || p.role === 'C' || (p.role === 'TE' && onLine && Math.abs(p.x) < 6)) {
      paths[`${id}-b-${p.id}`] = withId(passSetBlock(p), `${id}-b-${p.id}`);
    }
  }
  const qb = players.find((p) => p.role === 'QB');
  if (qb && spec.category !== 'Screen') {
    paths[`${id}-qb`] = { id: `${id}-qb`, anchor: { kind: 'player', playerId: qb.id }, points: dropFor(spec, qb), end: 'dot', line: 'solid', role: 'free' };
  }
}

/** What the tag engine did for one play, kept for the report and the tests. */
export const PACKERS_2019_TAG_LOG = new Map<string, AppliedTag[]>();

function toPlay(spec: PlaySpec): Play | null {
  const formation: Formation | undefined = FORMATION_BY_ID.get(`${PACKERS_2019_ID_PREFIX}${spec.formationKey}`);
  if (!formation) return null;
  const id = `${PACKERS_2019_PLAY_ID_PREFIX}${spec.key}`;
  const base: Player[] = Object.values(formation.players).map((p) => ({ ...p, id: `${id}-${p.id.slice(formation.id.length + 1)}` }));

  // Tags are applied in strong-right space, then the whole thing is mirrored for a Lt call (ghosts and motion paths included).
  let tagged;
  try {
    tagged = applyCallTags(base, { pre: spec.preTag, post: spec.postTags, direction: spec.direction, personnel: spec.personnel, formationWords: FORMATION_WORDS });
  } catch (e) {
    throw new Error(`${spec.rawCall} (p-${spec.sourcePage}): ${e instanceof Error ? e.message : String(e)}`);
  }
  const players = tagged.players.map((p) => (spec.direction === 'LT' ? flipPlayer(p) : p)).map((p) => ({ ...p, x: r2(p.x), y: r2(p.y) }));
  assertSevenOnLine(players, `${spec.rawCall} (p-${spec.sourcePage})`);
  PACKERS_2019_TAG_LOG.set(id, tagged.applied);

  const paths: Record<string, Path> = {};
  const annotations: Record<string, Annotation> = {};
  const routeTags: Record<string, string> = {};
  const hotRoutes: Record<string, boolean> = {};
  const review = [...spec.reviewNotes, ...tagged.review];
  if (spec.runFamily === 'outside-zone' || spec.runFamily === 'inside-zone') composeRun(spec, players, id, paths, annotations);
  else if (Object.keys(spec.routeTags).length > 0) composePass(spec, players, id, paths, routeTags, hotRoutes, review);

  // a Can call's alternate rides along as data; a pass alternate keeps its route words, keyed by player id
  let alternate: PlayAlternate | undefined;
  if (spec.alternate?.name) {
    const altRoutes: Record<string, string> = {};
    for (const [letter, tag] of Object.entries(spec.alternate.routeTags ?? {})) {
      const p = players.find((q) => q.label === letter);
      if (p) altRoutes[p.id] = p.y <= -3 ? tag.hb : tag.wr;
    }
    alternate = {
      name: spec.alternate.name,
      ...(spec.alternate.trigger ? { trigger: spec.alternate.trigger } : {}),
      ...(spec.alternate.runNumber ? { runNumber: spec.alternate.runNumber } : {}),
      ...(spec.alternate.runFamily ? { runFamily: spec.alternate.runFamily } : {}),
      ...(Object.keys(altRoutes).length ? { routeTags: altRoutes } : {}),
    };
    if (!spec.alternate.trigger) review.push('Can call: the page does not state what flips it to the alternate');
  }
  const appliedTags = tagged.applied.map((a) => (a.player ? `${a.player} ${a.tag}` : a.tag));
  const uniqueReview = [...new Set(review)];

  return {
    id,
    name: spec.name,
    formationId: formation.id,
    formationLabel: spec.formationLabel,
    personnel: spec.personnel,
    category: spec.category,
    tags: [PACKERS_2019_TAG, `install-${spec.install}`, ...(spec.runFamily ? [spec.runFamily] : []), ...(alternate ? ['can'] : [])],
    notes: [spec.notes, ...tagged.notes].filter(Boolean).join(' ') || undefined,
    positionNotes: {},
    diagram: { players: Object.fromEntries(players.map((p) => [p.id, p])), paths, annotations },
    source: playPack.source,
    sourcePage: spec.sourcePage,
    install: spec.install,
    rawCall: spec.rawCall,
    protection: spec.protection ?? undefined,
    concept: spec.concept,
    routeTags: Object.keys(routeTags).length ? routeTags : undefined,
    hotRoutes: Object.keys(hotRoutes).length ? hotRoutes : undefined,
    alternate,
    appliedTags: appliedTags.length ? appliedTags : undefined,
    confidence: uniqueReview.length ? 'needs-review' : 'derived',
    reviewNotes: uniqueReview.length ? uniqueReview : undefined,
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  };
}

export const PACKERS_2019_PLAYS: Play[] = (playPack.plays as unknown as PlaySpec[]).map(toPlay).filter((p): p is Play => p !== null);
