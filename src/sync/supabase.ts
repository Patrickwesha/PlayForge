import type { SupabaseClient } from '@supabase/supabase-js';

// Next only inlines literal process.env.NEXT_PUBLIC_* reads, so these two lines must stay exactly like this.
// Both values are public by design: the key can only do what Row Level Security allows a signed-in user.
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** False on a deployment without the two env vars: the app then stays fully local, exactly as before. */
export const isSyncConfigured = () => URL.length > 0 && KEY.length > 0;

let client: Promise<SupabaseClient> | null = null;

/** Browser-only, created on first use. The library is not even loaded when sync is not configured. */
export function getSupabase(): Promise<SupabaseClient> | null {
  if (!isSyncConfigured() || typeof window === 'undefined') return null;
  if (!client) {
    client = import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(URL, KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' },
      }),
    );
  }
  return client;
}
