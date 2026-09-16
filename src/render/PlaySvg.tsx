import type { CSSProperties, ReactNode, Ref, SVGProps } from 'react';
import type { Diagram, ViewWindow } from '@/model/types';
import { viewBox } from '@/geometry/transform';
import { COLORS } from '@/model/constants';
import { AnnotationLayer } from './AnnotationLayer';
import { FieldLayer } from './FieldLayer';
import { PathLayer } from './PathLayer';
import { PlayerLayer } from './PlayerLayer';
import { DEFAULT_RENDER_THEME, type RenderTheme } from './theme';

export type PlaySvgProps = {
  diagram: Diagram;
  view: ViewWindow;
  theme?: RenderTheme;
  selectedPlayerIds?: ReadonlySet<string>;
  selectedPathId?: string;
  selectedAnnotationId?: string;
  /** Rendered last, in the same SVG coordinate space (guides, handles). */
  overlay?: ReactNode;
  /** Extra props for the root svg (pointer handlers, etc.). */
  svgProps?: SVGProps<SVGSVGElement>;
  svgRef?: Ref<SVGSVGElement>;
  style?: CSSProperties;
  className?: string;
  background?: boolean;
};

/**
 * The single renderer used by the editor, thumbnails, print cells, and PNG export.
 * Pure: no DOM access, inline attributes only.
 */
export function PlaySvg({
  diagram,
  view,
  theme = DEFAULT_RENDER_THEME,
  selectedPlayerIds,
  selectedPathId,
  selectedAnnotationId,
  overlay,
  svgProps,
  svgRef,
  style,
  className,
  background = true,
}: PlaySvgProps) {
  return (
    <svg
      ref={svgRef}
      xmlns="http://www.w3.org/2000/svg"
      viewBox={viewBox(view)}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      style={{ display: 'block', width: '100%', height: '100%', ...style }}
      {...svgProps}
    >
      {background && <rect x={0} y={0} width="100%" height="100%" fill={COLORS.paper} data-hit="bg" />}
      <FieldLayer view={view} theme={theme} />
      <PathLayer diagram={diagram} view={view} selectedPathId={selectedPathId} />
      <AnnotationLayer annotations={diagram.annotations} view={view} selectedId={selectedAnnotationId} />
      <PlayerLayer players={diagram.players} view={view} selectedIds={selectedPlayerIds} />
      {overlay}
    </svg>
  );
}
