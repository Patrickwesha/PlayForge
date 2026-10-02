import type { Diagram, ViewWindow } from '@/model/types';

/**
 * A scanned playbook rebuilt as a readable document (built by scripts/playbook/build_book.py).
 * Coordinates in `bbox` / `at` are pixels of the 300 DPI page renders (1650 x 2550).
 */
/**
 * `href` / `hrefs`: links the builder found from the book's own index pages to the pages they list.
 * `restored`: row indexes whose cut-off label / first cell was restored from the rest of the book.
 */
export type BookBlock =
  | { kind: 'heading'; text: string; href?: string }
  | { kind: 'para'; text: string }
  | { kind: 'list'; ordered?: boolean; items: string[]; hrefs?: (string | null)[] }
  | { kind: 'kv'; rows: [string, string][]; restored?: number[] }
  | { kind: 'table'; header?: string[]; rows: string[][]; hrefs?: (string | null)[]; restored?: number[] };

export type BookLabel = { text: string; color?: string; at?: [number, number] };

export type BookVector = {
  diagram: Diagram;
  view: ViewWindow;
  confidence: 'high' | 'medium' | 'low';
  recall: number;
  precision: number;
  issues: string[];
  /** Players placed by educated guess (cut off or hidden in the scan), one line each. */
  guesses?: string[];
};

export type BookCell = {
  id: string;
  kind: 'diagram' | 'text' | 'photo' | 'empty';
  bbox: [number, number, number, number];
  lines: string[];
  footer: string;
  badges: string[];
  notes: string;
  labels: BookLabel[];
  rings: string[];
  defenders: string[];
  crop: string;
  /** The page-pixel box the crop image covers (below the cell's printed title lines). */
  cropBox: [number, number, number, number];
  cutLeft: boolean;
  cutRight: boolean;
  anchor: string;
  vector: BookVector | null;
  guesses?: string[];
  playId?: string;
};

export type BookPageType =
  | 'cover' | 'divider' | 'index' | 'text' | 'terminology' | 'formation' | 'defense' | 'route-tree' | 'concept'
  | 'run-play' | 'pass-play' | 'play-action' | 'screen' | 'protection' | 'situational' | 'blank' | 'other';

export type BookPage = {
  n: number;
  type: BookPageType;
  title: string;
  titleRestored: boolean;
  printedPage: string;
  section: number;
  blocks: BookBlock[];
  cells: BookCell[];
  uncertain: string[];
  unverified: boolean;
  anchor: string;
  titleAnchor: string;
};

export type BookTocEntry = { label: string; page: number; anchor: string; children: { label: string; anchor: string }[] };

export type BookSection = { id: string; title: string; start: number; end: number; anchor: string; entries: BookTocEntry[] };

export type ReviewCell = {
  page: number;
  cell: string;
  lines: string[];
  anchor: string;
  crop: string;
  cropBox: [number, number, number, number];
  vector: BookVector & { diagram: Diagram };
};

export type ReviewFile = { id: string; title: string; cells: ReviewCell[] };

export type Book = {
  id: string;
  title: string;
  source: string;
  pageCount: number;
  built: string;
  sections: BookSection[];
  pages: BookPage[];
};

export const PAGE_TYPE_LABEL: Record<BookPageType, string> = {
  cover: 'Cover',
  divider: 'Section divider',
  index: 'Index',
  text: 'Procedures',
  terminology: 'Terminology',
  formation: 'Formations',
  defense: 'Defense',
  'route-tree': 'Route tree',
  concept: 'Concept',
  'run-play': 'Run plays',
  'pass-play': 'Pass plays',
  'play-action': 'Play action',
  screen: 'Screens',
  protection: 'Protection',
  situational: 'Situational',
  blank: 'Blank',
  other: 'Other',
};
