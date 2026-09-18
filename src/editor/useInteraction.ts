'use client';

import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type RefObject } from 'react';
import type { Point } from '@/model/types';
import { UNITS_PER_YARD } from '@/model/constants';
import { fromSvg, panWindow, zoomWindow } from '@/geometry/transform';
import { snapPoint, snapWaypoint } from '@/geometry/snap';
import { bendThrough, resolvePoints, distanceToPolyline, samplePolyline, toSegments } from '@/geometry/path';
import { hashX } from '@/geometry/yards';
import { diagramOf, useEditor } from '@/store/editorStore';
import * as A from '@/store/editorActions';
import { useSettings } from '@/store/settingsStore';
import { parseHit, type Hit } from './hit';

type IState =
  | { mode: 'idle' }
  | { mode: 'down'; origin: Point; screen: Point; hit: Hit; shift: boolean; alt: boolean }
  | { mode: 'dragPlayers'; ids: string[]; primary: string; start: Record<string, Point>; origin: Point }
  | { mode: 'dragPoint'; pathId: string; index: number }
  | { mode: 'dragBend'; pathId: string; index: number }
  | { mode: 'dragAnnotation'; id: string; offset: Point }
  | { mode: 'marquee'; from: Point }
  | { mode: 'panning'; startScreen: Point; startView: { minX: number; maxX: number; minY: number; maxY: number } };

export type Overlay = {
  marquee: { from: Point; to: Point } | null;
  hover: Point | null;
};

const DRAG_PX = 3;

export function useInteraction(svgRef: RefObject<SVGSVGElement | null>) {
  const st = useRef<IState>({ mode: 'idle' });
  const spaceHeld = useRef(false);
  const lastClick = useRef<{ t: number; p: Point } | null>(null);
  const [overlay, setOverlay] = useState<Overlay>({ marquee: null, hover: null });
  // Multi-touch: two fingers pinch to zoom and pan.
  const pointers = useRef(new Map<number, Point>());
  const pinch = useRef<{ d: number; mid: Point } | null>(null);

  const toYards = useCallback(
    (clientX: number, clientY: number): Point => {
      const svg = svgRef.current;
      const view = useEditor.getState().view;
      if (!svg) return { x: 0, y: 0 };
      const ctm = svg.getScreenCTM();
      if (!ctm) return { x: 0, y: 0 };
      const pt = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      return fromSvg({ x: pt.x, y: pt.y }, view);
    },
    [svgRef],
  );

  const pxPerYard = useCallback(() => {
    const ctm = svgRef.current?.getScreenCTM();
    return (ctm?.a ?? 1) * UNITS_PER_YARD;
  }, [svgRef]);

  // Space to pan, tracked globally.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTyping(e.target)) {
        spaceHeld.current = true;
        e.preventDefault();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeld.current = false;
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  // Wheel zoom must be a non-passive native listener.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = useEditor.getState();
      const about = toYards(e.clientX, e.clientY);
      if (e.ctrlKey || !e.shiftKey) {
        const factor = Math.exp(-e.deltaY * 0.0012);
        const next = zoomWindow(s.view, factor, about);
        if (next.maxX - next.minX < 8 || next.maxX - next.minX > 120) return;
        s.setView(next);
      } else {
        const ppy = pxPerYard();
        s.setView(panWindow(s.view, e.deltaY / ppy, 0));
      }
    };
    svg.addEventListener('wheel', onWheel, { passive: false });
    return () => svg.removeEventListener('wheel', onWheel);
  }, [svgRef, toYards, pxPerYard]);

  const snapCtx = useCallback((excludeIds: string[], e: { shiftKey: boolean; altKey: boolean }, origin?: Point) => {
    const d = diagramOf(useEditor.getState().doc);
    const settings = useSettings.getState().settings;
    return {
      others: Object.values(d.players).filter((p) => !excludeIds.includes(p.id)).map((p) => ({ x: p.x, y: p.y })),
      grid: 0.5,
      hashX: hashX(settings.hashPreset),
      symmetry: true,
      disabled: e.altKey,
      axisLock: e.shiftKey && origin ? { origin } : undefined,
    };
  }, []);

  const finishDrawing = useCallback((cancel = false) => {
    const s = useEditor.getState();
    const id = s.drawingPathId;
    if (!id) return;
    const d = diagramOf(s.doc);
    const p = d.paths[id];
    if (cancel || !p || p.points.length < 2) {
      if (p) A.deletePath(id);
    } else {
      s.setSelection({ playerIds: [], pathId: id });
    }
    s.setDrawingPathId(null);
    s.setGuides([]);
    setOverlay({ marquee: null, hover: null });
  }, []);

  const startDrawingFrom = useCallback((playerId: string, tool: string) => {
    const s = useEditor.getState();
    const opts =
      tool === 'block' ? { end: 'tbar' as const, role: 'block' as const }
      : tool === 'motion' ? { end: 'arrow' as const, role: 'motion' as const, line: 'squiggle' as const }
      : {};
    const id = A.startPath(playerId, opts);
    s.setDrawingPathId(id);
    s.setSelection({ playerIds: [], pathId: id });
  }, []);

  const addWaypoint = useCallback(
    (pt: Point, e: { shiftKey: boolean; altKey: boolean }) => {
      const s = useEditor.getState();
      const id = s.drawingPathId;
      if (!id) return;
      const d = diagramOf(s.doc);
      const p = d.paths[id];
      if (!p) return;
      const abs = resolvePoints(p, d.players);
      const prev = abs[abs.length - 1] ?? null;
      const snapped = snapWaypoint(pt, prev, { disabled: e.altKey, axisLock: e.shiftKey, angleSnap: p.role === 'block' ? 45 : undefined }).point;
      const anchor = p.anchor.kind === 'player' ? d.players[p.anchor.playerId] : { x: 0, y: 0 };
      if (prev && Math.hypot(prev.x - snapped.x, prev.y - snapped.y) < 0.2) return;
      A.appendPoint(id, { x: snapped.x - anchor.x, y: snapped.y - anchor.y });
    },
    [],
  );

  const onPointerDown = useCallback(
    (e: RPointerEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const s = useEditor.getState();
      const yd = toYards(e.clientX, e.clientY);
      const hit = parseHit(e.target);
      const screen = { x: e.clientX, y: e.clientY };

      // Second finger down: switch to pinch zoom/pan and abandon any single-finger gesture.
      pointers.current.set(e.pointerId, screen);
      if (e.pointerType === 'touch' && pointers.current.size === 2) {
        svg.setPointerCapture(e.pointerId);
        const [a, b] = [...pointers.current.values()];
        pinch.current = { d: Math.hypot(a.x - b.x, a.y - b.y), mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
        if (st.current.mode === 'dragPlayers' || st.current.mode === 'dragPoint' || st.current.mode === 'dragBend') s.undo();
        st.current = { mode: 'idle' };
        s.setGuides([]);
        setOverlay({ marquee: null, hover: null });
        return;
      }
      if (pinch.current) return;

      // Panning: middle button, pan tool, or space.
      if (e.button === 1 || s.tool === 'pan' || spaceHeld.current) {
        svg.setPointerCapture(e.pointerId);
        st.current = { mode: 'panning', startScreen: screen, startView: s.view };
        e.preventDefault();
        return;
      }
      if (e.button !== 0) return;
      svg.setPointerCapture(e.pointerId);

      // Route drawing in progress: add a waypoint (double-click finishes).
      if (s.drawingPathId) {
        const now = performance.now();
        const lc = lastClick.current;
        const isDouble = lc && now - lc.t < 320 && Math.hypot(lc.p.x - screen.x, lc.p.y - screen.y) < 6;
        lastClick.current = { t: now, p: screen };
        if (isDouble) finishDrawing();
        else addWaypoint(yd, e);
        return;
      }

      // Drawing tools: click a player to start.
      if (s.tool === 'route' || s.tool === 'block' || s.tool === 'motion') {
        if (hit.kind === 'player') {
          startDrawingFrom(hit.id, s.tool);
          lastClick.current = { t: performance.now(), p: screen };
        } else if (hit.kind === 'bg' && s.doc?.kind === 'play') {
          const id = A.startFreePath(snapWaypoint(yd, null, { disabled: e.altKey }).point, s.tool === 'block' ? { end: 'tbar', role: 'block' } : s.tool === 'motion' ? { role: 'motion', line: 'squiggle' } : { role: 'free' });
          s.setDrawingPathId(id);
          s.setSelection({ playerIds: [], pathId: id });
          lastClick.current = { t: performance.now(), p: screen };
        }
        return;
      }

      if (s.tool === 'text') {
        if (s.doc?.kind === 'play' && (hit.kind === 'bg' || hit.kind === 'none')) {
          const pt = snapWaypoint(yd, null, { grid: 0.25 }).point;
          A.addAnnotation({ kind: 'text', x: pt.x, y: pt.y, text: 'TEXT', style: 'redCaps', size: 'md' });
          s.setTool('select');
        }
        return;
      }

      // Select tool.
      st.current = { mode: 'down', origin: yd, screen, hit, shift: e.shiftKey, alt: e.altKey };
    },
    [svgRef, toYards, finishDrawing, addWaypoint, startDrawingFrom],
  );

  const onPointerMove = useCallback(
    (e: RPointerEvent<SVGSVGElement>) => {
      const s = useEditor.getState();
      const cur = st.current;
      const yd = toYards(e.clientX, e.clientY);

      if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.current) {
        if (pointers.current.size < 2) return;
        const [a, b] = [...pointers.current.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const prev = pinch.current;
        const ppy = pxPerYard();
        let view = s.view;
        if (prev.d > 0 && d > 0) {
          const factor = d / prev.d;
          const w = view.maxX - view.minX;
          if ((factor > 1 && w / factor >= 8) || (factor < 1 && w / factor <= 120)) view = zoomWindow(view, factor, toYards(mid.x, mid.y));
        }
        view = panWindow(view, -(mid.x - prev.mid.x) / ppy, (mid.y - prev.mid.y) / ppy);
        s.setView(view);
        pinch.current = { d, mid };
        return;
      }

      if (s.drawingPathId) {
        setOverlay((o) => ({ ...o, hover: yd }));
        return;
      }

      switch (cur.mode) {
        case 'down': {
          const dist = Math.hypot(e.clientX - cur.screen.x, e.clientY - cur.screen.y);
          if (dist < DRAG_PX) return;
          const d = diagramOf(s.doc);
          if (cur.hit.kind === 'player') {
            const ids = s.selection.playerIds.includes(cur.hit.id) ? s.selection.playerIds : [cur.hit.id];
            if (!s.selection.playerIds.includes(cur.hit.id)) s.setSelection({ playerIds: [cur.hit.id] });
            const start: Record<string, Point> = {};
            for (const id of ids) {
              const p = d.players[id];
              if (p) start[id] = { x: p.x, y: p.y };
            }
            s.checkpoint();
            st.current = { mode: 'dragPlayers', ids, primary: cur.hit.id, start, origin: cur.origin };
          } else if (cur.hit.kind === 'point') {
            s.checkpoint();
            s.setSelection({ playerIds: [], pathId: cur.hit.pathId, pointIndex: cur.hit.index });
            st.current = { mode: 'dragPoint', pathId: cur.hit.pathId, index: cur.hit.index };
          } else if (cur.hit.kind === 'mid') {
            s.checkpoint();
            s.setSelection({ playerIds: [], pathId: cur.hit.pathId });
            st.current = { mode: 'dragBend', pathId: cur.hit.pathId, index: cur.hit.index };
          } else if (cur.hit.kind === 'ann') {
            const a = d.annotations[cur.hit.id];
            s.checkpoint();
            s.setSelection({ playerIds: [], annotationId: cur.hit.id });
            st.current = { mode: 'dragAnnotation', id: cur.hit.id, offset: a ? { x: a.x - cur.origin.x, y: a.y - cur.origin.y } : { x: 0, y: 0 } };
          } else {
            st.current = { mode: 'marquee', from: cur.origin };
            setOverlay({ marquee: { from: cur.origin, to: yd }, hover: null });
          }
          return;
        }
        case 'dragPlayers': {
          const raw = { x: cur.start[cur.primary].x + (yd.x - cur.origin.x), y: cur.start[cur.primary].y + (yd.y - cur.origin.y) };
          const snapped = snapPoint(raw, snapCtx(cur.ids, e, cur.start[cur.primary]));
          const dx = snapped.point.x - cur.start[cur.primary].x;
          const dy = snapped.point.y - cur.start[cur.primary].y;
          const pos: Record<string, Point> = {};
          for (const id of cur.ids) pos[id] = { x: round3(cur.start[id].x + dx), y: round3(cur.start[id].y + dy) };
          A.setPlayerPositionsLive(pos);
          s.setGuides(snapped.guides);
          return;
        }
        case 'dragPoint': {
          const d = diagramOf(s.doc);
          const p = d.paths[cur.pathId];
          if (!p) return;
          const abs = resolvePoints(p, d.players);
          const prev = cur.index > 0 ? abs[cur.index - 1] : null;
          const snapped = snapWaypoint(yd, prev, { disabled: e.altKey, axisLock: e.shiftKey, angleSnap: p.role === 'block' && !p.points[cur.index]?.bend ? 45 : undefined });
          const anchor = p.anchor.kind === 'player' ? d.players[p.anchor.playerId] : { x: 0, y: 0 };
          A.setPoint(cur.pathId, cur.index, { x: round3(snapped.point.x - anchor.x), y: round3(snapped.point.y - anchor.y) }, true);
          s.setGuides(snapped.guides);
          return;
        }
        case 'dragBend': {
          const d = diagramOf(s.doc);
          const p = d.paths[cur.pathId];
          if (!p || cur.index === 0) return;
          const abs = resolvePoints(p, d.players);
          const a = abs[cur.index - 1];
          const b = abs[cur.index];
          if (!a || !b) return;
          const anchor = p.anchor.kind === 'player' ? d.players[p.anchor.playerId] : { x: 0, y: 0 };
          // Already curved: the handle IS the apex control point (FirstDown style), so it follows the pointer.
          // Straight: dragging the midpoint starts the curve through the pointer.
          const bend = p.points[cur.index].bend ? bendThrough(a, b, { x: (a.x + b.x) / 4 + yd.x / 2, y: (a.y + b.y) / 4 + yd.y / 2 }) : bendThrough(a, b, yd);
          A.setBend(cur.pathId, cur.index, bend ? { x: round3(bend.x - anchor.x), y: round3(bend.y - anchor.y) } : undefined, true);
          return;
        }
        case 'dragAnnotation': {
          const pt = snapWaypoint({ x: yd.x + cur.offset.x, y: yd.y + cur.offset.y }, null, { grid: 0.25, disabled: e.altKey }).point;
          A.moveAnnotationLive(cur.id, pt);
          return;
        }
        case 'marquee':
          setOverlay({ marquee: { from: cur.from, to: yd }, hover: null });
          return;
        case 'panning': {
          const ppy = pxPerYard();
          const dx = -(e.clientX - cur.startScreen.x) / ppy;
          const dy = (e.clientY - cur.startScreen.y) / ppy;
          s.setView(panWindow(cur.startView, dx, dy));
          return;
        }
      }
    },
    [toYards, snapCtx, pxPerYard],
  );

  const onPointerUp = useCallback(
    (e: RPointerEvent<SVGSVGElement>) => {
      const s = useEditor.getState();
      const cur = st.current;
      const yd = toYards(e.clientX, e.clientY);
      pointers.current.delete(e.pointerId);
      if (pinch.current) {
        if (pointers.current.size < 2) pinch.current = null;
        st.current = { mode: 'idle' };
        return;
      }
      st.current = { mode: 'idle' };
      s.setGuides([]);
      if (s.drawingPathId) return;

      switch (cur.mode) {
        case 'down': {
          const h = cur.hit;
          if (h.kind === 'player') {
            if (cur.shift) {
              const ids = s.selection.playerIds.includes(h.id) ? s.selection.playerIds.filter((x) => x !== h.id) : [...s.selection.playerIds, h.id];
              s.setSelection({ playerIds: ids });
            } else s.setSelection({ playerIds: [h.id] });
          } else if (h.kind === 'path') s.setSelection({ playerIds: [], pathId: h.id });
          else if (h.kind === 'point') s.setSelection({ playerIds: [], pathId: h.pathId, pointIndex: h.index });
          else if (h.kind === 'mid') s.setSelection({ playerIds: [], pathId: h.pathId });
          else if (h.kind === 'ann') s.setSelection({ playerIds: [], annotationId: h.id });
          else if (!cur.shift) s.clearSelection();
          break;
        }
        case 'marquee': {
          const d = diagramOf(s.doc);
          const x1 = Math.min(cur.from.x, yd.x);
          const x2 = Math.max(cur.from.x, yd.x);
          const y1 = Math.min(cur.from.y, yd.y);
          const y2 = Math.max(cur.from.y, yd.y);
          const ids = Object.values(d.players).filter((p) => p.x >= x1 && p.x <= x2 && p.y >= y1 && p.y <= y2).map((p) => p.id);
          s.setSelection({ playerIds: e.shiftKey ? Array.from(new Set([...s.selection.playerIds, ...ids])) : ids });
          setOverlay({ marquee: null, hover: null });
          break;
        }
        default:
          break;
      }
    },
    [toYards],
  );

  const onDoubleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const s = useEditor.getState();
      if (s.drawingPathId || s.tool !== 'select') return;
      const hit = parseHit(e.target);
      if (hit.kind === 'player' && s.doc?.kind === 'play') {
        startDrawingFrom(hit.id, 'route');
        lastClick.current = null;
      } else if (hit.kind === 'path') {
        // Insert a waypoint on the nearest segment.
        const d = diagramOf(s.doc);
        const p = d.paths[hit.id];
        if (!p) return;
        const yd = toYards(e.clientX, e.clientY);
        const abs = resolvePoints(p, d.players);
        let best = 0;
        let bestD = Infinity;
        for (let i = 0; i < abs.length - 1; i++) {
          const poly = samplePolyline(toSegments([abs[i], abs[i + 1]]), 0.25);
          const dist = distanceToPolyline(yd, poly);
          if (dist < bestD) {
            bestD = dist;
            best = i;
          }
        }
        const anchor = p.anchor.kind === 'player' ? d.players[p.anchor.playerId] : { x: 0, y: 0 };
        A.insertPoint(hit.id, best, { x: round3(yd.x - anchor.x), y: round3(yd.y - anchor.y) });
        s.setSelection({ playerIds: [], pathId: hit.id, pointIndex: best + 1 });
      }
    },
    [startDrawingFrom, toYards],
  );

  return { onPointerDown, onPointerMove, onPointerUp, onDoubleClick, overlay, finishDrawing, startDrawingFrom };
}

const round3 = (n: number) => Math.round(n * 1000) / 1000;

export function isTyping(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable;
}
