import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { NextResponse } from 'next/server';
import { playSchema } from '@/model/schema';

/**
 * Your edits to the book's plays, written beside the book so the next `build_book.py` (and the PDF) use them.
 * Local only: the book exists only on the machine that built it (public/book/<id>), so anywhere else this is a 404.
 */
function paths(id: string) {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  const root = process.cwd();
  if (!existsSync(path.join(root, 'public', 'book', id, 'book.json'))) return null;
  return { dir: path.join(root, 'source', 'book', 'edits'), file: path.join(root, 'source', 'book', 'edits', `${id}.json`) };
}

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const p = paths(id);
  if (!p) return NextResponse.json({ error: 'no book here' }, { status: 404 });
  try {
    const data = JSON.parse(await readFile(p.file, 'utf8')) as { plays: unknown[] };
    return NextResponse.json({ saved: data.plays.length });
  } catch {
    return NextResponse.json({ saved: 0 });
  }
}

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const p = paths(id);
  if (!p) return NextResponse.json({ error: 'no book here' }, { status: 404 });
  const body = (await req.json()) as { plays?: unknown[] };
  const plays = [];
  for (const raw of body.plays ?? []) {
    const r = playSchema.safeParse(raw);
    if (!r.success) return NextResponse.json({ error: `a play failed validation: ${r.error.issues[0]?.message}` }, { status: 400 });
    if (!r.data.id.startsWith('gb19-')) return NextResponse.json({ error: `${r.data.id} is not a play of this book` }, { status: 400 });
    plays.push(r.data);
  }
  // merge with what was saved before: a play saved earlier and not sent now stays
  let prior: Record<string, unknown> = {};
  try {
    const old = JSON.parse(await readFile(p.file, 'utf8')) as { plays: { id: string }[] };
    prior = Object.fromEntries(old.plays.map((q) => [q.id, q]));
  } catch {
    /* first save */
  }
  for (const q of plays) prior[q.id] = q;
  await mkdir(p.dir, { recursive: true });
  await writeFile(p.file, JSON.stringify({ savedAt: new Date().toISOString(), plays: Object.values(prior) }, null, 1), 'utf8');
  return NextResponse.json({ saved: Object.keys(prior).length });
}
