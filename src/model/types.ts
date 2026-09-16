/**
 * PlayForge domain model.
 * Units: yards. x = 0 at the ball, positive to the right.
 * y = 0 at the line of scrimmage, positive downfield (toward the defense).
 */

export type Point = { x: number; y: number };

export type Side = 'offense' | 'defense';

/** Visual symbol for a player. 'letter' = bare bold letter (defenders). */
export type PlayerSymbol = 'circle' | 'square' | 'letter' | 'triangle' | 'oval' | 'diamond';

/** Visio stencil shading: Center Shade Lt/Rt, O-Line Shade, Skill (filled). */
export type Shade = 'none' | 'left' | 'right' | 'full';

export type LabelColor = 'black' | 'red' | 'green' | 'blue' | 'brown' | 'orange';

export type PlayerRole = 'OL' | 'C' | 'QB' | 'RB' | 'WR' | 'TE' | 'DL' | 'LB' | 'DB';

export type Player = {
  id: string;
  side: Side;
  symbol: PlayerSymbol;
  label: string;
  x: number;
  y: number;
  shade?: Shade;
  /** Visio "Center |" and "O-Line ||" vertical bar marks */
  bars?: 0 | 1 | 2;
  labelColor?: LabelColor;
  role?: PlayerRole;
};

export type PathPoint = Point & {
  /** When true the path curves smoothly through this point (Catmull-Rom). */
  smooth?: boolean;
};

export type PathEnd = 'arrow' | 'tbar' | 'none' | 'dot';
export type LineStyle = 'solid' | 'dashed' | 'dotted' | 'squiggle';
export type PathRole = 'route' | 'block' | 'motion' | 'ball' | 'blitz' | 'zone' | 'free';
export type PathColor = 'black' | 'red' | 'blue';
export type PathWidth = 'thin' | 'normal' | 'thick';

export type PathAnchor = { kind: 'player'; playerId: string } | { kind: 'free' };

export type Path = {
  id: string;
  /** Points are relative to the anchor player's position, or absolute for 'free'. */
  anchor: PathAnchor;
  /** points[0] is the start offset (usually {0,0} for player-anchored paths). */
  points: PathPoint[];
  end: PathEnd;
  line: LineStyle;
  role: PathRole;
  /** Yellow highlight underlay (primary route / ball carrier). */
  primary?: boolean;
  color?: PathColor;
  width?: PathWidth;
};

export type TextStyle = 'redCaps' | 'plain' | 'split' | 'bold';
export type TextSize = 'sm' | 'md' | 'lg';
export type MarkKind = 'handoffX' | 'ballDot' | 'zoneBubble' | 'fakeArrow';

export type TextAnnotation = {
  id: string;
  kind: 'text';
  x: number;
  y: number;
  text: string;
  style: TextStyle;
  size?: TextSize;
  rotate?: 0 | 90 | -90;
};

export type MarkAnnotation = {
  id: string;
  kind: 'mark';
  x: number;
  y: number;
  mark: MarkKind;
  /** radius for zoneBubble */
  r?: number;
  label?: string;
};

export type Annotation = TextAnnotation | MarkAnnotation;

export type Diagram = {
  players: Record<string, Player>;
  paths: Record<string, Path>;
  annotations: Record<string, Annotation>;
};

export type ViewWindow = { minX: number; maxX: number; minY: number; maxY: number };

export type PersonnelTag = string;
export type PlayersPerSide = 6 | 7 | 8 | 9 | 11 | 12;

export type Formation = {
  id: string;
  name: string;
  side: Side;
  personnel?: PersonnelTag;
  playersPerSide: PlayersPerSide;
  players: Record<string, Player>;
  /** Defense only: default coverage label, e.g. "COVER 3". */
  coverage?: string;
  tags: string[];
  builtin?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PlayCategory = 'Run' | 'Pass' | 'PA' | 'Screen' | 'Special';

export type PlayDefense = { formationId?: string; front?: string; coverage?: string };

export type Play = {
  id: string;
  name: string;
  /** Provenance only; the diagram is denormalized. */
  formationId?: string;
  /** Header line 1 override. Defaults to the formation name. */
  formationLabel?: string;
  /** Header "[11]" */
  personnel?: PersonnelTag;
  category: PlayCategory;
  tags: string[];
  notes?: string;
  /** playerId -> coaching point */
  positionNotes: Record<string, string>;
  /** Footer left: "OVER COVER 3" */
  defense?: PlayDefense;
  /** Footer right: "35 (3WK)" */
  wristband?: string;
  diagram: Diagram;
  /** Explicit view window; undefined = auto-fit. */
  view?: ViewWindow;
  createdAt: string;
  updatedAt: string;
};

export type SectionKind = 'plays' | 'formations';
export type PlaybookSection = { id: string; title: string; kind: SectionKind; itemIds: string[] };

export type LayoutId = '1up' | '2up' | '4up' | '6up' | '8up' | '9up' | '10up';
export type Paper = 'letter' | 'a4';
export type Orientation = 'portrait' | 'landscape';

export type PlaybookCover = {
  title: string;
  subtitle?: string;
  team?: string;
  season?: string;
  showCover: boolean;
};

export type Playbook = {
  id: string;
  /** Sheet title bar text, e.g. "BEAST COUNTER" */
  name: string;
  /** Red quoted subtitle in the title bar */
  subtitle?: string;
  cover: PlaybookCover;
  sections: PlaybookSection[];
  defaultLayout: LayoutId;
  paper: Paper;
  createdAt: string;
  updatedAt: string;
};

export type SheetLayout = {
  id: LayoutId;
  cols: number;
  rows: number;
  orientation: Orientation;
  kind: SectionKind;
};

export type HashPreset = 'nfl' | 'ncaa' | 'hs';
export type Theme = 'plain' | 'yardlines';

export type Settings = {
  hashPreset: HashPreset;
  theme: Theme;
  paper: Paper;
  defaultPlayersPerSide: PlayersPerSide;
  flipSwapsXZ: boolean;
};

export type BackupV2 = {
  app: 'playforge';
  version: 2;
  exportedAt: string;
  formations: Formation[];
  plays: Play[];
  playbooks: Playbook[];
  settings: Settings;
};

export const DEFAULT_SETTINGS: Settings = {
  hashPreset: 'ncaa',
  theme: 'plain',
  paper: 'letter',
  defaultPlayersPerSide: 11,
  flipSwapsXZ: false,
};
