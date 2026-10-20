/**
 * Beast Offense 2026: the 9 formations and the 20 plays (10 concepts, Red and Yellow), drawn from my Beast
 * Playmaker sheets (formations, run plays, pass plays). Red (right) is drawn here; Yellow (left) is the exact
 * mirror, so the two can never drift apart. Ids are fixed so "Add to my library" twice never duplicates.
 *
 * Units are yards, x = 0 at the ball (+ right), y = 0 at the line (+ downfield). Path points are relative to
 * their player. Line spacing follows PlayForge: linemen 1 yard apart, the ends at 3.
 */
import type { FitOptions } from '@/geometry/bounds';
import type { Diagram, Formation, Path, PathPoint, Play, PlayCategory, Playbook, Player, PlayerRole } from '@/model/types';
import { flipDiagram, flipLabel } from '@/geometry/flip';
import { fieldLandmarks, landmarkById } from '@/geometry/landmarks';
import { BEAST_ID_PREFIX, BEAST_PLAYBOOK_ID, BEAST_TAG, COLORS, CONCEPTS, type Concept, type Side } from './content';

/** Tight fit for small youth thumbnails (wristbands, call sheet strip): the plays are short. */
export const BEAST_FIT: FitOptions = { pad: 0.8, minBack: 5, minDown: 4, minSide: 6 };

/** Every pack row carries this time; "Add to my library" restamps rows as it writes them. */
export const BEAST_PACK_TIME = '2026-10-19T00:00:00.000Z';

// ---------------------------------------------------------------- formations

type Spot = { label: string; x: number; y: number; role: PlayerRole; alignment?: string };

const LINE: Spot[] = [
  { label: 'LT', x: -2, y: 0, role: 'OL' },
  { label: 'LG', x: -1, y: 0, role: 'OL' },
  { label: 'C', x: 0, y: 0, role: 'C' },
  { label: 'RG', x: 1, y: 0, role: 'OL' },
  { label: 'RT', x: 2, y: 0, role: 'OL' },
];

const NFL_LANDMARKS = fieldLandmarks('nfl');
const at = (id: string) => {
  const l = landmarkById(NFL_LANDMARKS, id);
  if (!l) throw new Error(`landmark ${id} missing`);
  return l.x;
};
const HASH5 = at('hash+5-right');

export type BeastFormationSpec = {
  key: string;
  name: string;
  /** Red / Yellow, or null for a balanced look. */
  side: Side | null;
  family: string;
  qb: 'under' | 'pistol';
  cue: string;
  spots: Spot[];
};

/** Right-side and balanced formations; Left ones are mirrors (see FORMATION_SPECS). */
const RIGHT_FORMATIONS: BeastFormationSpec[] = [
  {
    key: 'beast-right', name: 'Beast Right', side: 'right', family: 'Beast', qb: 'under',
    cue: 'Y and both wings on the Red side. 1 and 2 four yards back, 2 on the wing side.',
    spots: [
      { label: 'F', x: -3, y: 0, role: 'TE' }, ...LINE, { label: 'Y', x: 3, y: 0, role: 'TE' },
      { label: '3', x: 2.5, y: -1, role: 'WR' }, { label: '4', x: 3.5, y: -1, role: 'WR' },
      { label: '1', x: 0, y: -4, role: 'QB' }, { label: '2', x: 1, y: -4, role: 'RB' },
    ],
  },
  {
    key: 'beast-wide-right', name: 'Beast Wide Right', side: 'right', family: 'Beast', qb: 'under',
    cue: 'Same as Beast, but Y splits out to Hash +5 and the wings go with him.',
    spots: [
      { label: 'F', x: -3, y: 0, role: 'TE' }, ...LINE, { label: 'Y', x: HASH5, y: 0, role: 'TE', alignment: 'hash+5-right' },
      { label: '3', x: HASH5 - 0.6, y: -1, role: 'WR' }, { label: '4', x: HASH5 + 0.6, y: -1, role: 'WR' },
      { label: '1', x: 0, y: -4, role: 'QB' }, { label: '2', x: 1, y: -4, role: 'RB' },
    ],
  },
  {
    key: 'pistol-right', name: 'Pistol Right', side: 'right', family: 'Pistol', qb: 'pistol',
    cue: '1 at 3 yards, 3 next to him on the Red side, 2 behind him. 4 is the only wing, outside the Y.',
    spots: [
      { label: 'F', x: -3, y: 0, role: 'TE' }, ...LINE, { label: 'Y', x: 3, y: 0, role: 'TE' },
      { label: '4', x: 4, y: -1, role: 'WR' },
      { label: '1', x: 0, y: -3, role: 'QB' }, { label: '3', x: 1, y: -3, role: 'RB' }, { label: '2', x: 0, y: -4.5, role: 'RB' },
    ],
  },
  {
    key: 'pistol-slot', name: 'Pistol Slot', side: null, family: 'Pistol', qb: 'pistol',
    cue: 'Balanced. F and Y two big steps outside the tackles, 3 and 4 in the slots one yard back. 1 at 3, 2 behind him.',
    spots: [
      { label: 'F', x: -5, y: 0, role: 'TE' }, { label: '3', x: -3.5, y: -1, role: 'WR' }, ...LINE,
      { label: '4', x: 3.5, y: -1, role: 'WR' }, { label: 'Y', x: 5, y: 0, role: 'TE' },
      { label: '1', x: 0, y: -3, role: 'QB' }, { label: '2', x: 0, y: -4.5, role: 'RB' },
    ],
  },
  {
    key: 'tank-right', name: 'Tank Right', side: 'right', family: 'Tank', qb: 'under',
    cue: 'Short yardage. 1 right behind the center, 2, 3 and 4 in a row one yard back on the Red side.',
    spots: [
      { label: 'F', x: -3, y: 0, role: 'TE' }, ...LINE, { label: 'Y', x: 3, y: 0, role: 'TE' },
      { label: '1', x: 0, y: -1.2, role: 'QB' }, { label: '2', x: 1.5, y: -1.2, role: 'RB' },
      { label: '3', x: 2.5, y: -1.2, role: 'WR' }, { label: '4', x: 3.5, y: -1.2, role: 'WR' },
    ],
  },
];

const mirrorSpec = (f: BeastFormationSpec): BeastFormationSpec => ({
  ...f,
  key: f.key.replace('right', 'left'),
  name: f.name.replace('Right', 'Left'),
  side: 'left',
  cue: f.cue.replace(/Red/g, 'Yellow'),
  spots: f.spots.map((s) => ({ ...s, x: s.alignment ? -s.x : -s.x, label: flipLabel(s.label), alignment: s.alignment?.replace('-right', '-left') })),
});

export const FORMATION_SPECS: BeastFormationSpec[] = RIGHT_FORMATIONS.flatMap((f) => (f.side === 'right' ? [f, mirrorSpec(f)] : [f]));

const formationId = (key: string) => `${BEAST_ID_PREFIX}f-${key}`;

function players(prefix: string, spots: Spot[]): Record<string, Player> {
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
      labelColor: s.label === '1' ? 'red' : undefined,
      ...(s.alignment ? { alignment: s.alignment } : {}),
    };
  }
  return out;
}

export const BEAST_FORMATIONS: Formation[] = FORMATION_SPECS.map((f) => ({
  id: formationId(f.key),
  name: f.side ? `${f.name} (${COLORS[f.side].word})` : f.name,
  side: 'offense',
  personnel: undefined,
  playersPerSide: 11,
  players: players(formationId(f.key), f.spots),
  tags: [BEAST_TAG, 'youth', f.family.toLowerCase()],
  family: f.family,
  strength: f.side ?? undefined,
  qbAlignment: f.qb,
  source: 'Beast Offense Formations (Playmaker, 2026-02-28)',
  note: f.cue,
  confidence: 'derived',
  builtin: false,
  createdAt: BEAST_PACK_TIME,
  updatedAt: BEAST_PACK_TIME,
}));

export const beastFormationByKey = new Map(FORMATION_SPECS.map((f, i) => [f.key, BEAST_FORMATIONS[i]]));

// ---------------------------------------------------------------- path language

/** [x, y] or [x, y, 's'] for a point the line curves through. Relative to the player. */
type Pt = [number, number] | [number, number, 's'];
type Kind = 'block' | 'run' | 'fake' | 'route' | 'read1' | 'pull' | 'ball' | 'action';
type Line = { who: string; kind: Kind; pts: Pt[] };

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

// blocks every play reuses (relative, Red side: + x is toward the wings)
const TOWARD_WINGS: Pt[] = [[0, 0], [0.8, 0.6]];
const TOWARD_AWAY: Pt[] = [[0, 0], [-0.8, 0.6]];
const DOWN_AWAY: Pt[] = [[0, 0], [-0.8, 0.9]];
const DOWN_WINGS: Pt[] = [[0, 0], [0.8, 0.9]];
const OUT_WINGS: Pt[] = [[0, 0], [0.8, 0.9]];
const OUT_AWAY: Pt[] = [[0, 0], [-0.8, 0.9]];
const BASE: Pt[] = [[0, 0], [0, 1.2]];
const SET: Pt[] = [[0, 0], [0, -0.8]];
const b = (who: string, p: Pt[]): Line => ({ who, kind: 'block', pts: p });
const passPro = (...who: string[]) => who.map((w) => b(w, SET));

// ---------------------------------------------------------------- the ten concepts, drawn Red

export type PlayDraw = {
  lines: Line[];
  /** Big red words on the field (Ice). */
  text?: { x: number; y: number; t: string }[];
  /** Assignments by Red-side label. {wing} / {away} become right / left (mirrored on Yellow). */
  notes: Record<string, string>;
  /** Where my source pages disagree with each other, and what I drew. */
  review?: string[];
};

const ballTo = (from: [number, number], to: [number, number]): Line => ({ who: '1', kind: 'ball', pts: [from, [to[0], to[1] + 4]] });

export const DRAWINGS: Record<string, PlayDraw> = {
  train: {
    lines: [
      b('F', TOWARD_WINGS), b('LT', TOWARD_WINGS), b('LG', TOWARD_WINGS),
      b('C', [[0, 0], [0.45, 1.2]]), b('RG', [[0, 0], [-0.45, 1.2]]),
      b('RT', DOWN_AWAY), b('Y', DOWN_AWAY),
      { who: '2', kind: 'block', pts: [[0, 0], [-0.5, 3, 's'], [-0.5, 7.5]] },
      { who: '1', kind: 'run', pts: [[0, 0], [0.4, 2.6, 's'], [0.5, 5], [0.5, 9]] },
      b('3', [[0, 0], [0, 5]]),
      b('4', [[0, 0], [1, 1.5, 's'], [1.3, 4.5]]),
    ],
    notes: {
      '1': 'Snap, then follow 2 through the {wing} A gap. Stay right behind him and cut off his block. Two hands on the ball in the hole.',
      '2': 'Lead through the {wing} A gap. Block the first linebacker you see. Hit him in the numbers and keep your feet moving.',
      C: 'Snap. GOD to the {wing} side: double the man in the {wing} A gap with your guard. Drive him back. If he is handled, climb to the linebacker.',
      RG: 'GOD. Gap: double the man in the A gap with the center and drive him back.',
      RT: 'GOD. Gap, On, Down: block the first man inside you and seal him away from the hole.',
      Y: 'GOD. Gap, On, Down: seal the end man inside.',
      LG: 'GOD toward the ball. Nobody gets through your inside gap.',
      LT: 'GOD toward the ball. Nobody gets through your inside gap.',
      F: 'GOD toward the ball. Shut the back door: nobody chases 1 from behind.',
      '3': 'Stalk the corner on your side: get in front of him, hit him, stay on him.',
      '4': 'Stalk the safety or the nickel. Keep him from running inside.',
    },
  },
  hammer: {
    lines: [
      b('F', TOWARD_WINGS), b('LT', TOWARD_WINGS), b('LG', TOWARD_WINGS),
      b('C', BASE), b('RG', DOWN_AWAY), b('RT', OUT_WINGS),
      { who: 'Y', kind: 'block', pts: [[0, 0], [-0.8, 1, 's'], [-1.2, 3.5]] },
      { who: '2', kind: 'block', pts: [[0, 0], [0.5, 3, 's'], [0.5, 7.5]] },
      { who: '1', kind: 'run', pts: [[0, 0], [1.4, 3, 's'], [1.5, 5.5], [1.6, 9.5]] },
      b('3', [[0, 0], [0.3, 2, 's'], [0.1, 5.5]]),
      b('4', [[0, 0], [1, 2, 's'], [1.5, 4.5]]),
    ],
    notes: {
      '1': 'Snap, follow 2 into the {wing} B gap (between the guard and the tackle). Watch the tackle\'s OUT block and cut tight off it.',
      '2': 'Lead through the {wing} B gap. Stay tight to the guard. Block the first linebacker in the hole.',
      C: 'GOD. Block the man on you. If nobody is there, help the guard, then climb to the linebacker.',
      RG: 'GOD. Gap, On, Down: block down on the man inside you. Drive him toward the ball to open the B gap.',
      RT: 'OUT! This is the one block that is not GOD. Block the end man and push him to the outside.',
      Y: 'Down to the linebacker: skip the end (the tackle has him) and block the first linebacker inside.',
      LG: 'GOD toward the ball. Nobody gets through your inside gap.',
      LT: 'GOD toward the ball. Nobody gets through your inside gap.',
      F: 'GOD toward the ball. Shut the back door.',
      '3': 'Block the safety or the closest man coming inside. Get your body between him and the hole.',
      '4': 'Release outside and stalk the corner. Keep him outside.',
    },
    review: ['My Hammer (14 Blast) text says the RT kicks the end out and also "logs him inside". The drawing is an out block, so I drew OUT.'],
  },
  rocket: {
    lines: [
      b('F', TOWARD_WINGS), b('LT', TOWARD_WINGS), b('LG', TOWARD_WINGS), b('C', TOWARD_WINGS),
      b('RG', DOWN_AWAY), b('RT', DOWN_AWAY),
      { who: 'Y', kind: 'block', pts: [[0, 0], [1.2, 1, 's'], [2.2, 2.5]] },
      { who: '2', kind: 'block', pts: [[0, 0], [3, 0.6, 's'], [5, 3, 's'], [5.5, 6]] },
      { who: '1', kind: 'run', pts: [[0, 0], [3, -0.3, 's'], [6, 2, 's'], [7.5, 6, 's'], [8, 10]] },
      b('3', [[0, 0], [1.8, 2, 's'], [2.2, 5]]),
      b('4', [[0, 0], [2, 1.5, 's'], [2.8, 5.5]]),
    ],
    notes: {
      '1': 'Snap and get to the {wing} edge fast. Run flat, read your blockers, and turn up when you see the crease.',
      '2': 'Lead the Rocket in front of 1. Block the first man who shows up in the alley.',
      C: 'GOD to the {wing} side. Wash anybody who chases toward the Rocket.',
      RG: 'GOD. Down: block the man inside you and seal him.',
      RT: 'GOD. Down: block the end inside. This block opens the edge.',
      Y: 'Release and block the first man outside you. Seal him inside.',
      LG: 'GOD toward the ball. Seal the inside.',
      LT: 'GOD toward the ball. Seal the inside.',
      F: 'GOD toward the ball. Nobody chases the Rocket from behind.',
      '3': 'Lead outside. Block the linebacker or safety who flows to the edge.',
      '4': 'Lead outside as the farthest blocker. Block the corner.',
    },
  },
  crossover: {
    lines: [
      b('F', OUT_AWAY), b('LT', DOWN_WINGS), b('LG', DOWN_WINGS),
      b('C', TOWARD_AWAY), b('RG', TOWARD_AWAY), b('RT', TOWARD_AWAY), b('Y', TOWARD_AWAY),
      { who: '2', kind: 'fake', pts: [[0, 0], [3, 0.7, 's'], [5.5, 3]] },
      b('4', [[0, 0], [1, 1.5, 's'], [1.4, 4]]),
      { who: '3', kind: 'block', pts: [[0, 0], [-3, -0.4, 's'], [-4.8, -0.2, 's'], [-5.1, 4.5]] },
      { who: '1', kind: 'run', pts: [[0, 0], [0.7, 0.4], [-0.3, 1.8, 's'], [-1.6, 4.5, 's'], [-1.8, 9]] },
    ],
    notes: {
      '1': 'Snap, one jab step to the {wing} side to sell Rocket. Then cut back hard to the {away} B gap behind 3.',
      '2': 'Fake Rocket to the {wing} side. Run it full speed for 5 yards. Do not look back.',
      '3': 'Cross behind the line to the {away} side and lead through the hole. Block the first linebacker.',
      '4': 'Stalk your man on the {wing} side like it is Rocket.',
      F: 'OUT! Block the end man on your side and push him outside.',
      LT: 'GOD. Down: block the man inside you toward the ball. This is the seam 1 runs through.',
      LG: 'GOD. Down: block the man inside you and widen the hole.',
      C: 'GOD to the {away} side. Nobody fills the hole from the inside.',
      RG: 'GOD toward the ball. Cut off anybody chasing back.',
      RT: 'GOD toward the ball. Cut off anybody chasing back.',
      Y: 'GOD toward the ball. Nobody chases 1 from behind.',
    },
    review: ['My Crossover (GH Counter) text says 3 fakes the sweep and F leads through. The drawing has 3 crossing to lead and F blocking. I drew the drawing: 3 leads, F blocks OUT.'],
  },
  limo: {
    lines: [
      b('F', DOWN_WINGS), b('LT', DOWN_WINGS),
      { who: 'LG', kind: 'block', pts: [[0, 0], [-1.3, -0.9, 's'], [-2.8, -0.6, 's'], [-3.3, 0.8]] },
      { who: 'C', kind: 'block', pts: [[0, 0], [-0.8, -1, 's'], [-1.6, -0.8, 's'], [-1.7, 3.5]] },
      b('RG', [[0, 0], [-0.9, 0.9]]), b('RT', TOWARD_AWAY), b('Y', TOWARD_AWAY),
      b('3', [[0, 0], [0.5, 2, 's'], [0.6, 4.5]]),
      b('4', [[0, 0], [1.2, 1.5, 's'], [1.6, 4.5]]),
      { who: '1', kind: 'fake', pts: [[0, 0], [1.4, -0.7, 's'], [3.2, -0.5]] },
      { who: '2', kind: 'run', pts: [[0, 0], [-1, 0.8, 's'], [-2.2, 2.5, 's'], [-2.6, 5], [-2.8, 9.5]] },
    ],
    notes: {
      '1': 'Snap, hand the ball to 2 as he crosses in front of you. Then fake Rocket to the {wing} side.',
      '2': 'Cross in front of 1 going to the {away} side and take the handoff. Follow the center through the hole. Run downhill.',
      LG: 'PULL and kick out: step back, run flat behind the line, and block the first man past the end. Push him out.',
      C: 'Snap, then PULL and lead: follow the guard, turn up in the hole, and block the first linebacker.',
      RG: 'BLOCK BACK (Down): block the man over the center so the center can pull.',
      LT: 'GOD. Down: block the man inside you toward the ball.',
      F: 'GOD. Down: seal the man inside you.',
      RT: 'GOD toward the ball. Cut off anybody chasing.',
      Y: 'GOD toward the ball. Cut off anybody chasing.',
      '3': 'Block on the {wing} side like it is Rocket.',
      '4': 'Block on the {wing} side like it is Rocket.',
    },
    review: [
      'My 23 / 24 Buck pages drew Y and F swapped (Y away from the wings). I kept the normal Beast so the kids never change where they line up: F is the end on the hole side.',
      'Pullers follow my Buck text: the hole-side guard kicks out, the center leads, the other guard blocks back.',
    ],
  },
  elevator: {
    lines: [
      ...passPro('F', 'LT', 'LG', 'C', 'RG', 'RT'),
      { who: '2', kind: 'block', pts: [[0, 0], [0.2, 1.3, 's'], [-0.5, 2.2]] },
      b('3', [[0, 0], [-0.3, 0.7]]),
      { who: 'Y', kind: 'read1', pts: [[0, 0], [0, 4.5], [3.5, 7.5]] },
      { who: '4', kind: 'route', pts: [[0, 0], [1.2, 1.5, 's'], [1.5, 6], [5.5, 6]] },
      { who: '1', kind: 'action', pts: [[0, 0], [1, -0.8, 's'], [2.2, -0.6]] },
      ballTo([2.2, -0.6], [6.5, 7.5]),
    ],
    notes: {
      '1': 'Three steps, drift to the {wing} side. Look HIGH to Y on the corner first, then come DOWN to 4 on the out. If both are covered, tuck it and run.',
      Y: 'Corner: run up 5 steps, then break to the {wing} sideline at 7 yards. You are the first look. Hands up, eyes on 1.',
      '4': 'Out: run up 5 yards, then break flat to the {wing} sideline. You are the second look.',
      '2': 'Stay in and block. Pick up any blitzer.',
      '3': 'Stay in and block the most dangerous rusher inside.',
      F: 'Pass GOD. Stay in and protect the back side.',
      LT: 'Pass GOD: Gap, On, Don\'t go downfield.',
      LG: 'Pass GOD: Gap, On, Don\'t go downfield.',
      C: 'Snap. Pass GOD: Gap, On, Don\'t go downfield.',
      RG: 'Pass GOD: Gap, On, Don\'t go downfield.',
      RT: 'Pass GOD: Gap, On, Don\'t go downfield.',
    },
  },
  magic: {
    lines: [
      ...passPro('LT', 'LG', 'C', 'RG', 'RT'),
      { who: 'F', kind: 'route', pts: [[0, 0], [0, 6], [2.8, 9]] },
      { who: 'Y', kind: 'read1', pts: [[0, 0], [0, 5], [3.5, 8.5]] },
      { who: '2', kind: 'block', pts: [[0, 0], [-0.8, 0.9, 's'], [-1.4, 1.8]] },
      b('3', [[0, 0], [1, 1.6]]), b('4', [[0, 0], [0.5, 2]]),
      { who: '1', kind: 'action', pts: [[0, 0], [1.6, -0.6, 's'], [3.6, -0.2]] },
      ballTo([3.6, -0.2], [6.5, 8.5]),
    ],
    notes: {
      '1': 'Run the Rocket fake to the {wing} side, then set your feet. Look Y on the corner first, F on the post second. Nobody open? Run.',
      Y: 'Corner: run up 5 yards, then break to the {wing} sideline. First look.',
      F: 'Post from the back side: run up 6 yards, then cut to the middle. Second look.',
      '2': 'Block the end man on the {away} side. He is the one who can hit 1 from behind.',
      '3': 'Sell Rocket: block your man like it is a run. Do not go out for a pass.',
      '4': 'Sell Rocket: block your man like it is a run. Do not go out for a pass.',
      LT: 'Sell the run for one step, then Pass GOD: Gap, On, Don\'t go downfield.',
      LG: 'Sell the run for one step, then Pass GOD.',
      C: 'Snap. Sell the run for one step, then Pass GOD.',
      RG: 'Sell the run for one step, then Pass GOD.',
      RT: 'Sell the run for one step, then Pass GOD.',
    },
    review: ['My Sweep Pass text names both F and Y as the primary read. The drawing throws to Y, so Y is the first look.'],
  },
  pop: {
    lines: [
      ...passPro('LT', 'LG', 'C', 'RG', 'RT'),
      b('3', [[0, 0], [-0.4, 0.8]]), b('4', [[0, 0], [0.4, 1, 's'], [0.9, 2.2]]),
      { who: 'F', kind: 'read1', pts: [[0, 0], [-0.3, 3, 's'], [0.2, 7]] },
      { who: 'Y', kind: 'route', pts: [[0, 0], [0.5, 3], [0, 8]] },
      { who: '2', kind: 'route', pts: [[0, 0], [5.5, 1.5]] },
      ballTo([0, 0], [-2.8, 7]),
    ],
    notes: {
      '1': 'Catch the snap and look at F right away. Throw it on time. Then Y up the seam, then 2 in the flat. Nobody open? Run.',
      F: 'Pop! Get off the line fast and run straight up the seam. Hands up early. You are the first look.',
      Y: 'Run straight up the {wing} seam. Second look.',
      '2': 'Run to the {wing} flat, 3 yards deep. You are the safety valve.',
      '3': 'Stay in and block the most dangerous rusher.',
      '4': 'Stay in and block. Help on any outside rusher.',
      LT: 'Pass GOD: Gap, On, Don\'t go downfield.',
      LG: 'Pass GOD: Gap, On, Don\'t go downfield.',
      C: 'Snap. Pass GOD: Gap, On, Don\'t go downfield.',
      RG: 'Pass GOD: Gap, On, Don\'t go downfield.',
      RT: 'Pass GOD: Gap, On, Don\'t go downfield.',
    },
    review: ['My TE Pop text has 4 staying in to block and also calls a curl. I kept 4 in to block (drawn as a short block).'],
  },
  boomerang: {
    lines: [
      b('F', OUT_AWAY), b('LT', DOWN_WINGS), b('LG', DOWN_WINGS), b('C', BASE),
      b('RG', TOWARD_AWAY), b('RT', TOWARD_AWAY), b('Y', TOWARD_AWAY),
      { who: '2', kind: 'fake', pts: [[0, 0], [3, 0.5, 's'], [5, 3]] },
      { who: '3', kind: 'block', pts: [[0, 0], [-3.5, -0.6, 's'], [-6.5, -0.4, 's'], [-7.3, 4.5]] },
      { who: '1', kind: 'action', pts: [[0, 0], [2.5, -0.3, 's'], [4, 0.9]] },
      { who: '4', kind: 'run', pts: [[0, 0], [0.9, 0.9, 's'], [1.3, -0.8, 's'], [0.5, -2, 's'], [-2, -3.3, 's'], [-6, -3.2, 's'], [-8.5, 0, 's'], [-9, 5.5]] },
    ],
    notes: {
      '1': 'Run the Rocket action to the {wing} side. Hand the ball to 4 coming back. Keep faking Rocket after the handoff.',
      '4': 'Take one step like you are blocking for Rocket, then come back behind 1. Take the ball with two hands and run around the {away} end behind 3.',
      '2': 'Fake Rocket full speed to the {wing} side. Make them chase you.',
      '3': 'Cross behind the line to the {away} side and lead. Block the first man outside F\'s block.',
      F: 'OUT! Block the force player on your side and push him outside.',
      LT: 'GOD. Down: seal the man inside you.',
      LG: 'GOD. Down: seal the man inside you.',
      C: 'Snap. GOD: block the man on you.',
      RG: 'Sell Rocket for one step, then GOD toward the ball. Cut off the chase.',
      RT: 'Sell Rocket for one step, then GOD toward the ball. Cut off the chase.',
      Y: 'Sell Rocket for one step, then GOD toward the ball. Nobody chases 4 from behind.',
    },
  },
  ice: {
    lines: [],
    text: [{ x: 0, y: 3, t: 'ICE: FREEZE! NOBODY MOVES' }],
    notes: {
      '1': 'Freeze. If a defender jumps across the line, catch the snap and run right behind the center.',
      C: 'Freeze with your hand on the ball. Only snap it if a defender jumps across the line.',
      LT: 'Freeze. Do not move a muscle.', LG: 'Freeze. Do not move a muscle.', RG: 'Freeze. Do not move a muscle.', RT: 'Freeze. Do not move a muscle.',
      Y: 'Freeze.', F: 'Freeze.', '2': 'Freeze.', '3': 'Freeze.', '4': 'Freeze.',
    },
  },
};

// ---------------------------------------------------------------- build plays

const playId = (side: Side, c: Concept) => `${BEAST_ID_PREFIX}${COLORS[side].word.toLowerCase()}-${c.n}-${c.key}`;
const categoryOf = (c: Concept): PlayCategory => (c.kind === 'run' ? 'Run' : c.kind === 'pass' ? (c.key === 'pop' || c.key === 'elevator' ? 'Pass' : 'PA') : 'Special');
const words = (s: string, side: Side) => s.replace(/\{wing\}/g, side).replace(/\{away\}/g, side === 'right' ? 'left' : 'right');

/** The coach's call from Call Sheet V3, e.g. "Beast Right (Base) 14 Blast". */
export function coachCall(side: Side, c: Concept): string {
  const num = c.numbers[side];
  return `${COLORS[side].formation} (Base) ${num ? `${num} ` : ''}${c.coach}`;
}

/** What the card says, e.g. "14 HAMMER". */
export function kidCall(side: Side, c: Concept): string {
  const num = c.numbers[side];
  return `${num ? `${num} ` : ''}${c.kid}`.toUpperCase();
}

export const wristbandLabel = (side: Side, c: Concept) => `${COLORS[side].word.toUpperCase()} ${c.n}`;

function buildRight(c: Concept): { diagram: Diagram; notes: Record<string, string> } {
  const f = beastFormationByKey.get('beast-right')!;
  const pid = playId('right', c);
  const byLabel = new Map<string, Player>();
  const diagram: Diagram = { players: {}, paths: {}, annotations: {} };
  for (const p of Object.values(f.players)) {
    const id = `${pid}-${p.label.toLowerCase()}`;
    diagram.players[id] = { ...p, id };
    byLabel.set(p.label, diagram.players[id]);
  }
  const draw = DRAWINGS[c.key];
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
  const draw = DRAWINGS[c.key];
  const notes: Record<string, string> = {};
  for (const [label, text] of Object.entries(draw.notes)) notes[`${to}-${flipLabel(label).toLowerCase()}`] = words(text, 'left');
  return { diagram, notes };
}

function makePlay(side: Side, c: Concept, d: { diagram: Diagram; notes: Record<string, string> }): Play {
  const draw = DRAWINGS[c.key];
  const formation = beastFormationByKey.get(side === 'right' ? 'beast-right' : 'beast-left')!;
  return {
    id: playId(side, c),
    name: kidCall(side, c),
    formationId: formation.id,
    formationLabel: `${COLORS[side].formation} (${COLORS[side].word})`.toUpperCase(),
    category: categoryOf(c),
    tags: [BEAST_TAG, 'youth', c.key, c.kind, `week-${c.week}`, COLORS[side].word.toLowerCase()],
    notes: `${c.kidSays}\n\nCoach: ${c.coachNote}\n\nSignal: ${c.signal}. Check with me: ${c.cities.join(' / ')} ${COLORS[side].word}.`,
    positionNotes: d.notes,
    wristband: wristbandLabel(side, c),
    diagram: d.diagram,
    source: 'Beast Offense (Playmaker, 2026-02-28)',
    rawCall: coachCall(side, c),
    concept: c.coach,
    install: c.week,
    confidence: draw.review?.length ? 'needs-review' : 'derived',
    reviewNotes: draw.review,
    createdAt: BEAST_PACK_TIME,
    updatedAt: BEAST_PACK_TIME,
  };
}

export const BEAST_PLAYS: Play[] = CONCEPTS.flatMap((c) => {
  const red = buildRight(c);
  return [makePlay('right', c, red), makePlay('left', c, mirror(c, red.diagram))];
});

export const beastPlay = (side: Side, key: string) => BEAST_PLAYS.find((p) => p.id === playId(side, CONCEPTS.find((c) => c.key === key)!));

/** A player's note on a play, by the label he wears (LT, 3, Y ...). */
export function jobOf(play: Play, label: string): string {
  const p = Object.values(play.diagram.players).find((x) => x.label === label);
  return (p && play.positionNotes[p.id]) || '';
}

/**
 * One position's jobs on every concept: the player cards. Sides are said as "the wing side" / "the other side"
 * so one line works for both colors. A lineman's job can change with the color (on Yellow the left guard does
 * what the right guard does on Red), so `yellow` is set only when it differs.
 */
export const JOB_LABELS = ['1', '2', '3', '4', 'Y', 'F', 'LT', 'LG', 'C', 'RG', 'RT'];
const sideless = (s: string) => s.replace(/\{wing\}/g, 'wing').replace(/\{away\}/g, 'other');
export function jobsFor(label: string): { concept: Concept; red: string; yellow?: string }[] {
  return CONCEPTS.map((c) => {
    const notes = DRAWINGS[c.key].notes;
    const red = sideless(notes[label] ?? '');
    const yellow = sideless(notes[flipLabel(label)] ?? '');
    return { concept: c, red, yellow: yellow !== red ? yellow : undefined };
  });
}

/** The playbook row: runs, passes, Ice, then the formations. Prints 6-up with the existing print page. */
export const BEAST_PLAYBOOK: Playbook = {
  id: BEAST_PLAYBOOK_ID,
  name: 'BEAST OFFENSE',
  subtitle: '2nd & 3rd grade',
  cover: { title: 'BEAST OFFENSE', subtitle: '2nd & 3rd grade · GOD blocking · Red right, Yellow left', season: '2026', showCover: true },
  sections: [
    { id: `${BEAST_ID_PREFIX}s-runs`, title: 'Runs', kind: 'plays', itemIds: CONCEPTS.filter((c) => c.kind === 'run').flatMap((c) => [playId('right', c), playId('left', c)]) },
    { id: `${BEAST_ID_PREFIX}s-pass`, title: 'Passes', kind: 'plays', itemIds: CONCEPTS.filter((c) => c.kind === 'pass').flatMap((c) => [playId('right', c), playId('left', c)]) },
    { id: `${BEAST_ID_PREFIX}s-ice`, title: 'Ice (freeze)', kind: 'plays', itemIds: CONCEPTS.filter((c) => c.kind === 'special').flatMap((c) => [playId('right', c), playId('left', c)]) },
    { id: `${BEAST_ID_PREFIX}s-formations`, title: 'Formations', kind: 'formations', itemIds: BEAST_FORMATIONS.map((f) => f.id) },
  ],
  defaultLayout: '6up',
  paper: 'letter',
  createdAt: BEAST_PACK_TIME,
  updatedAt: BEAST_PACK_TIME,
};

export const BEAST_PACK = { formations: BEAST_FORMATIONS, plays: BEAST_PLAYS, playbooks: [BEAST_PLAYBOOK] };
