import { describe, expect, it } from 'vitest';
import { PACKERS_2019_FORMATIONS } from '@/seeds/packers2019';
import { bookFormationMatches, matchLibraryFormation, parseCellTitle } from './formationMatch';
import type { Book, BookCell, BookPage } from './types';

const cell = (id: string, lines: string[], kind: BookCell['kind'] = 'diagram'): BookCell => ({ id, kind, bbox: [0, 0, 1, 1], lines, footer: '', badges: [], notes: '', labels: [], rings: [], defenders: [], crop: '', cropBox: [0, 0, 1, 1], cutLeft: false, cutRight: false, anchor: `a-${id}`, vector: null, playId: `gb19-p013-${id}` });
const page = (n: number, type: BookPage['type'], title: string, cells: BookCell[]): BookPage => ({ n, type, title, titleRestored: false, printedPage: '', section: 0, blocks: [], cells, uncertain: [], unverified: false, anchor: `p-${n}`, titleAnchor: `t-${n}` });

describe('book formation matching', () => {
  it('parses "[21] WEAK RT" into personnel and name', () => {
    expect(parseCellTitle('[21] WEAK RT')).toEqual({ personnel: '21', name: 'WEAK RT' });
    expect(parseCellTitle("[22Z] I RT TIGHTER")).toEqual({ personnel: '22Z', name: 'I RT TIGHTER' });
    expect(parseCellTitle('TRIPS RT')).toEqual({ name: 'TRIPS RT' });
  });

  it('matches cell titles to the Packers 2019 pack by personnel + name, same page first', () => {
    expect(matchLibraryFormation(['[21] WEAK RT'], 13)?.id).toBe('seed-gb19-weak-rt-21');
    expect(matchLibraryFormation(['[23] WEAK RT'], 22)?.id).toBe('seed-gb19-weak-rt-23');
    expect(matchLibraryFormation(["[21] I RT #'s"], 15)?.id).toBe('seed-gb19-i-rt-numbers-21');
    expect(matchLibraryFormation(['[11] TRIPS RT'], 16)?.name).toBe('Trips Rt');
    expect(matchLibraryFormation(['TRIPS RT'], 16, '[11] 1 BACK 3x1')?.name).toBe('Trips Rt');
    expect(matchLibraryFormation(['[21] NOT A FORMATION'], 13)).toBeUndefined();
    expect(matchLibraryFormation([], 13)).toBeUndefined();
    // "I Rt" exists in 21, 23 and 20: personnel decides, and page breaks a tie
    expect(matchLibraryFormation(['[20] I RT'], 23)?.id).toBe('seed-gb19-i-rt-20');
  });

  it('maps every matching diagram cell on formation pages, and nothing on play pages', () => {
    const book: Book = {
      id: 'gb-2019', title: 't', source: 's', pageCount: 2, built: '2026-01-01T00:00:00.000Z', sections: [],
      pages: [
        page(13, 'formation', '2 BACK', [cell('c1', ['[21] I RT']), cell('c2', ['[21] STRONG RT']), cell('c3', ['[21] NOPE RT']), cell('c4', ['[21] WEAK RT'], 'text')]),
        page(108, 'run-play', '18 MIKE', [cell('c1', ['[21] I RT', '18 MIKE'])]),
      ],
    };
    const m = bookFormationMatches(book);
    expect([...m.entries()]).toEqual([
      ['13:c1', 'seed-gb19-i-rt-21'],
      ['13:c2', 'seed-gb19-strong-rt-21'],
    ]);
    const ids = new Set(PACKERS_2019_FORMATIONS.map((f) => f.id));
    for (const id of m.values()) expect(ids.has(id)).toBe(true);
  });
});
