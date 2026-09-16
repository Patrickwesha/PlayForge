import type { ReactNode } from 'react';
import { COLORS } from '@/model/constants';
import type { ViewWindow } from '@/model/types';
import { toSvg, yd } from '@/geometry/transform';
import { hashX, sidelinesInWindow, yardLines, yardTicks } from '@/geometry/yards';
import type { RenderTheme } from './theme';

export function FieldLayer({ view, theme }: { view: ViewWindow; theme: RenderTheme }) {
  const left = toSvg({ x: view.minX, y: 0 }, view).x;
  const right = toSvg({ x: view.maxX, y: 0 }, view).x;
  const items: ReactNode[] = [];

  if (theme.theme === 'yardlines') {
    for (const y of yardLines(view)) {
      const sy = toSvg({ x: 0, y }, view).y;
      items.push(<line key={`yl${y}`} x1={left} x2={right} y1={sy} y2={sy} stroke={COLORS.yardline} strokeWidth={yd(0.05)} />);
    }
    const hx = hashX(theme.hashPreset);
    const tickHalf = yd(0.35);
    for (const y of yardTicks(view)) {
      if (y % 5 === 0) continue;
      const sy = toSvg({ x: 0, y }, view).y;
      for (const x of [-hx, hx]) {
        if (x < view.minX || x > view.maxX) continue;
        const sx = toSvg({ x, y }, view).x;
        items.push(<line key={`h${x}_${y}`} x1={sx - tickHalf} x2={sx + tickHalf} y1={sy} y2={sy} stroke={COLORS.yardline} strokeWidth={yd(0.06)} />);
      }
    }
    for (const x of sidelinesInWindow(view)) {
      const sx = toSvg({ x, y: 0 }, view).x;
      const top = toSvg({ x, y: view.maxY }, view).y;
      const bottom = toSvg({ x, y: view.minY }, view).y;
      items.push(<line key={`sl${x}`} x1={sx} x2={sx} y1={top} y2={bottom} stroke={COLORS.los} strokeWidth={yd(0.08)} />);
    }
  }

  if (theme.showLos) {
    const sy = toSvg({ x: 0, y: 0 }, view).y;
    items.push(<line key="los" x1={left} x2={right} y1={sy} y2={sy} stroke={COLORS.los} strokeWidth={yd(0.09)} />);
  }

  return <g data-layer="field">{items}</g>;
}
