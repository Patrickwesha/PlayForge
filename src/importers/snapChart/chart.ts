/**
 * The All-22 chart workbook (sheet "Chart"): one row per snap. Header on row 4, data from row 5 down
 * to the first empty Play ID. Values only; formula cells contribute their cached value.
 */
import type { SnapBackfield, SnapCallType, SnapHash, SnapStrength } from '@/model/types';
import { readSheet, type CellValue, type SheetRows } from './xlsx';

export type ChartRow = {
  /** Spreadsheet row number, for skip reports. */
  row: number;
  playId: string;
  week: number;
  quarter?: number;
  down?: number;
  distance?: number;
  fieldZone?: string;
  hash?: SnapHash;
  personnel: string;
  formFamily: string;
  strength?: SnapStrength;
  backfield: SnapBackfield;
  backfieldDetail?: string;
  playType?: string;
  callType: SnapCallType;
  target?: string;
  result?: string;
  yards?: number;
  motion?: string;
  set?: string;
  notes?: string;
};

export type SkippedRow = { row?: number; playId?: string; reason: string };

export type ParsedChart = { rows: ChartRow[]; skipped: SkippedRow[]; warnings: string[] };

export const CHART_SHEET = 'Chart';
export const HEADER_ROW = 4;

/** Header text -> field. The letters in the comments are where the template puts them. */
const HEADERS: Record<string, string> = {
  'play id': 'playId', // A
  wk: 'week', // B
  qtr: 'quarter', // C
  down: 'down', // D
  dist: 'distance', // E
  'field zone': 'fieldZone', // F
  hash: 'hash', // G
  personnel: 'personnel', // H
  'form family': 'formFamily', // I
  str: 'strength', // K
  backfield: 'backfield', // N
  'play type': 'playType', // O
  target: 'target', // V
  result: 'result', // W
  yds: 'yards', // X
  notes: 'notes', // AE
};
const FALLBACK_COLUMNS: Record<string, string> = { A: 'playId', B: 'week', C: 'quarter', D: 'down', E: 'distance', F: 'fieldZone', G: 'hash', H: 'personnel', I: 'formFamily', K: 'strength', N: 'backfield', O: 'playType', V: 'target', W: 'result', X: 'yards', AE: 'notes' };

const str = (v: CellValue | undefined): string | undefined => {
  if (v === undefined || v === null) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
};
const num = (v: CellValue | undefined): number | undefined => {
  if (v === undefined || v === '' || typeof v === 'boolean') return undefined;
  const n = typeof v === 'number' ? v : Number(String(v).trim());
  return Number.isFinite(n) ? n : undefined;
};

export function normalizeHash(v: string | undefined): SnapHash | undefined {
  const s = v?.trim().toLowerCase();
  if (!s) return undefined;
  if (s.startsWith('l')) return 'Left';
  if (s.startsWith('r')) return 'Right';
  if (s.startsWith('m') || s.startsWith('c')) return 'Middle';
  return undefined;
}

export function normalizeStrength(v: string | undefined): SnapStrength | undefined {
  const s = v?.trim().toLowerCase();
  if (!s) return undefined;
  if (s === 'rt' || s === 'r' || s === 'right') return 'Rt';
  if (s === 'lt' || s === 'l' || s === 'left') return 'Lt';
  return undefined;
}

/** "Gun, RB L" -> Gun; "Under Center" -> Under Center; "Pistol" -> Pistol. */
export function normalizeBackfield(v: string | undefined): SnapBackfield | undefined {
  const s = v?.trim().toLowerCase();
  if (!s) return undefined;
  if (s.startsWith('under') || s === 'uc') return 'Under Center';
  if (s.startsWith('gun') || s.startsWith('shotgun')) return 'Gun';
  if (s.startsWith('pistol')) return 'Pistol';
  return undefined;
}

/** Run or pass, from Play Type when charted, else from the Result. */
export function callTypeOf(playType: string | undefined, result: string | undefined): SnapCallType {
  const t = (playType ?? '').toLowerCase();
  if (t === 'run' || t === 'qb run') return 'run';
  if (t.startsWith('pass') || t === 'scramble' || t === 'screen' || t === 'pa' || t === 'rpo') return 'pass';
  if (t.startsWith('penalty')) return 'other';
  const r = (result ?? '').toLowerCase();
  if (r.startsWith('run')) return 'run';
  if (r === 'complete' || r === 'incomplete' || r === 'sack' || r === 'interception' || r === 'scramble' || r === 'touchdown') return 'pass';
  return 'other';
}

/** Pull "Set: ..." and "Motion: ..." out of a Notes cell. */
export function parseNotes(notes: string | undefined): { set?: string; motion?: string } {
  if (!notes) return {};
  const out: { set?: string; motion?: string } = {};
  const setM = notes.match(/\bSet:\s*([\s\S]*?)(?=\s*\bMotion:|\s*\|\s*Conf\b|\s*\|\s*$|$)/);
  if (setM) out.set = setM[1].replace(/\s*\|\s*$/, '').trim() || undefined;
  const moM = notes.match(/\bMotion:\s*([\s\S]*?)(?=\s*\|\s*Conf\b|\s*\|\s*$|$)/);
  if (moM) out.motion = moM[1].replace(/\s*\|\s*$/, '').trim() || undefined;
  return out;
}

function columnMap(header: Map<string, CellValue> | undefined, warnings: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  if (header) {
    for (const [col, v] of header) {
      const field = HEADERS[String(v).trim().toLowerCase()];
      if (field) map[col] = field;
    }
  }
  const found = new Set(Object.values(map));
  for (const [col, field] of Object.entries(FALLBACK_COLUMNS)) {
    if (found.has(field)) continue;
    if (!header) map[col] = field;
    else {
      map[col] = field;
      warnings.push(`Header row ${HEADER_ROW} has no "${field}" column; used column ${col}`);
    }
  }
  return map;
}

/** Parse the chart from the sheet rows (exposed for tests that build a sheet by hand). */
export function parseChartRows(sheet: SheetRows): ParsedChart {
  const warnings: string[] = [];
  const skipped: SkippedRow[] = [];
  const rows: ChartRow[] = [];
  const columns = columnMap(sheet.get(HEADER_ROW), warnings);
  const byField = (r: Map<string, CellValue>) => {
    const o: Record<string, CellValue | undefined> = {};
    for (const [col, field] of Object.entries(columns)) o[field] = r.get(col);
    return o;
  };
  const last = Math.max(HEADER_ROW, ...sheet.keys());
  const seen = new Map<string, number>();
  for (let n = HEADER_ROW + 1; n <= last; n++) {
    const r = sheet.get(n);
    const f = r ? byField(r) : {};
    const playId = str(f.playId);
    if (!playId) break; // data ends at the first empty Play ID
    const week = num(f.week);
    if (week === undefined) {
      skipped.push({ row: n, playId, reason: 'Wk is not a number' });
      continue;
    }
    const personnel = str(f.personnel);
    const formFamily = str(f.formFamily);
    const backfield = normalizeBackfield(str(f.backfield));
    const missing = [!personnel && 'Personnel', !formFamily && 'Form Family', !backfield && (str(f.backfield) ? `Backfield "${str(f.backfield)}" not recognized (Under Center / Gun / Pistol)` : 'Backfield')].filter(Boolean);
    if (missing.length) {
      skipped.push({ row: n, playId, reason: `${missing.join(', ')} ${missing.length > 1 ? 'are' : 'is'} blank` });
      continue;
    }
    if (seen.has(playId)) {
      skipped.push({ row: n, playId, reason: `Duplicate Play ID (first seen on row ${seen.get(playId)})` });
      continue;
    }
    seen.set(playId, n);
    const hashText = str(f.hash);
    const hash = normalizeHash(hashText);
    if (hashText && !hash) warnings.push(`${playId}: Hash "${hashText}" not recognized, drawn as Middle`);
    const strText = str(f.strength);
    const strength = normalizeStrength(strText);
    if (strText && !strength) warnings.push(`${playId}: Str "${strText}" not recognized, treated as blank`);
    const notes = str(f.notes);
    const parsed = parseNotes(notes);
    const playType = str(f.playType);
    const result = str(f.result);
    rows.push({
      row: n,
      playId,
      week,
      quarter: num(f.quarter),
      down: num(f.down),
      distance: num(f.distance),
      fieldZone: str(f.fieldZone),
      hash,
      personnel: personnel!,
      formFamily: formFamily!,
      strength,
      backfield: backfield!,
      backfieldDetail: str(f.backfield),
      playType,
      callType: callTypeOf(playType, result),
      target: str(f.target),
      result,
      yards: num(f.yards),
      motion: parsed.motion,
      set: parsed.set,
      notes,
    });
  }
  return { rows, skipped, warnings };
}

/** Parse the "Chart" sheet of an .xlsx workbook. */
export function parseChartXlsx(file: Uint8Array, sheetName = CHART_SHEET): ParsedChart {
  return parseChartRows(readSheet(file, sheetName));
}
