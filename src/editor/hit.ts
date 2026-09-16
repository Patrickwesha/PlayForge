export type Hit =
  | { kind: 'player'; id: string }
  | { kind: 'path'; id: string }
  | { kind: 'point'; pathId: string; index: number }
  | { kind: 'ann'; id: string }
  | { kind: 'bg' }
  | { kind: 'none' };

export function parseHit(target: EventTarget | null): Hit {
  if (!(target instanceof Element)) return { kind: 'none' };
  const el = target.closest('[data-hit]');
  if (!el) return { kind: 'none' };
  const v = el.getAttribute('data-hit') ?? '';
  if (v === 'bg') return { kind: 'bg' };
  const [kind, a, b] = v.split(':');
  if (kind === 'player') return { kind: 'player', id: a };
  if (kind === 'path') return { kind: 'path', id: a };
  if (kind === 'point') return { kind: 'point', pathId: a, index: Number(b) };
  if (kind === 'ann') return { kind: 'ann', id: a };
  return { kind: 'none' };
}
