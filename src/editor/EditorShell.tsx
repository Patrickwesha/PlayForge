'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { repo } from '@/store/repo';
import { useEditor, type EditorDoc } from '@/store/editorStore';
import { saveNow, useAutosave } from '@/store/autosave';
import { useSettings } from '@/store/settingsStore';
import { duplicateFormation, duplicatePlay } from '@/model/factories';
import { exportSvgAsPng } from '@/print/exportPng';
import * as A from '@/store/editorActions';
import { Canvas } from './Canvas';
import { Inspector } from './Inspector';
import { ToolRail } from './ToolRail';
import { useShortcuts } from './useShortcuts';
import { diagramOf } from '@/store/editorStore';
import { diagramBounds, fitWindow } from '@/geometry/bounds';
import type { ViewWindow } from '@/model/types';

export function EditorShell({ kind, id }: { kind: 'play' | 'formation'; id: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing'>('loading');
  const { doc, dirty, savedAt } = useEditor(useShallow((s) => ({ doc: s.doc, dirty: s.dirty, savedAt: s.savedAt })));
  const loadSettings = useSettings((s) => s.load);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const row = kind === 'play' ? await repo.getPlay(id) : await repo.getFormation(id);
      if (!alive) return;
      if (!row) {
        setStatus('missing');
        return;
      }
      const d: EditorDoc = kind === 'play' ? { kind: 'play', play: row as never } : { kind: 'formation', formation: row as never };
      const savedView = kind === 'play' ? (row as { view?: ViewWindow }).view : undefined;
      useEditor.getState().load(d, savedView ?? fitWindow(diagramBounds(diagramOf(d)), 1.6, { pad: 3, minW: 34, maxDown: 18 }));
      setStatus('ready');
    })();
    return () => {
      alive = false;
      useEditor.getState().unload();
    };
  }, [kind, id]);

  useAutosave();

  const finishDrawing = useCallback((cancel = false) => {
    const s = useEditor.getState();
    const pid = s.drawingPathId;
    if (!pid) return;
    const p = diagramOf(s.doc).paths[pid];
    if (cancel || !p || p.points.length < 2) {
      if (p) A.deletePath(pid);
    } else s.setSelection({ playerIds: [], pathId: pid });
    s.setDrawingPathId(null);
  }, []);

  useShortcuts({ onSave: () => void saveNow(), onFinishDrawing: finishDrawing });

  const onDuplicate = async () => {
    const s = useEditor.getState();
    if (!s.doc) return;
    await saveNow();
    if (s.doc.kind === 'play') {
      const copy = duplicatePlay(s.doc.play);
      await repo.savePlay(copy);
      router.push(`/plays/${copy.id}`);
    } else {
      const copy = duplicateFormation(s.doc.formation);
      await repo.saveFormation(copy);
      router.push(`/formations/${copy.id}`);
    }
  };

  const onPng = async () => {
    useEditor.getState().clearSelection();
    await new Promise((r) => setTimeout(r, 30));
    const svg = document.querySelector<SVGSVGElement>('[data-editor-svg]');
    if (!svg || !doc) return;
    const name = doc.kind === 'play' ? doc.play.name : doc.formation.name;
    const rect = svg.getBoundingClientRect();
    await exportSvgAsPng(svg, name, Math.round(rect.width), Math.round(rect.height));
  };

  if (status === 'missing') {
    return (
      <div className="p-8">
        <p>That {kind} no longer exists.</p>
        <Link className="underline" href={kind === 'play' ? '/plays' : '/formations'}>Back to {kind}s</Link>
      </div>
    );
  }
  if (status === 'loading' || !doc) return <div className="p-8 text-neutral-500">Loading…</div>;

  const title = doc.kind === 'play' ? doc.play.name : doc.formation.name;
  const back = doc.kind === 'play' ? '/plays' : '/formations';

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="h-11 shrink-0 flex items-center gap-3 px-3 bg-white border-b border-neutral-300 text-sm">
        <Link href={back} className="text-neutral-500 hover:text-black">&larr; {doc.kind === 'play' ? 'Plays' : 'Formations'}</Link>
        <span className="font-bold truncate">{title || '(untitled)'}</span>
        <span className="text-xs text-neutral-500">{dirty ? 'Unsaved changes…' : savedAt ? 'Saved' : ''}</span>
        <div className="ml-auto flex items-center gap-2">
          <button className="text-xs px-2 py-1 rounded border border-neutral-300 hover:border-black" onClick={() => void saveNow()}>Save</button>
          <button className="text-xs px-2 py-1 rounded border border-neutral-300 hover:border-black" onClick={() => void onDuplicate()}>Duplicate</button>
          <button className="text-xs px-2 py-1 rounded border border-neutral-300 hover:border-black" onClick={() => void onPng()}>Export PNG</button>
          {doc.kind === 'play' && (
            <Link href={`/print?play=${doc.play.id}&layout=1up`} className="text-xs px-2 py-1 rounded bg-black text-white">Print</Link>
          )}
          {doc.kind === 'formation' && (
            <Link href={`/print?formations=${doc.formation.id}&layout=4up`} className="text-xs px-2 py-1 rounded bg-black text-white">Print</Link>
          )}
        </div>
      </div>
      <div className="flex-1 flex min-h-0">
        <ToolRail />
        <Canvas />
        <Inspector />
      </div>
    </div>
  );
}
