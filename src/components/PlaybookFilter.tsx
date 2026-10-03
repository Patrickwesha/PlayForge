'use client';

import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Playbook, SectionKind } from '@/model/types';
import { repo } from '@/store/repo';

/** '' = every item, 'none' = items in no playbook, else a playbook id. */
export type PlaybookFilterValue = '' | 'none' | string;
export const NOT_IN_PLAYBOOK: PlaybookFilterValue = 'none';

/** item id -> the playbooks whose sections of `kind` list it. */
export function playbookMembership(playbooks: Playbook[], kind: SectionKind): Map<string, Playbook[]> {
  const m = new Map<string, Playbook[]>();
  for (const pb of playbooks) {
    const ids = new Set(pb.sections.filter((s) => s.kind === kind).flatMap((s) => s.itemIds));
    for (const id of ids) m.set(id, [...(m.get(id) ?? []), pb]);
  }
  return m;
}

export function matchesPlaybook(value: PlaybookFilterValue, itemId: string, memberOf: Map<string, Playbook[]>): boolean {
  if (!value) return true;
  const books = memberOf.get(itemId) ?? [];
  if (value === NOT_IN_PLAYBOOK) return books.length === 0;
  return books.some((pb) => pb.id === value);
}

/** Live playbooks plus the membership map for one kind of item. */
export function usePlaybookMembership(kind: SectionKind) {
  const playbooks = useLiveQuery(() => repo.listPlaybooks(), []);
  const memberOf = useMemo(() => playbookMembership(playbooks ?? [], kind), [playbooks, kind]);
  return { playbooks: playbooks ?? [], memberOf };
}

type Props = {
  value: PlaybookFilterValue;
  onChange: (v: PlaybookFilterValue) => void;
  playbooks: Playbook[];
  kind: SectionKind;
  /** Ids of the items the page lists, so each option can show how many of them it holds. */
  itemIds: string[];
  memberOf: Map<string, Playbook[]>;
  className?: string;
};

/** "Playbook: all / not in a playbook / BEAST OFFENSE (12)". Hidden until there is a playbook to pick. */
export function PlaybookFilter({ value, onChange, playbooks, kind, itemIds, memberOf, className }: Props) {
  if (playbooks.length === 0) return null;
  const count = (v: PlaybookFilterValue) => itemIds.filter((id) => matchesPlaybook(v, id, memberOf)).length;
  const noun = kind === 'plays' ? 'plays' : 'formations';
  return (
    <select className={className} value={value} onChange={(e) => onChange(e.target.value)} aria-label="Playbook">
      <option value="">All playbooks</option>
      <option value={NOT_IN_PLAYBOOK}>Not in a playbook ({count(NOT_IN_PLAYBOOK)})</option>
      {[...playbooks]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((pb) => (
          <option key={pb.id} value={pb.id}>
            {pb.name} ({count(pb.id)} {noun})
          </option>
        ))}
    </select>
  );
}

/** A small chip on a card: which playbooks hold this item. */
export function PlaybookChip({ books }: { books: Playbook[] | undefined }) {
  if (!books?.length) return null;
  return (
    <span className="shrink-0 rounded bg-neutral-100 text-neutral-700 px-1 text-[11px]" title={`In: ${books.map((b) => b.name).join(', ')}`}>
      {books.length === 1 ? books[0].name : `${books.length} playbooks`}
    </span>
  );
}
