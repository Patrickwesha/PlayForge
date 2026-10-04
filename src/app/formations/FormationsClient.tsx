'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Formation, Side, Snap } from '@/model/types';
import { repo } from '@/store/repo';
import { duplicateFormation, newFormation } from '@/model/factories';
import { flipFormationPlayers, flipName } from '@/geometry/flip';
import { FORMATION_FIT } from '@/geometry/bounds';
import { PlayThumb } from '@/render/PlayThumb';
import { buildPlayers, ol } from '@/seeds/builders';
import { PlaybookChip, PlaybookFilter, matchesPlaybook, usePlaybookMembership, type PlaybookFilterValue } from '@/components/PlaybookFilter';

const btn = 'text-xs px-2 py-1 rounded border border-neutral-300 bg-white hover:border-black';

export function FormationsClient() {
  const router = useRouter();
  const [side, setSide] = useState<Side>('offense');
  const [q, setQ] = useState('');
  const [family, setFamily] = useState('');
  const [reviewOnly, setReviewOnly] = useState(false);
  const [sort, setSort] = useState<'name' | 'usage'>('name');
  const [book, setBook] = useState<PlaybookFilterValue>('');
  const formations = useLiveQuery(() => repo.listFormations(side), [side]);
  const { playbooks, memberOf } = usePlaybookMembership('formations');
  const snaps = useLiveQuery(() => repo.listSnaps(), []);
  const snapsByFormation = useMemo(() => {
    const m = new Map<string, Snap[]>();
    for (const s of snaps ?? []) m.set(s.formationId, [...(m.get(s.formationId) ?? []), s]);
    return m;
  }, [snaps]);
  // live count from the snaps on this device; a stored count on a copied or hand-edited formation is not shown as usage
  const usageOf = (f: Formation) => (snaps ? (snapsByFormation.get(f.id)?.length ?? 0) : (f.usage?.count ?? 0));
  const families = useMemo(() => [...new Set((formations ?? []).map((f) => f.family).filter((x): x is string => !!x))].sort(), [formations]);
  const reviewCount = useMemo(() => (formations ?? []).filter((f) => f.confidence === 'needs-review').length, [formations]);
  const list = useMemo(() => {
    // a snap id (W1-001) finds only the formation that snap is linked to, not every note that mentions it
    const snapId = /^w[0-9]+-[0-9k]+$/i.test(q.trim()) ? q.trim().toUpperCase() : null;
    const rows = (formations ?? []).filter(
      (f) =>
        snapId ? (snapsByFormation.get(f.id) ?? []).some((s) => s.playId.toUpperCase() === snapId) :
        (!family || f.family === family) &&
        (!reviewOnly || f.confidence === 'needs-review') &&
        matchesPlaybook(book, f.id, memberOf) &&
        `${f.name} ${f.alias ?? ''} ${f.chartName ?? ''} ${f.personnel ?? ''} ${f.tags.join(' ')} ${f.family ?? ''} ${f.confidence ?? ''} ${f.note ?? ''} ${f.usage?.snapIds.join(' ') ?? ''}`.toLowerCase().includes(q.toLowerCase()),
    );
    if (sort === 'usage') rows.sort((a, b) => usageOf(b) - usageOf(a) || a.name.localeCompare(b.name));
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formations, q, family, reviewOnly, sort, snapsByFormation, book, memberOf]);
  const hasUsage = (formations ?? []).some((f) => usageOf(f) > 0);
  // formations that came from the Green Bay book reader (gb19-): guesses from cut-off scans, not the pack (seed-gb19-) or charted snaps
  const imported = useMemo(() => (formations ?? []).filter((f) => f.id.startsWith('gb19-')), [formations]);
  const [removing, setRemoving] = useState(false);
  const removeImported = async () => {
    if (!confirm(`Remove ${imported.length} formations imported from the Green Bay book? The formation pack and the charted formations stay, and plays keep their own copy of the players. This syncs to your other devices and cannot be undone.`)) return;
    setRemoving(true);
    try {
      for (const f of imported) await repo.deleteFormation(f.id);
    } finally {
      setRemoving(false);
    }
  };

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
        <input className="border border-neutral-300 rounded px-2 py-1 text-sm w-56" placeholder="Search name, personnel, family, tag, snap id" value={q} onChange={(e) => setQ(e.target.value)} />
        {hasUsage && (
          <select className="border border-neutral-300 rounded px-2 py-1 text-sm bg-white" value={sort} onChange={(e) => setSort(e.target.value as 'name' | 'usage')} aria-label="Sort">
            <option value="name">Sort: name</option>
            <option value="usage">Sort: most used</option>
          </select>
        )}
        {families.length > 0 && (
          <select className="border border-neutral-300 rounded px-2 py-1 text-sm bg-white" value={family} onChange={(e) => setFamily(e.target.value)} aria-label="Family">
            <option value="">All families</option>
            {families.map((fam) => (
              <option key={fam} value={fam}>{fam}</option>
            ))}
          </select>
        )}
        <PlaybookFilter className="border border-neutral-300 rounded px-2 py-1 text-sm bg-white" value={book} onChange={setBook} playbooks={playbooks} kind="formations" itemIds={(formations ?? []).map((f) => f.id)} memberOf={memberOf} />
        {reviewCount > 0 && (
          <label className="flex items-center gap-1.5 text-sm select-none">
            <input type="checkbox" checked={reviewOnly} onChange={(e) => setReviewOnly(e.target.checked)} />
            Needs review ({reviewCount})
          </label>
        )}
        <div className="ml-auto flex gap-2">
          {imported.length > 0 && (
            <button className={btn} onClick={() => void removeImported()} disabled={removing} title="Delete every formation that came from the Green Bay book reader. The formation pack, the charted formations and formations you created stay.">
              {removing ? 'Removing…' : `Remove ${imported.length} imported formations`}
            </button>
          )}
          <Link href={`/print?formations=${list.map((f) => f.id).join(',')}&layout=9up&title=${encodeURIComponent(side.toUpperCase() + ' FORMATIONS')}`} className={btn}>
            Print sheet
          </Link>
          {side === 'offense' && (
            <Link href="/formations/import" className={btn}>
              Import
            </Link>
          )}
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
              {(f.family || f.confidence === 'needs-review' || usageOf(f) > 0 || memberOf.has(f.id)) && (
                <div className="flex items-center gap-1.5 px-2 py-0.5 border-b text-[11px] text-neutral-600">
                  <span className="truncate">{f.family}</span>
                  <PlaybookChip books={memberOf.get(f.id)} />
                  {f.sourcePage && <span className="text-neutral-400">p.{f.sourcePage}</span>}
                  {usageOf(f) > 0 && (
                    <span className="shrink-0 rounded bg-black text-white px-1 font-semibold" title={`${usageOf(f)} charted snaps: ${(snapsByFormation.get(f.id)?.map((s) => s.playId) ?? f.usage?.snapIds ?? []).join(', ')}`}>
                      {usageOf(f)} snap{usageOf(f) === 1 ? '' : 's'}
                    </span>
                  )}
                  {f.confidence === 'needs-review' && <span className="ml-auto shrink-0 rounded bg-amber-100 text-amber-900 px-1 font-semibold">needs review</span>}
                </div>
              )}
              <div className="aspect-[3/2]">
                <PlayThumb diagram={{ players: f.players, paths: {}, annotations: {} }} aspect={1.5} fit={FORMATION_FIT} />
              </div>
            </Link>
            {(snapsByFormation.get(f.id)?.length ?? 0) > 0 && <SnapList snaps={snapsByFormation.get(f.id)!} />}
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

const ordinal = (d: number) => `${d}${d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'}`;

/** The charted snaps behind a formation: week, down and distance, call, result. */
function SnapList({ snaps }: { snaps: Snap[] }) {
  const runs = snaps.filter((s) => s.callType === 'run').length;
  const passes = snaps.filter((s) => s.callType === 'pass').length;
  const template = snaps.filter((s) => s.source === 'template').length;
  return (
    <details className="border-t border-neutral-200 text-[11px]">
      <summary className="px-2 py-1 cursor-pointer select-none text-neutral-700">
        {snaps.length} snap{snaps.length === 1 ? '' : 's'}: {runs} run, {passes} pass{template ? `, ${template} from template` : ''}
      </summary>
      <ul className="px-2 pb-1.5 max-h-40 overflow-auto space-y-0.5">
        {[...snaps]
          .sort((a, b) => a.week - b.week || a.playId.localeCompare(b.playId))
          .map((s) => (
            <li key={s.id} className="flex gap-1.5 whitespace-nowrap" title={[s.set && `Set: ${s.set}`, s.motion && `Motion: ${s.motion}`, s.notes].filter(Boolean).join('\n')}>
              <span className="font-mono">{s.playId}</span>
              <span className="text-neutral-500">{s.down ? `${ordinal(s.down)}&${s.distance ?? '?'}` : ''}</span>
              <span className="text-neutral-500">{s.hash ? s.hash[0] : ''}</span>
              <span className="truncate">{s.result ?? s.playType ?? ''}{s.yards !== undefined ? ` ${s.yards > 0 ? '+' : ''}${s.yards}` : ''}</span>
              {s.mirrored && <span className="text-neutral-400">mirror</span>}
              {s.source === 'template' && <span className="text-amber-800">template</span>}
            </li>
          ))}
      </ul>
    </details>
  );
}
