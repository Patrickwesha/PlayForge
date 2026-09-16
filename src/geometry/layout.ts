import { PAGE_MARGIN_IN, PAPER } from '@/model/constants';
import type { LayoutId, Orientation, Paper, SheetLayout } from '@/model/types';

export const LAYOUTS: Record<LayoutId, SheetLayout> = {
  '1up': { id: '1up', cols: 1, rows: 1, orientation: 'portrait', kind: 'plays' },
  '2up': { id: '2up', cols: 1, rows: 2, orientation: 'portrait', kind: 'plays' },
  '4up': { id: '4up', cols: 2, rows: 2, orientation: 'landscape', kind: 'plays' },
  '6up': { id: '6up', cols: 2, rows: 3, orientation: 'portrait', kind: 'plays' },
  '8up': { id: '8up', cols: 2, rows: 4, orientation: 'portrait', kind: 'plays' },
  '9up': { id: '9up', cols: 3, rows: 3, orientation: 'portrait', kind: 'formations' },
  '10up': { id: '10up', cols: 2, rows: 5, orientation: 'portrait', kind: 'formations' },
};

export const PLAY_LAYOUTS: LayoutId[] = ['1up', '2up', '4up', '6up', '8up'];
export const FORMATION_LAYOUTS: LayoutId[] = ['4up', '6up', '9up', '10up'];

export type SheetMetrics = {
  /** page size in inches after orientation */
  pageW: number;
  pageH: number;
  marginIn: number;
  gapIn: number;
  titleIn: number;
  footerIn: number;
  cellW: number;
  cellH: number;
  cellHeaderIn: number;
  cellFooterIn: number;
  /** diagram area inside a cell */
  svgW: number;
  svgH: number;
  aspect: number;
};

export type MetricOptions = {
  marginIn?: number;
  gapIn?: number;
  titleIn?: number;
  footerIn?: number;
  cellHeaderIn?: number;
  cellFooterIn?: number;
};

export function pageSize(paper: Paper, orientation: Orientation): { w: number; h: number } {
  const p = PAPER[paper];
  return orientation === 'portrait' ? { w: p.wIn, h: p.hIn } : { w: p.hIn, h: p.wIn };
}

export function sheetMetrics(layoutId: LayoutId, paper: Paper, o: MetricOptions = {}): SheetMetrics {
  const layout = LAYOUTS[layoutId];
  const { w: pageW, h: pageH } = pageSize(paper, layout.orientation);
  const marginIn = o.marginIn ?? PAGE_MARGIN_IN;
  const gapIn = o.gapIn ?? 0.12;
  const titleIn = o.titleIn ?? 0.42;
  const footerIn = o.footerIn ?? 0.22;
  const big = layout.cols * layout.rows <= 2;
  const cellHeaderIn = o.cellHeaderIn ?? (big ? 0.6 : 0.44);
  const cellFooterIn = o.cellFooterIn ?? (big ? 0.28 : 0.2);
  const innerW = pageW - 2 * marginIn;
  const innerH = pageH - 2 * marginIn - titleIn - footerIn;
  const cellW = (innerW - gapIn * (layout.cols - 1)) / layout.cols;
  const cellH = (innerH - gapIn * (layout.rows - 1)) / layout.rows;
  const svgW = cellW - 0.1;
  const svgH = cellH - cellHeaderIn - cellFooterIn - 0.05;
  return { pageW, pageH, marginIn, gapIn, titleIn, footerIn, cellW, cellH, cellHeaderIn, cellFooterIn, svgW, svgH, aspect: svgW / svgH };
}

export function paginate<T>(items: T[], perPageCount: number): T[][] {
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perPageCount) pages.push(items.slice(i, i + perPageCount));
  return pages;
}

export function perPage(layoutId: LayoutId): number {
  const l = LAYOUTS[layoutId];
  return l.cols * l.rows;
}
