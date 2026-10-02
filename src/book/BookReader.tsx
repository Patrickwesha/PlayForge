import type { ReactNode } from 'react';
import { PlaySvg } from '@/render/PlaySvg';
import { DEFAULT_RENDER_THEME } from '@/render/theme';
import { ReaderChrome } from './ReaderChrome';
import { LibraryBar, PlayLink } from './LibraryLinks';
import { PAGE_TYPE_LABEL, type Book, type BookBlock, type BookCell, type BookPage } from './types';

type Loading = 'eager' | 'lazy';

/**
 * The whole book as one server-rendered document. Every word is HTML or SVG text, so the browser's own
 * find (Ctrl+F) reaches titles, notes, assignments and the labels drawn on the diagrams.
 */
export function BookReader({ book, base, range, print }: { book: Book; base: string; range?: [number, number]; print?: boolean }) {
  const loading = print ? 'eager' : 'lazy';
  const inRange = (n: number) => !range || (n >= range[0] && n <= range[1]);
  const cellMap = new Map<string, BookCell>();
  for (const p of book.pages) for (const c of p.cells) cellMap.set(`${p.n}:${c.id}`, c);
  const counts = { high: 0, medium: 0, low: 0, scan: 0 };
  for (const p of book.pages)
    for (const c of p.cells) {
      if (c.kind !== 'diagram') continue;
      if (c.vector?.confidence === 'high') counts.high++;
      else {
        counts.scan++;
        if (c.vector?.confidence === 'medium') counts.medium++;
      }
    }

  return (
    <ReaderChrome book={{ id: book.id, title: book.title, sections: book.sections, pageCount: book.pageCount }} counts={counts}>
      <header className="bk-doc-head">
        <h1>{book.title}</h1>
        <p>
          {book.source}. All {book.pageCount} pages in their original order, with the original page number on each. Diagrams are
          PlayForge drawings where the rebuild matches the scan with high confidence; every other diagram shows the cleaned scan.
        </p>
        <div className="bk-legend">
          <span>{counts.high} diagrams shown as PlayForge drawings</span>
          <span>{counts.scan} shown as the cleaned scan ({counts.medium} of them have a rebuild waiting for review)</span>
        </div>
      </header>
      <LibraryBar bookId={book.id} libraryUrl={`${base}/library.json`} />
      {inRange(1) && <PrintToc book={book} />}
      {book.pages.filter((p) => inRange(p.n)).map((p) => (
        <PageSection key={p.n} page={p} book={book} base={base} cellMap={cellMap} loading={loading} />
      ))}
    </ReaderChrome>
  );
}

function PrintToc({ book }: { book: Book }) {
  return (
    <nav className="bk-print-only bk-print-toc" aria-label="Contents (print)">
      <h2>Contents</h2>
      <ol>
        {book.sections.map((s) => (
          <li key={s.id}>
            <a className="bk-ptoc-sec" href={`#${s.anchor}`}>
              <span>{s.title}</span>
              <span>{s.start}</span>
            </a>
            <ol>
              {s.entries
                .filter((e) => e.label && e.label !== 'Blank')
                .map((e) => (
                  <li key={e.anchor}>
                    <a className="bk-ptoc-page" href={`#${e.anchor}`}>
                      <span>{e.label}</span>
                      <span>{e.page}</span>
                    </a>
                  </li>
                ))}
            </ol>
          </li>
        ))}
      </ol>
    </nav>
  );
}

function PageSection({ page, book, base, cellMap, loading }: { page: BookPage; book: Book; base: string; cellMap: Map<string, BookCell>; loading: Loading }) {
  const section = book.sections[page.section];
  const startsSection = section && section.start === page.n;
  const inTable = new Set<string>();
  for (const b of page.blocks)
    if (b.kind === 'table') for (const r of b.rows) for (const v of r) if (/^@c\w+$/.test(v.trim())) inTable.add(v.trim().slice(1));
  // covers and dividers are a photo and a few big words: show the whole cleaned page, not fragments of it
  const wholePage = page.type === 'cover' || page.type === 'divider' || (page.cells.length > 0 && page.cells.every((c) => c.kind === 'photo' || c.kind === 'empty'));
  const gridCells = wholePage ? [] : page.cells.filter((c) => !inTable.has(c.id) && c.kind === 'diagram');
  const cols = columnCount(page.cells.filter((c) => !inTable.has(c.id) && c.kind === 'diagram'));
  const rows = Math.max(1, Math.ceil(gridCells.length / cols));

  return (
    <>
      <section className="bk-page" id={page.anchor} data-page={page.n} data-section={section?.id} aria-label={`Page ${page.n}`}>
        {startsSection && (
          <h2 className="bk-section-title" id={section.id}>
            {section.title}
          </h2>
        )}
        <div className="bk-page-head">
          <a className="bk-page-no" href={`#${page.anchor}`}>
            Page {page.n}
          </a>
          <span className="bk-chip">{PAGE_TYPE_LABEL[page.type] ?? page.type}</span>
          {section && <span>{section.title}</span>}
          {page.printedPage && <span>Book page {page.printedPage}</span>}
          {page.unverified && <span className="bk-chip bk-chip-warn">Machine OCR, not yet checked</span>}
          <a className="bk-scan no-print" href={`${base}/pages/p-${String(page.n).padStart(3, '0')}.webp`} target="_blank" rel="noreferrer">
            Original scan
          </a>
        </div>
        {page.title && (
          <h3 className="bk-page-title" id={page.titleAnchor}>
            {page.title}
            {page.titleRestored && <span className="bk-chip" style={{ marginLeft: 8, fontSize: '0.65rem', fontWeight: 500 }} title="The scan cuts this title; restored from the page">restored</span>}
          </h3>
        )}
        {page.blocks.map((b, i) => (
          <Block key={i} block={b} page={page} base={base} cellMap={cellMap} loading={loading} />
        ))}
        {wholePage && page.type !== 'blank' && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="bk-whole" src={`${base}/pages/p-${String(page.n).padStart(3, '0')}.webp`} alt={page.title || `Page ${page.n}`} loading={loading} />
        )}
        {gridCells.length > 0 && (
          <div className="bk-grid" style={{ ['--cols' as string]: cols, ['--rows' as string]: rows, ['--print-h' as string]: `${printGridHeight(page).toFixed(2)}in` }}>
            {gridCells.map((c) => (
              <Cell key={c.id} cell={c} page={page} base={base} loading={loading} />
            ))}
          </div>
        )}
        {page.uncertain.length > 0 && !page.unverified && (
          <details className="bk-uncertain no-print">
            <summary>{page.uncertain.length} spot{page.uncertain.length > 1 ? 's' : ''} the scan leaves unclear</summary>
            <ul>
              {page.uncertain.map((u, i) => (
                <li key={i}>{u}</li>
              ))}
            </ul>
          </details>
        )}
      </section>
    </>
  );
}

/**
 * Height left for the diagram rows on a printed letter sheet once the page's text is set (inches).
 * Estimate: ~95 characters a line at 8.5pt over 7.5in, 0.16in a line, headings and table rows a little more.
 */
function printGridHeight(page: BookPage): number {
  let lines = page.title ? 2 : 0;
  for (const b of page.blocks) {
    if (b.kind === 'heading') lines += 1.6;
    else if (b.kind === 'para') lines += Math.ceil(b.text.length / 95) + 0.4;
    else if (b.kind === 'list') lines += b.items.reduce((n, t) => n + Math.ceil(t.length / 90), 0) + 0.4;
    else if (b.kind === 'kv') lines += b.rows.reduce((n, [, v]) => n + Math.ceil(v.length / 75), 0) + 0.4;
    else if (b.kind === 'table') lines += b.rows.reduce((n, r) => n + Math.max(1, ...r.map((v) => Math.ceil(v.length / 40))), 0) * 1.2;
  }
  return Math.max(3, 9.0 - 0.45 - lines * 0.16);
}

/** Columns of the original grid: distinct left edges of the diagram cells. */
function columnCount(cells: BookCell[]): number {
  const xs = cells.map((c) => c.bbox[0]).sort((a, b) => a - b);
  let cols = 0;
  let last = -1e9;
  for (const x of xs) {
    if (x - last > 120) cols++;
    last = x;
  }
  return Math.min(Math.max(cols, 1), 4);
}

function lines(text: string): ReactNode {
  const parts = text.split('\n');
  return parts.map((p, i) => (
    <span key={i}>
      {p}
      {i < parts.length - 1 && <br />}
    </span>
  ));
}

function Block({ block, page, base, cellMap, loading }: { block: BookBlock; page: BookPage; base: string; cellMap: Map<string, BookCell>; loading: Loading }) {
  switch (block.kind) {
    case 'heading':
      return <h4 className="bk-block-head">{block.href ? <a href={block.href}>{block.text}</a> : block.text}</h4>;
    case 'para':
      return <p>{lines(block.text)}</p>;
    case 'list': {
      const items = block.items.map((t, i) => <li key={i}>{block.hrefs?.[i] ? <a href={block.hrefs[i]!}>{lines(t)}</a> : lines(t)}</li>);
      return block.ordered ? <ol>{items}</ol> : <ul>{items}</ul>;
    }
    case 'kv':
      return (
        <dl className="bk-kv">
          {block.rows.map(([k, v], i) => (
            <div key={i} style={{ display: 'contents' }}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      );
    case 'table':
      return (
        <div className="bk-table-wrap">
          <table className="bk-table">
            {block.header && block.header.length > 0 && (
              <thead>
                <tr>
                  {block.header.map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody>
              {block.rows.map((r, i) =>
                !r.some((v) => v.trim()) ? null : (
                  <tr key={i}>
                    {r.map((v, j) => {
                      const m = /^@(c\w+|x\w+)$/.exec(v.trim());
                      const cell = m ? cellMap.get(`${page.n}:${m[1]}`) : undefined;
                      if (cell)
                        return (
                          <td key={j} className="bk-td-art">
                            <Art cell={cell} page={page} base={base} loading={loading} />
                            <CellFoot cell={cell} />
                          </td>
                        );
                      const href = j === 0 ? block.hrefs?.[i] : null;
                      return <td key={j}>{v === '@diagram' ? '(drawing)' : href ? <a href={href}>{v}</a> : v}</td>;
                    })}
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      );
  }
}

function Cell({ cell, page, base, loading }: { cell: BookCell; page: BookPage; base: string; loading: Loading }) {
  return (
    <figure className="bk-cell" id={cell.anchor} data-cell={cell.id}>
      {cell.lines.length > 0 && (
        <figcaption className="bk-cell-head">
          <h4 className="bk-cell-title">
            {cell.lines.map((l, i) => (
              <span key={i} className={i === 0 ? 'bk-l1' : 'bk-l2'}>
                {l}
              </span>
            ))}
          </h4>
        </figcaption>
      )}
      <Art cell={cell} page={page} base={base} loading={loading} />
      <CellFoot cell={cell} />
      {cell.vector?.confidence === 'high' && (
        <details className="bk-orig no-print">
          <summary>Compare with the scan</summary>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`${base}/${cell.crop}`} alt={`Scan of ${cell.lines.join(' / ') || 'the diagram'}`} loading="lazy" />
        </details>
      )}
      {cell.vector?.confidence === 'medium' && (
        <a className="bk-orig no-print" style={{ display: 'block', padding: '0.25rem 0.5rem', color: 'var(--bk-muted)' }} href={`/playbooks/${base.split('/').pop()}/review?c=medium&at=${cell.anchor}#${cell.anchor}`}>
          PlayForge rebuild flagged for review: compare it with this scan
        </a>
      )}
    </figure>
  );
}

function Art({ cell, page, base, loading }: { cell: BookCell; page: BookPage; base: string; loading: Loading }) {
  const [x0, y0, x1, y1] = cell.cropBox ?? cell.bbox;
  const w = Math.max(x1 - x0, 1);
  const h = Math.max(y1 - y0, 1);
  const v = cell.vector;
  // only a high-confidence rebuild stands in for the drawing; anything less shows the scan itself
  if (v && v.confidence === 'high' && v.diagram && cell.kind === 'diagram') {
    const vw = v.view.maxX - v.view.minX;
    const vh = v.view.maxY - v.view.minY;
    return (
      <div className="bk-art" style={{ aspectRatio: `${vw} / ${vh}` }}>
        <PlaySvg diagram={v.diagram} view={v.view} theme={DEFAULT_RENDER_THEME} style={{ height: 'auto' }} />
      </div>
    );
  }
  // the cleaned scan, with its words laid over it as invisible text so find-in-page lands on them
  return (
    <div className="bk-art" style={{ aspectRatio: `${w} / ${h}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${base}/${cell.crop}`} alt={cell.lines.join(' / ') || `Diagram on page ${page.n}`} loading={loading} width={w} height={h} />
      {cell.labels.length > 0 && (
        <div className="bk-ocr-layer">
          {cell.labels.map((l, i) =>
            l.at ? (
              <span key={i} style={{ left: `${((l.at[0] - x0) / w) * 100}%`, top: `${((l.at[1] - y0) / h) * 100}%` }}>
                {l.text}
              </span>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

function CellFoot({ cell }: { cell: BookCell }) {
  const v = cell.vector;
  const conf = !v || v.confidence === 'low' ? 'scan' : v.confidence === 'medium' ? 'review' : 'high';
  const unplaced = cell.labels.filter((l) => !l.at);
  return (
    <>
      <div className="bk-cell-foot">
        {cell.footer && <span className="bk-footer-tag">{cell.footer}</span>}
        {cell.badges.map((b, i) => (
          <span key={i} className="bk-badge">
            {b}
          </span>
        ))}
        {cell.playId && <PlayLink id={cell.playId} />}
        <span className={`bk-conf bk-conf-${conf === 'scan' ? 'low' : conf === 'review' ? 'medium' : 'high'}`} title={v?.issues.join('; ') || 'Shown as the cleaned scan'}>
          {conf === 'scan' ? 'scan' : conf === 'review' ? 'scan · rebuild in review' : 'rebuilt'}
        </span>
      </div>
      {unplaced.length > 0 && <div className="bk-labels-note">{unplaced.map((l) => l.text).join(' · ')}</div>}
    </>
  );
}
