'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Player } from '@/model/types';
import { toSvg } from '@/geometry/transform';
import { resolvePoints } from '@/geometry/path';
import { diagramOf, useEditor } from '@/store/editorStore';
import * as A from '@/store/editorActions';
import { ROUTE_TREE } from '@/geometry/routeTree';
import { PATH_COLORS } from '@/render/theme';
import { ColorSwatch, END_OPTIONS, EndIcon, STYLE_OPTIONS, StyleIcon, ThicknessIcon, WIDTH_OPTIONS } from './LineIcons';
import { useCoarsePointer, useNarrowScreen } from './useCoarsePointer';
import { BLOCK_PRESETS, blockPreset, doubleTeam, type BlockPreset, type Playside } from '@/geometry/blockPresets';
import { buildD, toSegments } from '@/geometry/path';
import { arrowHead, tBar } from '@/geometry/markers';

/** Tiny preview of a block preset drawn from a dummy player at the origin. */
function BlockIcon({ kind, side }: { kind: BlockPreset; side: Playside }) {
  const dummy: Player = { id: 'd', side: 'offense', symbol: 'circle', label: '', x: side === 'R' ? 1 : -1, y: 0 };
  const paths = kind === 'double'
    ? doubleTeam({ ...dummy, id: 'a', x: -0.6 }, { ...dummy, id: 'b', x: 0.6 })
    : blockPreset(kind, dummy, side);
  // fit: x in [-5,5], y in [-2,4.5] -> 40x28 box, y up
  const S = 5.5;
  const map = (p: { x: number; y: number }) => ({ x: 20 + p.x * S, y: 22 - p.y * S });
  return (
    <svg width={40} height={28} viewBox="0 0 40 28">
      {paths.map((p, i) => {
        const origin = kind === 'double' ? (i === 0 ? { x: -0.6, y: 0 } : { x: 0.6, y: 0 }) : { x: 0, y: 0 };
        const abs = p.points.map((pt) => ({ ...pt, x: pt.x + origin.x, y: pt.y + origin.y, bend: pt.bend ? { x: pt.bend.x + origin.x, y: pt.bend.y + origin.y } : undefined }));
        const segs = toSegments(abs);
        const end = abs[abs.length - 1];
        const last = segs[segs.length - 1];
        const from = last?.c2 ?? last?.from ?? abs[0];
        const l = Math.hypot(end.x - from.x, end.y - from.y) || 1;
        const dir = { x: (end.x - from.x) / l, y: (end.y - from.y) / l };
        return (
          <g key={i} stroke="#fff" fill="none" strokeWidth={1.5} strokeLinecap="round">
            <circle cx={map(origin).x} cy={map(origin).y} r={2.2} />
            <path d={buildD(segs, map)} />
            {p.end === 'tbar' && (() => { const [a, b] = tBar(end, dir, 0.55).map(map); return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth={2} />; })()}
            {p.end === 'arrow' && (() => { const [a, b, c] = arrowHead(end, dir, 0.8, 0.4).map(map); return <polygon points={`${a.x},${a.y} ${b.x},${b.y} ${c.x},${c.y}`} fill="#fff" />; })()}
          </g>
        );
      })}
    </svg>
  );
}

const btn = 'px-2 h-7 text-xs rounded hover:bg-neutral-700 disabled:opacity-40 whitespace-nowrap';
const ibtn = 'h-7 px-0.5 flex items-center justify-center rounded hover:bg-neutral-700';
const active = 'bg-white text-black hover:bg-white';

const PIN_KEY = 'playforge.toolbarPin';
type Pin = { x: number; y: number };

function loadPin(): Pin | null {
  try {
    const v = JSON.parse(window.localStorage.getItem(PIN_KEY) ?? 'null');
    return v && typeof v.x === 'number' && typeof v.y === 'number' ? v : null;
  } catch {
    return null;
  }
}

function savePin(pin: Pin | null) {
  try {
    if (pin) window.localStorage.setItem(PIN_KEY, JSON.stringify(pin));
    else window.localStorage.removeItem(PIN_KEY);
  } catch {
    // private window or blocked storage: the pin just lasts for this visit
  }
}

function Group({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5 px-1 border-r border-neutral-700 last:border-0">{children}</div>;
}

export function MiniToolbar({ svgRef, wrapRef }: { svgRef: RefObject<SVGSVGElement | null>; wrapRef: RefObject<HTMLDivElement | null> }) {
  const { doc, selection, view, drawingPathId, guides } = useEditor(
    useShallow((s) => ({ doc: s.doc, selection: s.selection, view: s.view, drawingPathId: s.drawingPathId, guides: s.guides })),
  );
  const [pos, setPos] = useState<{ x: number; y: number; wrapW: number } | null>(null);
  // Dragging the grip pins the toolbar to a spot on the canvas (top-left, in canvas pixels) until the grip is double-clicked.
  const [pin, setPin] = useState<Pin | null>(loadPin);
  const barRef = useRef<HTMLDivElement | null>(null);
  const grab = useRef<{ dx: number; dy: number; last: Pin | null } | null>(null);
  // Per-selection UI state, reset whenever the selection changes (adjust-state-on-prop-change pattern).
  const [ui, setUi] = useState<{ key: string; treeOpen: boolean; blocksOpen: boolean; labelEdit: string | null }>({ key: '', treeOpen: false, blocksOpen: false, labelEdit: null });
  const diagram = diagramOf(doc);
  const isPlay = doc?.kind === 'play';

  const players = selection.playerIds.map((id) => diagram.players[id]).filter(Boolean) as Player[];
  const path = selection.pathId ? diagram.paths[selection.pathId] : undefined;
  const ann = selection.annotationId ? diagram.annotations[selection.annotationId] : undefined;
  const hasSel = players.length > 0 || !!path || !!ann;
  const dragging = guides.length > 0;
  const coarse = useCoarsePointer();
  const narrow = useNarrowScreen();
  const selectionKey = `${selection.playerIds.join(',')}|${selection.pathId ?? ''}|${selection.annotationId ?? ''}`;
  if (ui.key !== selectionKey) setUi({ key: selectionKey, treeOpen: false, blocksOpen: false, labelEdit: null });
  const treeOpen = ui.key === selectionKey && ui.treeOpen;
  const blocksOpen = ui.key === selectionKey && ui.blocksOpen;
  const labelEdit = ui.key === selectionKey ? ui.labelEdit : null;
  const setTreeOpen = (v: boolean | ((p: boolean) => boolean)) => setUi((u) => ({ ...u, key: selectionKey, blocksOpen: false, treeOpen: typeof v === 'function' ? v(u.treeOpen) : v }));
  const setBlocksOpen = (v: boolean | ((p: boolean) => boolean)) => setUi((u) => ({ ...u, key: selectionKey, treeOpen: false, blocksOpen: typeof v === 'function' ? v(u.blocksOpen) : v }));
  const setLabelEdit = (v: string | null) => setUi((u) => ({ ...u, key: selectionKey, labelEdit: v }));

  useEffect(() => {
    const svg = svgRef.current;
    const wrap = wrapRef.current;
    const update = (next: { x: number; y: number; wrapW: number } | null) =>
      setPos((cur) => {
        if (cur === next) return cur;
        if (cur && next && Math.abs(cur.x - next.x) < 0.5 && Math.abs(cur.y - next.y) < 0.5 && cur.wrapW === next.wrapW) return cur;
        return next;
      });
    if (!svg || !wrap || !hasSel || drawingPathId || dragging) {
      update(null);
      return;
    }
    const d = diagramOf(doc);
    const pts: { x: number; y: number }[] = [];
    for (const id of selection.playerIds) {
      const p = d.players[id];
      if (p) pts.push(toSvg(p, view));
    }
    const sp = selection.pathId ? d.paths[selection.pathId] : undefined;
    if (sp) for (const p of resolvePoints(sp, d.players)) pts.push(toSvg(p, view));
    const sa = selection.annotationId ? d.annotations[selection.annotationId] : undefined;
    if (sa) pts.push(toSvg(sa, view));
    const ctm = svg.getScreenCTM();
    if (pts.length === 0 || !ctm) {
      update(null);
      return;
    }
    const wr = wrap.getBoundingClientRect();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    for (const p of pts) {
      const s = new DOMPoint(p.x, p.y).matrixTransform(ctm);
      minX = Math.min(minX, s.x);
      maxX = Math.max(maxX, s.x);
      minY = Math.min(minY, s.y);
    }
    update({ x: (minX + maxX) / 2 - wr.left, y: minY - wr.top - 14, wrapW: wrap.clientWidth });
  }, [svgRef, wrapRef, hasSel, drawingPathId, dragging, selectionKey, selection.playerIds, selection.pathId, selection.annotationId, view, doc]);

  if (!pos || dragging) return null;
  const wrapW = pos.wrapW;

  const ids = selection.playerIds;
  const side: 'L' | 'R' = players.length && players[0].x < 0 ? 'L' : 'R';

  // Touch screens and narrow windows: dock the toolbar along the bottom of the canvas so it never covers the play.
  const docked = coarse || narrow;
  const floatStyle = {
    left: Math.max(8, Math.min(pos.x, wrapW - 8)),
    top: Math.max(72, pos.y),
    maxWidth: Math.min(720, wrapW - 16),
    // centered on the selection, but kept inside the canvas: percentages resolve against the toolbar's own width
    transform: `translate(clamp(${(8 - pos.x).toFixed(1)}px, -50%, calc(${(wrapW - 8 - pos.x).toFixed(1)}px - 100%)), -100%)`,
  };

  const pinStyle = pin && { left: Math.max(0, Math.min(pin.x, wrapW - 48)), top: Math.max(0, pin.y), maxWidth: Math.min(720, wrapW - 16) };

  const onGripDown = (e: React.PointerEvent) => {
    const bar = barRef.current;
    if (!bar) return;
    e.preventDefault();
    const r = bar.getBoundingClientRect();
    grab.current = { dx: e.clientX - r.left, dy: e.clientY - r.top, last: null };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* synthetic or refused pointer: the drag still works while over the grip */ }
  };
  const onGripMove = (e: React.PointerEvent) => {
    const g = grab.current;
    const bar = barRef.current;
    const wrap = wrapRef.current;
    if (!g || !bar || !wrap) return;
    const wr = wrap.getBoundingClientRect();
    const br = bar.getBoundingClientRect();
    g.last = {
      x: Math.round(Math.max(0, Math.min(e.clientX - g.dx - wr.left, wr.width - br.width))),
      y: Math.round(Math.max(0, Math.min(e.clientY - g.dy - wr.top, wr.height - br.height))),
    };
    setPin(g.last);
  };
  const onGripUp = () => {
    const g = grab.current;
    grab.current = null;
    if (g?.last) savePin(g.last);
  };
  const unpin = () => { setPin(null); savePin(null); };

  return (
    <div
      ref={barRef}
      className={`absolute z-20 flex flex-wrap items-center justify-center bg-neutral-900 text-white shadow-lg px-1 py-1 ${pinStyle ? 'rounded-md' : docked ? 'left-2 right-2 bottom-2 rounded-lg gap-y-1' : 'rounded-md'} ${coarse ? 'touch' : ''}`}
      style={pinStyle || (docked ? undefined : floatStyle)}
      onPointerDown={(e) => e.stopPropagation()}
    >
      <div
        data-toolbar-grip
        className={`self-stretch flex items-center justify-center rounded cursor-grab active:cursor-grabbing hover:bg-neutral-700 ${coarse ? 'w-9 min-h-10' : 'w-5 min-h-7'} ${pin ? 'text-sky-300' : 'text-neutral-400'}`}
        style={{ touchAction: 'none' }}
        title={pin ? 'Drag to move. Double-click to snap back to the selection.' : 'Drag to move this panel. It stays where you put it.'}
        onPointerDown={onGripDown}
        onPointerMove={onGripMove}
        onPointerUp={onGripUp}
        onPointerCancel={onGripUp}
        onDoubleClick={unpin}
      >
        <svg width={8} height={16} viewBox="0 0 8 16" fill="currentColor" aria-hidden>
          {[2, 8, 14].map((y) => [1.5, 6.5].map((x) => <circle key={`${x}${y}`} cx={x} cy={y} r={1.3} />))}
        </svg>
      </div>
      {pin && (
        <button className={`${btn} text-sky-300`} onClick={unpin} title="Let the panel follow the selection again">
          Unpin
        </button>
      )}
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
              <div className="relative">
                <button className={`${btn} ${blocksOpen ? active : ''}`} onClick={() => setBlocksOpen((v) => !v)} title="Blocking presets">Blocks</button>
                {blocksOpen && (
                  <div className="absolute left-0 top-8 bg-neutral-900 rounded shadow-lg p-1.5 grid grid-cols-4 gap-1 w-72 z-30">
                    {BLOCK_PRESETS.map((b) => (
                      <button
                        key={b.id}
                        disabled={b.multi && ids.length < 2}
                        className="flex flex-col items-center gap-0.5 px-1 py-1 rounded hover:bg-neutral-700 disabled:opacity-30"
                        title={b.hint}
                        onClick={() => { A.applyBlockPresetTo(b.id, ids, side); setBlocksOpen(false); }}
                      >
                        <BlockIcon kind={b.id} side={side} />
                        <span className="text-[10px] leading-tight">{b.name}</span>
                      </button>
                    ))}
                    <div className="col-span-4 text-[10px] text-neutral-400 px-1 pt-1 border-t border-neutral-700">
                      Playside: {side === 'R' ? 'right' : 'left'} (from the player&apos;s side of the ball). Select two linemen for Double.
                    </div>
                  </div>
                )}
              </div>
            </Group>
          )}
          <Group>
            {labelEdit !== null ? (
              <input
                autoFocus
                className="h-7 w-14 text-xs bg-white text-black px-1 rounded"
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
            <select className="h-7 text-xs bg-neutral-800 rounded px-1" value={players[0].outline ?? 'solid'} onChange={(e) => A.updatePlayers(ids, { outline: e.target.value as Player['outline'] })} title="Outline: dashed shows where a player lines up before motion">
              <option value="solid">Solid outline</option>
              <option value="dashed">Dashed outline</option>
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
            {END_OPTIONS.map((o) => (
              <button key={o.end} title={o.name} className={`${ibtn} ${path.end === o.end ? active : ''}`} onClick={() => A.updatePath(path.id, { end: o.end })}>
                <EndIcon end={o.end} />
              </button>
            ))}
          </Group>
          <Group>
            {STYLE_OPTIONS.map((o) => (
              <button key={o.line} title={o.name} className={`${ibtn} ${path.line === o.line ? active : ''}`} onClick={() => A.updatePath(path.id, { line: o.line })}>
                <StyleIcon line={o.line} />
              </button>
            ))}
          </Group>
          <Group>
            {WIDTH_OPTIONS.map((o) => (
              <button key={o.width} title={o.name} className={`${ibtn} ${(path.width ?? 'normal') === o.width ? active : ''}`} onClick={() => A.updatePath(path.id, { width: o.width })}>
                <ThicknessIcon width={o.width} />
              </button>
            ))}
          </Group>
          <Group>
            <button className={btn} onClick={() => A.curvePath(path.id)} title="Make the whole line one smooth curve; drag the apex handle or the points to shape it">Curve</button>
            <button className={btn} onClick={() => A.straightenPath(path.id)} title="Straight segments">Straighten</button>
            {selection.pointIndex !== undefined && selection.pointIndex > 0 && (
              <button className={btn} onClick={() => A.deletePoint(path.id, selection.pointIndex!)} title="Delete this point">Del pt</button>
            )}
          </Group>
          <Group>
            {PATH_COLORS.map((c) => (
              <button key={c} title={c} className="h-7 w-6 flex items-center justify-center rounded hover:bg-neutral-700" onClick={() => A.updatePath(path.id, { color: c })}>
                <ColorSwatch color={c} selected={(path.color ?? 'black') === c} />
              </button>
            ))}
          </Group>
          <Group>
            <button className={`${btn} ${path.primary ? 'bg-yellow-300 text-black hover:bg-yellow-300' : ''}`} onClick={() => A.updatePath(path.id, { primary: !path.primary })} title="Highlight (P)">Primary</button>
            <button className={btn} onClick={() => A.branchFromEnd(path.id)} title="Add another line starting at this line's end (alternate route, second leg)">Branch</button>
            <button className={btn} onClick={() => A.bringPathToFront(path.id)} title="Put this line on top where lines cross">Front</button>
            <button className={btn} onClick={() => A.sendPathToBack(path.id)} title="Put this line underneath where lines cross">Back</button>
            <button className={`${btn} text-red-300`} onClick={() => A.deletePath(path.id)}>Delete</button>
          </Group>
        </>
      )}

      {ann && ann.kind === 'text' && (
        <>
          <Group>
            <input
              key={ann.id}
              className="h-7 w-32 text-xs bg-white text-black px-1 rounded"
              // freshly placed text still reads TEXT: focus it with everything selected so typing replaces it
              autoFocus={ann.text === 'TEXT'}
              onFocus={(e) => e.target.select()}
              placeholder="text"
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
            <input className="h-7 w-24 text-xs bg-white text-black px-1 rounded" placeholder="label" value={ann.label ?? ''} onChange={(e) => A.updateAnnotation(ann.id, { label: e.target.value })} onKeyDown={(e) => e.stopPropagation()} />
          )}
          <button className={`${btn} text-red-300`} onClick={() => A.deleteAnnotation(ann.id)}>Delete</button>
        </Group>
      )}
    </div>
  );

  function startDraw(playerId: string, tool: 'route' | 'block' | 'motion') {
    const s = useEditor.getState();
    const opts = tool === 'block' ? { end: 'tbar' as const, role: 'block' as const } : tool === 'motion' ? { role: 'motion' as const, line: 'squiggle' as const } : {};
    const id = A.startPath(playerId, opts);
    s.setDrawingPathId(id);
    s.setSelection({ playerIds: [], pathId: id });
  }
}
