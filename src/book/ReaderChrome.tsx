'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import type { BookSection } from './types';

type Theme = 'auto' | 'light' | 'dark';
const THEME_KEY = 'playforge.reader.theme';
const themeListeners = new Set<() => void>();
function subscribeTheme(fn: () => void) {
  themeListeners.add(fn);
  return () => themeListeners.delete(fn);
}
function readTheme(): Theme {
  try {
    const t = localStorage.getItem(THEME_KEY);
    return t === 'light' || t === 'dark' ? t : 'auto';
  } catch {
    return 'auto'; // storage blocked: follow the system
  }
}
function writeTheme(t: Theme) {
  try {
    if (t === 'auto') localStorage.removeItem(THEME_KEY);
    else localStorage.setItem(THEME_KEY, t);
  } catch {
    /* ignore: the choice just won't persist */
  }
  themeListeners.forEach((fn) => fn());
}

/**
 * Interactive shell around the server-rendered book: the sticky TOC (collapsible sections, current page
 * highlighted while scrolling), light / dark, a find box, and the phone drawer. The document itself stays
 * plain HTML so the browser's own Ctrl+F works without any of this.
 */
export function ReaderChrome({
  book,
  counts,
  children,
  hasScans = true,
}: {
  book: { id: string; title: string; sections: BookSection[]; pageCount: number };
  hasScans?: boolean;
  counts: { high: number; medium: number; low: number; scan: number };
  children: ReactNode;
}) {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => 'auto' as Theme);
  const [tocOpen, setTocOpen] = useState(false);
  const [current, setCurrent] = useState<{ page: string; section: string }>({ page: '', section: '' });
  const [openSecs, setOpenSecs] = useState<Set<string>>(() => new Set());
  const mainRef = useRef<HTMLElement>(null);
  const tocRef = useRef<HTMLElement>(null);

  const cycleTheme = () => writeTheme(theme === 'auto' ? 'dark' : theme === 'dark' ? 'light' : 'auto');

  // scroll spy: the page block nearest the top of the viewport is "current"
  useEffect(() => {
    const pages = Array.from(document.querySelectorAll<HTMLElement>('.bk-page'));
    if (!pages.length) return;
    const visible = new Map<Element, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target, e.boundingClientRect.top);
          else visible.delete(e.target);
        }
        let best: HTMLElement | null = null;
        let bestTop = Infinity;
        for (const [el] of visible) {
          const top = Math.abs((el as HTMLElement).getBoundingClientRect().top);
          if (top < bestTop) {
            bestTop = top;
            best = el as HTMLElement;
          }
        }
        if (best) setCurrent({ page: best.id, section: best.dataset.section ?? '' });
      },
      { rootMargin: '0px 0px -60% 0px', threshold: [0, 0.01] },
    );
    pages.forEach((p) => io.observe(p));
    return () => io.disconnect();
  }, []);

  // keep the current page's entry in view in the sidebar (its section is always shown open)
  useEffect(() => {
    if (!current.section) return;
    const link = tocRef.current?.querySelector<HTMLElement>(`a[data-anchor="${current.page}"]`);
    if (link && tocRef.current) {
      const box = tocRef.current.getBoundingClientRect();
      const r = link.getBoundingClientRect();
      if (r.top < box.top + 40 || r.bottom > box.bottom - 40) link.scrollIntoView({ block: 'center' });
    }
  }, [current]);

  // a hash link to a page inside a closed section opens that section
  useEffect(() => {
    const onHash = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      const el = id ? document.getElementById(id) : null;
      const sec = el?.closest<HTMLElement>('[data-section]')?.dataset.section;
      if (sec) setOpenSecs((s) => new Set(s).add(sec));
      setTocOpen(false);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const toggleSec = (id: string, open: boolean) =>
    setOpenSecs((s) => {
      const n = new Set(s);
      if (open) n.add(id);
      else n.delete(id);
      return n;
    });

  return (
    <div className="bk-root" data-theme={theme === 'auto' ? undefined : theme} data-toc={tocOpen ? 'open' : undefined}>
      <div className="bk-layout">
        <aside className="bk-side" ref={tocRef} aria-label="Table of contents">
          <div className="bk-side-head">
            <div className="bk-side-title">{book.title}</div>
            <div className="bk-side-sub">
              {book.pageCount} pages · {counts.high} rebuilt diagrams · {counts.scan} scans
            </div>
            <div className="bk-tools">
              <button type="button" className="bk-btn" onClick={cycleTheme} title="Theme: auto, dark, light">
                {theme === 'auto' ? 'Theme: auto' : theme === 'dark' ? 'Theme: dark' : 'Theme: light'}
              </button>
              <button type="button" className="bk-btn" onClick={() => setOpenSecs(new Set(book.sections.map((s) => s.id)))}>
                Expand all
              </button>
              <button type="button" className="bk-btn" onClick={() => setOpenSecs(new Set())}>
                Collapse
              </button>
            </div>
            <BookFind main={mainRef} />
          </div>
          <nav className="bk-toc">
            {book.sections.map((s) => (
              <details key={s.id} open={openSecs.has(s.id) || current.section === s.id} className={current.section === s.id ? 'bk-sec-active' : undefined} onToggle={(e) => toggleSec(s.id, (e.target as HTMLDetailsElement).open)}>
                <summary>
                  <span>{s.title}</span>
                  <span className="bk-pg">
                    {s.start}–{s.end}
                  </span>
                </summary>
                <ul>
                  {s.entries.map((e) => (
                    <li key={e.anchor}>
                      <a href={`#${e.anchor}`} data-anchor={e.anchor} aria-current={current.page === e.anchor ? 'true' : undefined}>
                        <span>{e.label || 'Untitled'}</span>
                        <span className="bk-pg">{e.page}</span>
                      </a>
                      {e.children.length > 0 && (openSecs.has(s.id) || current.section === s.id) && (
                        <ul>
                          {e.children.map((c, i) => (
                            <li key={i}>
                              <a href={`#${c.anchor}`}>{c.label}</a>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </nav>
          <div style={{ padding: '0.75rem 0.5rem', fontSize: '0.75rem' }}>
            {hasScans && (
              <a className="bk-btn" href={`/playbooks/${book.id}/review`}>
                Review list
              </a>
            )}
          </div>
        </aside>
        <main className="bk-main" ref={mainRef}>
          {children}
        </main>
      </div>
      <button type="button" className="bk-toggle no-print" onClick={() => setTocOpen((o) => !o)} aria-expanded={tocOpen}>
        {tocOpen ? 'Close' : 'Contents'}
      </button>
    </div>
  );
}

type Hit = { anchor: string; page: string; title: string; snippet: [string, string, string] };

/** A find box on top of the page text (the browser's Ctrl+F works without it). */
function BookFind({ main }: { main: React.RefObject<HTMLElement | null> }) {
  const [q, setQ] = useState('');
  const [hits, setHits] = useState<Hit[] | null>(null);
  const index = useRef<{ anchor: string; page: string; title: string; text: string; lower: string }[] | null>(null);

  const build = useCallback(() => {
    if (index.current || !main.current) return;
    index.current = Array.from(main.current.querySelectorAll<HTMLElement>('.bk-page')).map((el) => {
      const text = (el.textContent ?? '').replace(/\s+/g, ' ');
      return { anchor: el.id, page: el.dataset.page ?? '', title: el.querySelector('.bk-page-title')?.textContent ?? '', text, lower: text.toLowerCase() };
    });
  }, [main]);

  const results = useMemo(() => hits, [hits]);

  const run = (value: string) => {
    setQ(value);
    const needle = value.trim().toLowerCase();
    if (needle.length < 2) {
      setHits(null);
      return;
    }
    build();
    const out: Hit[] = [];
    for (const p of index.current ?? []) {
      const at = p.lower.indexOf(needle);
      if (at < 0) continue;
      const s = Math.max(0, at - 40);
      out.push({ anchor: p.anchor, page: p.page, title: p.title, snippet: [p.text.slice(s, at), p.text.slice(at, at + needle.length), p.text.slice(at + needle.length, at + needle.length + 50)] });
      if (out.length >= 300) break;
    }
    setHits(out);
  };

  return (
    <div className="bk-search">
      <input type="search" placeholder="Find in the book (Ctrl+F works too)" value={q} onChange={(e) => run(e.target.value)} aria-label="Find in the book" />
      {results && (
        <>
          <div className="bk-search-count">
            {results.length === 300 ? '300+' : results.length} page{results.length === 1 ? '' : 's'}
          </div>
          {results.length > 0 && (
            <div className="bk-search-results">
              {results.map((h) => (
                <a key={h.anchor} href={`#${h.anchor}`}>
                  <strong>
                    p.{h.page} {h.title}
                  </strong>
                  <br />…{h.snippet[0]}
                  <mark>{h.snippet[1]}</mark>
                  {h.snippet[2]}…
                </a>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
