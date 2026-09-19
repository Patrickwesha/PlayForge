'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { COLORS } from '@/model/constants';
import { matchAspect, toSvg, windowAspect, yd } from '@/geometry/transform';
import { resolvePoints, segmentMidpoints } from '@/geometry/path';
import { PlaySvg } from '@/render/PlaySvg';
import { themeFor } from '@/render/theme';
import { diagramOf, useEditor } from '@/store/editorStore';
import { useSettings } from '@/store/settingsStore';
import { useInteraction } from './useInteraction';
import { MiniToolbar } from './MiniToolbar';
import { useCoarsePointer } from './useCoarsePointer';

export function Canvas() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const { doc, view, selection, guides, tool, drawingPathId } = useEditor(
    useShallow((s) => ({ doc: s.doc, view: s.view, selection: s.selection, guides: s.guides, tool: s.tool, drawingPathId: s.drawingPathId })),
  );
  const settings = useSettings((s) => s.settings);
  const { onPointerDown, onPointerMove, onPointerUp, onDoubleClick, overlay, finishDrawing } = useInteraction(svgRef);

  const diagram = diagramOf(doc);
  const theme = themeFor(settings.theme, settings.hashPreset);

  // Keep the view window at the container's aspect so the SVG fills the canvas (no letterboxing).
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const apply = () => {
      const r = el.getBoundingClientRect();
      if (r.width < 10 || r.height < 10) return;
      const s = useEditor.getState();
      const aspect = r.width / r.height;
      if (Math.abs(windowAspect(s.view) - aspect) > 0.002) s.setView(matchAspect(s.view, aspect));
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [doc]);
  const selectedIds = useMemo(() => new Set(selection.playerIds), [selection.playerIds]);

  const cursor = tool === 'pan' ? 'grab' : tool === 'select' ? 'default' : 'crosshair';

  // ---- overlay: guides, marquee, handles, rubber band ----
  const left = toSvg({ x: view.minX, y: 0 }, view).x;
  const right = toSvg({ x: view.maxX, y: 0 }, view).x;
  const top = toSvg({ x: 0, y: view.maxY }, view).y;
  const bottom = toSvg({ x: 0, y: view.minY }, view).y;

  const guideEls = guides.map((g, i) => {
    if (g.axis === 'x') {
      const x = toSvg({ x: g.value, y: 0 }, view).x;
      if (g.kind === 'spacing' && g.ref !== undefined) {
        // short dimension bar from the neighbour to the snapped slot, drawn just above the row
        const rowY = guides.find((q) => q.axis === 'y')?.value;
        const yv = rowY ?? 0;
        const y = toSvg({ x: 0, y: yv }, view).y - yd(0.8);
        const rx = toSvg({ x: g.ref, y: 0 }, view).x;
        return (
          <g key={i} stroke={COLORS.orange} strokeWidth={yd(0.05)}>
            <line x1={rx} x2={x} y1={y} y2={y} />
            <line x1={rx} x2={rx} y1={y - yd(0.2)} y2={y + yd(0.2)} />
            <line x1={x} x2={x} y1={y - yd(0.2)} y2={y + yd(0.2)} />
          </g>
        );
      }
      return <line key={i} x1={x} x2={x} y1={top} y2={bottom} stroke={COLORS.guide} strokeWidth={yd(0.04)} strokeDasharray={`${yd(0.25)} ${yd(0.15)}`} />;
    }
    const y = toSvg({ x: 0, y: g.value }, view).y;
    return <line key={i} x1={left} x2={right} y1={y} y2={y} stroke={COLORS.guide} strokeWidth={yd(0.04)} strokeDasharray={`${yd(0.25)} ${yd(0.15)}`} />;
  });

  const selPath = selection.pathId ? diagram.paths[selection.pathId] : undefined;
  const selAbs = selPath ? resolvePoints(selPath, diagram.players) : [];
  // touch screens get bigger handles and hit areas (in yards, so they scale with zoom)
  const coarse = useCoarsePointer();
  const handleR = coarse ? 0.26 : 0.17;
  const hitR = coarse ? 0.75 : 0.45;
  const handleEls = selPath
    ? [
        // Apex handles (FirstDown style): a curved segment shows its control point as a hollow circle
        // tied to the arc; a straight segment shows a small diamond at its midpoint. Drag either to bend.
        ...segmentMidpoints(selAbs).map((m, i) => {
          const endPt = selAbs[i + 1];
          const bend = endPt?.bend;
          if (bend) {
            const anchorPt = selPath.anchor.kind === 'player' ? diagram.players[selPath.anchor.playerId] : { x: 0, y: 0 };
            const c = toSvg({ x: bend.x + anchorPt.x, y: bend.y + anchorPt.y }, view);
            const s = toSvg(m, view);
            return (
              <g key={`m${i}`} data-hit={`mid:${selPath.id}:${i + 1}`} style={{ cursor: 'move' }}>
                <line x1={s.x} y1={s.y} x2={c.x} y2={c.y} stroke={COLORS.selection} strokeWidth={yd(0.03)} strokeDasharray={`${yd(0.12)} ${yd(0.1)}`} style={{ pointerEvents: 'none' }} />
                <circle cx={c.x} cy={c.y} r={yd(hitR)} fill="transparent" />
                <circle cx={c.x} cy={c.y} r={yd(handleR * 1.1)} fill={COLORS.paper} stroke={COLORS.selection} strokeWidth={yd(0.06)} />
              </g>
            );
          }
          // smooth spline segments have no midpoint handle: shape them by moving the points
          if (endPt?.smooth || selAbs[i]?.smooth) return null;
          const s = toSvg(m, view);
          return (
            <g key={`m${i}`} data-hit={`mid:${selPath.id}:${i + 1}`} style={{ cursor: 'move' }}>
              <circle cx={s.x} cy={s.y} r={yd(hitR)} fill="transparent" />
              <rect x={s.x - yd(handleR * 0.8)} y={s.y - yd(handleR * 0.8)} width={yd(handleR * 1.6)} height={yd(handleR * 1.6)} transform={`rotate(45 ${s.x} ${s.y})`} fill={COLORS.paper} stroke={COLORS.selection} strokeWidth={yd(0.05)} />
            </g>
          );
        }),
        ...selAbs.map((pt, i) => {
          const s = toSvg(pt, view);
          const active = selection.pointIndex === i;
          return (
            <g key={i} data-hit={`point:${selPath.id}:${i}`} style={{ cursor: 'move' }}>
              <circle cx={s.x} cy={s.y} r={yd(hitR)} fill="transparent" />
              <circle cx={s.x} cy={s.y} r={yd(active ? handleR * 1.3 : handleR)} fill={COLORS.selection} stroke={COLORS.paper} strokeWidth={yd(0.04)} />
            </g>
          );
        }),
      ]
    : null;

  let rubber: React.ReactNode = null;
  if (drawingPathId && overlay.hover) {
    const p = diagram.paths[drawingPathId];
    if (p) {
      const abs = resolvePoints(p, diagram.players);
      const last = abs[abs.length - 1];
      if (last) {
        const a = toSvg(last, view);
        const b = toSvg(overlay.hover, view);
        rubber = <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={COLORS.selection} strokeWidth={yd(0.06)} strokeDasharray={`${yd(0.3)} ${yd(0.2)}`} />;
      }
    }
  }

  let marquee: React.ReactNode = null;
  if (overlay.marquee) {
    const a = toSvg(overlay.marquee.from, view);
    const b = toSvg(overlay.marquee.to, view);
    marquee = (
      <rect x={Math.min(a.x, b.x)} y={Math.min(a.y, b.y)} width={Math.abs(a.x - b.x)} height={Math.abs(a.y - b.y)} fill="rgba(45,127,249,0.08)" stroke={COLORS.selection} strokeWidth={yd(0.04)} />
    );
  }

  return (
    <div ref={wrapRef} className="relative flex-1 min-h-0 min-w-0 bg-neutral-200 overflow-hidden select-none" style={{ touchAction: 'none' }}>
      <PlaySvg
        diagram={diagram}
        view={view}
        theme={theme}
        selectedPlayerIds={selectedIds}
        selectedPathId={selection.pathId}
        selectedAnnotationId={selection.annotationId}
        svgRef={svgRef}
        style={{ cursor }}
        svgProps={{ 'data-editor-svg': '', onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onDoubleClick, onContextMenu: (e) => e.preventDefault() } as React.SVGProps<SVGSVGElement>}
        overlay={
          <g data-layer="overlay" style={{ pointerEvents: 'none' }}>
            {guideEls}
            {rubber}
            {marquee}
            <g style={{ pointerEvents: 'all' }}>{handleEls}</g>
          </g>
        }
      />
      {drawingPathId && (
        <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black text-white text-xs px-3 py-1.5 rounded shadow">
          Click to add points &middot; double-click or Enter to finish &middot; Backspace = undo point &middot; Esc = cancel &middot; then drag a segment&apos;s middle handle to bend it
          <button className="ml-3 underline" onClick={() => finishDrawing()}>
            Done
          </button>
        </div>
      )}
      <MiniToolbar svgRef={svgRef} wrapRef={wrapRef} />
    </div>
  );
}
