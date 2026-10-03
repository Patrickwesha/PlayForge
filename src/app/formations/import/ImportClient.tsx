'use client';

import Link from 'next/link';
import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Formation } from '@/model/types';
import { nowIso } from '@/model/ids';
import { repo, type SnapImportReport } from '@/store/repo';
import { FORMATION_FIT } from '@/geometry/bounds';
import { PlayThumb } from '@/render/PlayThumb';
import { buildImportPlan, parseChartXlsx, parseFormationsJson, type ImportPlan, type ParsedChart, type ParsedFormationsJson, type PlannedFormation } from '@/importers/snapChart';

const btn = 'text-xs px-2 py-1 rounded border border-neutral-300 bg-white hover:border-black disabled:opacity-40';
const field = 'border border-neutral-300 rounded px-2 py-1 text-sm bg-white';

type Loaded<T> = { name: string; data: T } | null;

const SOURCE_BADGE: Record<PlannedFormation['source'], { text: string; cls: string }> = {
  exact: { text: 'W2 exact', cls: 'bg-emerald-100 text-emerald-900' },
  template: { text: 'W1 template', cls: 'bg-amber-100 text-amber-900' },
  mixed: { text: 'exact + template', cls: 'bg-sky-100 text-sky-900' },
};

export function ImportClient() {
  const [chart, setChart] = useState<Loaded<ParsedChart>>(null);
  const [json, setJson] = useState<Loaded<ParsedFormationsJson>>(null);
  const [team, setTeam] = useState('PHI');
  const [season, setSeason] = useState(String(new Date().getFullYear()));
  const [mirror, setMirror] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // the selection belongs to one plan: a new plan (new file or option) starts with everything selected
  const [selState, setSelState] = useState<{ plan: ImportPlan | null; ids: Set<string> }>({ plan: null, ids: new Set() });
  const [report, setReport] = useState<SnapImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const xlsxRef = useRef<HTMLInputElement | null>(null);
  const jsonRef = useRef<HTMLInputElement | null>(null);

  const loadXlsx = async (file: File) => {
    setError(null);
    setReport(null);
    try {
      const data = parseChartXlsx(new Uint8Array(await file.arrayBuffer()));
      setChart({ name: file.name, data });
    } catch (e) {
      setChart(null);
      setError(`${file.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const loadJson = async (file: File) => {
    setError(null);
    setReport(null);
    try {
      const data = parseFormationsJson(await file.text());
      setJson({ name: file.name, data });
      if (data.game.team) setTeam(data.game.team);
      if (data.game.season) setSeason(String(data.game.season));
    } catch (e) {
      setJson(null);
      setError(`${file.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const seasonNum = Number(season) || new Date().getFullYear();
  const built = useMemo((): { plan: ImportPlan | null; error: string | null } => {
    if (!chart && !json) return { plan: null, error: null };
    try {
      const teamCode = team.trim() || 'TEAM';
      return { plan: buildImportPlan({ chart: chart?.data, json: json?.data }, { team: teamCode, season: seasonNum, mirror, now: nowIso(), source: `${teamCode} ${seasonNum} All-22 chart (${[chart?.name, json?.name].filter(Boolean).join(', ')})` }), error: null };
    } catch (e) {
      return { plan: null, error: e instanceof Error ? e.message : String(e) };
    }
  }, [chart, json, team, seasonNum, mirror]);
  const plan = built.plan;
  const selected = useMemo(() => (selState.plan === plan ? selState.ids : new Set(plan?.formations.map((p) => p.formation.id) ?? [])), [selState, plan]);
  const setSelected = (ids: Set<string>) => setSelState({ plan, ids });

  // what is already in the library (live, so it updates right after the import)
  const existingRows = useLiveQuery(() => (plan ? Promise.all(plan.formations.map((p) => repo.getFormation(p.formation.id))) : Promise.resolve([] as (Formation | undefined)[])), [plan]);
  const existing = useMemo(() => {
    const m = new Map<string, Formation>();
    existingRows?.forEach((r) => r && m.set(r.id, r));
    return m;
  }, [existingRows]);

  const toggle = (id: string) => {
    const n = new Set(selected);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    setSelected(n);
  };
  const selectedSnaps = plan ? plan.snaps.filter((s) => selected.has(s.formationId)).length : 0;

  const doImport = async () => {
    if (!plan) return;
    setBusy(true);
    try {
      setReport(await repo.applySnapImport(plan, selected));
    } catch (e) {
      setError(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="max-w-6xl mx-auto w-full p-6">
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h1 className="text-xl font-bold">Import formations from a snap chart</h1>
        <Link href="/formations" className={`${btn} ml-auto`}>Back to Formations</Link>
      </div>

      <section className="bg-white border border-neutral-300 rounded p-4 mb-4 text-sm">
        <div className="grid md:grid-cols-2 gap-4">
          <label className="block">
            <div className="text-xs uppercase text-neutral-500 mb-1">Chart workbook (.xlsx, sheet &quot;Chart&quot;)</div>
            <input ref={xlsxRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="text-sm" onChange={(e) => e.target.files?.[0] && void loadXlsx(e.target.files[0])} />
            {chart && <div className="text-xs text-neutral-600 mt-1">{chart.name}: {chart.data.rows.length} snaps{chart.data.skipped.length ? `, ${chart.data.skipped.length} rows skipped` : ''}</div>}
          </label>
          <label className="block">
            <div className="text-xs uppercase text-neutral-500 mb-1">Per-player alignment (.json, playforge-formations/v1)</div>
            <input ref={jsonRef} type="file" accept=".json,application/json" className="text-sm" onChange={(e) => e.target.files?.[0] && void loadJson(e.target.files[0])} />
            {json && <div className="text-xs text-neutral-600 mt-1">{json.name}: {json.data.snaps.length} snaps with exact alignment{json.data.game.week ? ` (week ${json.data.game.week})` : ''}</div>}
          </label>
        </div>
        <div className="flex items-end gap-4 flex-wrap mt-4">
          <label>
            <div className="text-xs uppercase text-neutral-500 mb-1">Team</div>
            <input className={`${field} w-20`} value={team} onChange={(e) => setTeam(e.target.value.toUpperCase())} />
          </label>
          <label>
            <div className="text-xs uppercase text-neutral-500 mb-1">Season</div>
            <input className={`${field} w-24`} value={season} inputMode="numeric" onChange={(e) => setSeason(e.target.value)} />
          </label>
          <label className="flex items-center gap-2 pb-1.5 select-none">
            <input type="checkbox" checked={mirror} onChange={(e) => setMirror(e.target.checked)} />
            Merge Rt and Lt mirrors into one formation
          </label>
        </div>
        <p className="text-xs text-neutral-500 mt-3">
          The workbook is the snap record (down, distance, result, notes). The JSON adds exact per-player alignment, joined on Play ID. Snaps without per-player data are drawn from a template keyed on personnel + family + backfield + strength (the most common alignment seen on film for that key, else a default shape) and tagged &quot;template, verify&quot;. Importing the same files again merges; it never duplicates.
        </p>
        {(error ?? built.error) && <div className="mt-3 text-sm border border-red-300 rounded p-2 bg-red-50 text-red-900">{error ?? built.error}</div>}
      </section>

      {plan && (
        <>
          <section className="bg-white border border-neutral-300 rounded p-4 mb-4 text-sm">
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <b>{plan.summary.snaps} snaps</b> ({Object.entries(plan.summary.weeks).map(([w, n]) => `${w}: ${n}`).join(', ')}; {plan.summary.exact} exact, {plan.summary.template} template) in <b>{plan.summary.formations} unique formations</b>
                {existing.size > 0 && <span className="text-neutral-600">, {existing.size} already in the library (will merge)</span>}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <button className={btn} onClick={() => setSelected(new Set(plan.formations.map((p) => p.formation.id)))}>Select all</button>
                <button className={btn} onClick={() => setSelected(new Set())}>Select none</button>
                <button className="text-sm px-3 py-1 rounded bg-black text-white disabled:opacity-40" disabled={busy || selected.size === 0} onClick={() => void doImport()}>
                  Import {selected.size} formation{selected.size === 1 ? '' : 's'} / {selectedSnaps} snap{selectedSnaps === 1 ? '' : 's'}
                </button>
              </div>
            </div>
            {report && (
              <div className="mt-3 border border-emerald-300 rounded p-2 bg-emerald-50 text-emerald-900">
                Imported: {report.formationsAdded} new formation{report.formationsAdded === 1 ? '' : 's'}, {report.formationsMerged} merged into existing ones; {report.snapsAdded} new snaps, {report.snapsUpdated} refreshed
                {report.snapsSkipped ? `, ${report.snapsSkipped} skipped (formation not selected)` : ''}. <Link href="/formations" className="underline">Open the library</Link>.
              </div>
            )}
            {plan.skipped.length > 0 && (
              <details className="mt-3" open>
                <summary className="cursor-pointer font-semibold">{plan.skipped.length} row{plan.skipped.length === 1 ? '' : 's'} skipped</summary>
                <table className="mt-1 text-xs">
                  <tbody>
                    {plan.skipped.map((s, i) => (
                      <tr key={i} className="border-t border-neutral-200">
                        <td className="pr-3 py-0.5 text-neutral-500">{s.row ? `row ${s.row}` : ''}</td>
                        <td className="pr-3 py-0.5 font-mono">{s.playId ?? ''}</td>
                        <td className="py-0.5">{s.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            )}
            {plan.warnings.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer font-semibold">{plan.warnings.length} note{plan.warnings.length === 1 ? '' : 's'}</summary>
                <ul className="mt-1 text-xs list-disc pl-5 space-y-0.5">
                  {plan.warnings.map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
              </details>
            )}
          </section>

          <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {plan.formations.map((p) => {
              const f = p.formation;
              const on = selected.has(f.id);
              const badge = SOURCE_BADGE[p.source];
              const was = existing.get(f.id);
              return (
                <div key={f.id} className={`border rounded overflow-hidden bg-white ${on ? 'border-black' : 'border-neutral-300 opacity-70'}`}>
                  <label className="flex items-center gap-2 text-xs font-bold px-2 py-1 border-b cursor-pointer select-none">
                    <input type="checkbox" checked={on} onChange={() => toggle(f.id)} />
                    <span className="truncate" title={f.note}>{f.name}</span>
                    <span className="ml-auto shrink-0 rounded bg-black text-white px-1.5">{p.count}</span>
                  </label>
                  <div className="flex items-center gap-1.5 px-2 py-0.5 border-b text-[11px] text-neutral-600">
                    <span className={`rounded px-1 font-semibold ${badge.cls}`}>{badge.text}</span>
                    {was && <span className="rounded px-1 bg-neutral-200 text-neutral-800" title={`Already in the library as "${was.name}"${was.usage ? ` (${was.usage.count} snaps)` : ''}`}>in library</span>}
                    <span className="ml-auto truncate">{p.weeks.map((w) => `W${w}`).join(' ')} · {Object.entries(p.hashes).map(([h, n]) => `${h[0]}${n}`).join(' ')}</span>
                  </div>
                  <div className="aspect-[3/2]">
                    <PlayThumb diagram={{ players: f.players, paths: {}, annotations: {} }} aspect={1.5} fit={FORMATION_FIT} />
                  </div>
                  <div className="px-2 py-1 border-t text-[11px] text-neutral-600 font-mono truncate" title={p.snapIds.join(', ')}>
                    {p.snapIds.slice(0, 5).join(' ')}
                    {p.snapIds.length > 5 && <span className="font-sans"> +{p.snapIds.length - 5} more</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
