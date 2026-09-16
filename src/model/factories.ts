import { did, nowIso, pid } from './ids';
import type { Diagram, Formation, Play, PlayCategory, Playbook, Player, Side } from './types';

export const emptyDiagram = (): Diagram => ({ players: {}, paths: {}, annotations: {} });

export function clonePlayers(players: Record<string, Player>): Record<string, Player> {
  const out: Record<string, Player> = {};
  for (const p of Object.values(players)) out[p.id] = { ...p };
  return out;
}

/** Copy players with fresh ids (used when applying a formation to a play). */
export function reidPlayers(players: Record<string, Player>): Record<string, Player> {
  const out: Record<string, Player> = {};
  for (const p of Object.values(players)) {
    const id = pid();
    out[id] = { ...p, id };
  }
  return out;
}

export function newFormation(partial: Partial<Formation> & { name: string; side: Side }): Formation {
  const t = nowIso();
  return {
    id: did(),
    playersPerSide: 11,
    players: {},
    tags: [],
    createdAt: t,
    updatedAt: t,
    ...partial,
  };
}

export type NewPlayOptions = {
  name: string;
  category?: PlayCategory;
  offense?: Formation;
  defense?: Formation;
  personnel?: string;
};

export function newPlay(o: NewPlayOptions): Play {
  const t = nowIso();
  const diagram = emptyDiagram();
  if (o.offense) Object.assign(diagram.players, reidPlayers(o.offense.players));
  if (o.defense) Object.assign(diagram.players, reidPlayers(o.defense.players));
  return {
    id: did(),
    name: o.name,
    formationId: o.offense?.id,
    formationLabel: o.offense?.name,
    personnel: o.personnel ?? o.offense?.personnel,
    category: o.category ?? 'Run',
    tags: [],
    positionNotes: {},
    defense: o.defense ? { formationId: o.defense.id, front: o.defense.name, coverage: o.defense.coverage } : undefined,
    diagram,
    createdAt: t,
    updatedAt: t,
  };
}

export function duplicatePlay(p: Play, name?: string): Play {
  const t = nowIso();
  return { ...structuredClone(p), id: did(), name: name ?? `${p.name} COPY`, createdAt: t, updatedAt: t };
}

export function duplicateFormation(f: Formation, name?: string): Formation {
  const t = nowIso();
  return { ...structuredClone(f), id: did(), name: name ?? `${f.name} COPY`, builtin: false, createdAt: t, updatedAt: t };
}

export function newPlaybook(name: string): Playbook {
  const t = nowIso();
  return {
    id: did(),
    name,
    cover: { title: name, showCover: false },
    sections: [{ id: did(), title: 'Plays', kind: 'plays', itemIds: [] }],
    defaultLayout: '6up',
    paper: 'letter',
    createdAt: t,
    updatedAt: t,
  };
}

/** Header line 1 for a play cell: "[11] SNUG" */
export function playHeaderLine1(p: Play): string {
  const f = (p.formationLabel ?? '').trim();
  return p.personnel ? `[${p.personnel}] ${f}`.trim() : f;
}

/** Footer left: "OVER COVER 3" */
export function playDefenseLabel(p: Play): string {
  const parts = [p.defense?.front, p.defense?.coverage].filter(Boolean);
  return parts.join(' ');
}
