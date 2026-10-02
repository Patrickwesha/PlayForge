import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

/**
 * A simple gate for the book on a deployment: BOOK_ACCESS_CODE in the environment is the code to type once;
 * the browser then holds an HMAC of it in a cookie. Unset (local builds), the book is open.
 */
const COOKIE = 'playforge-book';

function token(code: string): string {
  return createHmac('sha256', `playforge-book:${code}`).update(code).digest('hex');
}

export function bookIsGated(): boolean {
  return !!process.env.BOOK_ACCESS_CODE;
}

export async function bookUnlocked(): Promise<boolean> {
  const code = process.env.BOOK_ACCESS_CODE;
  if (!code) return true;
  const c = (await cookies()).get(COOKIE)?.value ?? '';
  const want = token(code);
  return c.length === want.length && timingSafeEqual(Buffer.from(c), Buffer.from(want));
}

/** The cookie value for a correct code, or null. */
export function unlockToken(attempt: string): string | null {
  const code = process.env.BOOK_ACCESS_CODE;
  if (!code) return null;
  const a = Buffer.from(attempt);
  const b = Buffer.from(code);
  return a.length === b.length && timingSafeEqual(a, b) ? token(code) : null;
}

export const BOOK_COOKIE = COOKIE;
