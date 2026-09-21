'use client';

import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Formation, PlayCategory, PlayersPerSide } from '@/model/types';
import { diagramOf, useEditor } from '@/store/editorStore';
import * as A from '@/store/editorActions';
import { COVERAGES } from '@/seeds';
import { FormationPicker } from './FormationPicker';
import { useSettings } from '@/store/settingsStore';
import { FIELD_PRESETS, FIELD_WIDTH_FT } from '@/model/constants';
import { fieldLandmarks, landmarkReadout } from '@/geometry/landmarks';
import { PATH_COLORS } from '@/render/theme';
import { ColorSwatch, END_OPTIONS, EndIcon, INSERT_OPTIONS, InsertIcon, STYLE_OPTIONS, StyleIcon, ThicknessIcon, WIDTH_OPTIONS } from './LineIcons';

const field = 'w-full border border-neutral-300 rounded px-2 py-1 text-sm bg-white';
const label = 'block text-[11px] uppercase tracking-wide text-neutral-500 mt-3 mb-0.5';
const btn = 'text-xs px-2 py-1 rounded border border-neutral-300 bg-white hover:border-black';
const ibtn = 'h-8 px-0.5 flex items-center justify-center rounded border border-neutral-300 bg-white hover:border-black';
const iactive = 'bg-black text-white border-black hover:border-black';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-neutral-200 p-3">
      <div className="font-bold text-sm">{title}</div>
      {children}
    </div>
  );
}

/** Where the selected player sits across the field, in landmark terms. The check that alignments are consistent. */
function AlignmentReadout({ x, label: who, preset }: { x: number; label: string; preset: keyof typeof FIELD_PRESETS }) {
  const r = landmarkReadout(fieldLandmarks(preset), x);
  const fromSideline = FIELD_WIDTH_FT / 3 / 2 - Math.abs(x);
  const n = (v: number) => String(Math.round(v * 100) / 100);
  return (
    <Section title={`Alignment: ${who}`}>
      <div data-alignment-readout="" className={`mt-1 text-base font-semibold ${r.aligned ? 'text-blue-700' : ''}`}>{r.text}</div>
      <div className="text-xs text-neutral-500 mt-0.5">
        {x === 0 ? 'On the ball' : `${n(Math.abs(x))} yd ${x > 0 ? 'right' : 'left'} of the ball`} · {n(fromSideline)} yd from the sideline · {FIELD_PRESETS[preset].label} field
      </div>
    </Section>
  );
}

export function Inspector() {
  const { doc, selection } = useEditor(useShallow((s) => ({ doc: s.doc, selection: s.selection })));
  const [picker, setPicker] = useState<null | 'offense' | 'defense'>(null);
  const hashPreset = useSettings((s) => s.settings.hashPreset);
  if (!doc) return null;
  const diagram = diagramOf(doc);
  const selPlayer = selection.playerIds.length === 1 ? diagram.players[selection.playerIds[0]] : undefined;
  const selPath = selection.pathId ? diagram.paths[selection.pathId] : undefined;

  const addPlayer = (side: 'offense' | 'defense') => {
    const s = useEditor.getState();
    const cx = (s.view.minX + s.view.maxX) / 2;
    A.addPlayer({ side, x: Math.round(cx), y: side === 'defense' ? 3 : -3, label: side === 'defense' ? 'B' : 'X', symbol: side === 'defense' ? 'letter' : 'circle' });
  };
  const addMark = (mark: 'handoffX' | 'ballDot' | 'zoneBubble' | 'fakeArrow') => {
    const s = useEditor.getState();
    const cx = (s.view.minX + s.view.maxX) / 2;
    A.addAnnotation({ kind: 'mark', x: Math.round(cx), y: mark === 'zoneBubble' ? 5 : -2, mark, r: mark === 'zoneBubble' ? 2.5 : undefined });
  };
  const addText = (text: string, style: 'redCaps' | 'split' | 'plain' | 'bold') => {
    const s = useEditor.getState();
    const cx = (s.view.minX + s.view.maxX) / 2;
    A.addAnnotation({ kind: 'text', x: Math.round(cx), y: -2, text, style, size: 'md' });
  };

  return (
    <aside className="w-72 shrink-0 bg-white border-l border-neutral-300 overflow-y-auto text-sm">
      {selPlayer && <AlignmentReadout x={selPlayer.x} label={selPlayer.label || selPlayer.role || 'player'} preset={hashPreset} />}
      {doc.kind === 'play' ? (
        <>
          <Section title="Play">
            <label className={label}>Play name</label>
            <input className={field} value={doc.play.name} onChange={(e) => A.setPlayMeta({ name: e.target.value })} />
            <label className={label}>Formation label (header line 1)</label>
            <input className={field} value={doc.play.formationLabel ?? ''} onChange={(e) => A.setPlayMeta({ formationLabel: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={label}>Personnel</label>
                <input className={field} placeholder="11" value={doc.play.personnel ?? ''} onChange={(e) => A.setPlayMeta({ personnel: e.target.value || undefined })} />
              </div>
              <div>
                <label className={label}>Category</label>
                <select className={field} value={doc.play.category} onChange={(e) => A.setPlayMeta({ category: e.target.value as PlayCategory })}>
                  {(['Run', 'Pass', 'PA', 'Screen', 'Special'] as const).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
            <label className={label}>Wristband / tag (footer right)</label>
            <input className={field} placeholder="35 (3WK)" value={doc.play.wristband ?? ''} onChange={(e) => A.setPlayMeta({ wristband: e.target.value || undefined })} />
            <label className={label}>Tags (comma separated)</label>
            <input className={field} value={doc.play.tags.join(', ')} onChange={(e) => A.setPlayMeta({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
            <div className="flex gap-2 mt-3">
              <button className={btn} onClick={() => setPicker('offense')}>Change formation</button>
              <button className={btn} onClick={() => addPlayer('offense')}>+ Player</button>
            </div>
          </Section>

          {(doc.play.alternate || doc.play.confidence === 'needs-review') && (
            <Section title={doc.play.alternate ? 'Can call' : 'Import notes'}>
              {doc.play.alternate && (
                <p className="text-sm">
                  This drawing is the primary. Can to <b className="uppercase">{doc.play.alternate.name}</b>
                  {doc.play.alternate.trigger && <> vs. {doc.play.alternate.trigger}</>}.
                </p>
              )}
              {doc.play.reviewNotes && doc.play.reviewNotes.length > 0 && (
                <ul className="mt-2 text-xs text-neutral-600 list-disc pl-4 space-y-1">
                  {doc.play.reviewNotes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              )}
            </Section>
          )}

          <Section title="Defense">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={label}>Front</label>
                <input className={field} placeholder="OVER" value={doc.play.defense?.front ?? ''} onChange={(e) => A.setPlayMeta({ defense: { ...(doc.play.defense ?? {}), front: e.target.value || undefined } })} />
              </div>
              <div>
                <label className={label}>Coverage</label>
                <input className={field} list="coverages" placeholder="COVER 3" value={doc.play.defense?.coverage ?? ''} onChange={(e) => A.setPlayMeta({ defense: { ...(doc.play.defense ?? {}), coverage: e.target.value || undefined } })} />
                <datalist id="coverages">
                  {COVERAGES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="flex gap-2 mt-3 flex-wrap">
              <button className={btn} onClick={() => setPicker('defense')}>Set front</button>
              <button className={btn} onClick={() => addPlayer('defense')}>+ Defender</button>
              <button className={btn} onClick={() => A.removeSide('defense')}>Remove defense</button>
            </div>
          </Section>

          <Section title="Marks and text">
            <div className="flex gap-1.5 mt-2 flex-wrap">
              <button className={btn} onClick={() => addText('TEXT', 'redCaps')}>Red caps</button>
              <button className={btn} onClick={() => addText('-5-', 'split')}>-5- split</button>
              <button className={btn} onClick={() => addText('Note', 'plain')}>Plain</button>
              <button className={btn} onClick={() => addMark('handoffX')}>Handoff X</button>
              <button className={btn} onClick={() => addMark('ballDot')}>Ball dot</button>
              <button className={btn} onClick={() => addMark('zoneBubble')}>Zone</button>
              <button className={btn} onClick={() => addMark('fakeArrow')}>Fake arrow</button>
            </div>
          </Section>

          {selPath && (
            <Section title="Line">
              <div className={label}>Thickness</div>
              <div className="flex gap-1">
                {WIDTH_OPTIONS.map((o) => (
                  <button key={o.width} title={o.name} className={`${ibtn} ${(selPath.width ?? 'normal') === o.width ? iactive : ''}`} onClick={() => A.updatePath(selPath.id, { width: o.width })}>
                    <ThicknessIcon width={o.width} />
                  </button>
                ))}
              </div>
              <div className={label}>Style</div>
              <div className="flex gap-1">
                {STYLE_OPTIONS.map((o) => (
                  <button key={o.line} title={o.name} className={`${ibtn} ${selPath.line === o.line ? iactive : ''}`} onClick={() => A.updatePath(selPath.id, { line: o.line })}>
                    <StyleIcon line={o.line} />
                  </button>
                ))}
              </div>
              <div className={label}>Endpoint</div>
              <div className="flex gap-1 flex-wrap">
                {END_OPTIONS.map((o) => (
                  <button key={o.end} title={o.name} className={`${ibtn} ${selPath.end === o.end ? iactive : ''}`} onClick={() => A.updatePath(selPath.id, { end: o.end })}>
                    <EndIcon end={o.end} />
                  </button>
                ))}
              </div>
              <div className={label}>Color</div>
              <div className="flex gap-1 flex-wrap">
                {PATH_COLORS.map((c) => (
                  <button key={c} title={c} className="h-7 w-7 flex items-center justify-center rounded hover:bg-neutral-100" onClick={() => A.updatePath(selPath.id, { color: c })}>
                    <ColorSwatch color={c} selected={(selPath.color ?? 'black') === c} />
                  </button>
                ))}
              </div>
              <div className={label}>Inserts (symbols on the line)</div>
              <div className="flex gap-1">
                {INSERT_OPTIONS.map((o) => (
                  <button key={o.kind} title={`Add ${o.name}`} className={ibtn} onClick={() => A.addInsert(selPath.id, o.kind, 0.5)}>
                    <InsertIcon kind={o.kind} />
                  </button>
                ))}
              </div>
              {(selPath.inserts ?? []).map((ins, i) => (
                <div key={i} className="flex items-center gap-2 mt-1.5 text-xs">
                  <span className="w-20 text-neutral-600">{INSERT_OPTIONS.find((o) => o.kind === ins.kind)?.name}</span>
                  <input type="range" min={0.05} max={0.95} step={0.05} value={ins.t} onChange={(e) => A.updateInsert(selPath.id, i, { t: Number(e.target.value) })} className="flex-1" title="Position along the line" />
                  <button className="text-red-700 px-1" onClick={() => A.removeInsert(selPath.id, i)} title="Remove">✕</button>
                </div>
              ))}
              <div className="flex gap-2 mt-3 flex-wrap">
                <button className={btn} onClick={() => A.curvePath(selPath.id)}>Curve</button>
                <button className={btn} onClick={() => A.straightenPath(selPath.id)}>Straighten</button>
                <button className={btn} onClick={() => A.branchFromEnd(selPath.id)}>Branch from end</button>
                <button className={btn} onClick={() => A.bringPathToFront(selPath.id)} title="On top where lines cross">Bring to front</button>
                <button className={btn} onClick={() => A.sendPathToBack(selPath.id)} title="Underneath where lines cross">Send to back</button>
                <button className={`${btn} ${selPath.primary ? 'bg-yellow-200' : ''}`} onClick={() => A.updatePath(selPath.id, { primary: !selPath.primary })}>Primary</button>
              </div>
              <div className="text-xs text-neutral-500 mt-2">Drag the hollow circle (curve apex) or the diamond (straight segment) on the canvas to bend the line.</div>
            </Section>
          )}

          {selPlayer && (
            <Section title={`Coaching point: ${selPlayer.label || selPlayer.role || 'player'}`}>
              <textarea
                className={`${field} mt-2`}
                rows={3}
                placeholder="What this player does on this play"
                value={doc.play.positionNotes[selPlayer.id] ?? ''}
                onChange={(e) => A.setPositionNote(selPlayer.id, e.target.value)}
              />
            </Section>
          )}

          <Section title="Notes">
            <textarea className={`${field} mt-2`} rows={4} value={doc.play.notes ?? ''} onChange={(e) => A.setPlayMeta({ notes: e.target.value || undefined })} />
          </Section>

          {picker && (
            <FormationPicker
              side={picker}
              title={picker === 'offense' ? 'Change formation' : 'Set defensive front'}
              onClose={() => setPicker(null)}
              onPick={(f: Formation | null) => {
                if (f) A.applyFormationToPlay(f);
                setPicker(null);
              }}
            />
          )}
        </>
      ) : (
        <>
          <Section title="Formation">
            <label className={label}>Name</label>
            <input className={field} value={doc.formation.name} onChange={(e) => A.setFormationMeta({ name: e.target.value })} />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className={label}>Personnel</label>
                <input className={field} placeholder="11" value={doc.formation.personnel ?? ''} onChange={(e) => A.setFormationMeta({ personnel: e.target.value || undefined })} />
              </div>
              <div>
                <label className={label}>Players / side</label>
                <select className={field} value={doc.formation.playersPerSide} onChange={(e) => A.setFormationMeta({ playersPerSide: Number(e.target.value) as PlayersPerSide })}>
                  {[6, 7, 8, 9, 11, 12].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
            </div>
            {doc.formation.side === 'defense' && (
              <>
                <label className={label}>Default coverage</label>
                <input className={field} list="coverages" value={doc.formation.coverage ?? ''} onChange={(e) => A.setFormationMeta({ coverage: e.target.value || undefined })} />
                <datalist id="coverages">
                  {COVERAGES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </>
            )}
            <label className={label}>Tags</label>
            <input className={field} value={doc.formation.tags.join(', ')} onChange={(e) => A.setFormationMeta({ tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
            <label className={label}>Family</label>
            <input className={field} placeholder="3x1 'T'" value={doc.formation.family ?? ''} onChange={(e) => A.setFormationMeta({ family: e.target.value || undefined })} />
            <label className={label}>Note</label>
            <textarea className={field} rows={2} value={doc.formation.note ?? ''} onChange={(e) => A.setFormationMeta({ note: e.target.value || undefined })} />
            <label className="flex items-center gap-2 text-xs mt-2 select-none">
              <input type="checkbox" checked={doc.formation.confidence === 'needs-review'} onChange={(e) => A.setFormationMeta({ confidence: e.target.checked ? 'needs-review' : 'derived' })} />
              Needs review (positions are a starting shape)
            </label>
            {doc.formation.source && (
              <div className="text-xs text-neutral-500 mt-1">
                {doc.formation.source}
                {doc.formation.sourcePage ? `, p.${doc.formation.sourcePage}` : ''}
              </div>
            )}
            <div className="flex gap-2 mt-3">
              <button className={btn} onClick={() => addPlayer(doc.formation.side)}>+ Player</button>
            </div>
            <div className="text-xs text-neutral-500 mt-3">
              {Object.keys(doc.formation.players).length} players on the field. Drag to move, Shift-click to multi-select, double-click a label to rename.
            </div>
          </Section>
        </>
      )}

      <Section title="Shortcuts">
        <div className="text-xs text-neutral-600 leading-5 mt-1">
          V select · R route · B block · M motion · T text · H pan · Space+drag pan · wheel zoom
          <br />
          Double-click player: draw route · 0-9: route tree · P: primary · F: flip · Del: delete · Ctrl+Z/Y undo/redo · Ctrl+D duplicate · Ctrl+0 fit
          <br />
          While drawing: click adds points · Enter/double-click finishes · Esc cancels · Block tool snaps to 45°
          <br />
          Curves: select a line, then drag the diamond handle in the middle of a segment to bend it. Drag it back to the line to straighten.
          <br />
          Lining up: dragging a player near a row snaps to the next open slot at that row&apos;s spacing (orange bar). Alt = no snap, Shift = one axis.
          <br />
          Landmarks: dragging sideways also snaps to field spots (each yard around the hash, top / middle / bottom of the numbers, 2 and 4 from the sideline, middle of the field) and names the spot. G shows them all. They never print.
        </div>
      </Section>
    </aside>
  );
}
