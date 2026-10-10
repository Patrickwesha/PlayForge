/**
 * One Rams 2022 diagram cell as scripts/rams/build_plays.py writes it (public/rams-2022/plays.json): the
 * translated words plus the drawing's own geometry. x is in line splits (yards) from the center, y in yards
 * from the line of scrimmage, + downfield, all in the DRAWING's frame; compose.ts moves it onto the pack
 * formation's landmarks.
 */
export type RamsSpot = 'LT' | 'LG' | 'C' | 'RG' | 'RT' | 'Q' | 'H' | 'X' | 'Y' | 'Z' | 'F' | 'U';

export type RamsMotion = { player: string | null; rams: string; word: string; pre?: boolean };

export type RamsFormationWords = {
  ramsLine: string;
  personnel: string[] | null;
  base: string;
  ramsBase: string;
  direction: 'RT' | 'LT';
  tags: string[];
  motions: RamsMotion[];
  unknown: string[];
  gun: boolean;
  name: string;
};

export type RamsPath = {
  spot: RamsSpot | null;
  pts: [number, number][];
  dashed: boolean;
  end: 'arrow' | 'tbar' | 'none';
  startMark: 'arrow' | 'tbar' | 'none';
  role: 'block' | 'route' | 'ball' | 'motion' | 'free' | null;
  branch?: boolean;
  ghost?: [number, number];
};

export type RamsLabel = { kind: 'block' | 'route' | 'depth' | 'progression' | 'note'; text: string; x: number; y: number; spot: RamsSpot | null };

export type RamsDefender = { label: string; role: 'DL' | 'LB' | 'DB'; x: number; y: number };

export type RamsPlaySpec = {
  key: string;
  section: string;
  family: string | null;
  page: number;
  cell: number;
  cellNumber: string | null;
  pageTitle: string;
  conceptTitle: string | null;
  conceptPage: number | null;
  install: number | null;
  group: string | null;
  situation: string | null;
  installBasis: string | null;
  systemConcept: string | null;
  systemConceptId: string | null;
  conceptMeans: string | null;
  conceptOnFilm: string | null;
  name: string;
  alias: string;
  rawCall: string;
  category: 'Run' | 'Pass' | 'PA' | 'Screen';
  formation: RamsFormationWords | null;
  packKey: string | null;
  packPersonnel: string | null;
  baseKey: string | null;
  personnel: string | null;
  runNumber: number | null;
  runFamily: string | null;
  toss: boolean;
  protection: string | null;
  protectionRams: string | null;
  concept: string;
  can: string | null;
  front: string;
  frontNote: string;
  frontKey: string | null;
  unit: number;
  unitY: number;
  offense: Partial<Record<RamsSpot, [number, number]>>;
  extraMen: [number, number][];
  ghosts: { x: number; y: number }[];
  marks: { mark: string; x: number; y: number }[];
  defenders: RamsDefender[];
  paths: RamsPath[];
  freePaths: RamsPath[];
  labels: RamsLabel[];
  routeWords: Partial<Record<RamsSpot, string[]>>;
  blockCalls: Partial<Record<RamsSpot, string[]>>;
  positionNotes: Partial<Record<RamsSpot, string>>;
  notes: { summary?: string; qb?: string; hb?: string; criteria?: string; progression?: string; alerts?: string[]; can?: string };
  tags: string[];
  warnings: string[];
};

export type RamsPlayPack = { revision: string; source: string; plays: RamsPlaySpec[] };
