/**
 * A small .xlsx reader: cell VALUES only (cached results for formula cells), one sheet at a time.
 * Enough for a charting workbook; not a general spreadsheet library. Works in the browser and in Node.
 */
import { unzipSync, strFromU8 } from 'fflate';

export type CellValue = string | number | boolean;
/** Row number (1-based) -> column letter ("A", "AE") -> value. Empty cells are absent. */
export type SheetRows = Map<number, Map<string, CellValue>>;

const ENTITIES: Record<string, string> = { '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'", '&amp;': '&' };
const unescape = (s: string) =>
  s.replace(/&(lt|gt|quot|apos|amp);|&#(\d+);|&#x([0-9a-fA-F]+);/g, (m, _n, dec, hex) => (dec ? String.fromCodePoint(Number(dec)) : hex ? String.fromCodePoint(parseInt(hex, 16)) : ENTITIES[m] ?? m));

/** Concatenate every <t> run inside a rich-text / shared string item. */
const textRuns = (xml: string) => [...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => unescape(m[1])).join('');

function sharedStrings(zip: Record<string, Uint8Array>): string[] {
  const raw = zip['xl/sharedStrings.xml'];
  if (!raw) return [];
  return [...strFromU8(raw).matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textRuns(m[1]));
}

function sheetPath(zip: Record<string, Uint8Array>, name: string): string {
  const wb = strFromU8(zip['xl/workbook.xml']);
  const sheet = [...wb.matchAll(/<sheet\b([^>]*)\/?>/g)].map((m) => m[1]).find((attrs) => unescape((attrs.match(/\bname="([^"]*)"/) ?? [])[1] ?? '') === name);
  if (!sheet) {
    const names = [...wb.matchAll(/<sheet\b[^>]*\bname="([^"]*)"/g)].map((m) => unescape(m[1]));
    throw new Error(`No sheet named "${name}" (sheets: ${names.join(', ')})`);
  }
  const rid = (sheet.match(/\br:id="([^"]*)"/) ?? [])[1];
  const rels = strFromU8(zip['xl/_rels/workbook.xml.rels']);
  const rel = [...rels.matchAll(/<Relationship\b([^>]*)\/?>/g)].map((m) => m[1]).find((attrs) => (attrs.match(/\bId="([^"]*)"/) ?? [])[1] === rid);
  const target = rel ? (rel.match(/\bTarget="([^"]*)"/) ?? [])[1] : undefined;
  if (!target) throw new Error(`Sheet "${name}" has no worksheet part`);
  return target.startsWith('/') ? target.slice(1) : `xl/${target}`;
}

/** Split "AE12" into ["AE", 12]. */
export function splitRef(ref: string): [string, number] {
  const m = ref.match(/^([A-Z]+)(\d+)$/);
  if (!m) throw new Error(`Bad cell reference ${ref}`);
  return [m[1], Number(m[2])];
}

/** "A" -> 1, "Z" -> 26, "AE" -> 31. */
export function columnIndex(col: string): number {
  let n = 0;
  for (const ch of col) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/** Read one sheet of an .xlsx file into row -> column -> value. */
export function readSheet(file: Uint8Array, sheetName: string): SheetRows {
  let zip: Record<string, Uint8Array>;
  try {
    zip = unzipSync(file);
  } catch {
    throw new Error('Not a .xlsx file (could not unzip it)');
  }
  if (!zip['xl/workbook.xml']) throw new Error('Not a .xlsx workbook (no xl/workbook.xml)');
  const sst = sharedStrings(zip);
  const xml = strFromU8(zip[sheetPath(zip, sheetName)]);
  const rows: SheetRows = new Map();
  for (const m of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
    const attrs = m[1];
    const inner = m[2];
    if (!inner) continue;
    const ref = (attrs.match(/\br="([A-Z]+\d+)"/) ?? [])[1];
    if (!ref) continue;
    const type = (attrs.match(/\bt="(\w+)"/) ?? [])[1];
    let value: CellValue | undefined;
    if (type === 'inlineStr') value = textRuns(inner);
    else {
      const v = inner.match(/<v>([\s\S]*?)<\/v>/);
      if (!v) continue;
      if (type === 's') value = sst[Number(v[1])] ?? '';
      else if (type === 'str' || type === 'e') value = unescape(v[1]);
      else if (type === 'b') value = v[1] === '1';
      else value = Number(v[1]);
    }
    if (value === undefined || value === '') continue;
    const [col, row] = splitRef(ref);
    let r = rows.get(row);
    if (!r) rows.set(row, (r = new Map()));
    r.set(col, value);
  }
  return rows;
}
