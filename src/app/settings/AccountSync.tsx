'use client';

import { useEffect, useState } from 'react';
import { getPendingEmail, sendCode, setPendingEmail, signOut, verifyCode } from '@/sync/auth';
import { requestSync } from '@/sync/controller';
import { useSync } from '@/sync/syncStore';
import { ago } from '@/components/SyncChip';

// 16px inputs so iPad Safari does not zoom the page when the keyboard opens
const field = 'border border-neutral-300 rounded px-3 h-10 text-base bg-white';
const btn = 'text-sm px-3 h-10 rounded border border-neutral-300 bg-white hover:border-black disabled:opacity-50';
const primary = 'text-sm px-4 h-10 rounded bg-black text-white disabled:opacity-50';

/** Sign in with an emailed code and keep the library the same on every device. */
export function AccountSync() {
  const { ready, phase, email: signedInAs, lastSyncedAt, lastError, pending } = useSync();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    // after a reload (iPad does this coming back from Mail) pick the code step back up
    const pending = getPendingEmail();
    // a magic link that expired or was opened by a mail scanner lands here with an error in the URL
    const failedLink = /error_code=|error=/.test(window.location.search + window.location.hash);
    const t = setTimeout(() => {
      if (pending) setSentTo(pending);
      if (failedLink) setMsg('That link did not work (expired or already used). Type the code from the same email instead.');
    }, 0);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      clearTimeout(t);
      clearInterval(tick);
    };
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMsg(null);
    try {
      await fn();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const shell = (children: React.ReactNode) => (
    <section className="bg-white border border-neutral-300 rounded p-4 mb-4">
      <h2 className="font-bold mb-1">Sync across devices</h2>
      {children}
    </section>
  );

  if (!ready) return shell(<p className="text-sm text-neutral-500">Checking…</p>);
  if (phase === 'off') {
    return shell(<p className="text-sm text-neutral-600">Sync isn&apos;t set up on this deployment. Everything stays in this browser. Use the backup below to move your library.</p>);
  }

  if (phase !== 'signedOut') {
    return shell(
      <>
        <p className="text-sm text-neutral-600 mb-3">
          Signed in as <b>{signedInAs}</b>. Plays, formations, and playbooks stay the same on every device where you sign in. The newest edit wins.
        </p>
        <div className="text-sm mb-3">
          {phase === 'syncing' ? 'Syncing…' : phase === 'offline' ? 'Offline. Changes are saved here and go up when you are back online.' : `Last synced ${ago(lastSyncedAt, now)}.`}
          {pending > 0 && ` ${pending} change${pending === 1 ? '' : 's'} waiting to send.`}
        </div>
        {phase === 'error' && lastError && <div className="mb-3 text-sm border border-red-300 bg-red-50 text-red-800 rounded p-2">Sync problem: {lastError}</div>}
        <div className="flex gap-2 flex-wrap">
          <button className={primary} disabled={phase === 'syncing'} onClick={() => void requestSync()}>Sync now</button>
          <button className={btn} disabled={phase === 'syncing'} onClick={() => void requestSync({ full: true })} title="Re-check every row in the cloud, not just what changed">Full re-sync</button>
          <button className={btn} disabled={busy} onClick={() => void run(signOut)} title="Signs out this device only. Your library stays on it.">Sign out</button>
        </div>
        {msg && <div className="mt-3 text-sm border border-neutral-300 rounded p-2 bg-neutral-50">{msg}</div>}
      </>,
    );
  }

  return shell(
    <>
      <p className="text-sm text-neutral-600 mb-3">Sign in on your desktop and your iPad with the same email and your library stays the same on both. No password: we email you a code.</p>
      {!sentTo ? (
        <form
          className="flex gap-2 flex-wrap"
          onSubmit={(e) => {
            e.preventDefault();
            const to = email.trim();
            if (to) void run(async () => { await sendCode(to); setSentTo(to); });
          }}
        >
          <input className={`${field} w-64`} type="email" inputMode="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <button className={primary} disabled={busy || !email.trim()}>{busy ? 'Sending…' : 'Email me a code'}</button>
        </form>
      ) : (
        <form
          className="flex gap-2 flex-wrap items-center"
          onSubmit={(e) => {
            e.preventDefault();
            if (code.trim()) void run(() => verifyCode(sentTo, code.trim()));
          }}
        >
          <div className="w-full text-sm">
            Code sent to <b>{sentTo}</b>. Type it here. On iPad this is better than tapping the link, which opens in Mail&apos;s own browser.
          </div>
          <input className={`${field} w-40 tracking-widest`} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6,10}" placeholder="123456" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 10))} required />
          <button className={primary} disabled={busy || code.length < 6}>{busy ? 'Checking…' : 'Sign in'}</button>
          <button type="button" className={btn} disabled={busy} onClick={() => { setPendingEmail(null); setSentTo(null); setCode(''); setMsg(null); }}>Use a different email</button>
        </form>
      )}
      {msg && <div className="mt-3 text-sm border border-neutral-300 rounded p-2 bg-neutral-50">{msg}</div>}
    </>,
  );
}
