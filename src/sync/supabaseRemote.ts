import type { SupabaseClient } from '@supabase/supabase-js';
import type { Remote } from './engine';
import type { RemoteRow } from './types';

const TABLE = 'items';

/** The cloud side of the engine. Row Level Security scopes every call to the signed-in user. */
export function supabaseRemote(sb: SupabaseClient, userId: string): Remote {
  return {
    async pull(cursor, limit) {
      const { data, error } = await sb.from(TABLE).select('kind,id,data,updated_at,deleted,rev').gt('rev', cursor).order('rev', { ascending: true }).limit(limit);
      if (error) throw new Error(error.message);
      // bigint can arrive as a string
      return (data ?? []).map((r) => ({ ...r, rev: Number(r.rev) })) as RemoteRow[];
    },
    async push(rows) {
      if (rows.length === 0) return;
      // RLS rejects any user_id that is not the signed-in user, so this cannot write into someone else's rows
      const { error } = await sb.from(TABLE).upsert(rows.map((r) => ({ ...r, user_id: userId })), { onConflict: 'user_id,kind,id' });
      if (error) throw new Error(error.message);
    },
  };
}
