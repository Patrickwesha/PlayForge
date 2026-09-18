import { z } from 'zod';

const point = z.object({ x: z.number(), y: z.number() });
const pathPoint = point.extend({ smooth: z.boolean().optional(), bend: point.optional() });

export const playerSchema = z.object({
  id: z.string(),
  side: z.enum(['offense', 'defense']),
  symbol: z.enum(['circle', 'square', 'letter', 'triangle', 'oval', 'diamond']),
  label: z.string(),
  x: z.number(),
  y: z.number(),
  shade: z.enum(['none', 'left', 'right', 'full']).optional(),
  bars: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional(),
  labelColor: z.enum(['black', 'red', 'green', 'blue', 'brown', 'orange']).optional(),
  role: z.enum(['OL', 'C', 'QB', 'RB', 'WR', 'TE', 'DL', 'LB', 'DB']).optional(),
});

export const pathSchema = z.object({
  id: z.string(),
  anchor: z.union([z.object({ kind: z.literal('player'), playerId: z.string() }), z.object({ kind: z.literal('free') })]),
  points: z.array(pathPoint),
  end: z.enum(['arrow', 'tbar', 'none', 'dot', 'openArrow', 'tbarAngled']),
  line: z.enum(['solid', 'dashed', 'dotted', 'squiggle']),
  role: z.enum(['route', 'block', 'motion', 'ball', 'blitz', 'zone', 'free']),
  primary: z.boolean().optional(),
  color: z.enum(['black', 'red', 'blue', 'green', 'orange', 'gray', 'purple', 'yellow']).optional(),
  width: z.enum(['thin', 'normal', 'thick']).optional(),
  inserts: z.array(z.object({ kind: z.enum(['bars', 'chip', 'zigzag', 'x']), t: z.number().min(0).max(1) })).optional(),
});

export const annotationSchema = z.discriminatedUnion('kind', [
  z.object({
    id: z.string(),
    kind: z.literal('text'),
    x: z.number(),
    y: z.number(),
    text: z.string(),
    style: z.enum(['redCaps', 'plain', 'split', 'bold']),
    size: z.enum(['sm', 'md', 'lg']).optional(),
    rotate: z.union([z.literal(0), z.literal(90), z.literal(-90)]).optional(),
  }),
  z.object({
    id: z.string(),
    kind: z.literal('mark'),
    x: z.number(),
    y: z.number(),
    mark: z.enum(['handoffX', 'ballDot', 'zoneBubble', 'fakeArrow']),
    r: z.number().optional(),
    label: z.string().optional(),
  }),
]);

export const diagramSchema = z.object({
  players: z.record(z.string(), playerSchema),
  paths: z.record(z.string(), pathSchema),
  annotations: z.record(z.string(), annotationSchema),
});

const viewWindow = z.object({ minX: z.number(), maxX: z.number(), minY: z.number(), maxY: z.number() });
const playersPerSide = z.union([z.literal(6), z.literal(7), z.literal(8), z.literal(9), z.literal(11), z.literal(12)]);

export const formationSchema = z.object({
  id: z.string(),
  name: z.string(),
  side: z.enum(['offense', 'defense']),
  personnel: z.string().optional(),
  playersPerSide,
  players: z.record(z.string(), playerSchema),
  coverage: z.string().optional(),
  tags: z.array(z.string()),
  builtin: z.boolean().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const playSchema = z.object({
  id: z.string(),
  name: z.string(),
  formationId: z.string().optional(),
  formationLabel: z.string().optional(),
  personnel: z.string().optional(),
  category: z.enum(['Run', 'Pass', 'PA', 'Screen', 'Special']),
  tags: z.array(z.string()),
  notes: z.string().optional(),
  positionNotes: z.record(z.string(), z.string()),
  defense: z
    .object({ formationId: z.string().optional(), front: z.string().optional(), coverage: z.string().optional() })
    .optional(),
  wristband: z.string().optional(),
  diagram: diagramSchema,
  view: viewWindow.optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const playbookSchema = z.object({
  id: z.string(),
  name: z.string(),
  subtitle: z.string().optional(),
  cover: z.object({
    title: z.string(),
    subtitle: z.string().optional(),
    team: z.string().optional(),
    season: z.string().optional(),
    showCover: z.boolean(),
  }),
  sections: z.array(
    z.object({ id: z.string(), title: z.string(), kind: z.enum(['plays', 'formations']), itemIds: z.array(z.string()) }),
  ),
  defaultLayout: z.enum(['1up', '2up', '4up', '6up', '8up', '9up', '10up']),
  paper: z.enum(['letter', 'a4']),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const settingsSchema = z.object({
  hashPreset: z.enum(['nfl', 'ncaa', 'hs']),
  theme: z.enum(['plain', 'yardlines']),
  paper: z.enum(['letter', 'a4']),
  defaultPlayersPerSide: playersPerSide,
  flipSwapsXZ: z.boolean(),
});

export const backupV2Schema = z.object({
  app: z.literal('playforge'),
  version: z.literal(2),
  exportedAt: z.string(),
  formations: z.array(formationSchema),
  plays: z.array(playSchema),
  playbooks: z.array(playbookSchema),
  settings: settingsSchema,
});
