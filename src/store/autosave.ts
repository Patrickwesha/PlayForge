'use client';

import { useEffect, useRef } from 'react';
import { repo } from './repo';
import { useEditor, type EditorDoc } from './editorStore';

export async function saveDoc(doc: EditorDoc) {
  if (doc.kind === 'play') await repo.savePlay(doc.play);
  else await repo.saveFormation({ ...doc.formation, builtin: false });
}

/** Debounced autosave of the editor document plus a flush on unload. */
export function useAutosave(delayMs = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const flush = async () => {
      const s = useEditor.getState();
      if (s.doc && s.dirty) {
        await saveDoc(s.doc);
        useEditor.getState().markSaved();
      }
    };
    const unsub = useEditor.subscribe((s, prev) => {
      if (s.doc !== prev.doc && s.dirty) {
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => void flush(), delayMs);
      }
    });
    const onUnload = () => {
      void flush();
    };
    window.addEventListener('beforeunload', onUnload);
    return () => {
      unsub();
      window.removeEventListener('beforeunload', onUnload);
      if (timer.current) clearTimeout(timer.current);
      void flush();
    };
  }, [delayMs]);
}

export async function saveNow() {
  const s = useEditor.getState();
  if (!s.doc) return;
  await saveDoc(s.doc);
  useEditor.getState().markSaved();
}
