import Link from 'next/link';
import { connection } from 'next/server';
import { loadBook } from '@/book/loadBook';
import { BookReader } from '@/book/BookReader';
import '@/book/reader.css';

export async function generateMetadata(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  return { title: id === 'gb-2019' ? 'Green Bay 2019 - Reader - PlayForge' : 'Reader - PlayForge' };
}

export default async function ReadPage(props: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection(); // the book is read from this machine's disk at request time, never baked into a build
  const { id } = await props.params;
  const sp = await props.searchParams;
  const book = await loadBook(id);
  if (!book)
    return (
      <main className="max-w-2xl mx-auto p-8 space-y-3">
        <h1 className="text-xl font-bold">No readable book for this playbook here</h1>
        <p className="text-neutral-600">
          The reader shows a scanned playbook rebuilt by the PlayForge book pipeline (<code>scripts/playbook/</code>). Its pages stay on the
          computer that built them, so this deployment does not have them. Run the app on that computer to read it, or open the exported PDF.
        </p>
        <Link className="underline" href={`/playbooks/${id}`}>
          Back to the playbook
        </Link>
      </main>
    );
  // ?pages=a-b renders part of the book and ?print=1 loads every image up front (the PDF export prints in chunks)
  const m = typeof sp.pages === 'string' ? /^(\d+)-(\d+)$/.exec(sp.pages) : null;
  const range: [number, number] | undefined = m ? [Number(m[1]), Number(m[2])] : undefined;
  return <BookReader book={book} base={`/book/${book.id}`} range={range} print={sp.print === '1'} />;
}
