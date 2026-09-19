import { getSupabase } from './supabase';

const PENDING_KEY = 'playforge.pendingEmail';
const PENDING_TTL_MS = 60 * 60 * 1000;

/** iPad Safari often reloads the tab after a trip to Mail: remember who the code was sent to. */
export function getPendingEmail(): string | null {
  try {
    const v = JSON.parse(window.localStorage.getItem(PENDING_KEY) ?? 'null');
    return v && typeof v.email === 'string' && Date.now() - v.at < PENDING_TTL_MS ? v.email : null;
  } catch {
    return null;
  }
}

export function setPendingEmail(email: string | null) {
  try {
    if (email) window.localStorage.setItem(PENDING_KEY, JSON.stringify({ email, at: Date.now() }));
    else window.localStorage.removeItem(PENDING_KEY);
  } catch {
    // blocked storage: the form just will not survive a reload
  }
}

async function client() {
  const sb = await getSupabase();
  if (!sb) throw new Error('Sync is not set up on this deployment.');
  return sb;
}

/** Email a sign-in link plus a code. The code is the dependable path on iPad (Mail opens links in its own browser). */
export async function sendCode(email: string) {
  const sb = await client();
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/settings` } });
  if (error) throw new Error(error.message);
  setPendingEmail(email);
}

export async function verifyCode(email: string, code: string) {
  const sb = await client();
  const { error } = await sb.auth.verifyOtp({ email, token: code, type: 'email' });
  if (error) throw new Error(error.message);
  setPendingEmail(null);
}

/** Signs out this device only. The library stays on the device; the other device stays signed in. */
export async function signOut() {
  const sb = await client();
  const { error } = await sb.auth.signOut({ scope: 'local' });
  if (error) throw new Error(error.message);
}
