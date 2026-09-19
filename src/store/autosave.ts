'use client';

import { useEffect, useRef } from 'react';
import { repo } from './repo';
import { useEditor, type EditorDoc } from './editorStore';

export async function saveDoc(doc: EditorDoc) {
  if (doc.kind === 'play') await repo.savePlay(doc.play);
  else await repo.saveFormation({ ...doc.formation, builtin: false });
}

/** Write the open document now if it has unsaved edits. Sync calls this before it compares anything. */
export async function flushIfDirty() {
  const s = useEditor.getState();
  if (s.doc && s.dirty) {
    await saveDoc(s.doc);
    useEditor.getState().markSaved();
  }
}

/** Debounced autosave of the editor document plus a flush when the page is hidden or closed. */
export function useAutosave(delayMs = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const flush = () => void flushIfDirty();
    const unsub = useEditor.subscribe((s, prev) => {
      if (s.doc !== prev.doc && s.dirty) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(flush, delayMs);
      }
    });
    // iPad Safari rarely fires beforeunload: switching apps or tabs hides the page instead.
    const onHidden = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    window.addEventListener('beforeunload', flush);
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onHidden);
    return () => {
      unsub();
      window.removeEventListener('beforeunload', flush);
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onHidden);
      if (timer.current) clearTimeout(timer.current);
      flush();
    };
  }, [delayMs]);
}

export async function saveNow() {
  const s = useEditor.getState();
  if (!s.doc) return;
  await saveDoc(s.doc);
  useEditor.getState().markSaved();
}
