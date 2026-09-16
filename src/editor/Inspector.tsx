'use client';

import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { Formation, PlayCategory, PlayersPerSide } from '@/model/types';
import { diagramOf, useEditor } from '@/store/editorStore';
import * as A from '@/store/editorActions';
import { COVERAGES } from '@/seeds';
import { FormationPicker } from './FormationPicker';

const field = 'w-full border border-neutral-300 rounded px-2 py-1 text-sm bg-white';
const label = 'block text-[11px] uppercase tracking-wide text-neutral-500 mt-3 mb-0.5';
const btn = 'text-xs px-2 py-1 rounded border border-neutral-300 bg-white hover:border-black';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-neutral-200 p-3">
      <div className="font-bold text-sm">{title}</div>
      {children}
    </div>
  );
}

export function Inspector() {
  const { doc, selection } = useEditor(useShallow((s) => ({ doc: s.doc, selection: s.selection })));
  const [picker, setPicker] = useState<null | 'offense' | 'defense'>(null);
  if (!doc) return null;
  const diagram = diagramOf(doc);
  const selPlayer = selection.playerIds.length === 1 ? diagram.players[selection.playerIds[0]] : undefined;

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
          While drawing: click adds points · C curves the last point · Enter/double-click finishes · Esc cancels
        </div>
      </Section>
    </aside>
  );
}
