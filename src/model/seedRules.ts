/** Every built-in row (formations, demo plays, the demo playbook) is stamped with this time. */
export const SEED_TIME = '2026-01-01T00:00:00.000Z';

/** The three kinds of library rows that sync between devices. */
export type ItemKind = 'formation' | 'play' | 'playbook';
export const ITEM_KINDS: ItemKind[] = ['formation', 'play', 'playbook'];

export const itemKey = (kind: ItemKind, id: string) => `${kind}:${id}`;

/**
 * A built-in row nobody has edited. Every device already has its own copy, so these never upload,
 * and a real edit or delete coming from another device always beats them.
 */
export function isUntouchedSeed(kind: ItemKind, row: { updatedAt: string; builtin?: boolean }): boolean {
  if (kind === 'formation') return row.builtin === true;
  return row.updatedAt === SEED_TIME;
}
