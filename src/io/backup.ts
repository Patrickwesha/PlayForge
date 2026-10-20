import type { BackupV2, Formation, Play, Playbook, Settings } from '@/model/types';
import { z } from 'zod';
import { backupV2Schema, formationSchema, playSchema, playbookSchema } from '@/model/schema';
import { importLegacy, looksLegacy } from './legacyImport';

/**
 * A pack: formations, plays and playbooks to ADD to a library, with no settings. Used for playbooks that are
 * kept out of the public repo (a coach's private book) and handed over as a file. Imported with repo.addPack,
 * so it never touches settings and never overwrites a row the library already has.
 */
export const packSchema = z.object({
  app: z.literal('playforge'),
  kind: z.literal('pack'),
  name: z.string(),
  formations: z.array(formationSchema),
  plays: z.array(playSchema),
  playbooks: z.array(playbookSchema),
});
export type PlayForgePack = z.infer<typeof packSchema>;

export type ParsedBackup = {
  source: 'playforge-v2' | 'playforge-lite' | 'playforge-pack';
  data: { formations: Formation[]; plays: Play[]; playbooks: Playbook[]; settings?: Settings };
  warnings: string[];
};

/** Parse a backup file: PlayForge v2 JSON or a PlayForge-Lite export. */
export function parseBackup(text: string): ParsedBackup {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Not a JSON file');
  }
  if (json && typeof json === 'object' && (json as { kind?: string }).kind === 'pack') {
    const r = packSchema.safeParse(json);
    if (!r.success) throw new Error(`Pack failed validation: ${r.error.issues[0]?.path.join('.')} ${r.error.issues[0]?.message}`);
    return { source: 'playforge-pack', data: { formations: r.data.formations as Formation[], plays: r.data.plays as Play[], playbooks: r.data.playbooks as Playbook[] }, warnings: [] };
  }
  if (json && typeof json === 'object' && (json as { app?: string }).app === 'playforge') {
    const r = backupV2Schema.safeParse(json);
    if (!r.success) throw new Error(`Backup failed validation: ${r.error.issues[0]?.path.join('.')} ${r.error.issues[0]?.message}`);
    const b: BackupV2 = r.data;
    return { source: 'playforge-v2', data: { formations: b.formations, plays: b.plays, playbooks: b.playbooks, settings: b.settings }, warnings: [] };
  }
  if (looksLegacy(json)) {
    const r = importLegacy(json);
    return { source: 'playforge-lite', data: { formations: r.formations, plays: r.plays, playbooks: r.playbooks }, warnings: r.warnings };
  }
  throw new Error('Unrecognized file. Expected a PlayForge backup or a PlayForge-Lite export.');
}
