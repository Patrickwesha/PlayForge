'use client';

import type { Annotation, Diagram, Formation, MarkAnnotation, Path, PathInsert, PathInsertKind, PathPoint, Play, Player, Point, TextAnnotation } from '@/model/types';
import { aid, pid, rid } from '@/model/ids';
import { flipDiagram, flipFormationPlayers, flipName } from '@/geometry/flip';
import { applyRouteTree, routeScaleFor } from '@/geometry/routeTree';
import { blockPreset, doubleTeam, type BlockPreset, type Playside } from '@/geometry/blockPresets';
import { diagramOf, useEditor, type EditorDoc } from './editorStore';

type Draft = EditorDoc;

function players(d: Draft): Record<string, Player> {
  return d.kind === 'play' ? d.play.diagram.players : d.formation.players;
}
function diagram(d: Draft): Diagram | null {
  return d.kind === 'play' ? d.play.diagram : null;
}
const store = () => useEditor.getState();

// ---------------- players ----------------

export function addPlayer(spec: Partial<Player> & { x: number; y: number }): string {
  const id = pid();
  store().commit((d) => {
    const side = spec.side ?? (d.kind === 'formation' ? d.formation.side : 'offense');
    players(d)[id] = {
      id,
      side,
      symbol: spec.symbol ?? (side === 'defense' ? 'letter' : 'circle'),
      label: spec.label ?? (side === 'defense' ? 'B' : ''),
      x: spec.x,
      y: spec.y,
      shade: spec.shade,
      bars: spec.bars,
      labelColor: spec.labelColor,
      role: spec.role,
    };
  });
  store().setSelection({ playerIds: [id] });
  return id;
}

export function updatePlayer(id: string, patch: Partial<Player>) {
  store().commit((d) => {
    const p = players(d)[id];
    if (p) Object.assign(p, patch);
  });
}

export function updatePlayers(ids: string[], patch: Partial<Player>) {
  store().commit((d) => {
    for (const id of ids) {
      const p = players(d)[id];
      if (p) Object.assign(p, patch);
    }
  });
}

/** Live drag frame: set absolute positions for several players. */
export function setPlayerPositionsLive(pos: Record<string, Point>) {
  store().live((d) => {
    const ps = players(d);
    for (const [id, pt] of Object.entries(pos)) {
      const p = ps[id];
      if (p) {
        p.x = pt.x;
        p.y = pt.y;
      }
    }
  });
}

export function nudgePlayers(ids: string[], dx: number, dy: number) {
  store().commit((d) => {
    const ps = players(d);
    for (const id of ids) {
      const p = ps[id];
      if (p) {
        p.x = Math.round((p.x + dx) * 1000) / 1000;
        p.y = Math.round((p.y + dy) * 1000) / 1000;
      }
    }
  });
}

export function deletePlayers(ids: string[]) {
  store().commit((d) => {
    const ps = players(d);
    for (const id of ids) delete ps[id];
    const dg = diagram(d);
    if (dg) {
      for (const [pathId, path] of Object.entries(dg.paths)) {
        if (path.anchor.kind === 'player' && ids.includes(path.anchor.playerId)) delete dg.paths[pathId];
      }
      if (d.kind === 'play') for (const id of ids) delete d.play.positionNotes[id];
    }
  });
  store().clearSelection();
}

export function duplicatePlayers(ids: string[]): string[] {
  const newIds: string[] = [];
  store().commit((d) => {
    const ps = players(d);
    for (const id of ids) {
      const p = ps[id];
      if (!p) continue;
      const nid = pid();
      ps[nid] = { ...p, id: nid, x: p.x + 1, y: p.y - 1 };
      newIds.push(nid);
    }
  });
  store().setSelection({ playerIds: newIds });
  return newIds;
}

export function alignPlayers(ids: string[], mode: 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom' | 'los') {
  store().commit((d) => {
    const ps = players(d);
    const sel = ids.map((id) => ps[id]).filter(Boolean);
    if (sel.length === 0) return;
    const xs = sel.map((p) => p.x);
    const ys = sel.map((p) => p.y);
    for (const p of sel) {
      switch (mode) {
        case 'left': p.x = Math.min(...xs); break;
        case 'right': p.x = Math.max(...xs); break;
        case 'centerX': p.x = (Math.min(...xs) + Math.max(...xs)) / 2; break;
        case 'top': p.y = Math.max(...ys); break;
        case 'bottom': p.y = Math.min(...ys); break;
        case 'centerY': p.y = (Math.min(...ys) + Math.max(...ys)) / 2; break;
        case 'los': p.y = 0; break;
      }
    }
  });
}

/** Even horizontal spacing between the leftmost and rightmost selected players. */
export function distributePlayers(ids: string[], spacing?: number) {
  store().commit((d) => {
    const ps = players(d);
    const sel = ids.map((id) => ps[id]).filter(Boolean).sort((a, b) => a.x - b.x);
    if (sel.length < 2) return;
    if (spacing !== undefined) {
      const total = spacing * (sel.length - 1);
      const start = (sel[0].x + sel[sel.length - 1].x) / 2 - total / 2;
      sel.forEach((p, i) => (p.x = Math.round((start + i * spacing) * 1000) / 1000));
      return;
    }
    const step = (sel[sel.length - 1].x - sel[0].x) / (sel.length - 1);
    sel.forEach((p, i) => (p.x = Math.round((sel[0].x + i * step) * 1000) / 1000));
  });
}

// ---------------- paths ----------------

export function addPath(path: Path) {
  store().commit((d) => {
    const dg = diagram(d);
    if (dg) dg.paths[path.id] = path;
  });
}

/** Start a new path anchored to a player; returns the path id. Used by the route tool. */
export function startPath(playerId: string, opts: Partial<Path> = {}): string {
  const id = rid();
  store().commit((d) => {
    const dg = diagram(d);
    if (!dg) return;
    dg.paths[id] = { id, anchor: { kind: 'player', playerId }, points: [{ x: 0, y: 0 }], end: 'arrow', line: 'solid', role: 'route', ...opts };
  });
  return id;
}

export function startFreePath(start: Point, opts: Partial<Path> = {}): string {
  const id = rid();
  store().commit((d) => {
    const dg = diagram(d);
    if (!dg) return;
    dg.paths[id] = { id, anchor: { kind: 'free' }, points: [{ ...start }], end: 'arrow', line: 'solid', role: 'free', ...opts };
  });
  return id;
}

export function appendPoint(pathId: string, pt: PathPoint, live = false) {
  const fn = live ? store().live : store().commit;
  fn((d) => {
    const p = diagram(d)?.paths[pathId];
    if (p) p.points.push(pt);
  });
}

export function setPoint(pathId: string, index: number, pt: Point, live = false) {
  const fn = live ? store().live : store().commit;
  fn((d) => {
    const p = diagram(d)?.paths[pathId];
    if (p && p.points[index]) {
      p.points[index].x = pt.x;
      p.points[index].y = pt.y;
    }
  });
}

export function removeLastPoint(pathId: string) {
  store().commit((d) => {
    const p = diagram(d)?.paths[pathId];
    if (p && p.points.length > 1) p.points.pop();
  });
}

export function insertPoint(pathId: string, afterIndex: number, pt: PathPoint) {
  store().commit((d) => {
    const p = diagram(d)?.paths[pathId];
    if (p) p.points.splice(afterIndex + 1, 0, pt);
  });
}

export function deletePoint(pathId: string, index: number) {
  store().commit((d) => {
    const dg = diagram(d);
    const p = dg?.paths[pathId];
    if (!p || index === 0) return;
    p.points.splice(index, 1);
    if (p.points.length < 2 && dg) delete dg.paths[pathId];
  });
}

export function togglePointSmooth(pathId: string, index: number) {
  store().commit((d) => {
    const p = diagram(d)?.paths[pathId];
    if (p && p.points[index]) p.points[index].smooth = !p.points[index].smooth;
  });
}

export function setPathSmooth(pathId: string, smooth: boolean) {
  store().commit((d) => {
    const p = diagram(d)?.paths[pathId];
    if (!p) return;
    p.points.forEach((pt, i) => {
      if (i > 0 && i < p.points.length - 1) pt.smooth = smooth;
    });
  });
}

export function updatePath(pathId: string, patch: Partial<Path>) {
  store().commit((d) => {
    const p = diagram(d)?.paths[pathId];
    if (p) Object.assign(p, patch);
  });
}

export function deletePath(pathId: string) {
  store().commit((d) => {
    const dg = diagram(d);
    if (dg) delete dg.paths[pathId];
  });
  store().clearSelection();
}

export function deletePathsOf(playerIds: string[]) {
  store().commit((d) => {
    const dg = diagram(d);
    if (!dg) return;
    for (const [id, p] of Object.entries(dg.paths)) if (p.anchor.kind === 'player' && playerIds.includes(p.anchor.playerId)) delete dg.paths[id];
  });
}

export function applyRouteTreeTo(n: number, playerIds: string[]) {
  store().commit((d) => {
    const dg = diagram(d);
    if (!dg) return;
    const scale = d.kind === 'play' ? routeScaleFor(Object.values(dg.players).filter((p) => p.side === 'offense').length) : 1;
    for (const id of playerIds) {
      const player = dg.players[id];
      if (!player) continue;
      for (const [pathId, p] of Object.entries(dg.paths)) if (p.anchor.kind === 'player' && p.anchor.playerId === id && p.role === 'route') delete dg.paths[pathId];
      const path = applyRouteTree(n, player, { scale });
      dg.paths[path.id] = path;
    }
  });
}

export type { BlockPreset };

export function applyBlockPresetTo(kind: BlockPreset, playerIds: string[], side: Playside) {
  store().commit((d) => {
    const dg = diagram(d);
    if (!dg) return;
    const clear = (id: string) => {
      for (const [pathId, p] of Object.entries(dg.paths)) if (p.anchor.kind === 'player' && p.anchor.playerId === id && p.role === 'block') delete dg.paths[pathId];
    };
    if (kind === 'double') {
      const [a, b] = playerIds.map((id) => dg.players[id]).filter(Boolean);
      if (!a || !b) return;
      clear(a.id);
      clear(b.id);
      for (const path of doubleTeam(a, b)) dg.paths[path.id] = path;
      return;
    }
    for (const id of playerIds) {
      const player = dg.players[id];
      if (!player) continue;
      clear(id);
      for (const path of blockPreset(kind, player, side)) dg.paths[path.id] = path;
    }
  });
}

/** Set (or clear) the bend control of the segment ending at `index`. */
export function setBend(pathId: string, index: number, bend: Point | undefined, live = false) {
  const fn = live ? store().live : store().commit;
  fn((d) => {
    const p = diagram(d)?.paths[pathId];
    if (!p || !p.points[index] || index === 0) return;
    if (bend) p.points[index].bend = bend; else delete p.points[index].bend;
  });
}

/** Add a symbol on the line at fraction t of its length. */
export function addInsert(pathId: string, kind: PathInsertKind, t = 0.5) {
  store().commit((d) => {
    const p = diagram(d)?.paths[pathId];
    if (!p) return;
    p.inserts = [...(p.inserts ?? []), { kind, t }];
  });
}

export function updateInsert(pathId: string, index: number, patch: Partial<PathInsert>) {
  store().commit((d) => {
    const p = diagram(d)?.paths[pathId];
    if (p?.inserts?.[index]) Object.assign(p.inserts[index], patch);
  });
}

export function removeInsert(pathId: string, index: number) {
  store().commit((d) => {
    const p = diagram(d)?.paths[pathId];
    if (p?.inserts) p.inserts.splice(index, 1);
  });
}

/**
 * Start a new line from the end of an existing one (alternate route / second leg).
 * The new path shares the anchor and begins at the old end point. Returns the new id.
 */
export function branchFromEnd(pathId: string): string | null {
  let newId: string | null = null;
  store().commit((d) => {
    const dg = diagram(d);
    const p = dg?.paths[pathId];
    if (!dg || !p || p.points.length < 2) return;
    const last = p.points[p.points.length - 1];
    const prev = p.points[p.points.length - 2];
    const dx = last.x - prev.x;
    const dy = last.y - prev.y;
    const l = Math.hypot(dx, dy) || 1;
    const id = rid();
    dg.paths[id] = {
      id,
      anchor: p.anchor,
      points: [{ x: last.x, y: last.y }, { x: last.x + (dx / l) * 3, y: last.y + (dy / l) * 3 }],
      end: p.end === 'none' ? 'arrow' : p.end,
      line: p.line === 'squiggle' ? 'solid' : p.line,
      role: p.role,
      color: p.color,
      width: p.width,
    };
    newId = id;
  });
  if (newId) store().setSelection({ playerIds: [], pathId: newId, pointIndex: 1 });
  return newId;
}

/** Remove every bend and smooth flag: sharp, straight segments. */
export function straightenPath(pathId: string) {
  store().commit((d) => {
    const p = diagram(d)?.paths[pathId];
    if (!p) return;
    for (const pt of p.points) {
      delete pt.bend;
      delete pt.smooth;
    }
  });
}

/**
 * FirstDown-style "Curve Line": the whole line becomes one smooth curve.
 * Two points: a single arc with one apex handle, bowed toward the sideline.
 * More points: a smooth spline through every point (no per-segment bulges).
 */
export function curvePath(pathId: string) {
  store().commit((d) => {
    const dg = diagram(d);
    const p = dg?.paths[pathId];
    if (!dg || !p || p.points.length < 2) return;
    for (const pt of p.points) delete pt.bend;
    if (p.points.length === 2) {
      const a = p.points[0];
      const b = p.points[1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy) || 1;
      const anchorX = p.anchor.kind === 'player' ? (dg.players[p.anchor.playerId]?.x ?? 0) : a.x;
      // bow away from the ball (outside), like a bench route; straight-down-the-field lines bow toward the sideline
      const outward = anchorX >= 0 ? 1 : -1;
      const nx = -dy / len;
      const ny = dx / len;
      const side = Math.sign(nx * outward) || 1;
      const amt = Math.min(len * 0.35, 4);
      b.bend = { x: (a.x + b.x) / 2 + nx * amt * side, y: (a.y + b.y) / 2 + ny * amt * side };
      return;
    }
    p.points.forEach((pt, i) => {
      if (i > 0 && i < p.points.length - 1) pt.smooth = true;
    });
  });
}

/** @deprecated use curvePath */
export const roundPath = curvePath;

// ---------------- annotations ----------------

export type AnnotationInput = Omit<TextAnnotation, 'id'> | Omit<MarkAnnotation, 'id'>;

export function addAnnotation(a: AnnotationInput): string {
  const id = aid();
  store().commit((d) => {
    const dg = diagram(d);
    if (dg) dg.annotations[id] = { ...a, id } as Annotation;
  });
  store().setSelection({ playerIds: [], annotationId: id });
  return id;
}

export function updateAnnotation(id: string, patch: Partial<Annotation>) {
  store().commit((d) => {
    const a = diagram(d)?.annotations[id];
    if (a) Object.assign(a, patch);
  });
}

export function moveAnnotationLive(id: string, pt: Point) {
  store().live((d) => {
    const a = diagram(d)?.annotations[id];
    if (a) {
      a.x = pt.x;
      a.y = pt.y;
    }
  });
}

export function deleteAnnotation(id: string) {
  store().commit((d) => {
    const dg = diagram(d);
    if (dg) delete dg.annotations[id];
  });
  store().clearSelection();
}

// ---------------- document ----------------

export function setPlayMeta(patch: Partial<Omit<Play, 'diagram' | 'id'>>) {
  store().commit((d) => {
    if (d.kind === 'play') Object.assign(d.play, patch);
  });
}

export function setPositionNote(playerId: string, note: string) {
  store().commit((d) => {
    if (d.kind !== 'play') return;
    if (note.trim()) d.play.positionNotes[playerId] = note; else delete d.play.positionNotes[playerId];
  });
}

export function setFormationMeta(patch: Partial<Omit<Formation, 'players' | 'id'>>) {
  store().commit((d) => {
    if (d.kind === 'formation') Object.assign(d.formation, patch);
  });
}

export function flipDocument(swapXZ: boolean) {
  store().commit((d) => {
    if (d.kind === 'play') {
      d.play.diagram = flipDiagram(d.play.diagram, { swapXZ });
      if (d.play.formationLabel) d.play.formationLabel = flipName(d.play.formationLabel);
      d.play.name = flipName(d.play.name);
    } else {
      d.formation.players = flipFormationPlayers(d.formation, { swapXZ });
      d.formation.name = flipName(d.formation.name);
    }
  });
}

/** Replace the offense (or defense) players of a play with a formation's players, keeping paths whose anchor labels match. */
export function applyFormationToPlay(f: Formation) {
  store().commit((d) => {
    if (d.kind !== 'play') return;
    const dg = d.play.diagram;
    const old = Object.values(dg.players).filter((p) => p.side === f.side);
    const byLabel = new Map(old.map((p) => [p.label, p.id]));
    for (const p of old) delete dg.players[p.id];
    const remap = new Map<string, string>();
    for (const p of Object.values(f.players)) {
      const nid = pid();
      dg.players[nid] = { ...p, id: nid };
      const oldId = byLabel.get(p.label);
      if (oldId) remap.set(oldId, nid);
    }
    for (const [pathId, path] of Object.entries(dg.paths)) {
      if (path.anchor.kind !== 'player') continue;
      const nid = remap.get(path.anchor.playerId);
      if (nid) path.anchor.playerId = nid;
      else if (old.some((p) => p.id === (path.anchor as { playerId: string }).playerId)) delete dg.paths[pathId];
    }
    if (f.side === 'offense') {
      d.play.formationId = f.id;
      d.play.formationLabel = f.name;
      if (f.personnel) d.play.personnel = f.personnel;
    } else {
      d.play.defense = { ...(d.play.defense ?? {}), formationId: f.id, front: f.name, coverage: d.play.defense?.coverage ?? f.coverage };
    }
  });
}

export function removeSide(side: 'offense' | 'defense') {
  store().commit((d) => {
    if (d.kind !== 'play') return;
    const dg = d.play.diagram;
    const ids = Object.values(dg.players).filter((p) => p.side === side).map((p) => p.id);
    for (const id of ids) delete dg.players[id];
    for (const [pathId, p] of Object.entries(dg.paths)) if (p.anchor.kind === 'player' && ids.includes(p.anchor.playerId)) delete dg.paths[pathId];
    if (side === 'defense') d.play.defense = undefined;
  });
}

export function currentDiagram(): Diagram {
  return diagramOf(store().doc);
}
