/**
 * A youth offense as data: the language (colors, numbers, holes, blocking rules, cadence), the ten concepts,
 * the formations and the drawings. One engine (build.ts) turns any of these into formations, plays, a
 * playbook and the pages: the system page, the print sheets and the Rams-style book. Beast Offense 2026 and
 * the kid West Coast offense are the two systems today.
 */
import type { PlayerRole } from '@/model/types';

export type Side = 'right' | 'left';

/** Red = right, Yellow = left, in every youth system. */
export const COLORS = {
  right: { word: 'Red', hex: '#D0021B', ink: '#ffffff' },
  left: { word: 'Yellow', hex: '#FFD60A', ink: '#000000' },
} as const;

/** Hole numbers and gap letters, left to right as the offense sees it. */
export const HOLES = {
  rule: 'First number = who gets the ball. Second number = the hole. Even numbers go right, odd numbers go left.',
  line: ['LT', 'LG', 'C', 'RG', 'RT'],
  gaps: ['C', 'B', 'A', 'A', 'B', 'C'],
  numbers: { left: [9, 7, 5, 3, 1], right: [0, 2, 4, 6, 8] },
};

export type ConceptKind = 'run' | 'pass' | 'special';

export type Concept = {
  /** Wristband number. Same number both sides; the color picks the side. */
  n: number;
  key: string;
  /** What the kids call it. Every first letter is different so the city code works. */
  kid: string;
  /** The grown-up word for it. */
  coach: string;
  kind: ConceptKind;
  /** A pass off a run fake (category PA in the library). */
  playAction?: boolean;
  /** Play numbers (carrier + hole). 0 = no number (passes and Ice). */
  numbers: Record<Side, number>;
  carrier: string;
  where: string;
  /** true = the ball goes to the color side; false = it goes away from it (the trick plays). */
  withWings: boolean;
  kidSays: string;
  signal: string;
  /** Check-with-me words. Any word that starts with the same letter means the same play. */
  cities: string[];
  /** An older code word, for reference while the coaches switch over. */
  oldCity?: string;
  week: number;
  coachNote: string;
};

export type InstallWeek = {
  week: number;
  title: string;
  adds: string[];
  formations: string[];
  line: string;
  skill: string;
  calling: string;
  drills: string[];
  readyWhen: string[];
};

export type SheetEntry = [Side, string];
export type CallSection = { id: string; title: string; color: string; ink: string; rows: SheetEntry[] };

/** A blocking rule taught as three steps (GOD, STEP-HIT-UP, Pass GOD). */
export type BlockRule = {
  key: string;
  title: string;
  /** Which plays use it, in kid words. */
  usedOn: string;
  steps: { letter: string; word: string; ask?: string; then: string }[];
};

export type Blocking = {
  rules: BlockRule[];
  inside: string;
  exceptions: { word: string; who: string; means: string }[];
};

export type Position = { label: string; kid: string; job: string; lineup: string };

// ---------------------------------------------------------------- drawings

export type Spot = { label: string; x: number; y: number; role: PlayerRole; alignment?: string };

export type FormationSpec = {
  key: string;
  name: string;
  /** How the call sheet says it, if different ("Beast Right (Base)"). */
  callName?: string;
  /** Red / Yellow, or null for a balanced look. */
  side: Side | null;
  family: string;
  qb: 'under' | 'pistol' | 'gun';
  cue: string;
  spots: Spot[];
};

/** [x, y] or [x, y, 's'] for a point the line curves through. Relative to the player. */
export type Pt = [number, number] | [number, number, 's'];
export type LineKind = 'block' | 'run' | 'fake' | 'route' | 'read1' | 'pull' | 'ball' | 'action';
export type Line = { who: string; kind: LineKind; pts: Pt[] };

export type PlayDraw = {
  /** Red-side formation key; defaults to the system's base formation. */
  formation?: string;
  lines: Line[];
  /** Pre-snap motion: the player lines up at `from` and is at `to` (absolute yards, Red side) at the snap. */
  motion?: { who: string; from: [number, number]; to: [number, number]; tag: string };
  text?: { x: number; y: number; t: string }[];
  /** Jobs by Red-side label. {wing} / {away} become right / left (mirrored on Yellow). */
  notes: Record<string, string>;
  review?: string[];
};

export type YouthSystemDef = {
  id: string;
  /** Page title: "Beast Offense 2026". */
  title: string;
  /** Short name on print sheets: "BEAST". */
  short: string;
  subtitle: string;
  intro: string;
  /** Two lines of the gold book wordmark. */
  wordmark: [string, string];
  /** One letter for the book's badge. */
  badge: string;
  idPrefix: string;
  tag: string;
  playbookId: string;
  /** play.source on every play. */
  source: string;
  formationSource: string;
  /** Formation name by side for the color rule: "Beast Right". */
  baseFormation: Record<Side, string>;
  formations: FormationSpec[];
  concepts: Concept[];
  drawings: Record<string, PlayDraw>;
  /** What the color means: "the Y and both wings line up on the right". */
  colorMeans: Record<Side, string>;
  /** Badge words for concepts that go away from the color side. */
  awayWord: string;
  /** One-line explanation of with / away plays. */
  withAway: string;
  /** How a sideless card says {wing} / {away}. */
  sideWords: { wing: string; away: string };
  /** "on Call Sheet V3": where the coach word comes from. */
  coachWordFrom: string;
  positions: Position[];
  blocking: Blocking;
  legend: { mark: string; means: string }[];
  cadence: string;
  cadenceNote?: string;
  days: { day: string; means: string; why: string }[];
  /** What the coach yells to line up for check with me. */
  checkWithMe: string;
  install: InstallWeek[];
  callSheet: CallSection[];
  script: { entry: SheetEntry; asks: string }[];
  ifThen: { see: string; call: string[] }[];
  watchers: { who: string; tally: string[] }[];
  practice: { time: string; what: string }[];
  /** Choices the coach should confirm, shown on the page. */
  checkThese: { label: string; text: string }[];
};
