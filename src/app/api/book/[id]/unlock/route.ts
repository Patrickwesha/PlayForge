import { NextResponse } from 'next/server';
import { BOOK_COOKIE, unlockToken } from '@/book/access';

/** The access-code form posts here; a right code sets the cookie and sends the reader back where it was. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const form = await req.formData();
  const attempt = String(form.get('code') ?? '').trim();
  const back = String(form.get('back') ?? `/playbooks/${id}/read`);
  const target = back.startsWith('/') ? back : `/playbooks/${id}/read`;
  const tok = unlockToken(attempt);
  const url = new URL(target, req.url);
  if (!tok) {
    url.searchParams.set('locked', 'wrong');
    return NextResponse.redirect(url, 303);
  }
  url.searchParams.delete('locked');
  const res = NextResponse.redirect(url, 303);
  res.cookies.set(BOOK_COOKIE, tok, { httpOnly: true, sameSite: 'lax', secure: url.protocol === 'https:', path: '/', maxAge: 60 * 60 * 24 * 365 });
  return res;
}
