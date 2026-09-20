'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Formation, Play, PlayCategory } from '@/model/types';
import { repo } from '@/store/repo';
import { duplicatePlay, newPlay, playDefenseLabel, playHeaderLine1 } from '@/model/factories';
import { flipDiagram, flipName } from '@/geometry/flip';
import { CanBadge } from '@/components/CanBadge';
import { PlayThumb } from '@/render/PlayThumb';
import { FormationPicker } from '@/editor/FormationPicker';

const btn = 'text-xs px-2 py-1 rounded border border-neutral-300 bg-white hover:border-black';
const CATS: (PlayCategory | 'All')[] = ['All', 'Run', 'Pass', 'PA', 'Screen', 'Special'];

export function PlaysClient() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<PlayCategory | 'All'>('All');
  const [picker, setPicker] = useState<null | 'offense' | 'defense'>(null);
  const [pendingOffense, setPendingOffense] = useState<Formation | null>(null);
  const plays = useLiveQuery(() => repo.listPlays(), []);
  const list = useMemo(
    () =>
      (plays ?? []).filter(
        (p) => (cat === 'All' || p.category === cat) && `${p.name} ${p.formationLabel ?? ''} ${p.personnel ?? ''} ${p.tags.join(' ')} ${playDefenseLabel(p)}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [plays, q, cat],
  );

  const createWith = async (offense: Formation | null, defense: Formation | null) => {
    const p = newPlay({ name: 'NEW PLAY', offense: offense ?? undefined, defense: defense ?? undefined });
    await repo.savePlay(p);
    router.push(`/plays/${p.id}`);
  };
  const dup = async (p: Play) => {
    await repo.savePlay(duplicatePlay(p));
  };
  const flip = async (p: Play) => {
    const copy = duplicatePlay(p, flipName(p.name));
    copy.diagram = flipDiagram(copy.diagram);
    if (copy.formationLabel) copy.formationLabel = flipName(copy.formationLabel);
    await repo.savePlay(copy);
  };
  const del = async (p: Play) => {
    if (!confirm(`Delete "${p.name}"?`)) return;
    await repo.deletePlay(p.id);
  };

  return (
    <main className="max-w-6xl mx-auto w-full p-6">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h1 className="text-xl font-bold">Plays</h1>
        <div className="flex rounded overflow-hidden border border-neutral-300">
          {CATS.map((c) => (
            <button key={c} className={`px-2.5 py-1 text-sm ${cat === c ? 'bg-black text-white' : 'bg-white'}`} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
        <input className="border border-neutral-300 rounded px-2 py-1 text-sm w-56" placeholder="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="ml-auto flex gap-2">
          <Link href={`/print?plays=${list.map((p) => p.id).join(',')}&layout=6up&title=${encodeURIComponent(cat === 'All' ? 'PLAYS' : cat.toUpperCase() + ' PLAYS')}`} className={btn}>
            Print these ({list.length})
          </Link>
          <button className="text-sm px-3 py-1 rounded bg-black text-white" onClick={() => setPicker('offense')}>
            + New play
          </button>
        </div>
      </div>
      {!plays && <div className="text-neutral-500">Loading…</div>}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((p) => (
          <div key={p.id} className="border border-neutral-300 bg-white rounded overflow-hidden hover:border-black">
            <Link href={`/plays/${p.id}`} className="block">
              <div className="px-2 py-1 border-b text-center leading-tight">
                <div className="text-[11px] font-bold uppercase text-neutral-600">{playHeaderLine1(p) || ' '}</div>
                <div className="text-sm font-bold uppercase truncate">{p.name}</div>
              </div>
              <div className="aspect-[4/3]">
                <PlayThumb diagram={p.diagram} aspect={4 / 3} view={p.view} />
              </div>
              <CanBadge play={p} />
            </Link>
            <div className="flex items-center gap-1 p-1.5 border-t border-neutral-200 text-xs">
              <span className="px-1.5 py-0.5 rounded bg-neutral-100">{p.category}</span>
              <span className="text-neutral-500 truncate">{playDefenseLabel(p)}</span>
              <span className="ml-auto" />
              <button className={btn} onClick={() => void dup(p)}>Dup</button>
              <button className={btn} onClick={() => void flip(p)}>Flip</button>
              <button className={`${btn} text-red-700`} onClick={() => void del(p)}>Del</button>
            </div>
          </div>
        ))}
        {plays && list.length === 0 && <div className="text-neutral-500 col-span-full">No plays match.</div>}
      </div>

      {picker === 'offense' && (
        <FormationPicker
          side="offense"
          title="New play: pick the formation"
          allowNone
          onClose={() => setPicker(null)}
          onPick={(f) => {
            setPendingOffense(f);
            setPicker('defense');
          }}
        />
      )}
      {picker === 'defense' && (
        <FormationPicker
          side="defense"
          title="Pick a defensive front (or none)"
          allowNone
          onClose={() => setPicker(null)}
          onPick={(d) => {
            setPicker(null);
            void createWith(pendingOffense, d);
          }}
        />
      )}
    </main>
  );
}
