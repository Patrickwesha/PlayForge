import type { Diagram, Play } from '@/model/types';
import { clonePlayers } from '@/model/factories';
import { addPaths, byLabel, seedPath } from './builders';
import { DEFENSE_FORMATIONS } from './defense';
import { OFFENSE_FORMATIONS } from './offense';

const T = '2026-01-01T00:00:00.000Z';

function form(name: string, side: 'offense' | 'defense') {
  const f = [...OFFENSE_FORMATIONS, ...DEFENSE_FORMATIONS].find((x) => x.name === name && x.side === side);
  if (!f) throw new Error(`seed formation ${name} missing`);
  return f;
}

function diagramFrom(offense: string, defense?: string): Diagram {
  const d: Diagram = { players: clonePlayers(form(offense, 'offense').players), paths: {}, annotations: {} };
  if (defense) Object.assign(d.players, clonePlayers(form(defense, 'defense').players));
  return d;
}

/** Offensive lineman by x position (LT -2, LG -1, C 0, RG 1, RT 2). */
function lineman(d: Diagram, x: number) {
  const p = Object.values(d.players).find((q) => (q.role === 'OL' || q.role === 'C') && q.side === 'offense' && Math.abs(q.x - x) < 0.01);
  if (!p) throw new Error(`lineman at ${x} not found`);
  return p;
}

let annCounter = 0;
function text(d: Diagram, x: number, y: number, t: string, style: 'redCaps' | 'plain' | 'split' | 'bold' = 'redCaps', size?: 'sm' | 'md' | 'lg') {
  annCounter += 1;
  const id = `sa-${annCounter}`;
  d.annotations[id] = { id, kind: 'text', x, y, text: t, style, size };
}
function mark(d: Diagram, x: number, y: number, m: 'handoffX' | 'ballDot' | 'zoneBubble' | 'fakeArrow') {
  annCounter += 1;
  const id = `sa-${annCounter}`;
  d.annotations[id] = { id, kind: 'mark', x, y, mark: m };
}

const base = (id: string, name: string, extra: Partial<Play>, diagram: Diagram): Play => ({
  id,
  name,
  category: 'Run',
  tags: ['demo'],
  positionNotes: {},
  diagram,
  createdAt: T,
  updatedAt: T,
  ...extra,
});

/** BEAST LEFT 16 GH COUNTER (from the user's TacklexPlaymaker drawing). QB (1) counter to the right C gap. */
function beastCounter(): Play {
  const d = diagramFrom('BEAST LEFT');
  const P = (l: string) => byLabel(d.players, l, 'offense');
  addPaths(d, [
    seedPath(lineman(d, -2).id, [{ x: 0, y: 0 }, { x: 0, y: 1.3 }], { end: 'tbar', role: 'block' }),
    seedPath(lineman(d, -1).id, [{ x: 0, y: 0 }, { x: 0, y: 1.3 }], { end: 'tbar', role: 'block' }),
    seedPath(lineman(d, 0).id, [{ x: 0, y: 0 }, { x: 0, y: 1.3 }], { end: 'tbar', role: 'block' }),
    seedPath(lineman(d, 1).id, [{ x: 0, y: 0 }, { x: 0, y: 1.3 }], { end: 'tbar', role: 'block' }),
    seedPath(lineman(d, 2).id, [{ x: 0, y: 0 }, { x: 0, y: 1.3 }], { end: 'tbar', role: 'block' }),
    seedPath(P('F').id, [{ x: 0, y: 0 }, { x: 0, y: 1.3 }], { end: 'tbar', role: 'block' }),
    seedPath(P('Y').id, [{ x: 0, y: 0 }, { x: -1.6, y: 0.6, smooth: true }, { x: -2.4, y: 2.2 }], { end: 'tbar', role: 'block' }),
    seedPath(P('4').id, [{ x: 0, y: 0 }, { x: 1.6, y: 2.2 }], { end: 'tbar', role: 'block' }),
    seedPath(P('2').id, [{ x: 0, y: 0 }, { x: -8, y: 1.2, smooth: true }, { x: -11, y: 3.6 }], { end: 'tbar', role: 'block' }),
    seedPath(P('3').id, [{ x: 0, y: 0 }, { x: 3, y: -0.8, smooth: true }, { x: 8.5, y: -0.6, smooth: true }, { x: 10, y: 1.5 }], { end: 'tbar', role: 'block' }),
    seedPath(P('1').id, [{ x: 0, y: 0 }, { x: -1.2, y: -1.4, smooth: true }, { x: 2, y: -2.2, smooth: true }, { x: 8.5, y: -1.2, smooth: true }, { x: 10.5, y: 4 }], { end: 'arrow', role: 'route', primary: true }),
  ]);
  return base('demo-beast-counter', 'BEAST LEFT 16 GH COUNTER', { formationLabel: 'BEAST LEFT (BASE)', personnel: undefined, category: 'Run', wristband: '3' }, d);
}

/** [11] SNUG / 11 POP vs OVER COVER 3: play-action TE pop. */
function snugPop(): Play {
  const d = diagramFrom('SNUG', 'OVER');
  const P = (l: string) => byLabel(d.players, l, 'offense');
  const olIds = Object.values(d.players).filter((p) => p.role === 'OL' || p.role === 'C').map((p) => p.id);
  addPaths(d, olIds.map((id) => seedPath(id, [{ x: 0, y: 0 }, { x: 0, y: 1.1 }], { end: 'tbar', role: 'block' })));
  addPaths(d, [
    seedPath(P('Y').id, [{ x: 0, y: 0 }, { x: 0.3, y: 1.2 }, { x: -1.5, y: 8 }], { primary: true }),
    seedPath(P('Z').id, [{ x: 0, y: 0 }, { x: 0, y: 16 }]),
    seedPath(P('X').id, [{ x: 0, y: 0 }, { x: 0, y: 3 }, { x: 5, y: 8 }]),
    seedPath(P('F').id, [{ x: 0, y: 0 }, { x: -1, y: 1.5, smooth: true }, { x: -7, y: 3 }]),
    seedPath(P('H').id, [{ x: 0, y: 0 }, { x: 2.6, y: 2.5 }], { end: 'tbar', role: 'block' }),
    seedPath(P('Q').id, [{ x: 0, y: 0 }, { x: 0.5, y: -1.5 }, { x: 1.5, y: -3.5 }], { end: 'dot', line: 'dotted', role: 'ball' }),
  ]);
  text(d, 5.5, -1.9, '-5-', 'split');
  text(d, -5.6, -0.9, '-5-', 'split');
  text(d, -1.3, -6.5, 'PA', 'redCaps', 'sm');
  mark(d, 1.4, -2.6, 'handoffX');
  return base('demo-snug-pop', '11 POP', { formationLabel: 'SNUG', personnel: '11', category: 'PA', defense: { front: 'OVER', coverage: 'COVER 3' }, wristband: '35 (3WK)' }, d);
}

/** [12] ACE / 18 SIDELINE PIN vs UNDER: outside zone with the WR pinning the force player. */
function acePin(): Play {
  const d = diagramFrom('ACE', 'UNDER');
  const P = (l: string) => byLabel(d.players, l, 'offense');
  const reach = (l: string) => seedPath(P(l).id, [{ x: 0, y: 0 }, { x: 0.9, y: 1.0 }], { end: 'tbar', role: 'block' });
  addPaths(d, [
    reach('Y'), reach('F'),
    ...Object.values(d.players).filter((p) => p.role === 'OL' || p.role === 'C').map((p) => seedPath(p.id, [{ x: 0, y: 0 }, { x: 0.9, y: 1.0 }], { end: 'tbar', role: 'block' })),
    seedPath(P('Z').id, [{ x: 0, y: 0 }, { x: -2.5, y: 3.5 }], { end: 'tbar', role: 'block' }),
    seedPath(P('X').id, [{ x: 0, y: 0 }, { x: 0, y: 12 }]),
    seedPath(P('H').id, [{ x: 0, y: 0 }, { x: 5, y: 2, smooth: true }, { x: 11, y: 4, smooth: true }, { x: 14, y: 9 }], { primary: true }),
    seedPath(P('Q').id, [{ x: 0, y: 0 }, { x: -1.5, y: -2.5, smooth: true }, { x: -7, y: -3.5 }], { end: 'arrow', line: 'dashed', role: 'ball' }),
  ]);
  text(d, 12, -2.4, 'PIN');
  text(d, -8.5, -5.2, 'FAKE\nKEEP', 'redCaps', 'sm');
  text(d, 9.6, -2.5, '-5-', 'split');
  mark(d, 2.2, -1.9, 'handoffX');
  return base('demo-ace-pin', '18 SIDELINE PIN', { formationLabel: 'ACE', personnel: '12', category: 'Run', defense: { front: 'UNDER', coverage: 'COVER 3' }, wristband: '57 NAVAJO' }, d);
}

/** [11] DOUBLES / H SCREEN LT: slow screen to the back. */
function doublesScreen(): Play {
  const d = diagramFrom('DOUBLES', 'OVER');
  const P = (l: string) => byLabel(d.players, l, 'offense');
  const lineman = (x: number) => Object.values(d.players).find((p) => (p.role === 'OL' || p.role === 'C') && p.x === x)!;
  const passSet = (x: number) => seedPath(lineman(x).id, [{ x: 0, y: 0 }, { x: 0, y: -1.2 }], { end: 'tbar', role: 'block' });
  addPaths(d, [
    passSet(0),
    passSet(1),
    passSet(2),
    seedPath(lineman(-1).id, [{ x: 0, y: 0 }, { x: -0.5, y: -1, smooth: true }, { x: -6, y: 0, smooth: true }, { x: -8, y: 3 }], { end: 'arrow', role: 'block' }),
    seedPath(lineman(-2).id, [{ x: 0, y: 0 }, { x: -0.5, y: -1, smooth: true }, { x: -5, y: 0.5, smooth: true }, { x: -6, y: 4 }], { end: 'arrow', role: 'block' }),
    seedPath(P('Y').id, [{ x: 0, y: 0 }, { x: 0, y: 8 }]),
    seedPath(P('Z').id, [{ x: 0, y: 0 }, { x: 0, y: 12 }]),
    seedPath(P('F').id, [{ x: 0, y: 0 }, { x: 0, y: 3 }, { x: -3, y: 7 }], { end: 'tbar', role: 'block' }),
    seedPath(P('X').id, [{ x: 0, y: 0 }, { x: 0, y: 6 }], { end: 'tbar', role: 'block' }),
    seedPath(P('H').id, [{ x: 0, y: 0 }, { x: -1, y: 0.6 }, { x: -7, y: -1.5 }], { end: 'arrow', primary: true }),
    seedPath(P('Q').id, [{ x: 0, y: 0 }, { x: 0, y: -3.5 }], { end: 'dot', line: 'dotted', role: 'ball' }),
  ]);
  d.paths['sp-pass'] = { id: 'sp-pass', anchor: { kind: 'free' }, points: [{ x: 0, y: -8.5 }, { x: -9, y: -6.7 }], end: 'arrow', line: 'dotted', role: 'ball' };
  text(d, -7, -3.5, 'SLOW', 'redCaps', 'sm');
  return base('demo-doubles-screen', 'H SCREEN LT', { formationLabel: 'DOUBLES', personnel: '11', category: 'Screen', defense: { front: 'OVER', coverage: 'COVER 3' } }, d);
}

/** BEAST RIGHT 24 BUCK: RB (2) off tackle right, LG and C pull, wing (3) seals. */
function beastBuck(): Play {
  const d = diagramFrom('BEAST RIGHT');
  const P = (l: string) => byLabel(d.players, l, 'offense');
  addPaths(d, [
    seedPath(lineman(d, -2).id, [{ x: 0, y: 0 }, { x: 0, y: 1.2 }], { end: 'tbar', role: 'block' }),
    seedPath(P('F').id, [{ x: 0, y: 0 }, { x: 1, y: 1 }], { end: 'tbar', role: 'block' }),
    seedPath(lineman(d, -1).id, [{ x: 0, y: 0 }, { x: 1.2, y: -1, smooth: true }, { x: 3.5, y: -0.9, smooth: true }, { x: 4.6, y: 1.8 }], { end: 'arrow', role: 'block' }),
    seedPath(lineman(d, 0).id, [{ x: 0, y: 0 }, { x: 1.2, y: -1, smooth: true }, { x: 3.8, y: -0.6, smooth: true }, { x: 5.2, y: 0.8 }], { end: 'tbar', role: 'block' }),
    seedPath(lineman(d, 1).id, [{ x: 0, y: 0 }, { x: -0.9, y: 1.0 }], { end: 'tbar', role: 'block' }),
    seedPath(lineman(d, 2).id, [{ x: 0, y: 0 }, { x: -0.9, y: 1.0 }], { end: 'tbar', role: 'block' }),
    seedPath(P('Y').id, [{ x: 0, y: 0 }, { x: -0.9, y: 1.0 }], { end: 'tbar', role: 'block' }),
    seedPath(P('3').id, [{ x: 0, y: 0 }, { x: 1.5, y: 1.6 }, { x: 2.2, y: 4 }], { end: 'tbar', role: 'block' }),
    seedPath(P('4').id, [{ x: 0, y: 0 }, { x: 0, y: 5 }], { end: 'tbar', role: 'block' }),
    seedPath(P('2').id, [{ x: 0, y: 0 }, { x: 1.5, y: 0.8, smooth: true }, { x: 4, y: 3.5, smooth: true }, { x: 5, y: 8 }], { primary: true }),
    seedPath(P('1').id, [{ x: 0, y: 0 }, { x: 0.8, y: -1.5 }, { x: -2.5, y: -3 }], { end: 'arrow', role: 'ball', line: 'dashed' }),
  ]);
  mark(d, 1.4, -2.3, 'handoffX');
  text(d, -4.5, -4.2, 'FAKE\nKEEP', 'redCaps', 'sm');
  return base('demo-beast-buck', 'BEAST RIGHT 24 BUCK', { formationLabel: 'BEAST RIGHT (BASE)', category: 'Run', wristband: '7' }, d);
}

/** [11] TRIPS RT / FLOOD: three-level to the trips side. */
function tripsFlood(): Play {
  const d = diagramFrom('TRIPS RT', '4-2-5');
  const P = (l: string) => byLabel(d.players, l, 'offense');
  const ol = Object.values(d.players).filter((p) => p.role === 'OL' || p.role === 'C');
  addPaths(d, [
    ...ol.map((p) => seedPath(p.id, [{ x: 0, y: 0 }, { x: 0, y: -1.2 }], { end: 'tbar', role: 'block' })),
    seedPath(P('Z').id, [{ x: 0, y: 0 }, { x: 0, y: 18 }]),
    seedPath(P('F').id, [{ x: 0, y: 0 }, { x: 0, y: 12 }, { x: 8, y: 12 }], { primary: true }),
    seedPath(P('Y').id, [{ x: 0, y: 0 }, { x: 1, y: 1.5, smooth: true }, { x: 9, y: 3 }]),
    seedPath(P('X').id, [{ x: 0, y: 0 }, { x: 0, y: 12 }, { x: 6, y: 18 }]),
    seedPath(P('H').id, [{ x: 0, y: 0 }, { x: -1.5, y: 0.5 }, { x: -3, y: -0.5 }], { end: 'tbar', role: 'block' }),
    seedPath(P('Q').id, [{ x: 0, y: 0 }, { x: 0, y: -2 }], { end: 'dot', line: 'dotted', role: 'ball' }),
  ]);
  text(d, -6.5, -4, 'CHECK', 'redCaps', 'sm');
  return base('demo-trips-flood', 'FLOOD', { formationLabel: 'TRIPS RT', personnel: '11', category: 'Pass', defense: { front: '4-2-5', coverage: 'QUARTERS' }, wristband: '92' }, d);
}

export const DEMO_PLAYS: Play[] = [beastCounter(), snugPop(), acePin(), beastBuck(), tripsFlood(), doublesScreen()];
