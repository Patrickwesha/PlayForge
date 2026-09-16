import type { Diagram, Formation, Path, PathPoint, Play, Playbook, Player } from '@/model/types';
import { cubicMidpoint } from '@/geometry/path';
import { nowIso } from '@/model/ids';
import type { LegacyExport, LegacyPlayer, LegacyRouteSegment } from './legacyTypes';

export const LEGACY_PX_PER_YD = 15.4;
export const LEGACY_CENTER_X = 512;
export const LEGACY_DEFAULT_LOS_Y = 768;

export type LegacyImportOptions = { pxPerYard?: number; sideThresholdYd?: number };

export type LegacyImportResult = { formations: Formation[]; plays: Play[]; playbooks: Playbook[]; warnings: string[] };

export function looksLegacy(json: unknown): json is LegacyExport {
  if (!json || typeof json !== 'object') return false;
  const j = json as Record<string, unknown>;
  if (j.app === 'playforge') return false;
  return Array.isArray(j.plays) || Array.isArray(j.formations) || Array.isArray(j.playbooks);
}

const r4 = (n: number) => Math.round(n * 4) / 4;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

function isRed(stroke?: string) {
  if (!stroke) return false;
  const s = stroke.toLowerCase();
  return s === '#c0392b' || s === '#e74c3c' || s === '#ff0000' || s === 'red' || s === '#d0021b' || s === '#dc2626' || s === '#ef4444';
}
function isBlue(stroke?: string) {
  if (!stroke) return false;
  const s = stroke.toLowerCase();
  return s === '#3498db' || s === '#2563eb' || s === '#3b82f6' || s === 'blue' || s === '#1f4fd1';
}

function convertPlayer(lp: LegacyPlayer, losY: number, s: number, sideThreshold: number): Player {
  const x = r4((lp.x - LEGACY_CENTER_X) / s);
  const y = r4((losY - lp.y) / s);
  const side = y > sideThreshold ? 'defense' : 'offense';
  const symbol: Player['symbol'] = lp.shape === 'E' ? 'letter' : lp.shape === 'square' ? 'square' : lp.shape === 'diamond' ? 'diamond' : lp.shape === 'oval' ? 'oval' : 'circle';
  return {
    id: lp.id,
    side,
    symbol,
    label: lp.shape === 'E' && !lp.label ? 'E' : lp.label ?? '',
    x,
    y,
    shade: lp.shaded ? 'full' : undefined,
    labelColor: isRed(lp.fill) && !lp.shaded ? 'red' : undefined,
  };
}

/** Chain consecutive segments into paths. Returns paths anchored to the player. */
function convertRoutes(playerId: string, segs: LegacyRouteSegment[], s: number, warnings: string[]): Path[] {
  const paths: Path[] = [];
  let cur: Path | null = null;
  let curEnd: { x: number; y: number } | null = null;
  const rel = (p: { x: number; y: number }): PathPoint => ({ x: r3(p.x / s), y: r3(-p.y / s) });
  let n = 0;
  for (const seg of segs) {
    const chained = cur && curEnd && Math.abs(curEnd.x - seg.start.x) < 0.01 && Math.abs(curEnd.y - seg.start.y) < 0.01;
    if (!chained) {
      n += 1;
      cur = {
        id: `${playerId}-r${n}`,
        anchor: { kind: 'player', playerId },
        points: [rel(seg.start)],
        end: 'arrow',
        line: 'solid',
        role: 'route',
      };
      paths.push(cur);
    }
    if (!cur) continue;
    if (seg.type === 'curve' && seg.cp1) {
      const c1 = seg.cp1;
      const c2 = seg.cp2 ?? seg.cp1;
      const mid = cubicMidpoint(seg.start, c1, c2, seg.end);
      cur.points.push({ ...rel(mid), smooth: true });
    }
    cur.points.push(rel(seg.end));
    curEnd = seg.end;
    // style from the latest segment
    cur.end = seg.endpointStyle === 'T' ? 'tbar' : seg.endpointStyle === 'circle' ? 'dot' : seg.endpointStyle === 'none' ? 'none' : 'arrow';
    cur.line = seg.lineStyle === 'wavy' ? 'squiggle' : seg.lineStyle === 'dashed' ? 'dashed' : seg.lineStyle === 'dotted' ? 'dotted' : 'solid';
    cur.role = cur.end === 'tbar' ? 'block' : cur.line === 'squiggle' ? 'motion' : 'route';
    if (isRed(seg.stroke)) cur.color = 'red';
    else if (isBlue(seg.stroke)) cur.color = 'blue';
    if ((seg.strokeWidth ?? 3) >= 5) cur.width = 'thick';
    else if ((seg.strokeWidth ?? 3) <= 2) cur.width = 'thin';
  }
  for (const p of paths) {
    if (p.points.length < 2) warnings.push(`Dropped an empty line on ${playerId}`);
  }
  return paths.filter((p) => p.points.length >= 2);
}

function convertDiagram(players: Record<string, LegacyPlayer> | undefined, losY: number, s: number, sideThreshold: number, warnings: string[]): Diagram {
  const d: Diagram = { players: {}, paths: {}, annotations: {} };
  for (const lp of Object.values(players ?? {})) {
    d.players[lp.id] = convertPlayer(lp, losY, s, sideThreshold);
    for (const path of convertRoutes(lp.id, lp.routes ?? [], s, warnings)) d.paths[path.id] = path;
  }
  return d;
}

export function importLegacy(json: LegacyExport, opts: LegacyImportOptions = {}): LegacyImportResult {
  const s = opts.pxPerYard ?? LEGACY_PX_PER_YD;
  const sideThreshold = opts.sideThresholdYd ?? 0.5;
  const warnings: string[] = [];
  const t = nowIso();

  const formations: Formation[] = (json.formations ?? []).map((lf) => {
    const losY = lf.field?.losEnabled && lf.field.losY ? lf.field.losY : LEGACY_DEFAULT_LOS_Y;
    const d = convertDiagram(lf.layers?.players, losY, s, sideThreshold, warnings);
    const all = Object.values(d.players);
    const side = all.length > 0 && all.every((p) => p.side === 'defense') ? 'defense' : 'offense';
    for (const p of all) p.side = side;
    return {
      id: lf.id,
      name: lf.name,
      side,
      playersPerSide: 11,
      players: d.players,
      tags: ['imported'],
      builtin: false,
      createdAt: lf.createdAt ?? t,
      updatedAt: lf.updatedAt ?? t,
    };
  });

  const plays: Play[] = (json.plays ?? []).map((lp) => {
    const losY = lp.fieldConfig?.losEnabled && lp.fieldConfig.losY ? lp.fieldConfig.losY : LEGACY_DEFAULT_LOS_Y;
    const diagram = convertDiagram(lp.layers?.players, losY, s, sideThreshold, warnings);
    const hasBlocks = Object.values(diagram.paths).some((p) => p.end === 'tbar');
    return {
      id: lp.id,
      name: lp.name,
      formationId: lp.formationId,
      formationLabel: undefined,
      category: hasBlocks ? 'Run' : 'Pass',
      tags: [...(lp.tags ?? []), 'imported'],
      notes: lp.notes,
      positionNotes: {},
      diagram,
      createdAt: lp.createdAt ?? t,
      updatedAt: lp.updatedAt ?? t,
    };
  });

  const playIds = new Set(plays.map((p) => p.id));
  const playbooks: Playbook[] = (json.playbooks ?? []).map((pb) => {
    const ids = (pb.playIds ?? []).filter((id) => playIds.has(id));
    if (ids.length !== (pb.playIds ?? []).length) warnings.push(`Playbook "${pb.name}": ${(pb.playIds ?? []).length - ids.length} missing play reference(s) dropped`);
    return {
      id: pb.id,
      name: pb.name,
      cover: { title: pb.name, showCover: false },
      sections: [{ id: `${pb.id}-sec`, title: 'Plays', kind: 'plays', itemIds: ids }],
      defaultLayout: '6up',
      paper: 'letter',
      createdAt: pb.createdAt ?? t,
      updatedAt: pb.updatedAt ?? t,
    };
  });

  return { formations, plays, playbooks, warnings };
}
