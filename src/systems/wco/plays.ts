/**
 * Kid West Coast Offense 2026: formations and the ten plays, drawn Red (right). Yellow is the exact mirror
 * (build.ts). Units are yards, x = 0 at the ball (+ right), y = 0 at the line (+ downfield); path points are
 * relative to their player, motion spots absolute. Receivers sit on landmarks (NFL field level): X on Hash +4,
 * Z on Hash +3, the bunch on Hash +2 / +3 / +4.
 */
import { fieldLandmarks, landmarkById } from '@/geometry/landmarks';
import { buildYouthSystem } from '@/systems/youth/build';
import type { FormationSpec, Line, PlayDraw, Pt, Spot, YouthSystemDef } from '@/systems/youth/types';
import {
  BLOCKING, CADENCE, CALL_SHEET, CHECK_THESE, CONCEPTS, DAYS, IF_THEN, INSTALL, LEGEND, POSITIONS, PRACTICE_70, SCRIPT, WATCHERS,
  WCO_ID_PREFIX, WCO_PLAYBOOK_ID, WCO_SYSTEM_ID, WCO_TAG,
} from './content';

// ---------------------------------------------------------------- formations

const NFL = fieldLandmarks('nfl');
const lm = (id: string) => {
  const l = landmarkById(NFL, id);
  if (!l) throw new Error(`landmark ${id} missing`);
  return l.x;
};

const LINE: Spot[] = [
  { label: 'LT', x: -2, y: 0, role: 'OL' },
  { label: 'LG', x: -1, y: 0, role: 'OL' },
  { label: 'C', x: 0, y: 0, role: 'C' },
  { label: 'RG', x: 1, y: 0, role: 'OL' },
  { label: 'RT', x: 2, y: 0, role: 'OL' },
];
const Q: Spot = { label: 'Q', x: 0, y: -1.2, role: 'QB' };
const X_WIDE: Spot = { label: 'X', x: lm('hash+4-left'), y: 0, role: 'WR', alignment: 'hash+4-left' };
const Z_OFF: Spot = { label: 'Z', x: lm('hash+3-right'), y: -1, role: 'WR', alignment: 'hash+3-right' };

const FORMATIONS: FormationSpec[] = [
  {
    key: 'pro-right', name: 'Pro Right', side: 'right', family: 'Pro', qb: 'under',
    cue: 'Q under center, F at 3 yards and H at 6 straight behind him. Y on the Red side, Z one step back on Hash +3. X on the line on Hash +4 on the other side.',
    spots: [X_WIDE, ...LINE, { label: 'Y', x: 3, y: 0, role: 'TE' }, Z_OFF, Q, { label: 'F', x: 0, y: -3.5, role: 'RB' }, { label: 'H', x: 0, y: -6, role: 'RB' }],
  },
  {
    key: 'bunch-right', name: 'Bunch Right', side: 'right', family: 'Bunch', qb: 'under',
    cue: 'Three in a triangle on the Red side: Z on the line on Hash +3, Y one step back and inside (Hash +2), F one step back and outside (Hash +4). H at 5 and a half.',
    spots: [
      X_WIDE, ...LINE,
      { label: 'Y', x: lm('hash+2-right'), y: -1, role: 'TE', alignment: 'hash+2-right' },
      { label: 'Z', x: lm('hash+3-right'), y: 0, role: 'WR', alignment: 'hash+3-right' },
      { label: 'F', x: lm('hash+4-right'), y: -1, role: 'WR', alignment: 'hash+4-right' },
      Q, { label: 'H', x: 0, y: -5.5, role: 'RB' },
    ],
  },
  {
    key: 'ace-right', name: 'Ace Right', side: 'right', family: 'Ace', qb: 'under',
    cue: 'Two tight ends: Y on the Red side, F on the other side. X and Z one step back on Hash +4 and Hash +3. H at 6.',
    spots: [
      { ...X_WIDE, y: -1 }, { label: 'F', x: -3, y: 0, role: 'TE' }, ...LINE, { label: 'Y', x: 3, y: 0, role: 'TE' }, Z_OFF,
      Q, { label: 'H', x: 0, y: -6, role: 'RB' },
    ],
  },
  {
    key: 'jumbo', name: 'Jumbo', side: null, family: 'Jumbo', qb: 'under',
    cue: 'Goal line, balanced. F and Y tight ends, X and Z as wings one step back outside them. H at 5.',
    spots: [
      { label: 'X', x: -4, y: -1, role: 'WR' }, { label: 'F', x: -3, y: 0, role: 'TE' }, ...LINE, { label: 'Y', x: 3, y: 0, role: 'TE' }, { label: 'Z', x: 4, y: -1, role: 'WR' },
      Q, { label: 'H', x: 0, y: -5, role: 'RB' },
    ],
  },
];

// ---------------------------------------------------------------- drawing helpers (Red side: + x is toward the Y)

const b = (who: string, p: Pt[]): Line => ({ who, kind: 'block', pts: p });
const all = (who: string[], p: Pt[]) => who.map((w) => b(w, p));
const OL = ['LT', 'LG', 'C', 'RG', 'RT'];
const STEP_Y: Pt[] = [[0, 0], [0.9, 0.7]];
const STEP_AWAY: Pt[] = [[0, 0], [-0.9, 0.7]];
const TOWARD_Y: Pt[] = [[0, 0], [0.8, 0.6]];
const DOWN_AWAY: Pt[] = [[0, 0], [-0.8, 0.9]];
const SET: Pt[] = [[0, 0], [0, -0.8]];
const BOOT_FAKE: Line = { who: 'Q', kind: 'fake', pts: [[0, 0], [-0.6, -1.2, 's'], [-3, -1.4]] };
const SURF_FAKE: Line = { who: 'H', kind: 'fake', pts: [[0, 0], [2, 1.4, 's'], [4, 3.6]] };
/** Q is at (0, -1.2): a throw from a point relative to Q to an absolute spot. */
const throwTo = (from: [number, number], to: [number, number]): Line => ({ who: 'Q', kind: 'ball', pts: [from, [to[0], to[1] + 1.2]] });

const ZONE = 'ZONE: Step, Hit, Up. Big step to the {wing} side. Somebody there? Hit him and run your feet. Nobody? Up to the linebacker.';
const ZONE_AWAY = 'ZONE: Step, Hit, Up. Big step to the {away} side. Somebody there? Hit him and run your feet. Nobody? Up to the linebacker.';
const PASS = 'Pass GOD: Gap, On, Don\'t go downfield.';
const PASS_SELL_SURF = 'Sell Surf with a ZONE step to the {wing} side, then Pass GOD: Gap, On, Don\'t go downfield.';
const PASS_SELL_DART = 'Sell Dart for one step (GOD), then Pass GOD: Gap, On, Don\'t go downfield.';
const olNotes = (text: string) => Object.fromEntries(OL.map((l) => [l, text]));

const DRAWINGS: Record<string, PlayDraw> = {
  surf: {
    lines: [
      ...all([...OL, 'Y'], STEP_Y),
      { who: 'F', kind: 'block', pts: [[0, 0], [2, 0.8, 's'], [4.2, 2.6]] },
      b('Z', [[0, 0], [-1.2, 2.2]]),
      b('X', [[0, 0], [0, 5]]),
      BOOT_FAKE,
      { who: 'H', kind: 'run', pts: [[0, 0], [2, 1.4, 's'], [4, 3.6, 's'], [5, 5.8], [5.5, 10]] },
    ],
    text: [{ x: 1.4, y: 1.4, t: 'BANG' }, { x: 3.6, y: 2.4, t: 'BEND' }, { x: 7.6, y: 1.2, t: 'BOUNCE' }],
    notes: {
      H: 'Take the handoff running for the {wing} edge. Read the blocks and make ONE cut: Bang (up inside), Bend (up at the Y) or Bounce (outside). Then go.',
      Q: 'Turn your back to the line, hand the ball to H deep, then fake the boot to the {away} side. Sell it.',
      F: 'Run for the {wing} edge and block the first man outside the Y. Ride him to the sideline.',
      Y: ZONE,
      ...olNotes(ZONE),
      Z: 'Crack: block the first defender inside you (the linebacker or the safety).',
      X: 'Run at the corner like a go route, then block him.',
    },
  },
  dart: {
    lines: [
      b('LT', TOWARD_Y), b('LG', TOWARD_Y),
      b('C', [[0, 0], [0.45, 1.2]]), b('RG', [[0, 0], [-0.45, 1.2]]),
      b('RT', DOWN_AWAY), b('Y', DOWN_AWAY),
      { who: 'F', kind: 'block', pts: [[0, 0], [0.5, 2.4, 's'], [0.5, 6.5]] },
      { who: 'H', kind: 'run', pts: [[0, 0], [0.4, 3, 's'], [0.5, 7], [0.6, 11]] },
      BOOT_FAKE,
      b('Z', [[0, 0], [-0.5, 4.5]]), b('X', [[0, 0], [0, 4]]),
    ],
    notes: {
      H: 'Follow F through the {wing}-side A gap, right next to the center. Stay behind him and cut off his block.',
      F: 'Lead through the {wing}-side A gap. Block the first linebacker you see. Hit him in the numbers.',
      Q: 'Hand the ball to H, then fake the boot to the {away} side.',
      C: 'GOD to the {wing} side: double the man in the A gap with your guard. Drive him back, then climb.',
      RG: 'GOD. Gap: double the man in the A gap with the center and drive him back.',
      RT: 'GOD. Gap, On, Down: block the first man inside you.',
      Y: 'GOD. Gap, On, Down: seal the end man inside.',
      LG: 'GOD toward the ball. Nobody gets through your inside gap.',
      LT: 'GOD toward the ball. Nobody gets through your inside gap.',
      Z: 'Stalk the safety: get in front of him and stay on him.',
      X: 'Stalk the corner on your side.',
    },
  },
  jet: {
    motion: { who: 'Z', from: [lm('hash+3-right'), -1], to: [1.6, -1.9], tag: 'JET' },
    lines: [
      ...all([...OL, 'Y'], STEP_AWAY),
      { who: 'F', kind: 'block', pts: [[0, 0], [-3, 0.6, 's'], [-6.3, 2.6]] },
      b('X', [[0, 0], [-0.5, 4]]),
      SURF_FAKE,
      { who: 'Z', kind: 'run', pts: [[0, 0], [-4, 0.2, 's'], [-8, 1.6, 's'], [-9.5, 6]] },
    ],
    notes: {
      Z: 'Jet motion across the formation at full speed. Q hands it to you as you pass. Do not slow down: get to the {away} edge and turn up.',
      Q: 'Clap to start the motion. Snap when Z gets to the guard. Hand it to him on the run, then fake Surf to H.',
      H: 'Fake Surf to the {wing} side. Make them chase you.',
      F: 'Run to the {away} edge and block the first man outside.',
      X: 'Block the corner on your side.',
      Y: 'ZONE: Step, Hit, Up to the {away} side. Nobody chases Z from behind.',
      ...olNotes(ZONE_AWAY),
    },
  },
  cutback: {
    lines: [
      { who: 'LG', kind: 'block', pts: [[0, 0], [1.4, -1, 's'], [3.8, -0.9, 's'], [4.6, 0.6]] },
      { who: 'LT', kind: 'pull', pts: [[0, 0], [1.8, -1.5, 's'], [4.6, -1.3, 's'], [5.1, 0.3, 's'], [5.2, 3]] },
      b('C', [[0, 0], [-0.8, 0.9]]), b('RG', DOWN_AWAY), b('RT', DOWN_AWAY), b('Y', DOWN_AWAY),
      { who: 'F', kind: 'block', pts: [[0, 0], [-2, 1.2, 's'], [-2.6, 2.6]] },
      { who: 'H', kind: 'run', pts: [[0, 0], [-1, 0.3, 's'], [0.5, 1.8, 's'], [3.2, 4.6, 's'], [3.6, 7], [3.8, 11]] },
      BOOT_FAKE,
      b('Z', [[0, 0], [-1.2, 2.2]]), b('X', [[0, 0], [0, 4]]),
    ],
    notes: {
      H: 'One step to the {away} side (it looks like Surf the other way), plant, then follow the two pullers to the {wing} side.',
      Q: 'Open to the {away} side, hand the ball to H, then fake the boot.',
      LG: 'PULL and kick out: step back, run flat behind the line, block the first man past the Y. Push him out.',
      LT: 'PULL and lead: follow the guard, turn up in the hole, block the first linebacker.',
      C: 'BLOCK BACK (Down): block the man over you or on the {away} side, where the guard left.',
      RG: 'GOD. Down: block down on the man inside you.',
      RT: 'GOD. Down: block down on the man inside you.',
      Y: 'GOD. Down: block down on the man inside you.',
      F: 'Fill for the tackle: block the end man on the {away} side so nobody chases from behind.',
      Z: 'Crack: block the first defender inside you.',
      X: 'Stalk the corner on your side.',
    },
  },
  boot: {
    lines: [
      ...all(OL, STEP_Y),
      SURF_FAKE,
      { who: 'Q', kind: 'action', pts: [[0, 0], [0.8, -1.8, 's'], [-1.5, -3.3, 's'], [-5, -2.3]] },
      { who: 'F', kind: 'read1', pts: [[0, 0], [-2, 1.5, 's'], [-5, 5]] },
      { who: 'Y', kind: 'route', pts: [[0, 0], [0, 2.5], [-8, 6]] },
      { who: 'X', kind: 'route', pts: [[0, 0], [0, 12]] },
      { who: 'Z', kind: 'route', pts: [[0, 0], [0, 7], [-3, 10]] },
      throwTo([-5, -2.3], [-5, 1.5]),
    ],
    notes: {
      Q: 'Fake Surf to H, hide the ball on your hip, and boot out to the {away} side. Look LOW to F in the flat, then MIDDLE to Y on the cross. Nobody open? Run it.',
      F: 'Sneak out to the {away} flat. You are the first look: turn your eyes to Q right away.',
      Y: 'Block one count like it is Surf, then cross the field to the {away} side, 6 yards deep.',
      X: 'Go deep. You clear the space for F and Y.',
      Z: 'Run 7 yards, then cut in. Last look.',
      H: 'Fake Surf like you have the ball. Make them tackle you.',
      ...olNotes(PASS_SELL_SURF),
    },
  },
  leak: {
    lines: [
      b('LT', TOWARD_Y), b('LG', TOWARD_Y), b('C', [[0, 0], [0.45, 1.2]]), b('RG', [[0, 0], [-0.45, 1.2]]), b('RT', DOWN_AWAY),
      { who: 'F', kind: 'block', pts: [[0, 0], [0.5, 2.2, 's'], [0.5, 5.5]] },
      { who: 'H', kind: 'fake', pts: [[0, 0], [0.4, 3, 's'], [0.5, 6]] },
      { who: 'Q', kind: 'action', pts: [[0, 0], [-0.3, -1.4, 's'], [0, -3.2]] },
      { who: 'Y', kind: 'read1', pts: [[0, 0], [-0.3, 1.2], [-3, 3, 's'], [-9, 5]] },
      { who: 'X', kind: 'route', pts: [[0, 0], [0, 12]] },
      { who: 'Z', kind: 'route', pts: [[0, 0], [0, 7], [-3.5, 11]] },
      throwTo([0, -3.2], [-6, 5]),
    ],
    notes: {
      Y: 'Block for one count like it is Dart. Then sneak behind the linebackers to the {away} side, 5 yards deep. They will be looking at H.',
      Q: 'Fake Dart to H, then set your feet. Look Y first (he sneaks behind them), then Z deep.',
      H: 'Fake Dart: run hard through the A gap like you have the ball.',
      F: 'Lead like it is Dart, then block the first linebacker who rushes.',
      X: 'Go deep. Take your man with you.',
      Z: 'Run 7 yards, then the post. Second look.',
      ...olNotes(PASS_SELL_DART),
    },
  },
  hook: {
    formation: 'bunch-right',
    lines: [
      ...all(OL, SET),
      b('H', [[0, 0], [0.4, 1.4]]),
      { who: 'Y', kind: 'read1', pts: [[0, 0], [0, 6], [-0.6, 5.4]] },
      { who: 'F', kind: 'route', pts: [[0, 0], [1, 0.4, 's'], [4.5, 1.4]] },
      { who: 'Z', kind: 'route', pts: [[0, 0], [0, 11]] },
      { who: 'X', kind: 'route', pts: [[0, 0], [0, 2], [3, 4.5]] },
      { who: 'Q', kind: 'action', pts: [[0, 0], [0, -2.4]] },
      throwTo([0, -2.4], [lm('hash+2-right') - 0.6, 4.4]),
    ],
    notes: {
      Q: 'Three steps back. Look at Y on the hook first: throw it as soon as he turns. Covered? Throw to F in the flat.',
      Y: 'Run 5 yards and hook back to Q. Hands up, eyes on Q.',
      F: 'Run to the {wing} flat. Second look.',
      Z: 'Go deep. Take the corner with you.',
      X: 'Slant on the other side. Be ready if Q looks your way.',
      H: 'Stay in and block. Pick up anybody blitzing.',
      ...olNotes(PASS),
    },
  },
  web: {
    lines: [
      b('LT', SET), b('LG', SET),
      { who: 'C', kind: 'pull', pts: [[0, 0], [0.5, -0.7, 's'], [2.8, 0.4]] },
      { who: 'RG', kind: 'pull', pts: [[0, 0], [0.5, -0.7, 's'], [3.2, 0.8]] },
      { who: 'RT', kind: 'pull', pts: [[0, 0], [0.4, -0.6, 's'], [3.4, 1.4]] },
      b('Y', [[0, 0], [1.4, 2.2]]),
      b('Z', [[0, 0], [0.4, 4]]),
      { who: 'X', kind: 'route', pts: [[0, 0], [0, 11]] },
      b('F', [[0, 0], [-1.6, 1.4]]),
      { who: 'H', kind: 'read1', pts: [[0, 0], [2.5, 0.6, 's'], [4.8, 1.6]] },
      { who: 'Q', kind: 'action', pts: [[0, 0], [0, -3]] },
      throwTo([0, -3], [4.8, -4.4]),
    ],
    notes: {
      H: 'Take two steps like you are blocking, then slide to the {wing} side behind the line. Catch it and follow the web of blockers.',
      Q: 'Drop back deep like it is a long pass. Let the rush come, then flip it to H.',
      C: 'WEB: block for two counts (let him come), then slide to the {wing} side behind the line and block the first color you see.',
      RG: 'WEB: block for two counts, then slide to the {wing} side and block the first color you see.',
      RT: 'WEB: block for two counts, then slide out to the {wing} side and block the first color you see.',
      LG: PASS,
      LT: PASS,
      F: 'Block the end man on the {away} side.',
      Y: 'Block the man outside you.',
      Z: 'Block the corner.',
      X: 'Go deep. Take your man away.',
    },
  },
  zipper: {
    lines: [
      ...all(OL, SET),
      b('H', [[0, 0], [0, 1.6]]),
      { who: 'X', kind: 'read1', pts: [[0, 0], [0.5, 3], [12.5, 4]] },
      { who: 'Y', kind: 'route', pts: [[0, 0], [0, 2], [-9, 6]] },
      { who: 'Z', kind: 'route', pts: [[0, 0], [0, 12]] },
      { who: 'F', kind: 'route', pts: [[0, 0], [1.6, 1.2, 's'], [4.4, 4]] },
      { who: 'Q', kind: 'action', pts: [[0, 0], [0, -2.4]] },
      throwTo([0, -2.4], [lm('hash+4-left') + 12.5, 4]),
    ],
    notes: {
      X: 'Run across the field 4 yards deep. Zip right under Y (almost a high five). Look for the ball.',
      Y: 'Run across the field 6 yards deep, over the top of X.',
      Q: 'Three steps back. Throw to whoever pops open after they zip: X first, then Y, then F in the flat.',
      Z: 'Go deep. Take the safety with you.',
      F: 'Run to the {wing} flat. Last look.',
      H: 'Stay in and block. Pick up anybody blitzing.',
      ...olNotes(PASS),
    },
  },
  ice: {
    lines: [],
    text: [{ x: 0, y: 3, t: 'ICE: FREEZE! NOBODY MOVES' }],
    notes: {
      Q: 'Freeze. If a defender jumps across the line, take the snap and run right behind the center.',
      C: 'Freeze with your hand on the ball. Only snap it if a defender jumps across the line.',
      LT: 'Freeze. Do not move a muscle.', LG: 'Freeze. Do not move a muscle.', RG: 'Freeze. Do not move a muscle.', RT: 'Freeze. Do not move a muscle.',
      Y: 'Freeze.', F: 'Freeze.', H: 'Freeze.', X: 'Freeze.', Z: 'Freeze.',
    },
  },
};

export const WCO_DEF: YouthSystemDef = {
  id: WCO_SYSTEM_ID,
  title: 'West Coast Offense 2026',
  short: 'WEST COAST',
  subtitle: '2nd & 3rd grade',
  intro: 'The offense Sean McVay and Kyle Shanahan would build for their own kids. One look (Q under center, F and H stacked behind him), one main run (Surf, the wide zone), and every other play built to look like it for the first two steps. Same language as the Beast: the wristband number is the play, the color is the side.',
  wordmark: ['WEST COAST', 'OFFENSE'],
  badge: 'W',
  idPrefix: WCO_ID_PREFIX,
  tag: WCO_TAG,
  playbookId: WCO_PLAYBOOK_ID,
  source: 'Kid West Coast Offense 2026 (built in PlayForge, after McVay / Shanahan)',
  formationSource: 'Kid West Coast Offense 2026',
  baseFormation: { right: 'pro-right', left: 'pro-left' },
  formations: FORMATIONS,
  concepts: CONCEPTS,
  drawings: DRAWINGS,
  colorMeans: { right: 'Pro Right: the Y (tight end) and Z line up on the right', left: 'Pro Left: Y and Z line up on the left' },
  awayWord: 'goes AWAY from the Y',
  withAway: 'Surf, Dart and Cutback go to the Y side. Jet and Boot go the other way. Everything looks like Surf, then the ball goes somewhere else. That is the trick.',
  sideWords: { wing: 'Y', away: 'other' },
  coachWordFrom: 'in grown-up words',
  positions: POSITIONS,
  blocking: BLOCKING,
  legend: LEGEND,
  cadence: CADENCE,
  days: DAYS,
  checkWithMe: 'Pro Red, check with me!',
  install: INSTALL,
  callSheet: CALL_SHEET,
  script: SCRIPT,
  ifThen: IF_THEN,
  watchers: WATCHERS,
  practice: PRACTICE_70,
  checkThese: CHECK_THESE,
};

export const WCO = buildYouthSystem(WCO_DEF);
