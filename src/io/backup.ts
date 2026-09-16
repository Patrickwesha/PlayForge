import type { BackupV2, Formation, Play, Playbook, Settings } from '@/model/types';
import { backupV2Schema } from '@/model/schema';
import { importLegacy, looksLegacy } from './legacyImport';

export type ParsedBackup = {
  source: 'playforge-v2' | 'playforge-lite';
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
