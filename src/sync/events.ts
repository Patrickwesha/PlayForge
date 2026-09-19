import type { AppliedChange } from './types';

type Listener = (changes: AppliedChange[]) => void;
const listeners = new Set<Listener>();

/** Fired after a sync wrote rows that came from another device. Open editors use it to reload. */
export function onApplied(cb: Listener) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function emitApplied(changes: AppliedChange[]) {
  if (changes.length === 0) return;
  listeners.forEach((cb) => cb(changes));
}
