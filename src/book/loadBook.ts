import { createDecipheriv } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import type { Book, ReviewFile } from './types';

/**
 * Where the book comes from:
 *  - the machine that built it: public/book/<id>/ (gitignored: the source is a copyrighted playbook and the
 *    repo is public), with the scans for the review page and the "Original scan" links
 *  - a deployment: data/book/<id>.book.enc, sealed by scripts/playbook/pack_book.py (gzip + AES-256-GCM),
 *    opened with BOOK_KEY from the environment. No key, no book.
 */
const ID = /^[a-z0-9-]+$/;
const localDir = (id: string) => path.join(process.cwd(), 'public', 'book', id);
const sealedPath = (id: string, name: 'book' | 'library') => path.join(process.cwd(), 'data', 'book', `${id}.${name}.enc`);

const cache = new Map<string, Promise<string | null>>();

async function openSealed(id: string, name: 'book' | 'library'): Promise<string | null> {
  const key = process.env.BOOK_KEY;
  const file = sealedPath(id, name);
  if (!key || !/^[0-9a-f]{64}$/i.test(key) || !existsSync(file)) return null;
  const buf = await readFile(file);
  const nonce = buf.subarray(0, 12);
  const tag = buf.subarray(buf.length - 16);
  const body = buf.subarray(12, buf.length - 16);
  const d = createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex'), nonce);
  d.setAuthTag(tag);
  const packed = Buffer.concat([d.update(body), d.final()]);
  return gunzipSync(packed).toString('utf8');
}

/** The JSON text of book.json / library.json, from the local build or the sealed copy (cached per process). */
export async function bookText(id: string, name: 'book' | 'library'): Promise<string | null> {
  if (!ID.test(id)) return null;
  const local = path.join(localDir(id), `${name}.json`);
  if (existsSync(local)) return readFile(local, 'utf8');
  const k = `${id}:${name}`;
  if (!cache.has(k)) cache.set(k, openSealed(id, name).catch(() => null));
  return cache.get(k)!;
}

export async function loadBook(id: string): Promise<Book | null> {
  const text = await bookText(id, 'book');
  return text ? (JSON.parse(text) as Book) : null;
}

/** What this machine has beside the book: the scans (review page, "Original scan" links) and a writable edits folder. */
export function bookAssets(id: string): { hasScans: boolean; canSaveEdits: boolean } {
  if (!ID.test(id)) return { hasScans: false, canSaveEdits: false };
  const local = existsSync(path.join(localDir(id), 'book.json'));
  return { hasScans: local && existsSync(path.join(localDir(id), 'pages')), canSaveEdits: local };
}

/** The medium / low rebuilds with their drawings, for the review page (local build only: it needs the scans). */
export async function loadReview(id: string): Promise<ReviewFile | null> {
  if (!ID.test(id)) return null;
  try {
    return JSON.parse(await readFile(path.join(localDir(id), 'review.json'), 'utf8')) as ReviewFile;
  } catch {
    return null;
  }
}
