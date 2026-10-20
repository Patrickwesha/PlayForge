/**
 * Turn a youth system (types.ts) into PlayForge rows: formations, 20 plays (Red drawn, Yellow the exact mirror)
 * and the playbook, plus the helpers every page uses. Ids are fixed per system, so "Add to my library" twice
 * never duplicates.
 *
 * Units are yards, x = 0 at the ball (+ right), y = 0 at the line (+ downfield). Path points are relative to
 * their player; motion spots are absolute.
 */
import type { FitOptions } from '@/geometry/bounds';
import type { Diagram, Formation, Path, PathPoint, Play, PlayCategory, Playbook, Player } from '@/model/types';
import { flipDiagram, flipLabel } from '@/geometry/flip';
import { COLORS, type Concept, type FormationSpec, type Line, type Pt, type Side, type Spot, type YouthSystemDef } from './types';

/** Every pack row carries this time; "Add to my library" restamps rows as it writes them. */
export const YOUTH_PACK_TIME = '2026-10-19T00:00:00.000Z';

/** Tight fit for small youth thumbnails: the plays are short. */
export const YOUTH_FIT: FitOptions = { pad: 0.8, minBack: 5, minDown: 4, minSide: 6 };

export const JOB_ORDER_DEFAULT = ['LT', 'LG', 'C', 'RG', 'RT'];

const mirrorSpec = (f: FormationSpec): FormationSpec => ({
  ...f,
  key: f.key.replace('right', 'left'),
  name: f.name.replace('Right', 'Left'),
  callName: f.callName?.replace('Right', 'Left'),
  side: 'left',
  cue: f.cue.replace(/Red/g, 'Yellow'),
  spots: f.spots.map((s) => ({ ...s, x: -s.x, label: flipLabel(s.label), alignment: s.alignment?.replace('-right', '-left') })),
});

function playersFor(prefix: string, spots: Spot[]): Record<string, Player> {
  const out: Record<string, Player> = {};
  for (const s of spots) {
    const id = `${prefix}-${s.label.toLowerCase()}`;
    out[id] = {
      id,
      side: 'offense',
      symbol: s.role === 'C' ? 'square' : 'circle',
      label: s.label,
      x: s.x,
      y: s.y,
      role: s.role,
      labelColor: s.role === 'QB' ? 'red' : undefined,
      ...(s.alignment ? { alignment: s.alignment } : {}),
    };
  }
  return out;
}

const pts = (p: Pt[]): PathPoint[] => p.map(([x, y, s]) => (s ? { x, y, smooth: true } : { x, y }));

function pathFor(id: string, playerId: string, l: Line): Path {
  const base = { id, anchor: { kind: 'player' as const, playerId }, points: pts(l.pts) };
  switch (l.kind) {
    case 'block': return { ...base, end: 'tbar', line: 'solid', role: 'block' };
    case 'pull': return { ...base, end: 'arrow', line: 'solid', role: 'block' };
    case 'run': return { ...base, end: 'arrow', line: 'solid', role: 'route', color: 'red', width: 'thick' };
    case 'fake': return { ...base, end: 'arrow', line: 'dashed', role: 'route' };
    case 'route': return { ...base, end: 'arrow', line: 'solid', role: 'route' };
    case 'read1': return { ...base, end: 'arrow', line: 'solid', role: 'route', primary: true };
    case 'ball': return { ...base, end: 'arrow', line: 'dashed', role: 'ball', color: 'red' };
    case 'action': return { ...base, end: 'dot', line: 'solid', role: 'route' };
  }
}

export function buildYouthSystem(def: YouthSystemDef) {
  const formationSpecs: FormationSpec[] = def.formations.flatMap((f) => (f.side === 'right' ? [f, mirrorSpec(f)] : [f]));
  const formationId = (key: string) => `${def.idPrefix}f-${key}`;
  const formations: Formation[] = formationSpecs.map((f) => ({
    id: formationId(f.key),
    name: f.side ? `${f.name} (${COLORS[f.side].word})` : f.name,
    side: 'offense',
    personnel: undefined,
    playersPerSide: 11,
    players: playersFor(formationId(f.key), f.spots),
    tags: [def.tag, 'youth', f.family.toLowerCase()],
    family: f.family,
    strength: f.side ?? undefined,
    qbAlignment: f.qb,
    source: def.formationSource,
    note: f.cue,
    confidence: 'derived',
    builtin: false,
    createdAt: YOUTH_PACK_TIME,
    updatedAt: YOUTH_PACK_TIME,
  }));
  const specByKey = new Map(formationSpecs.map((f) => [f.key, f]));
  const formationByKey = new Map(formationSpecs.map((f, i) => [f.key, formations[i]]));
  const conceptByKey = new Map(def.concepts.map((c) => [c.key, c]));

  const redKey = (c: Concept) => def.drawings[c.key].formation ?? def.baseFormation.right;
  const sideKey = (side: Side, c: Concept) => (side === 'right' ? redKey(c) : redKey(c).replace('right', 'left'));

  const playId = (side: Side, c: Concept) => `${def.idPrefix}${COLORS[side].word.toLowerCase()}-${c.n}-${c.key}`;
  const categoryOf = (c: Concept): PlayCategory => (c.kind === 'run' ? 'Run' : c.kind === 'pass' ? (c.playAction ? 'PA' : 'Pass') : 'Special');
  const words = (s: string, side: Side) => s.replace(/\{wing\}/g, side).replace(/\{away\}/g, side === 'right' ? 'left' : 'right');

  /** The grown-up call, e.g. "Beast Right (Base) 14 Blast" or "Pro Right 28 Wide Zone". */
  const coachCall = (side: Side, c: Concept) => {
    const f = specByKey.get(sideKey(side, c))!;
    const num = c.numbers[side];
    return `${f.callName ?? f.name} ${num ? `${num} ` : ''}${c.coach}`;
  };
  const kidCall = (side: Side, c: Concept) => `${c.numbers[side] ? `${c.numbers[side]} ` : ''}${c.kid}`.toUpperCase();
  const wristbandLabel = (side: Side, c: Concept) => `${COLORS[side].word.toUpperCase()} ${c.n}`;

  function buildRight(c: Concept): { diagram: Diagram; notes: Record<string, string> } {
    const f = formationByKey.get(redKey(c));
    if (!f) throw new Error(`${def.id} ${c.key}: no formation ${redKey(c)}`);
    const pid = playId('right', c);
    const byLabel = new Map<string, Player>();
    const diagram: Diagram = { players: {}, paths: {}, annotations: {} };
    for (const p of Object.values(f.players)) {
      const id = `${pid}-${p.label.toLowerCase()}`;
      diagram.players[id] = { ...p, id };
      byLabel.set(p.label, diagram.players[id]);
    }
    const draw = def.drawings[c.key];
    if (draw.motion) {
      const p = byLabel.get(draw.motion.who);
      if (!p) throw new Error(`${c.key}: motion for missing ${draw.motion.who}`);
      p.motion = { from: { x: draw.motion.from[0], y: draw.motion.from[1] }, tag: draw.motion.tag, kind: 'motion' };
      p.x = draw.motion.to[0];
      p.y = draw.motion.to[1];
    }
    draw.lines.forEach((l, i) => {
      const p = byLabel.get(l.who);
      if (!p) throw new Error(`${c.key}: no player ${l.who}`);
      const id = `${pid}-r${i + 1}`;
      diagram.paths[id] = pathFor(id, p.id, l);
    });
    draw.text?.forEach((t, i) => {
      const id = `${pid}-a${i + 1}`;
      diagram.annotations[id] = { id, kind: 'text', x: t.x, y: t.y, text: t.t, style: 'redCaps', size: 'md' };
    });
    const notes: Record<string, string> = {};
    for (const [label, text] of Object.entries(draw.notes)) {
      const p = byLabel.get(label);
      if (!p) throw new Error(`${c.key}: note for missing player ${label}`);
      notes[p.id] = words(text, 'right');
    }
    return { diagram, notes };
  }

  /** Mirror a Red drawing into Yellow: same paths, every x flipped, ids renamed so they read right. */
  function mirror(c: Concept, red: Diagram): { diagram: Diagram; notes: Record<string, string> } {
    const from = playId('right', c);
    const to = playId('left', c);
    const flipped = flipDiagram(red);
    const idMap = new Map<string, string>();
    const diagram: Diagram = { players: {}, paths: {}, annotations: {} };
    for (const p of Object.values(flipped.players)) {
      const id = `${to}-${p.label.toLowerCase()}`;
      idMap.set(p.id, id);
      diagram.players[id] = { ...p, id };
    }
    for (const p of Object.values(flipped.paths)) {
      const id = p.id.replace(from, to);
      const anchor = p.anchor.kind === 'player' ? { kind: 'player' as const, playerId: idMap.get(p.anchor.playerId)! } : p.anchor;
      diagram.paths[id] = { ...p, id, anchor };
    }
    for (const a of Object.values(flipped.annotations)) {
      const id = a.id.replace(from, to);
      diagram.annotations[id] = { ...a, id };
    }
    const notes: Record<string, string> = {};
    for (const [label, text] of Object.entries(def.drawings[c.key].notes)) notes[`${to}-${flipLabel(label).toLowerCase()}`] = words(text, 'left');
    return { diagram, notes };
  }

  function makePlay(side: Side, c: Concept, d: { diagram: Diagram; notes: Record<string, string> }): Play {
    const draw = def.drawings[c.key];
    const formation = formationByKey.get(sideKey(side, c))!;
    return {
      id: playId(side, c),
      name: kidCall(side, c),
      formationId: formation.id,
      formationLabel: formation.name.toUpperCase(),
      category: categoryOf(c),
      tags: [def.tag, 'youth', c.key, c.kind, `week-${c.week}`, COLORS[side].word.toLowerCase()],
      notes: `${c.kidSays}\n\nCoach: ${c.coachNote}\n\nSignal: ${c.signal}. Check with me: ${c.cities.join(' / ')} ${COLORS[side].word}.`,
      positionNotes: d.notes,
      wristband: wristbandLabel(side, c),
      diagram: d.diagram,
      source: def.source,
      rawCall: coachCall(side, c),
      concept: c.coach,
      install: c.week,
      confidence: draw.review?.length ? 'needs-review' : 'derived',
      reviewNotes: draw.review,
      createdAt: YOUTH_PACK_TIME,
      updatedAt: YOUTH_PACK_TIME,
    };
  }

  const plays: Play[] = def.concepts.flatMap((c) => {
    const red = buildRight(c);
    return [makePlay('right', c, red), makePlay('left', c, mirror(c, red.diagram))];
  });
  const playById = new Map(plays.map((p) => [p.id, p]));
  const play = (side: Side, key: string) => {
    const c = conceptByKey.get(key);
    return c ? playById.get(playId(side, c)) : undefined;
  };

  const jobOf = (p: Play, label: string): string => {
    const pl = Object.values(p.diagram.players).find((x) => x.label === label);
    return (pl && p.positionNotes[pl.id]) || '';
  };

  /** Every label that wears a jersey in the base formation, skill players first, then the line. */
  const base = formationByKey.get(def.baseFormation.right)!;
  const jobLabels = [
    ...Object.values(base.players).filter((p) => p.role !== 'OL' && p.role !== 'C').map((p) => p.label),
    ...JOB_ORDER_DEFAULT,
  ];

  /**
   * One position's jobs on every concept, said sideless ("the wing side" / "the other side") so one line works
   * for both colors. A lineman's job can change with the color (on Yellow the left guard does what the right
   * guard does on Red), so `yellow` is set only when it differs.
   */
  const sideless = (s: string) => s.replace(/\{wing\}/g, def.sideWords.wing).replace(/\{away\}/g, def.sideWords.away);
  const jobsFor = (label: string): { concept: Concept; red: string; yellow?: string }[] =>
    def.concepts.map((c) => {
      const notes = def.drawings[c.key].notes;
      const red = sideless(notes[label] ?? '');
      const yellow = sideless(notes[flipLabel(label)] ?? '');
      return { concept: c, red, yellow: yellow !== red ? yellow : undefined };
    });

  const section = (id: string, title: string, kinds: Concept['kind'][]) => ({
    id: `${def.idPrefix}s-${id}`,
    title,
    kind: 'plays' as const,
    itemIds: def.concepts.filter((c) => kinds.includes(c.kind)).flatMap((c) => [playId('right', c), playId('left', c)]),
  });
  const playbook: Playbook = {
    id: def.playbookId,
    name: def.title.toUpperCase(),
    subtitle: def.subtitle,
    cover: { title: def.title.toUpperCase(), subtitle: `${def.subtitle} · Red right, Yellow left`, season: '2026', showCover: true },
    sections: [
      section('runs', 'Runs', ['run']),
      section('pass', 'Passes', ['pass']),
      section('ice', 'Ice (freeze)', ['special']),
      { id: `${def.idPrefix}s-formations`, title: 'Formations', kind: 'formations', itemIds: formations.map((f) => f.id) },
    ],
    defaultLayout: '6up',
    paper: 'letter',
    createdAt: YOUTH_PACK_TIME,
    updatedAt: YOUTH_PACK_TIME,
  };

  return {
    ...def,
    formationSpecs,
    formationRows: formations,
    formationByKey,
    specByKey,
    conceptByKey,
    plays,
    play,
    playbook,
    pack: { formations, plays, playbooks: [playbook] },
    fit: YOUTH_FIT,
    coachCall,
    kidCall,
    wristbandLabel,
    jobOf,
    jobsFor,
    jobLabels,
    /** The quarterback's label in this system (1 in Beast, Q in the West Coast). */
    qbLabel: Object.values(base.players).find((p) => p.role === 'QB')?.label ?? '1',
    /** Red-side formation key a concept is drawn from. */
    formationOf: redKey,
  };
}

export type YouthSystem = ReturnType<typeof buildYouthSystem>;
