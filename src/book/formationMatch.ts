import type { Formation } from '@/model/types';
import { PACKERS_2019_FORMATIONS } from '@/seeds/packers2019';
import type { Book, BookCell, BookPage } from './types';

/**
 * The formation pages of the Green Bay 2019 book draw the same formations PlayForge already ships as the
 * Packers 2019 pack (src/seeds/packers2019, positions derived from the book's own rules). Match a cell's
 * printed title ("[21] WEAK RT") to that pack by personnel + name, preferring the entry from the same page.
 */
/** Case, spacing and punctuation do not matter; "#'s" is the book's spelling of "Numbers". */
export const normalizeName = (s: string) => s.replace(/#'?s?\b/gi, ' NUMBERS ').toUpperCase().replace(/[^A-Z0-9]/g, '');

export function parseCellTitle(line: string): { personnel?: string; name: string } {
  const m = /^\s*\[([0-9A-Z/]+)\]\s*(.*)$/i.exec(line.trim());
  if (m) return { personnel: m[1].toUpperCase(), name: m[2].trim() };
  return { name: line.trim() };
}

export function matchLibraryFormation(lines: string[], pageN: number, pageTitle = '', pack: Formation[] = PACKERS_2019_FORMATIONS): Formation | undefined {
  const line1 = lines[0] ?? '';
  if (!line1.trim()) return undefined;
  const title = parseCellTitle(line1);
  const personnel = title.personnel ?? parseCellTitle(pageTitle).personnel;
  const want = normalizeName(title.name);
  if (!want) return undefined;
  const hits = pack.filter((f) => normalizeName(f.name) === want && (!personnel || (f.personnel ?? '').toUpperCase() === personnel));
  if (hits.length === 0) return undefined;
  return hits.find((f) => f.sourcePage === pageN) ?? hits[0];
}

export const cellKey = (page: BookPage, cell: BookCell) => `${page.n}:${cell.id}`;

/** Every diagram cell on a formation page that names a formation in the pack: cell key -> formation id. */
export function bookFormationMatches(book: Book, pack: Formation[] = PACKERS_2019_FORMATIONS): Map<string, string> {
  const out = new Map<string, string>();
  for (const page of book.pages) {
    if (page.type !== 'formation') continue;
    for (const cell of page.cells) {
      if (cell.kind !== 'diagram') continue;
      const f = matchLibraryFormation(cell.lines, page.n, page.title, pack);
      if (f) out.set(cellKey(page, cell), f.id);
    }
  }
  return out;
}

/** The section the reader adds to the book's playbook for the matched library formations. */
export const bookFormationSectionId = (bookId: string) => `${bookId}-library-formations`;
export const BOOK_FORMATION_SECTION_TITLE = 'Formations (PlayForge library)';
