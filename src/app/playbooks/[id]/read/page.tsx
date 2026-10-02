import Link from 'next/link';
import { connection } from 'next/server';
import { bookIsGated, bookUnlocked } from '@/book/access';
import { bookAssets, loadBook } from '@/book/loadBook';
import { BookReader } from '@/book/BookReader';
import '@/book/reader.css';

/** The whole book renders in one response (18 MB of HTML, streamed): give the function room on Vercel. */
export const maxDuration = 60;

export async function generateMetadata(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return { title: id === 'gb-2019' ? 'Green Bay 2019 - Reader - PlayForge' : 'Reader - PlayForge' };
}

export default async function ReadPage(props: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection(); // read from disk / opened with the key at request time, never baked into a build
  const { id } = await props.params;
  const sp = await props.searchParams;
  if (bookIsGated() && !(await bookUnlocked())) {
    const back = `/playbooks/${id}/read${typeof sp.pages === 'string' ? `?pages=${sp.pages}` : ''}`;
    return (
      <main className="max-w-md mx-auto p-8 space-y-4">
        <h1 className="text-xl font-bold">This playbook is private</h1>
        <p className="text-neutral-600">Enter the access code to read it. The code is remembered on this device.</p>
        <form method="post" action={`/api/book/${id}/unlock`} className="flex gap-2">
          <input type="hidden" name="back" value={back} />
          <input name="code" type="password" autoComplete="off" required className="border border-neutral-300 rounded px-3 py-2 flex-1" placeholder="Access code" />
          <button type="submit" className="px-4 py-2 rounded bg-black text-white">Open</button>
        </form>
        {sp.locked === 'wrong' && <p className="text-red-600 text-sm">That code is not right.</p>}
      </main>
    );
  }
  const book = await loadBook(id);
  if (!book)
    return (
      <main className="max-w-2xl mx-auto p-8 space-y-3">
        <h1 className="text-xl font-bold">No readable book for this playbook here</h1>
        <p className="text-neutral-600">
          The reader shows a scanned playbook rebuilt by the PlayForge book pipeline (<code>scripts/playbook/</code>). A deployment serves the sealed copy
          in <code>data/book/</code> only when <code>BOOK_KEY</code> is set in its environment.
        </p>
        <Link className="underline" href={`/playbooks/${id}`}>
          Back to the playbook
        </Link>
      </main>
    );
  // ?pages=a-b renders part of the book and ?print=1 loads everything up front (the PDF export prints in chunks)
  const m = typeof sp.pages === 'string' ? /^(\d+)-(\d+)$/.exec(sp.pages) : null;
  const range: [number, number] | undefined = m ? [Number(m[1]), Number(m[2])] : undefined;
  const assets = bookAssets(id);
  return <BookReader book={book} base={`/book/${book.id}`} range={range} print={sp.print === '1'} hasScans={assets.hasScans} canSaveEdits={assets.canSaveEdits} />;
}
