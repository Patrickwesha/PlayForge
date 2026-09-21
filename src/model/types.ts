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

/**
 * A pre-snap shift or motion. The player's own x/y is where he ENDS UP (every route and block hangs
 * off that spot); `from` is where he lines up first. Rendered as a dashed ghost at `from` plus a dotted
 * path to the player, always behind the line of scrimmage.
 */
export type PlayerMotion = {
  from: Point;
  /** The call's word for it: MO, HAX, SHORT, LT ... */
  tag: string;
  kind: 'motion' | 'shift';
  /** Absolute waypoints between `from` and the player (e.g. a counter motion's turn-back point). */
  via?: Point[];
};

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
  /** Dashed outline marks a pre-motion or ghost alignment. */
  outline?: 'solid' | 'dashed';
  labelColor?: LabelColor;
  role?: PlayerRole;
  motion?: PlayerMotion;
  /**
   * Field landmark this player is lined up on, e.g. "hash+3-right" (ids come from geometry/landmarks.ts).
   * Set when he is dropped on a landmark, cleared when he is moved off; absent on older saves.
   */
  alignment?: string;
};

export type PathPoint = Point & {
  /** When true the path curves smoothly through this point (Catmull-Rom). */
  smooth?: boolean;
  /**
   * Bend control for the segment that ENDS at this point (quadratic bezier control,
   * same coordinate space as the point). Set by dragging the segment's midpoint handle.
   */
  bend?: Point;
};

export type PathEnd = 'arrow' | 'tbar' | 'none' | 'dot' | 'openArrow' | 'tbarAngled' | 'tbarAngledL';

/** A symbol placed on the line at fraction t (0..1) of its length. */
export type PathInsertKind = 'bars' | 'chip' | 'zigzag' | 'x';
export type PathInsert = { kind: PathInsertKind; t: number };
export type LineStyle = 'solid' | 'dashed' | 'dotted' | 'squiggle';
export type PathRole = 'route' | 'block' | 'motion' | 'ball' | 'blitz' | 'zone' | 'free';
export type PathColor = 'black' | 'red' | 'blue' | 'green' | 'orange' | 'gray' | 'purple' | 'yellow';
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
  inserts?: PathInsert[];
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

export type QbAlignment = 'under' | 'gun' | 'pistol';
/** 'needs-review' = name and personnel are right, positions are a starting shape only. */
export type FormationConfidence = 'derived' | 'needs-review';

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
  /** Family inside the source system, e.g. "3x1 'T'". The way to find a formation later. */
  family?: string;
  strength?: 'left' | 'right';
  qbAlignment?: QbAlignment;
  /** Provenance, e.g. a playbook title and the page the alignment came from. */
  source?: string;
  sourcePage?: number;
  note?: string;
  confidence?: FormationConfidence;
  builtin?: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PlayCategory = 'Run' | 'Pass' | 'PA' | 'Screen' | 'Special';

/**
 * The built-in alternate of a "Can" call: two plays in one call, the quarterback cans to the alternate
 * off a pre-snap trigger (box count, unblockable support, rotation, shell).
 */
export type PlayAlternate = {
  /** The alternate's call, e.g. "18 MIKE" or "PASS X STRIKE". */
  name: string;
  /** What flips the call, as the page states it, e.g. "unblockable support". */
  trigger?: string;
  runNumber?: number;
  runFamily?: string;
  /** player id -> route library key, when the alternate is a pass. */
  routeTags?: Record<string, string>;
};

/** 'needs-review' = the call and assignments are from the source, but something about the drawing is a starting shape. */
export type PlayConfidence = 'derived' | 'needs-review';

/**
 * One named route from a system's route tree, with geometry derived from the written description.
 * frame 'receiver': points are relative to the player for a RIGHT-side receiver (+x = toward the sideline,
 * -x = inside, +y = downfield) and y is the depth from the line of scrimmage. frame 'back': x is relative
 * to the back (+x = his release side), y is the depth from the line of scrimmage unless relativeY is set.
 */
export type RouteDefPoint = Point & { smooth?: boolean; relativeY?: boolean };
/**
 * A named spot on the field that a route ends at or breaks toward, instead of a yard depth.
 * Vocabulary from the 2019 Packers route tree (pp. 71-103).
 */
export type LandmarkSpot = {
  spot:
    | 'front-pylon' | 'back-pylon' | 'far-pylon' | 'near-upright'
    | 'goal-line' | 'end-line'
    | 'redline' | 'split' | 'numbers' | 'hash' | 'opposite-hash' | 'middle' | 'sideline' | 'tackle';
  /** Yards from the spot: + = toward the sideline (or deeper, for goal line / end line), - = inside (or short). */
  offset?: number;
  /** For the numbers: which edge of the painted numbers. */
  edge?: 'inside' | 'middle' | 'outside';
};
/**
 * Many landmarks are side-dependent ("Field = X / Boundary = Y"), and a few depend on where the ball is
 * ("ball on the -50 = front pylon, +50 = back pylon"). `boundary` and `ballPlus` default to `field`.
 */
export type RouteLandmark = {
  /** Index of the route point this landmark places; -1 = the last point. */
  point: number;
  /** 'end' = the point sits on the landmark; 'toward' = the leg into the point aims at it (pylons, uprights). */
  mode: 'end' | 'toward';
  field: LandmarkSpot;
  boundary?: LandmarkSpot;
  ballPlus?: LandmarkSpot;
  note?: string;
};
export type RouteDef = {
  key: string;
  name: string;
  variant?: string | null;
  group: 'WR' | 'HB';
  frame: 'receiver' | 'back';
  sourcePage: number;
  /** Midpoint of depthRange (or the step count converted to yards when the source gives only steps). */
  breakDepthYards: number | null;
  depthRange?: [number, number] | null;
  steps?: number | null;
  depthFromSteps?: boolean;
  breakDirection: string;
  isDoubleMove: boolean;
  vsCoverageAdjustments: string[];
  landmarks?: RouteLandmark[] | null;
  /** A landmark the page states that is not a drawable spot (a defender, a variant's sit spot). */
  landmarkNote?: string | null;
  /** Field position the drawn depths assume, for routes measured from the goal line or end line (red zone). */
  assumes?: { yardsToGoal: number } | null;
  /** true/false = always or never the hot throw; null = the call says (DOWN FLAT is run Hot or Late with the same shape). */
  isHot?: boolean | null;
  aliasOf?: string[] | null;
  points: RouteDefPoint[];
  confidence: PlayConfidence;
  note?: string | null;
};

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
  /** Provenance for imported plays: the playbook, its install number, the page, and the call exactly as read. */
  source?: string;
  sourcePage?: number;
  install?: number;
  rawCall?: string;
  protection?: string;
  concept?: string;
  /** player id -> route library key, so a drawn route can be traced back to its route word. */
  routeTags?: Record<string, string>;
  /** player id -> is this route the hot throw, for routes whose record leaves it to the call. */
  hotRoutes?: Record<string, boolean>;
  /** Can call: this play is the primary, the alternate rides along. */
  alternate?: PlayAlternate;
  /** Alignment, shift and motion words of the call that were applied to the formation, in order. */
  appliedTags?: string[];
  confidence?: PlayConfidence;
  /** Why an imported play is needs-review (one reason per line). */
  reviewNotes?: string[];
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
  /** Editor only: show every alignment landmark faintly (toolbar Guides button, G). Never printed or exported. */
  showLandmarks: boolean;
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
  hashPreset: 'nfl',
  theme: 'plain',
  paper: 'letter',
  defaultPlayersPerSide: 11,
  flipSwapsXZ: false,
  showLandmarks: false,
};
