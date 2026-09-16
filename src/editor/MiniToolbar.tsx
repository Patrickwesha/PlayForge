'use client';

import { useEffect, useState, type RefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Player } from '@/model/types';
import { toSvg } from '@/geometry/transform';
import { resolvePoints } from '@/geometry/path';
import { diagramOf, useEditor } from '@/store/editorStore';
import * as A from '@/store/editorActions';
import { ROUTE_TREE } from '@/geometry/routeTree';

const btn = 'px-2 h-7 text-xs rounded hover:bg-neutral-700 disabled:opacity-40 whitespace-nowrap';
const active = 'bg-white text-black hover:bg-white';

function Group({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5 px-1 border-r border-neutral-700 last:border-0">{children}</div>;
}

export function MiniToolbar({ svgRef, wrapRef }: { svgRef: RefObject<SVGSVGElement | null>; wrapRef: RefObject<HTMLDivElement | null> }) {
  const { doc, selection, view, drawingPathId, guides } = useEditor(
    useShallow((s) => ({ doc: s.doc, selection: s.selection, view: s.view, drawingPathId: s.drawingPathId, guides: s.guides })),
  );
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [treeOpen, setTreeOpen] = useState(false);
  const [labelEdit, setLabelEdit] = useState<string | null>(null);
  const diagram = diagramOf(doc);
  const isPlay = doc?.kind === 'play';

  const players = selection.playerIds.map((id) => diagram.players[id]).filter(Boolean) as Player[];
  const path = selection.pathId ? diagram.paths[selection.pathId] : undefined;
  const ann = selection.annotationId ? diagram.annotations[selection.annotationId] : undefined;
  const hasSel = players.length > 0 || !!path || !!ann;
  const dragging = guides.length > 0;

  useEffect(() => {
    setTreeOpen(false);
    setLabelEdit(null);
  }, [selection.playerIds, selection.pathId, selection.annotationId]);

  useEffect(() => {
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    if (!svg || !wrap || !hasSel || drawingPathId) {
      setPos(null);
      return;
    }
    const pts: { x: number; y: number }[] = [];
    for (const p of players) pts.push(toSvg(p, view));
    if (path) for (const p of resolvePoints(path, diagram.players)) pts.push(toSvg(p, view));
    if (ann) pts.push(toSvg(ann, view));
    if (pts.length === 0) {
      setPos(null);
      return;
    }
    const ctm = svg.getScreenCTM();
    const wr = wrap.getBoundingClientRect();
    if (!ctm) return;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    for (const p of pts) {
      const s = new DOMPoint(p.x, p.y).matrixTransform(ctm);
      minX = Math.min(minX, s.x);
      maxX = Math.max(maxX, s.x);
      minY = Math.min(minY, s.y);
    }
    setPos({ x: (minX + maxX) / 2 - wr.left, y: minY - wr.top - 14 });
  }, [svgRef, wrapRef, hasSel, drawingPathId, players, path, ann, view, diagram.players]);

  if (!pos || dragging) return null;

  const ids = selection.playerIds;
  const side: 'L' | 'R' = players.length && players[0].x < 0 ? 'L' : 'R';

  return (
    <div
      className="absolute z-20 flex flex-wrap items-center justify-center bg-neutral-900 text-white rounded-md shadow-lg px-1 py-1 -translate-x-1/2 -translate-y-full"
      style={{
        left: Math.max(8, Math.min(pos.x, (wrapRef.current?.clientWidth ?? 800) - 8)),
        top: Math.max(72, pos.y),
        maxWidth: Math.min(720, (wrapRef.current?.clientWidth ?? 800) - 16),
        transform: `translate(${clampTranslate(pos.x, wrapRef.current?.clientWidth ?? 800)}, -100%)`,
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {players.length > 0 && (
        <>
          {isPlay && (
            <Group>
              <button className={btn} title="Draw route (double-click player also works)" onClick={() => startDraw(ids[0], 'route')}>Route</button>
              <button className={btn} title="Draw block (ends in a T)" onClick={() => startDraw(ids[0], 'block')}>Block</button>
              <button className={btn} title="Motion (squiggle)" onClick={() => startDraw(ids[0], 'motion')}>Motion</button>
              <div className="relative">
                <button className={`${btn} ${treeOpen ? active : ''}`} onClick={() => setTreeOpen((v) => !v)} title="Route tree 0-9">Tree</button>
                {treeOpen && (
                  <div className="absolute left-0 top-8 bg-neutral-900 rounded shadow-lg p-1 grid grid-cols-5 gap-0.5 w-56">
                    {Object.entries(ROUTE_TREE).map(([n, r]) => (
                      <button key={n} className={`${btn} text-left`} onClick={() => { A.applyRouteTreeTo(Number(n), ids); setTreeOpen(false); }}>
                        <span className="font-bold mr-1">{n}</span>{r.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <select className="h-7 text-xs bg-neutral-800 rounded px-1" defaultValue="" onChange={(e) => { if (e.target.value) A.applyBlockPresetTo(e.target.value as A.BlockPreset, ids, side); e.target.value = ''; }} title="Blocking presets">
                <option value="">Blocks…</option>
                <option value="base">Base</option>
                <option value="down">Down</option>
                <option value="reach">Reach</option>
                <option value="pull">Pull</option>
                <option value="kickout">Kick out</option>
              </select>
            </Group>
          )}
          <Group>
            {labelEdit !== null ? (
              <input
                autoFocus
                className="h-7 w-14 text-xs text-black px-1 rounded"
                value={labelEdit}
                onChange={(e) => setLabelEdit(e.target.value.toUpperCase().slice(0, 3))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { A.updatePlayers(ids, { label: labelEdit }); setLabelEdit(null); }
                  if (e.key === 'Escape') setLabelEdit(null);
                }}
                onBlur={() => { A.updatePlayers(ids, { label: labelEdit }); setLabelEdit(null); }}
              />
            ) : (
              <button className={btn} onClick={() => setLabelEdit(players[0].label)} title="Edit label">
                Label: <b>{players[0].label || '·'}</b>
              </button>
            )}
            <select className="h-7 text-xs bg-neutral-800 rounded px-1" value={players[0].symbol} onChange={(e) => A.updatePlayers(ids, { symbol: e.target.value as Player['symbol'] })} title="Symbol">
              <option value="circle">Circle</option>
              <option value="square">Square</option>
              <option value="letter">Letter</option>
              <option value="triangle">Triangle</option>
              <option value="oval">Oval</option>
              <option value="diamond">Diamond</option>
            </select>
            <select className="h-7 text-xs bg-neutral-800 rounded px-1" value={players[0].shade ?? 'none'} onChange={(e) => A.updatePlayers(ids, { shade: e.target.value as Player['shade'] })} title="Shade">
              <option value="none">No shade</option>
              <option value="left">Shade L</option>
              <option value="right">Shade R</option>
              <option value="full">Filled</option>
            </select>
            <select className="h-7 text-xs bg-neutral-800 rounded px-1" value={players[0].labelColor ?? 'black'} onChange={(e) => A.updatePlayers(ids, { labelColor: e.target.value as Player['labelColor'] })} title="Label color">
              <option value="black">Black</option>
              <option value="red">Red</option>
              <option value="blue">Blue</option>
              <option value="green">Green</option>
              <option value="brown">Brown</option>
              <option value="orange">Orange</option>
            </select>
          </Group>
          {players.length > 1 && (
            <Group>
              <button className={btn} onClick={() => A.alignPlayers(ids, 'centerY')} title="Align on the same line">Align Y</button>
              <button className={btn} onClick={() => A.alignPlayers(ids, 'centerX')} title="Stack vertically">Align X</button>
              <button className={btn} onClick={() => A.distributePlayers(ids)} title="Even spacing">Distribute</button>
              <button className={btn} onClick={() => A.distributePlayers(ids, 1)} title="1-yard splits">Tighten</button>
            </Group>
          )}
          <Group>
            <button className={btn} onClick={() => A.duplicatePlayers(ids)} title="Duplicate (Ctrl+D)">Dup</button>
            {isPlay && <button className={btn} onClick={() => A.deletePathsOf(ids)} title="Remove this player's routes and blocks">Clear lines</button>}
            <button className={`${btn} text-red-300`} onClick={() => A.deletePlayers(ids)} title="Delete (Del)">Delete</button>
          </Group>
        </>
      )}

      {path && (
        <>
          <Group>
            {(['arrow', 'tbar', 'dot', 'none'] as const).map((e) => (
              <button key={e} className={`${btn} ${path.end === e ? active : ''}`} onClick={() => A.updatePath(path.id, { end: e })}>
                {e === 'arrow' ? 'Arrow' : e === 'tbar' ? 'T' : e === 'dot' ? 'Dot' : 'None'}
              </button>
            ))}
          </Group>
          <Group>
            {(['solid', 'dashed', 'dotted', 'squiggle'] as const).map((l) => (
              <button key={l} className={`${btn} ${path.line === l ? active : ''}`} onClick={() => A.updatePath(path.id, { line: l })}>
                {l[0].toUpperCase() + l.slice(1)}
              </button>
            ))}
          </Group>
          <Group>
            <button className={btn} onClick={() => A.setPathSmooth(path.id, true)} title="Curve through all points">Curve</button>
            <button className={btn} onClick={() => A.setPathSmooth(path.id, false)} title="Sharp corners">Straight</button>
            {selection.pointIndex !== undefined && selection.pointIndex > 0 && (
              <button className={btn} onClick={() => A.togglePointSmooth(path.id, selection.pointIndex!)} title="Toggle curve at this point (S)">Pt curve</button>
            )}
            {selection.pointIndex !== undefined && selection.pointIndex > 0 && (
              <button className={btn} onClick={() => A.deletePoint(path.id, selection.pointIndex!)} title="Delete this point">Del pt</button>
            )}
          </Group>
          <Group>
            <button className={`${btn} ${path.primary ? 'bg-yellow-300 text-black hover:bg-yellow-300' : ''}`} onClick={() => A.updatePath(path.id, { primary: !path.primary })} title="Highlight (P)">Primary</button>
            <select className="h-7 text-xs bg-neutral-800 rounded px-1" value={path.color ?? 'black'} onChange={(e) => A.updatePath(path.id, { color: e.target.value as 'black' | 'red' | 'blue' })}>
              <option value="black">Black</option>
              <option value="red">Red</option>
              <option value="blue">Blue</option>
            </select>
            <select className="h-7 text-xs bg-neutral-800 rounded px-1" value={path.width ?? 'normal'} onChange={(e) => A.updatePath(path.id, { width: e.target.value as 'thin' | 'normal' | 'thick' })}>
              <option value="thin">Thin</option>
              <option value="normal">Normal</option>
              <option value="thick">Thick</option>
            </select>
            <button className={`${btn} text-red-300`} onClick={() => A.deletePath(path.id)}>Delete</button>
          </Group>
        </>
      )}

      {ann && ann.kind === 'text' && (
        <>
          <Group>
            <input
              className="h-7 w-32 text-xs text-black px-1 rounded"
              value={ann.text}
              onChange={(e) => A.updateAnnotation(ann.id, { text: e.target.value })}
              onKeyDown={(e) => e.stopPropagation()}
            />
          </Group>
          <Group>
            {(['redCaps', 'bold', 'plain', 'split'] as const).map((s) => (
              <button key={s} className={`${btn} ${ann.style === s ? active : ''}`} onClick={() => A.updateAnnotation(ann.id, { style: s })}>
                {s === 'redCaps' ? 'Red caps' : s === 'split' ? '-N-' : s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </Group>
          <Group>
            {(['sm', 'md', 'lg'] as const).map((s) => (
              <button key={s} className={`${btn} ${(ann.size ?? 'md') === s ? active : ''}`} onClick={() => A.updateAnnotation(ann.id, { size: s })}>{s.toUpperCase()}</button>
            ))}
            <button className={btn} onClick={() => A.updateAnnotation(ann.id, { rotate: ann.rotate === -90 ? 0 : ann.rotate === 90 ? -90 : 90 })}>Rotate</button>
            <button className={`${btn} text-red-300`} onClick={() => A.deleteAnnotation(ann.id)}>Delete</button>
          </Group>
        </>
      )}
      {ann && ann.kind === 'mark' && (
        <Group>
          <span className="text-xs px-1 text-neutral-300">{ann.mark}</span>
          {ann.mark === 'zoneBubble' && (
            <input className="h-7 w-24 text-xs text-black px-1 rounded" placeholder="label" value={ann.label ?? ''} onChange={(e) => A.updateAnnotation(ann.id, { label: e.target.value })} onKeyDown={(e) => e.stopPropagation()} />
          )}
          <button className={`${btn} text-red-300`} onClick={() => A.deleteAnnotation(ann.id)}>Delete</button>
        </Group>
      )}
    </div>
  );

  /** Keep the toolbar inside the canvas: shift the anchor from centered toward the edges. */
  function clampTranslate(x: number, width: number): string {
    const half = Math.min(360, (width - 16) / 2);
    if (x < half + 8) return `${-(x - 8)}px`;
    if (x > width - half - 8) return `${-(half * 2 - (width - 8 - x))}px`;
    return '-50%';
  }

  function startDraw(playerId: string, tool: 'route' | 'block' | 'motion') {
    const s = useEditor.getState();
    const opts = tool === 'block' ? { end: 'tbar' as const, role: 'block' as const } : tool === 'motion' ? { role: 'motion' as const, line: 'squiggle' as const } : {};
    const id = A.startPath(playerId, opts);
    s.setDrawingPathId(id);
    s.setSelection({ playerIds: [], pathId: id });
  }
}
