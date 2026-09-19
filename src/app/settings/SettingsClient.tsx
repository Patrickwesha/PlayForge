'use client';

import { useEffect, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { HashPreset, Paper, PlayersPerSide, Theme } from '@/model/types';
import { repo } from '@/store/repo';
import { useSettings } from '@/store/settingsStore';
import { downloadBlob } from '@/print/exportPng';
import { parseBackup } from '@/io/backup';
import { useSync } from '@/sync/syncStore';
import { AccountSync } from './AccountSync';

const field = 'border border-neutral-300 rounded px-2 py-1 text-sm bg-white';
const btn = 'text-sm px-3 py-1 rounded border border-neutral-300 bg-white hover:border-black';

export function SettingsClient() {
  const { settings, load, update } = useSettings();
  const counts = useLiveQuery(() => repo.counts(), []);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<'merge' | 'replace'>('merge');
  // wiping this device while signed in would fight the cloud copy, so those two actions wait for a sign-out
  const syncPhase = useSync((s) => s.phase);
  const signedIn = syncPhase !== 'off' && syncPhase !== 'signedOut';

  useEffect(() => {
    void load();
  }, [load]);

  const exportAll = async () => {
    const data = await repo.exportAll();
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `playforge-backup-${new Date().toISOString().slice(0, 10)}.json`);
  };

  const importFile = async (file: File) => {
    try {
      const text = await file.text();
      const result = parseBackup(text);
      if (mode === 'replace' && !confirm('Replace ALL current formations, plays, and playbooks with the file contents?')) return;
      await repo.importAll(result.data, mode);
      setMsg(`Imported ${result.data.formations.length} formations, ${result.data.plays.length} plays, ${result.data.playbooks.length} playbooks (${result.source}).${result.warnings.length ? ' Warnings: ' + result.warnings.join('; ') : ''}`);
    } catch (e) {
      setMsg(`Import failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <main className="max-w-3xl mx-auto w-full p-6">
      <h1 className="text-xl font-bold mb-4">Settings</h1>

      <section className="bg-white border border-neutral-300 rounded p-4 mb-4">
        <h2 className="font-bold mb-3">Drawing</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <label>
            <div className="text-xs uppercase text-neutral-500 mb-1">Look</div>
            <select className={field} value={settings.theme} onChange={(e) => void update({ theme: e.target.value as Theme })}>
              <option value="plain">Visio / NFL (plain white)</option>
              <option value="yardlines">Yard lines and hashes</option>
            </select>
          </label>
          <label>
            <div className="text-xs uppercase text-neutral-500 mb-1">Hash marks</div>
            <select className={field} value={settings.hashPreset} onChange={(e) => void update({ hashPreset: e.target.value as HashPreset })}>
              <option value="nfl">NFL</option>
              <option value="ncaa">NCAA</option>
              <option value="hs">High school</option>
            </select>
          </label>
          <label>
            <div className="text-xs uppercase text-neutral-500 mb-1">Paper</div>
            <select className={field} value={settings.paper} onChange={(e) => void update({ paper: e.target.value as Paper })}>
              <option value="letter">US Letter</option>
              <option value="a4">A4</option>
            </select>
          </label>
          <label>
            <div className="text-xs uppercase text-neutral-500 mb-1">Default players per side</div>
            <select className={field} value={settings.defaultPlayersPerSide} onChange={(e) => void update({ defaultPlayersPerSide: Number(e.target.value) as PlayersPerSide })}>
              {[6, 7, 8, 9, 11, 12].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 col-span-2">
            <input type="checkbox" checked={settings.flipSwapsXZ} onChange={(e) => void update({ flipSwapsXZ: e.target.checked })} />
            Flipping a play swaps the X and Z labels
          </label>
        </div>
      </section>

      <AccountSync />

      <section className="bg-white border border-neutral-300 rounded p-4 mb-4">
        <h2 className="font-bold mb-1">Backup</h2>
        <p className="text-sm text-neutral-600 mb-3">
          {signedIn ? 'Your library is stored in this browser and synced to your account. A backup file is still a good safety net.' : 'Everything is stored in this browser. Export a backup file regularly and keep it somewhere safe.'} {counts && `Currently ${counts.formations} formations, ${counts.plays} plays, ${counts.playbooks} playbooks.`}
        </p>
        <div className="flex gap-2 items-center flex-wrap">
          <button className={btn} onClick={() => void exportAll()}>Export backup (.json)</button>
          <span className="text-neutral-300">|</span>
          <select className={field} value={mode} onChange={(e) => setMode(e.target.value as 'merge' | 'replace')}>
            <option value="merge">Import: merge</option>
            <option value="replace" disabled={signedIn}>Import: replace everything{signedIn ? ' (sign out of sync first)' : ''}</option>
          </select>
          <input ref={fileRef} type="file" accept="application/json,.json" className="text-sm" onChange={(e) => e.target.files?.[0] && void importFile(e.target.files[0])} />
        </div>
        <p className="text-xs text-neutral-500 mt-2">Accepts PlayForge v2 backups and PlayForge-Lite exports (plays, formations, playbooks).</p>
        {msg && <div className="mt-3 text-sm border border-neutral-300 rounded p-2 bg-neutral-50">{msg}</div>}
      </section>

      <section className="bg-white border border-neutral-300 rounded p-4">
        <h2 className="font-bold mb-1">Reset</h2>
        <p className="text-sm text-neutral-600 mb-3">
          Delete everything on this device and restore the built-in formations and demo plays.{signedIn && ' Sign out of sync first to reset this device. Your cloud copy is not touched and comes back when you sign in again.'}
        </p>
        <button
          className={`${btn} text-red-700 disabled:opacity-40`}
          disabled={signedIn}
          onClick={async () => {
            if (!confirm('Delete ALL plays, formations, and playbooks and restore the seeds? Export a backup first.')) return;
            await repo.resetToSeeds();
            setMsg('Reset to seeds.');
          }}
        >
          Reset to seeds
        </button>
      </section>
    </main>
  );
}
