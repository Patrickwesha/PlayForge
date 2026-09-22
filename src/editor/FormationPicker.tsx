'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Formation, Side } from '@/model/types';
import { repo } from '@/store/repo';
import { FORMATION_FIT } from '@/geometry/bounds';
import { PlayThumb } from '@/render/PlayThumb';

export function FormationPicker({
  side,
  title,
  onPick,
  onClose,
  allowNone,
}: {
  side: Side;
  title: string;
  onPick: (f: Formation | null) => void;
  onClose: () => void;
  allowNone?: boolean;
}) {
  const formations = useLiveQuery(() => repo.listFormations(side), [side]);
  const [q, setQ] = useState('');
  const list = useMemo(() => (formations ?? []).filter((f) => `${f.name} ${f.personnel ?? ''} ${f.family ?? ''}`.toLowerCase().includes(q.toLowerCase())), [formations, q]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 p-3 border-b">
          <h2 className="font-bold">{title}</h2>
          <input autoFocus className="ml-auto border rounded px-2 py-1 text-sm w-56" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />
          {allowNone && (
            <button className="text-sm underline" onClick={() => onPick(null)}>
              None
            </button>
          )}
          <button className="text-sm px-2" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="overflow-y-auto p-3 grid gap-3 grid-cols-2 md:grid-cols-4">
          {list.map((f) => (
            <button key={f.id} className="text-left border border-neutral-300 rounded hover:border-black bg-white" onClick={() => onPick(f)}>
              <div className="text-xs font-bold px-2 py-1 border-b uppercase truncate">
                {f.personnel ? `[${f.personnel}] ` : ''}
                {f.name}
              </div>
              <div className="aspect-[3/2]">
                <PlayThumb diagram={{ players: f.players, paths: {}, annotations: {} }} aspect={1.5} fit={FORMATION_FIT} />
              </div>
            </button>
          ))}
          {list.length === 0 && <div className="col-span-full text-sm text-neutral-500 p-4">No formations.</div>}
        </div>
      </div>
    </div>
  );
}
