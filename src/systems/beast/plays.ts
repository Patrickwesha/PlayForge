/**
 * Beast Offense 2026: the 9 formations and the 20 plays (10 concepts, Red and Yellow), drawn from my Beast
 * Playmaker sheets (formations, run plays, pass plays). Red (right) is drawn here; Yellow (left) is the exact
 * mirror, so the two can never drift apart. Ids are fixed so "Add to my library" twice never duplicates.
 *
 * Units are yards, x = 0 at the ball (+ right), y = 0 at the line (+ downfield). Path points are relative to
 * their player. Line spacing follows PlayForge: linemen 1 yard apart, the ends at 3.
 */
import type { Play } from '@/model/types';
import { fieldLandmarks, landmarkById } from '@/geometry/landmarks';
import { buildYouthSystem, YOUTH_FIT, YOUTH_PACK_TIME } from '@/systems/youth/build';
import type { FormationSpec, Line, PlayDraw, Pt, Spot, YouthSystemDef } from '@/systems/youth/types';
import {
  BEAST_ID_PREFIX, BEAST_PLAYBOOK_ID, BEAST_SYSTEM_ID, BEAST_TAG, CADENCE, CALL_SHEET, CONCEPTS, DAYS, GOD, IF_THEN, INSTALL, LEGEND, POSITIONS, PRACTICE_70, SCRIPT, WATCHERS,
  type Concept, type Side,
} from './content';

/** Tight fit for small youth thumbnails (wristbands, call sheet strip): the plays are short. */
export const BEAST_FIT = YOUTH_FIT;

/** Every pack row carries this time; "Add to my library" restamps rows as it writes them. */
export const BEAST_PACK_TIME = YOUTH_PACK_TIME;


// ---------------------------------------------------------------- formations


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

export type BeastFormationSpec = FormationSpec;

const RIGHT_FORMATIONS: BeastFormationSpec[] = [
  {
    key: 'beast-right', name: 'Beast Right', callName: 'Beast Right (Base)', side: 'right', family: 'Beast', qb: 'under',
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

// ---------------------------------------------------------------- path language

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

export type { PlayDraw };

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

// ---------------------------------------------------------------- the system

export const BEAST_DEF: YouthSystemDef = {
  id: BEAST_SYSTEM_ID,
  title: 'Beast Offense 2026',
  short: 'BEAST',
  subtitle: '2nd & 3rd grade',
  intro: 'My Beast playbook rebuilt for 7 and 8 year olds. Ten plays, two colors, one blocking rule. The wristband number is the play, the color is the side, and the line blocks GOD on every run.',
  wordmark: ['BEAST', 'OFFENSE'],
  badge: 'B',
  idPrefix: BEAST_ID_PREFIX,
  tag: BEAST_TAG,
  playbookId: BEAST_PLAYBOOK_ID,
  source: 'Beast Offense (Playmaker, 2026-02-28)',
  formationSource: 'Beast Offense Formations (Playmaker, 2026-02-28)',
  baseFormation: { right: 'beast-right', left: 'beast-left' },
  formations: RIGHT_FORMATIONS,
  concepts: CONCEPTS,
  drawings: DRAWINGS,
  colorMeans: { right: 'Beast Right: the Y and both wings line up on the right', left: 'Beast Left: they line up on the left' },
  awayWord: 'goes AWAY from the wings',
  withAway: 'Train, Hammer and Rocket go the way the wings are. Crossover, Limo and Boomerang go the other way. That is the trick.',
  sideWords: { wing: 'wing', away: 'other' },
  coachWordFrom: 'on Call Sheet V3',
  positions: POSITIONS,
  blocking: {
    rules: [
      { key: 'god', title: GOD.title, usedOn: 'Every run', steps: GOD.steps },
      { key: 'pass', title: 'Pass GOD', usedOn: 'Every pass', steps: GOD.pass },
    ],
    inside: GOD.inside,
    exceptions: GOD.exceptions,
  },
  legend: LEGEND,
  cadence: CADENCE,
  cadenceNote: 'We changed "Red, Set, Go" to "Ready, Set, Go" because Red means right.',
  days: DAYS,
  checkWithMe: 'Beast Red, check with me!',
  install: INSTALL,
  callSheet: CALL_SHEET,
  script: SCRIPT,
  ifThen: IF_THEN,
  watchers: WATCHERS,
  practice: PRACTICE_70,
  checkThese: [
    { label: 'Beast Left', text: 'the formation sheet kept the Y on the right with the wings on the left, but every Beast Left play puts the Y with the wings. I used the plays, so Yellow is a true mirror of Red.' },
    { label: 'Colors', text: 'V3 used GREEN / BLUE on the wristband and Red / Yellow in the no-huddle. Everything is Red / Yellow now so the kids learn one color word per side.' },
    { label: 'Cities', text: 'V3 had Boston (Blast) and Buffalo (Buck) both on B, and Syracuse (Sweep) and Seattle (Sweep Pass) both on S. The kid names all start with different letters, so the city words changed.' },
    { label: 'Cadence', text: '"Red, Set, Go" became "Ready, Set, Go" because Red now means right.' },
  ],
};

export const BEAST = buildYouthSystem(BEAST_DEF);

// names the rest of the app already uses
export const FORMATION_SPECS = BEAST.formationSpecs;
export const BEAST_FORMATIONS = BEAST.formationRows;
export const beastFormationByKey = BEAST.formationByKey;
export const BEAST_PLAYS = BEAST.plays;
export const BEAST_PLAYBOOK = BEAST.playbook;
export const BEAST_PACK = BEAST.pack;
export const JOB_LABELS = BEAST.jobLabels;
export const beastPlay = (side: Side, key: string) => BEAST.play(side, key);
export const coachCall = (side: Side, c: Concept) => BEAST.coachCall(side, c);
export const kidCall = (side: Side, c: Concept) => BEAST.kidCall(side, c);
export const wristbandLabel = (side: Side, c: Concept) => BEAST.wristbandLabel(side, c);
export const jobOf = (play: Play, label: string) => BEAST.jobOf(play, label);
export const jobsFor = (label: string) => BEAST.jobsFor(label);
