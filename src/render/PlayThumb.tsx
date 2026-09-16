import type { CSSProperties } from 'react';
import type { Diagram, ViewWindow } from '@/model/types';
import { diagramBounds, fitWindow, type FitOptions } from '@/geometry/bounds';
import { PlaySvg } from './PlaySvg';
import type { RenderTheme } from './theme';

export type PlayThumbProps = {
  diagram: Diagram;
  /** width / height of the box the thumbnail fills */
  aspect: number;
  theme?: RenderTheme;
  view?: ViewWindow;
  fit?: FitOptions;
  style?: CSSProperties;
  className?: string;
};

/** Auto-fitted, non-interactive rendering of a diagram (library cards, print cells). */
export function PlayThumb({ diagram, aspect, theme, view, fit, style, className }: PlayThumbProps) {
  const w = view ?? fitWindow(diagramBounds(diagram), aspect, fit);
  return <PlaySvg diagram={diagram} view={w} theme={theme} style={style} className={className} />;
}
