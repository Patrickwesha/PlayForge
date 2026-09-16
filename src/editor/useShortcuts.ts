'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { diagramOf, useEditor } from '@/store/editorStore';
import * as A from '@/store/editorActions';
import { useSettings } from '@/store/settingsStore';
import { diagramBounds, fitWindow } from '@/geometry/bounds';
import { windowAspect } from '@/geometry/transform';
import { DEFAULT_WINDOW } from '@/model/constants';
import { isTyping } from './useInteraction';

export function useShortcuts(opts: { onSave: () => void; onFinishDrawing: (cancel?: boolean) => void }) {
  const router = useRouter();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      const s = useEditor.getState();
      if (!s.doc) return;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      const isPlay = s.doc.kind === 'play';

      if (mod && key === 'z' && !e.shiftKey) { e.preventDefault(); s.undo(); return; }
      if ((mod && key === 'y') || (mod && key === 'z' && e.shiftKey)) { e.preventDefault(); s.redo(); return; }
      if (mod && key === 's') { e.preventDefault(); opts.onSave(); return; }
      if (mod && key === 'p') { e.preventDefault(); if (s.doc.kind === 'play') router.push(`/print?play=${s.doc.play.id}&layout=1up`); return; }
      if (mod && key === 'a') { e.preventDefault(); s.setSelection({ playerIds: Object.keys(diagramOf(s.doc).players) }); return; }
      if (mod && key === 'd') { e.preventDefault(); if (s.selection.playerIds.length) A.duplicatePlayers(s.selection.playerIds); return; }
      if (mod && key === '0') { e.preventDefault(); s.setView(fitWindow(diagramBounds(diagramOf(s.doc)), windowAspect(s.view), { pad: 2 })); return; }
      if (mod && key === '1') { e.preventDefault(); s.setView({ ...DEFAULT_WINDOW }); return; }
      if (mod) return;

      if (s.drawingPathId) {
        if (e.key === 'Enter') { e.preventDefault(); opts.onFinishDrawing(); return; }
        if (e.key === 'Escape') { e.preventDefault(); opts.onFinishDrawing(true); return; }
        if (e.key === 'Backspace') { e.preventDefault(); A.removeLastPoint(s.drawingPathId); return; }
        if (key === 'c') {
          const p = diagramOf(s.doc).paths[s.drawingPathId];
          if (p && p.points.length > 1) A.togglePointSmooth(s.drawingPathId, p.points.length - 1);
          return;
        }
        return;
      }

      if (e.key === 'Escape') { s.clearSelection(); s.setTool('select'); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        const sel = s.selection;
        if (sel.pathId && sel.pointIndex !== undefined && sel.pointIndex > 0) A.deletePoint(sel.pathId, sel.pointIndex);
        else if (sel.pathId) A.deletePath(sel.pathId);
        else if (sel.annotationId) A.deleteAnnotation(sel.annotationId);
        else if (sel.playerIds.length) A.deletePlayers(sel.playerIds);
        return;
      }
      if (e.key.startsWith('Arrow') && s.selection.playerIds.length) {
        e.preventDefault();
        const step = e.shiftKey ? 1 : 0.5;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? step : e.key === 'ArrowDown' ? -step : 0;
        A.nudgePlayers(s.selection.playerIds, dx, dy);
        return;
      }
      if (/^[0-9]$/.test(e.key) && isPlay && s.selection.playerIds.length) {
        A.applyRouteTreeTo(Number(e.key), s.selection.playerIds);
        return;
      }
      switch (key) {
        case 'v': s.setTool('select'); break;
        case 'r': if (isPlay) s.setTool('route'); break;
        case 'b': if (isPlay) s.setTool('block'); break;
        case 'm': if (isPlay) s.setTool('motion'); break;
        case 't': if (isPlay) s.setTool('text'); break;
        case 'h': s.setTool('pan'); break;
        case 'f': A.flipDocument(useSettings.getState().settings.flipSwapsXZ); break;
        case 'p': if (s.selection.pathId) { const p = diagramOf(s.doc).paths[s.selection.pathId]; if (p) A.updatePath(p.id, { primary: !p.primary }); } break;
        case 's': if (s.selection.pathId && s.selection.pointIndex) A.togglePointSmooth(s.selection.pathId, s.selection.pointIndex); break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opts, router]);
}
