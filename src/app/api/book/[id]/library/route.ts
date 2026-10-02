import { NextResponse } from 'next/server';
import { bookUnlocked } from '@/book/access';
import { bookText } from '@/book/loadBook';

/** The book's PlayForge library (a backup file the reader imports), from the local build or the sealed copy. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!(await bookUnlocked())) return NextResponse.json({ error: 'locked' }, { status: 401 });
  const text = await bookText(id, 'library');
  if (!text) return NextResponse.json({ error: 'no book here' }, { status: 404 });
  return new NextResponse(text, { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'private, max-age=0' } });
}
