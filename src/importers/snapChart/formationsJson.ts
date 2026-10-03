/**
 * The "playforge-formations/v1" JSON: per-snap, per-player alignment labels charted from film.
 */
import { z } from 'zod';
import type { SnapBackfield, SnapHash, SnapStrength } from '@/model/types';
import { normalizeBackfield, normalizeHash, normalizeStrength } from './chart';

export const FORMATIONS_JSON_SCHEMA = 'playforge-formations/v1';

const playerSchema = z.object({
  pos: z.enum(['QB', 'RB', 'TE', 'WR']),
  name: z.string().nullish(),
  side: z.enum(['L', 'R', 'C']),
  align: z.string().min(1),
  on_line: z.boolean().nullish(),
  order: z.number().int().positive().nullish(),
  /** Order of the player (same side) this one stacks behind, or true for the previous one. */
  stack_behind: z.union([z.number().int().positive(), z.boolean()]).nullish(),
  id_unknown: z.boolean().nullish(),
});

const snapSchema = z.object({
  id: z.string().min(1),
  quarter: z.number().int().nullish(),
  clock: z.string().nullish(),
  down: z.number().int().nullish(),
  distance: z.number().nullish(),
  yardline: z.string().nullish(),
  play_text: z.string().nullish(),
  personnel: z.string().min(1),
  form_family: z.string().min(1),
  formation: z.string().nullish(),
  backfield: z.string().min(1),
  strength: z.string().nullish(),
  hash: z.string().nullish(),
  motion: z.string().nullish(),
  confidence: z.string().nullish(),
  angles: z.string().nullish(),
  notes: z.string().nullish(),
  players: z.array(playerSchema).min(1),
});

export const formationsJsonSchema = z.object({
  schema: z.literal(FORMATIONS_JSON_SCHEMA),
  game: z
    .object({
      season: z.number().int().optional(),
      week: z.number().int().optional(),
      team: z.string().optional(),
      opponent: z.string().optional(),
      home: z.boolean().optional(),
    })
    .partial()
    .optional(),
  snaps: z.array(snapSchema),
});

export type JsonPlayer = z.infer<typeof playerSchema>;
export type JsonSnapRaw = z.infer<typeof snapSchema>;

/** A JSON snap with its labels normalized to the chart's vocabulary. */
export type JsonSnap = {
  id: string;
  week?: number;
  quarter?: number;
  down?: number;
  distance?: number;
  personnel: string;
  formFamily: string;
  backfield: SnapBackfield;
  backfieldDetail: string;
  strength?: SnapStrength;
  hash?: SnapHash;
  motion?: string;
  /** The charted "set, then as-snapped" description. */
  formation?: string;
  playText?: string;
  notes?: string;
  players: JsonPlayer[];
};

export type ParsedFormationsJson = {
  game: { season?: number; week?: number; team?: string; opponent?: string };
  snaps: JsonSnap[];
  skipped: { playId: string; reason: string }[];
  warnings: string[];
};

export function parseFormationsJson(text: string | unknown): ParsedFormationsJson {
  let json: unknown = text;
  if (typeof text === 'string') {
    try {
      json = JSON.parse(text);
    } catch {
      throw new Error('Not a JSON file');
    }
  }
  const r = formationsJsonSchema.safeParse(json);
  if (!r.success) {
    const issue = r.error.issues[0];
    const where = issue?.path.length ? ` at ${issue.path.join('.')}` : '';
    throw new Error(`Not a ${FORMATIONS_JSON_SCHEMA} file${where}: ${issue?.message ?? 'invalid'}`);
  }
  const game = r.data.game ?? {};
  const skipped: ParsedFormationsJson['skipped'] = [];
  const warnings: string[] = [];
  const snaps: JsonSnap[] = [];
  const seen = new Set<string>();
  for (const s of r.data.snaps) {
    if (seen.has(s.id)) {
      skipped.push({ playId: s.id, reason: 'Duplicate snap id in the JSON' });
      continue;
    }
    seen.add(s.id);
    const backfield = normalizeBackfield(s.backfield);
    if (!backfield) {
      skipped.push({ playId: s.id, reason: `Backfield "${s.backfield}" not recognized (Under Center / Gun / Pistol)` });
      continue;
    }
    if (!s.players.some((p) => p.pos === 'QB')) warnings.push(`${s.id}: no QB in players; one is drawn from the backfield`);
    const week = game.week ?? weekFromId(s.id);
    snaps.push({
      id: s.id,
      week,
      quarter: s.quarter ?? undefined,
      down: s.down ?? undefined,
      distance: s.distance ?? undefined,
      personnel: s.personnel,
      formFamily: s.form_family,
      backfield,
      backfieldDetail: s.backfield,
      strength: normalizeStrength(s.strength ?? undefined),
      hash: normalizeHash(s.hash ?? undefined),
      motion: s.motion ?? undefined,
      formation: s.formation ?? undefined,
      playText: s.play_text ?? undefined,
      notes: s.notes ?? undefined,
      players: s.players,
    });
  }
  return { game: { season: game.season, week: game.week, team: game.team, opponent: game.opponent }, snaps, skipped, warnings };
}

/** "W2-014" -> 2 */
export function weekFromId(id: string): number | undefined {
  const m = id.match(/^W(\d+)-/i);
  return m ? Number(m[1]) : undefined;
}

/**
 * Several per-game files as one: every game's snaps in one list, the week taken from each snap id
 * (W1-001), so one import covers the whole season. The first file's season and team are kept.
 */
export function mergeFormationsJson(texts: string[]): unknown {
  const docs = texts.map((t) => JSON.parse(t) as { schema?: string; game?: { season?: number; team?: string }; snaps?: unknown[] });
  const first = docs[0];
  return { schema: first?.schema ?? FORMATIONS_JSON_SCHEMA, game: { season: first?.game?.season, team: first?.game?.team }, snaps: docs.flatMap((d) => d.snaps ?? []) };
}
