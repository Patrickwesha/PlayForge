'use client';

import { useShallow } from 'zustand/react/shallow';
import { useEditor, type Tool } from '@/store/editorStore';
import * as A from '@/store/editorActions';
import { useSettings } from '@/store/settingsStore';
import { diagramBounds, fitWindow } from '@/geometry/bounds';
import { diagramOf } from '@/store/editorStore';
import { windowAspect } from '@/geometry/transform';
import { DEFAULT_WINDOW } from '@/model/constants';

const TOOLS: { id: Tool; label: string; key: string; title: string; playOnly?: boolean }[] = [
  { id: 'select', label: 'Select', key: 'V', title: 'Select and move (V)' },
  { id: 'route', label: 'Route', key: 'R', title: 'Draw a route from a player (R)', playOnly: true },
  { id: 'block', label: 'Block', key: 'B', title: 'Draw a block ending in a T (B)', playOnly: true },
  { id: 'motion', label: 'Motion', key: 'M', title: 'Draw a motion squiggle (M)', playOnly: true },
  { id: 'text', label: 'Text', key: 'T', title: 'Place red-caps text (T)', playOnly: true },
  { id: 'pan', label: 'Pan', key: 'H', title: 'Pan the field (H, or hold Space)' },
];

export function ToolRail() {
  const { tool, setTool, doc, past, future, undo, redo } = useEditor(
    useShallow((s) => ({ tool: s.tool, setTool: s.setTool, doc: s.doc, past: s.past, future: s.future, undo: s.undo, redo: s.redo })),
  );
  const flipSwapsXZ = useSettings((s) => s.settings.flipSwapsXZ);
  const isPlay = doc?.kind === 'play';
  const b = 'w-14 h-12 flex flex-col items-center justify-center rounded text-[11px] leading-tight';

  const fit = () => {
    const s = useEditor.getState();
    const bb = diagramBounds(diagramOf(s.doc));
    s.setView(fitWindow(bb, windowAspect(s.view), { pad: 2 }));
  };

  return (
    <aside className="w-16 shrink-0 bg-neutral-900 text-white flex flex-col items-center py-2 gap-1 overflow-y-auto">
      {TOOLS.filter((t) => isPlay || !t.playOnly).map((t) => (
        <button key={t.id} title={t.title} onClick={() => setTool(t.id)} className={`${b} ${tool === t.id ? 'bg-white text-black' : 'hover:bg-neutral-700'}`}>
          <span className="font-semibold">{t.label}</span>
          <span className="opacity-60">{t.key}</span>
        </button>
      ))}
      <div className="h-px w-10 bg-neutral-700 my-1" />
      <button title="Undo (Ctrl+Z)" disabled={past.length === 0} onClick={undo} className={`${b} hover:bg-neutral-700 disabled:opacity-30`}>
        <span className="font-semibold">Undo</span>
        <span className="opacity-60">{past.length}</span>
      </button>
      <button title="Redo (Ctrl+Y)" disabled={future.length === 0} onClick={redo} className={`${b} hover:bg-neutral-700 disabled:opacity-30`}>
        <span className="font-semibold">Redo</span>
      </button>
      <div className="h-px w-10 bg-neutral-700 my-1" />
      <button title="Flip left/right (F)" onClick={() => A.flipDocument(flipSwapsXZ)} className={`${b} hover:bg-neutral-700`}>
        <span className="font-semibold">Flip</span>
        <span className="opacity-60">F</span>
      </button>
      <button title="Fit to content (Ctrl+0)" onClick={fit} className={`${b} hover:bg-neutral-700`}>
        <span className="font-semibold">Fit</span>
        <span className="opacity-60">^0</span>
      </button>
      <button title="Default view (Ctrl+1)" onClick={() => useEditor.getState().setView({ ...DEFAULT_WINDOW })} className={`${b} hover:bg-neutral-700`}>
        <span className="font-semibold">Reset</span>
        <span className="opacity-60">^1</span>
      </button>
    </aside>
  );
}
