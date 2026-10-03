import { NextResponse } from 'next/server';
import { bookUnlocked } from '@/book/access';
import { bookText } from '@/book/loadBook';
import type { Formation, Play } from '@/model/types';

/** One play of the book (and the formation it points at), so a cell's Edit button can import just that play. */
type Lib = { plays: Map<string, Play>; formations: Map<string, Formation> };
const libs = new Map<string, Promise<Lib | null>>();

function library(id: string): Promise<Lib | null> {
  if (!libs.has(id))
    libs.set(
      id,
      bookText(id, 'library').then((text) => {
        if (!text) return null;
        const data = JSON.parse(text) as { plays: Play[]; formations: Formation[] };
        return { plays: new Map(data.plays.map((p) => [p.id, p])), formations: new Map(data.formations.map((f) => [f.id, f])) };
      }),
    );
  return libs.get(id)!;
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string; playId: string }> }) {
  const { id, playId } = await ctx.params;
  if (!(await bookUnlocked())) return NextResponse.json({ error: 'locked' }, { status: 401 });
  const lib = await library(id);
  const play = lib?.plays.get(playId);
  if (!play) return NextResponse.json({ error: 'no such play' }, { status: 404 });
  const formation = play.formationId ? lib!.formations.get(play.formationId) : undefined;
  return NextResponse.json({ play, formation: formation ?? null }, { headers: { 'cache-control': 'private, max-age=0' } });
}
