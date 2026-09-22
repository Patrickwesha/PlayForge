'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Formation, Side } from '@/model/types';
import { repo } from '@/store/repo';
import { duplicateFormation, newFormation } from '@/model/factories';
import { flipFormationPlayers, flipName } from '@/geometry/flip';
import { FORMATION_FIT } from '@/geometry/bounds';
import { PlayThumb } from '@/render/PlayThumb';
import { buildPlayers, ol } from '@/seeds/builders';

const btn = 'text-xs px-2 py-1 rounded border border-neutral-300 bg-white hover:border-black';

export function FormationsClient() {
  const router = useRouter();
  const [side, setSide] = useState<Side>('offense');
  const [q, setQ] = useState('');
  const [family, setFamily] = useState('');
  const [reviewOnly, setReviewOnly] = useState(false);
  const formations = useLiveQuery(() => repo.listFormations(side), [side]);
  const families = useMemo(() => [...new Set((formations ?? []).map((f) => f.family).filter((x): x is string => !!x))].sort(), [formations]);
  const reviewCount = useMemo(() => (formations ?? []).filter((f) => f.confidence === 'needs-review').length, [formations]);
  const list = useMemo(
    () =>
      (formations ?? []).filter(
        (f) =>
          (!family || f.family === family) &&
          (!reviewOnly || f.confidence === 'needs-review') &&
          `${f.name} ${f.personnel ?? ''} ${f.tags.join(' ')} ${f.family ?? ''} ${f.confidence ?? ''} ${f.note ?? ''}`.toLowerCase().includes(q.toLowerCase()),
      ),
    [formations, q, family, reviewOnly],
  );

  const create = async () => {
    const f = newFormation({
      name: side === 'offense' ? 'NEW FORMATION' : 'NEW FRONT',
      side,
      players: side === 'offense' ? buildPlayers('new', 'offense', [...ol(), { label: 'Q', x: 0, y: -1.2, role: 'QB' }]) : {},
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
    if (copy.strength) copy.strength = copy.strength === 'left' ? 'right' : 'left';
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
        <input className="border border-neutral-300 rounded px-2 py-1 text-sm w-56" placeholder="Search name, personnel, family, tag" value={q} onChange={(e) => setQ(e.target.value)} />
        {families.length > 0 && (
          <select className="border border-neutral-300 rounded px-2 py-1 text-sm bg-white" value={family} onChange={(e) => setFamily(e.target.value)} aria-label="Family">
            <option value="">All families</option>
            {families.map((fam) => (
              <option key={fam} value={fam}>{fam}</option>
            ))}
          </select>
        )}
        {reviewCount > 0 && (
          <label className="flex items-center gap-1.5 text-sm select-none">
            <input type="checkbox" checked={reviewOnly} onChange={(e) => setReviewOnly(e.target.checked)} />
            Needs review ({reviewCount})
          </label>
        )}
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
              <div className="text-xs font-bold px-2 py-1 border-b uppercase truncate" title={f.note}>
                {f.personnel ? `[${f.personnel}] ` : ''}
                {f.name}
                {f.playersPerSide !== 11 && <span className="ml-1 text-neutral-400">({f.playersPerSide})</span>}
              </div>
              {(f.family || f.confidence === 'needs-review') && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 border-b text-[11px] text-neutral-600">
                  <span className="truncate">{f.family}</span>
                  {f.sourcePage && <span className="text-neutral-400">p.{f.sourcePage}</span>}
                  {f.confidence === 'needs-review' && <span className="ml-auto shrink-0 rounded bg-amber-100 text-amber-900 px-1 font-semibold">needs review</span>}
                </div>
              )}
              <div className="aspect-[3/2]">
                <PlayThumb diagram={{ players: f.players, paths: {}, annotations: {} }} aspect={1.5} fit={FORMATION_FIT} />
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
