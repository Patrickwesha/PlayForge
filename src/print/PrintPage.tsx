'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { LayoutId, Paper } from '@/model/types';
import { LAYOUTS, PLAY_LAYOUTS } from '@/geometry/layout';
import { themeFor } from '@/render/theme';
import { CallSheet } from './CallSheet';
import { CoverPage } from './CoverPage';
import { FormationCell, PlayCell } from './PlayCell';
import { EmptyCell, Sheet } from './Sheet';
import type { PrintDoc } from './pages';
import { loadPrintDoc, type PrintRequest } from './source';

function parseRequest(sp: URLSearchParams): PrintRequest {
  const layout = (sp.get('layout') ?? '6up') as LayoutId;
  const paper = (sp.get('paper') === 'a4' ? 'a4' : 'letter') as Paper;
  return {
    demo: sp.get('demo') === '1',
    play: sp.get('play') ?? undefined,
    playbook: sp.get('playbook') ?? undefined,
    formations: sp.get('formations') ?? undefined,
    plays: sp.get('plays') ?? undefined,
    layout: LAYOUTS[layout] ? layout : '6up',
    paper,
    cover: sp.get('cover') === '1',
    callsheet: sp.get('callsheet') === '1',
    title: sp.get('title') ?? undefined,
    theme: sp.get('theme') === 'yardlines' ? 'yardlines' : undefined,
  };
}

export default function PrintPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const req = useMemo(() => parseRequest(new URLSearchParams(sp.toString())), [sp]);
  const [doc, setDoc] = useState<PrintDoc | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    loadPrintDoc(req)
      .then((d) => alive && setDoc(d))
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [req]);

  useEffect(() => {
    if (!doc || sp.get('autoprint') !== '1') return;
    const t = setTimeout(() => {
      document.fonts.ready.then(() => window.print());
    }, 300);
    return () => clearTimeout(t);
  }, [doc, sp]);

  const setParam = (k: string, v: string) => {
    const p = new URLSearchParams(sp.toString());
    p.set(k, v);
    p.delete('autoprint');
    router.replace(`/print?${p.toString()}`);
  };

  const theme = themeFor(req.theme ?? 'plain', 'ncaa');
  const pageCount = doc?.pages.length ?? 0;
  const cellIndexBase = { n: 0 };

  return (
    <div style={{ background: '#e5e5e5', minHeight: '100%' }}>
      <style>{`@media print { @page { size: ${doc?.paper ?? req.paper} ${doc?.orientation ?? LAYOUTS[req.layout].orientation}; margin: 0; } }`}</style>
      <div className="no-print" style={{ position: 'sticky', top: 0, zIndex: 10, background: '#111', color: '#fff', padding: '8px 14px', display: 'flex', gap: 12, alignItems: 'center', fontSize: 13 }}>
        <Link href="/" style={{ fontWeight: 700 }}>
          &larr; PlayForge
        </Link>
        <label>
          Layout{' '}
          <select value={req.layout} onChange={(e) => setParam('layout', e.target.value)} style={{ color: '#000', background: '#fff', borderRadius: 3, padding: '2px 4px' }}>
            {PLAY_LAYOUTS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>
        <label>
          Paper{' '}
          <select value={req.paper} onChange={(e) => setParam('paper', e.target.value)} style={{ color: '#000', background: '#fff', borderRadius: 3, padding: '2px 4px' }}>
            <option value="letter">Letter</option>
            <option value="a4">A4</option>
          </select>
        </label>
        <label>
          <input type="checkbox" checked={req.callsheet} onChange={(e) => setParam('callsheet', e.target.checked ? '1' : '0')} /> Call sheet
        </label>
        <label>
          <input type="checkbox" checked={req.cover} onChange={(e) => setParam('cover', e.target.checked ? '1' : '0')} /> Cover
        </label>
        <label>
          <input type="checkbox" checked={req.theme === 'yardlines'} onChange={(e) => setParam('theme', e.target.checked ? 'yardlines' : 'plain')} /> Yard lines
        </label>
        <span style={{ marginLeft: 'auto', color: '#aaa' }}>{pageCount} page{pageCount === 1 ? '' : 's'} &middot; in the print dialog turn off headers and footers</span>
        <button onClick={() => window.print()} style={{ background: '#fff', color: '#000', fontWeight: 700, padding: '6px 14px', borderRadius: 4 }}>
          Print / Save PDF
        </button>
      </div>

      {error && <div style={{ padding: 24, color: '#b00' }}>{error}</div>}
      {!doc && !error && <div style={{ padding: 24 }}>Loading&hellip;</div>}

      <div style={{ padding: '0.5in 0' }}>
        {doc?.pages.map((page, i) => {
          if (page.kind === 'cover') return <CoverPage key={i} {...page} paper={doc.paper} orientation={doc.orientation} />;
          if (page.kind === 'callsheet') {
            const start = cellIndexBase.n;
            cellIndexBase.n += page.rows.length;
            return <CallSheet key={i} rows={page.rows} title={page.title} paper={doc.paper} orientation={doc.orientation} pageNo={i + 1} pageCount={pageCount} startIndex={start} />;
          }
          const l = LAYOUTS[page.layout];
          const slots = l.cols * l.rows;
          const big = slots <= 2;
          return (
            <Sheet key={i} layout={page.layout} paper={doc.paper} title={doc.title} subtitle={doc.subtitle} pageNo={i + 1} pageCount={pageCount} sectionTitle={page.sectionTitle}>
              {(m) => (
                <>
                  {page.cells.map((c) =>
                    c.kind === 'play' ? <PlayCell key={c.play.id} play={c.play} m={m} theme={theme} big={big} /> : <FormationCell key={c.formation.id} formation={c.formation} m={m} theme={theme} />,
                  )}
                  {Array.from({ length: slots - page.cells.length }, (_, k) => (
                    <EmptyCell key={`e${k}`} />
                  ))}
                </>
              )}
            </Sheet>
          );
        })}
      </div>
    </div>
  );
}
