'use client';

import { create } from 'zustand';
import { produce } from 'immer';
import type { Diagram, Formation, Play, ViewWindow } from '@/model/types';
import { DEFAULT_WINDOW } from '@/model/constants';
import type { SnapGuide } from '@/geometry/snap';

export type EditorDoc = { kind: 'play'; play: Play } | { kind: 'formation'; formation: Formation };

export type Selection = {
  playerIds: string[];
  pathId?: string;
  pointIndex?: number;
  annotationId?: string;
};

export type Tool = 'select' | 'route' | 'block' | 'motion' | 'text' | 'pan';

export type Snapshot = { doc: EditorDoc; selection: Selection };

const EMPTY_SELECTION: Selection = { playerIds: [] };
const HISTORY_CAP = 100;

export type EditorState = {
  doc: EditorDoc | null;
  selection: Selection;
  view: ViewWindow;
  guides: SnapGuide[];
  tool: Tool;
  past: Snapshot[];
  future: Snapshot[];
  dirty: boolean;
  savedAt: number | null;
  /** Route currently being drawn (id inside the doc) */
  drawingPathId: string | null;

  load: (doc: EditorDoc, view?: ViewWindow) => void;
  unload: () => void;
  /** Committed mutation: pushes history. */
  commit: (recipe: (doc: EditorDoc) => void) => void;
  /** Live mutation (drag frames): no history entry. */
  live: (recipe: (doc: EditorDoc) => void) => void;
  /** Push a history entry without changing the doc (drag start). */
  checkpoint: () => void;
  undo: () => void;
  redo: () => void;
  setSelection: (s: Selection) => void;
  clearSelection: () => void;
  setView: (v: ViewWindow) => void;
  setGuides: (g: SnapGuide[]) => void;
  setTool: (t: Tool) => void;
  setDrawingPathId: (id: string | null) => void;
  markSaved: () => void;
};

const EMPTY_PATHS: Diagram['paths'] = {};
const EMPTY_ANN: Diagram['annotations'] = {};

/** A Diagram view of the doc (formations have no paths/annotations). */
export function diagramOf(doc: EditorDoc | null): Diagram {
  if (!doc) return { players: {}, paths: EMPTY_PATHS, annotations: EMPTY_ANN };
  if (doc.kind === 'play') return doc.play.diagram;
  return { players: doc.formation.players, paths: EMPTY_PATHS, annotations: EMPTY_ANN };
}

export function docId(doc: EditorDoc): string {
  return doc.kind === 'play' ? doc.play.id : doc.formation.id;
}

export const useEditor = create<EditorState>((set, get) => ({
  doc: null,
  selection: EMPTY_SELECTION,
  view: { ...DEFAULT_WINDOW },
  guides: [],
  tool: 'select',
  past: [],
  future: [],
  dirty: false,
  savedAt: null,
  drawingPathId: null,

  load(doc, view) {
    set({ doc, selection: EMPTY_SELECTION, past: [], future: [], dirty: false, savedAt: null, drawingPathId: null, tool: 'select', view: view ?? { ...DEFAULT_WINDOW }, guides: [] });
  },
  unload() {
    set({ doc: null, selection: EMPTY_SELECTION, past: [], future: [], dirty: false, drawingPathId: null, guides: [] });
  },
  commit(recipe) {
    const { doc, selection, past } = get();
    if (!doc) return;
    const next = produce(doc, recipe);
    if (next === doc) return;
    set({ doc: next, past: [...past.slice(-HISTORY_CAP + 1), { doc, selection }], future: [], dirty: true });
  },
  live(recipe) {
    const { doc } = get();
    if (!doc) return;
    const next = produce(doc, recipe);
    if (next === doc) return;
    set({ doc: next, dirty: true });
  },
  checkpoint() {
    const { doc, selection, past } = get();
    if (!doc) return;
    set({ past: [...past.slice(-HISTORY_CAP + 1), { doc, selection }], future: [] });
  },
  undo() {
    const { doc, selection, past, future } = get();
    if (!doc || past.length === 0) return;
    const prev = past[past.length - 1];
    set({ doc: prev.doc, selection: prev.selection, past: past.slice(0, -1), future: [{ doc, selection }, ...future].slice(0, HISTORY_CAP), dirty: true, drawingPathId: null });
  },
  redo() {
    const { doc, selection, past, future } = get();
    if (!doc || future.length === 0) return;
    const next = future[0];
    set({ doc: next.doc, selection: next.selection, future: future.slice(1), past: [...past, { doc, selection }].slice(-HISTORY_CAP), dirty: true, drawingPathId: null });
  },
  setSelection(s) {
    set({ selection: s });
  },
  clearSelection() {
    set({ selection: EMPTY_SELECTION });
  },
  setView(v) {
    set({ view: v });
  },
  setGuides(g) {
    set({ guides: g });
  },
  setTool(t) {
    set({ tool: t, drawingPathId: null });
  },
  setDrawingPathId(id) {
    set({ drawingPathId: id });
  },
  markSaved() {
    set({ dirty: false, savedAt: Date.now() });
  },
}));
