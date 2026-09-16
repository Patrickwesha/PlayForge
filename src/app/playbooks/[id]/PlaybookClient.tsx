'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Formation, LayoutId, Paper, Play, Playbook, PlaybookSection } from '@/model/types';
import { repo } from '@/store/repo';
import { did } from '@/model/ids';
import { PLAY_LAYOUTS } from '@/geometry/layout';
import { PlayThumb } from '@/render/PlayThumb';
import { playHeaderLine1 } from '@/model/factories';

const btn = 'text-xs px-2 py-1 rounded border border-neutral-300 bg-white hover:border-black disabled:opacity-40';
const field = 'border border-neutral-300 rounded px-2 py-1 text-sm bg-white';

export function PlaybookClient({ id }: { id: string }) {
  const [pb, setPb] = useState<Playbook | null | undefined>(undefined);
  const playsQ = useLiveQuery(() => repo.listPlays(), []);
  const formationsQ = useLiveQuery(() => repo.listFormations(), []);
  const plays = useMemo(() => playsQ ?? [], [playsQ]);
  const formations = useMemo(() => formationsQ ?? [], [formationsQ]);
  const playMap = useMemo(() => new Map(plays.map((p) => [p.id, p])), [plays]);
  const formMap = useMemo(() => new Map(formations.map((f) => [f.id, f])), [formations]);
  const [adding, setAdding] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ sectionId: string; index: number } | null>(null);

  useEffect(() => {
    repo.getPlaybook(id).then((row) => setPb(row ?? null));
  }, [id]);

  const update = (fn: (draft: Playbook) => void) => {
    setPb((cur) => {
      if (!cur) return cur;
      const next = structuredClone(cur);
      fn(next);
      void repo.savePlaybook(next);
      return next;
    });
  };

  if (pb === undefined) return <div className="p-8 text-neutral-500">Loading…</div>;
  if (pb === null)
    return (
      <div className="p-8">
        Playbook not found. <Link className="underline" href="/playbooks">Back</Link>
      </div>
    );

  const printHref = `/print?playbook=${pb.id}&layout=${pb.defaultLayout}&paper=${pb.paper}&cover=${pb.cover.showCover ? 1 : 0}`;

  return (
    <main className="max-w-6xl mx-auto w-full p-6">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <Link href="/playbooks" className="text-neutral-500 hover:text-black text-sm">&larr; Playbooks</Link>
        <input className={`${field} font-bold uppercase w-64`} value={pb.name} onChange={(e) => update((d) => (d.name = e.target.value))} />
        <input className={`${field} w-48`} placeholder="Subtitle (red, quoted)" value={pb.subtitle ?? ''} onChange={(e) => update((d) => (d.subtitle = e.target.value || undefined))} />
        <select className={field} value={pb.defaultLayout} onChange={(e) => update((d) => (d.defaultLayout = e.target.value as LayoutId))}>
          {PLAY_LAYOUTS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <select className={field} value={pb.paper} onChange={(e) => update((d) => (d.paper = e.target.value as Paper))}>
          <option value="letter">Letter</option>
          <option value="a4">A4</option>
        </select>
        <label className="text-sm flex items-center gap-1">
          <input type="checkbox" checked={pb.cover.showCover} onChange={(e) => update((d) => (d.cover.showCover = e.target.checked))} /> Cover
        </label>
        <Link href={printHref} className="ml-auto text-sm px-3 py-1 rounded bg-black text-white">Print playbook</Link>
        <Link href={`${printHref}&callsheet=1`} className={btn}>Print + call sheet</Link>
      </div>

      {pb.cover.showCover && (
        <div className="flex gap-2 mb-4 flex-wrap">
          <input className={field} placeholder="Cover title" value={pb.cover.title} onChange={(e) => update((d) => (d.cover.title = e.target.value))} />
          <input className={field} placeholder="Cover subtitle" value={pb.cover.subtitle ?? ''} onChange={(e) => update((d) => (d.cover.subtitle = e.target.value || undefined))} />
          <input className={field} placeholder="Team" value={pb.cover.team ?? ''} onChange={(e) => update((d) => (d.cover.team = e.target.value || undefined))} />
          <input className={field} placeholder="Season" value={pb.cover.season ?? ''} onChange={(e) => update((d) => (d.cover.season = e.target.value || undefined))} />
        </div>
      )}

      {pb.sections.map((sec, si) => (
        <section key={sec.id} className="mb-6 bg-white border border-neutral-300 rounded">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-neutral-200">
            <input className={`${field} font-bold w-56`} value={sec.title} onChange={(e) => update((d) => (d.sections[si].title = e.target.value))} />
            <span className="text-xs text-neutral-500">{sec.kind} · {sec.itemIds.length}</span>
            <button className={btn} disabled={si === 0} onClick={() => update((d) => { const [s] = d.sections.splice(si, 1); d.sections.splice(si - 1, 0, s); })}>↑</button>
            <button className={btn} disabled={si === pb.sections.length - 1} onClick={() => update((d) => { const [s] = d.sections.splice(si, 1); d.sections.splice(si + 1, 0, s); })}>↓</button>
            <button className={`${btn} ml-auto`} onClick={() => setAdding(adding === sec.id ? null : sec.id)}>+ Add {sec.kind}</button>
            <button className={`${btn} text-red-700`} onClick={() => confirm('Remove this section?') && update((d) => d.sections.splice(si, 1))}>Remove</button>
          </div>

          {adding === sec.id && (
            <AddPicker
              kind={sec.kind}
              plays={plays}
              formations={formations}
              existing={new Set(sec.itemIds)}
              onAdd={(ids) => update((d) => d.sections[si].itemIds.push(...ids.filter((x) => !d.sections[si].itemIds.includes(x))))}
              onClose={() => setAdding(null)}
            />
          )}

          <div className="grid gap-2 grid-cols-2 md:grid-cols-4 lg:grid-cols-6 p-3">
            {sec.itemIds.map((itemId, ii) => {
              const play = sec.kind === 'plays' ? playMap.get(itemId) : undefined;
              const form = sec.kind === 'formations' ? formMap.get(itemId) : undefined;
              const diagram = play?.diagram ?? (form ? { players: form.players, paths: {}, annotations: {} } : null);
              const title = play ? play.name : form ? form.name : '(missing)';
              return (
                <div
                  key={itemId}
                  draggable
                  onDragStart={() => setDragging({ sectionId: sec.id, index: ii })}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (!dragging || dragging.sectionId !== sec.id || dragging.index === ii) return;
                    update((d) => { const arr = d.sections[si].itemIds; const [m] = arr.splice(dragging.index, 1); arr.splice(ii, 0, m); });
                    setDragging(null);
                  }}
                  className="border border-neutral-300 rounded overflow-hidden bg-white cursor-grab"
                >
                  <div className="text-[10px] font-bold uppercase px-1.5 py-0.5 border-b truncate flex items-center">
                    <span className="text-neutral-400 mr-1">{ii + 1}</span>
                    <span className="truncate">{play ? playHeaderLine1(play) + ' ' : ''}{title}</span>
                  </div>
                  <div className="aspect-[4/3]">{diagram && <PlayThumb diagram={diagram} aspect={4 / 3} view={play?.view} fit={form ? { losBand: 2, maxBack: 8 } : undefined} />}</div>
                  <div className="flex text-[11px] border-t border-neutral-200">
                    <button className="px-1.5 py-0.5 hover:bg-neutral-100" disabled={ii === 0} onClick={() => update((d) => { const arr = d.sections[si].itemIds; [arr[ii - 1], arr[ii]] = [arr[ii], arr[ii - 1]]; })}>◀</button>
                    <button className="px-1.5 py-0.5 hover:bg-neutral-100" disabled={ii === sec.itemIds.length - 1} onClick={() => update((d) => { const arr = d.sections[si].itemIds; [arr[ii + 1], arr[ii]] = [arr[ii], arr[ii + 1]]; })}>▶</button>
                    {play && <Link href={`/plays/${play.id}`} className="px-1.5 py-0.5 hover:bg-neutral-100">Edit</Link>}
                    <button className="ml-auto px-1.5 py-0.5 text-red-700 hover:bg-neutral-100" onClick={() => update((d) => d.sections[si].itemIds.splice(ii, 1))}>✕</button>
                  </div>
                </div>
              );
            })}
            {sec.itemIds.length === 0 && <div className="col-span-full text-xs text-neutral-500">Empty section. Use “Add”.</div>}
          </div>
        </section>
      ))}

      <div className="flex gap-2">
        <button className={btn} onClick={() => update((d) => d.sections.push({ id: did(), title: 'New section', kind: 'plays', itemIds: [] }))}>+ Plays section</button>
        <button className={btn} onClick={() => update((d) => d.sections.push({ id: did(), title: 'Formations', kind: 'formations', itemIds: [] }))}>+ Formations section</button>
      </div>
    </main>
  );
}

function AddPicker({ kind, plays, formations, existing, onAdd, onClose }: { kind: PlaybookSection['kind']; plays: Play[]; formations: Formation[]; existing: Set<string>; onAdd: (ids: string[]) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<Set<string>>(new Set());
  const items = kind === 'plays' ? plays.map((p) => ({ id: p.id, title: `${playHeaderLine1(p)} ${p.name}`.trim(), sub: p.category })) : formations.map((f) => ({ id: f.id, title: f.name, sub: f.side }));
  const list = items.filter((i) => i.title.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="p-3 border-b border-neutral-200 bg-neutral-50">
      <div className="flex gap-2 items-center mb-2">
        <input autoFocus className={field} placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={btn} onClick={() => setSel(new Set(list.filter((i) => !existing.has(i.id)).map((i) => i.id)))}>Select all</button>
        <button className="text-xs px-3 py-1 rounded bg-black text-white disabled:opacity-40" disabled={sel.size === 0} onClick={() => { onAdd([...sel]); onClose(); }}>Add {sel.size}</button>
        <button className={btn} onClick={onClose}>Close</button>
      </div>
      <div className="grid gap-1 grid-cols-2 md:grid-cols-3 max-h-56 overflow-y-auto">
        {list.map((i) => (
          <label key={i.id} className={`flex items-center gap-2 text-xs px-2 py-1 rounded border ${existing.has(i.id) ? 'opacity-50 border-neutral-200' : 'border-neutral-300 bg-white'}`}>
            <input type="checkbox" disabled={existing.has(i.id)} checked={sel.has(i.id)} onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(i.id); else n.delete(i.id); return n; })} />
            <span className="truncate uppercase font-semibold">{i.title}</span>
            <span className="ml-auto text-neutral-400">{i.sub}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
