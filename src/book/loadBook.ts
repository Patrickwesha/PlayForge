import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Book, ReviewFile } from './types';

/**
 * The rebuilt book lives only on the machine that built it (public/book/<id>/, gitignored: the source is a
 * copyrighted playbook and the repo is public). Returns null anywhere else, e.g. on the Vercel deployment.
 */
export async function loadBook(id: string): Promise<Book | null> {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  try {
    const raw = await readFile(path.join(process.cwd(), 'public', 'book', id, 'book.json'), 'utf8');
    return JSON.parse(raw) as Book;
  } catch {
    return null;
  }
}

/** The medium / low rebuilds with their drawings, for the review page. */
export async function loadReview(id: string): Promise<ReviewFile | null> {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), 'public', 'book', id, 'review.json'), 'utf8')) as ReviewFile;
  } catch {
    return null;
  }
}
