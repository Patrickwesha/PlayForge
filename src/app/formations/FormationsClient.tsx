'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Formation, Side } from '@/model/types';
import { repo } from '@/store/repo';
import { duplicateFormation, newFormation } from '@/model/factories';
import { flipFormationPlayers, flipName } from '@/geometry/flip';
import { PlayThumb } from '@/render/PlayThumb';
import { buildPlayers, ol } from '@/seeds/builders';

const btn = 'text-xs px-2 py-1 rounded border border-neutral-300 bg-white hover:border-black';

export function FormationsClient() {
  const router = useRouter();
  const [side, setSide] = useState<Side>('offense');
  const [q, setQ] = useState('');
  const formations = useLiveQuery(() => repo.listFormations(side), [side]);
  const list = useMemo(
    () => (formations ?? []).filter((f) => `${f.name} ${f.personnel ?? ''} ${f.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase())),
    [formations, q],
  );

  const create = async () => {
    const f = newFormation({
      name: side === 'offense' ? 'NEW FORMATION' : 'NEW FRONT',
      side,
      players: side === 'offense' ? buildPlayers('new', 'offense', [...ol('long'), { label: 'Q', x: 0, y: -1.2, role: 'QB' }]) : {},
    });
    await repo.saveFormation(f);
    router.push(`/formations/${f.id}`);
  };
  const dup = async (f: Formation) => {
    await repo.saveFormation(duplicateFormation(f));
  };
  const flip = async (f: Formation) => {
    const copy = duplicateFormation(f, flipName(f.name) === f.name ? `${f.name} (FLIPPED)` : flipName(f.name));
    copy.players = flipFormationPlayers(copy);
    await repo.saveFormation(copy);
  };
  const del = async (f: Formation) => {
    if (!confirm(`Delete "${f.name}"? Plays keep their own copy of the players.`)) return;
    await repo.deleteFormation(f.id);
  };

  return (
    <main className="max-w-6xl mx-auto w-full p-6">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h1 className="text-xl font-bold">Formations</h1>
        <div className="flex rounded overflow-hidden border border-neutral-300">
          {(['offense', 'defense'] as const).map((s) => (
            <button key={s} className={`px-3 py-1 text-sm ${side === s ? 'bg-black text-white' : 'bg-white'}`} onClick={() => setSide(s)}>
              {s === 'offense' ? 'Offense' : 'Defense'}
            </button>
          ))}
        </div>
        <input className="border border-neutral-300 rounded px-2 py-1 text-sm w-56" placeholder="Search name, personnel, tag" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="ml-auto flex gap-2">
          <Link href={`/print?formations=${list.map((f) => f.id).join(',')}&layout=9up&title=${encodeURIComponent(side.toUpperCase() + ' FORMATIONS')}`} className={btn}>
            Print sheet
          </Link>
          <button className="text-sm px-3 py-1 rounded bg-black text-white" onClick={() => void create()}>
            + New {side === 'offense' ? 'formation' : 'front'}
          </button>
        </div>
      </div>
      {!formations && <div className="text-neutral-500">Loading…</div>}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {list.map((f) => (
          <div key={f.id} className="border border-neutral-300 bg-white rounded overflow-hidden hover:border-black">
            <Link href={`/formations/${f.id}`} className="block">
              <div className="text-xs font-bold px-2 py-1 border-b uppercase truncate">
                {f.personnel ? `[${f.personnel}] ` : ''}
                {f.name}
                {f.playersPerSide !== 11 && <span className="ml-1 text-neutral-400">({f.playersPerSide})</span>}
              </div>
              <div className="aspect-[3/2]">
                <PlayThumb diagram={{ players: f.players, paths: {}, annotations: {} }} aspect={1.5} fit={{ losBand: 2, maxBack: 8 }} />
              </div>
            </Link>
            <div className="flex gap-1 p-1.5 border-t border-neutral-200 text-xs">
              <button className={btn} onClick={() => void dup(f)}>Duplicate</button>
              <button className={btn} onClick={() => void flip(f)}>Flip copy</button>
              <button className={`${btn} ml-auto text-red-700`} onClick={() => void del(f)}>Delete</button>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
