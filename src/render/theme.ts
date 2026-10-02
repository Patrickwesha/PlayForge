import { COLORS } from '@/model/constants';
import type { HashPreset, LabelColor, PathColor, Theme } from '@/model/types';

export type RenderTheme = {
  theme: Theme;
  hashPreset: HashPreset;
  showLos: boolean;
  /** Bridge gaps where lines cross (SVG masks). Off for print-to-PDF: Chromium rasterizes every masked line. */
  crossGaps?: boolean;
};

/** The book reader / PDF: plain vector lines, no masks. */
export const BOOK_RENDER_THEME: RenderTheme = { theme: 'plain', hashPreset: 'nfl', showLos: false, crossGaps: false };

export const DEFAULT_RENDER_THEME: RenderTheme = { theme: 'plain', hashPreset: 'ncaa', showLos: false };
export const YARDLINE_THEME: RenderTheme = { theme: 'yardlines', hashPreset: 'ncaa', showLos: true };

export function themeFor(theme: Theme, hashPreset: HashPreset): RenderTheme {
  return { theme, hashPreset, showLos: theme === 'yardlines' };
}

export function labelColorHex(c: LabelColor | undefined): string {
  switch (c) {
    case 'red': return COLORS.red;
    case 'green': return COLORS.green;
    case 'blue': return COLORS.blue;
    case 'brown': return COLORS.brown;
    case 'orange': return COLORS.orange;
    default: return COLORS.ink;
  }
}

export function pathColorHex(c: PathColor | undefined): string {
  switch (c) {
    case 'red': return COLORS.red;
    case 'blue': return COLORS.blue;
    case 'green': return COLORS.green;
    case 'orange': return COLORS.orange;
    case 'gray': return COLORS.gray;
    case 'purple': return COLORS.purple;
    case 'yellow': return COLORS.yellow;
    case 'brown': return COLORS.brown;
    default: return COLORS.ink;
  }
}

export const PATH_COLORS: PathColor[] = ['black', 'gray', 'red', 'blue', 'green', 'orange', 'purple', 'yellow'];
