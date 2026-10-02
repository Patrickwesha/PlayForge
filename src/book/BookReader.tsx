import type { ReactNode } from 'react';
import { PlaySvg } from '@/render/PlaySvg';
import { BOOK_RENDER_THEME } from '@/render/theme';
import { ReaderChrome } from './ReaderChrome';
import { LibraryBar, LiveArt, PlayLink } from './LibraryLinks';
import { PAGE_TYPE_LABEL, type Book, type BookBlock, type BookCell, type BookPage } from './types';

type Loading = 'eager' | 'lazy';

/**
 * The whole book as one server-rendered document, recreated: every word is HTML text, every diagram is a
 * PlayForge drawing (inline SVG with real text), so the browser's own find (Ctrl+F) reaches titles, notes,
 * assignments and the labels drawn on the diagrams, and all of it can be selected. Nothing is a scan.
 */
export function BookReader({ book, base, range, print }: { book: Book; base: string; range?: [number, number]; print?: boolean }) {
  const loading: Loading = print ? 'eager' : 'lazy';
  const inRange = (n: number) => !range || (n >= range[0] && n <= range[1]);
  const cellMap = new Map<string, BookCell>();
  for (const p of book.pages) for (const c of p.cells) cellMap.set(`${p.n}:${c.id}`, c);
  const counts = { high: 0, medium: 0, low: 0, scan: 0, guessed: 0 };
  for (const p of book.pages)
    for (const c of p.cells) {
      if (c.kind !== 'diagram') continue;
      if (!c.vector) counts.scan++;
      else counts[c.vector.confidence]++;
      if (c.guesses?.length) counts.guessed++;
    }

  return (
    <ReaderChrome book={{ id: book.id, title: book.title, sections: book.sections, pageCount: book.pageCount }} counts={counts}>
      <header className="bk-doc-head">
        <h1>{book.title}</h1>
        <p>
          {book.source}, recreated. All {book.pageCount} pages in their original order, with the original page number on each. Every diagram is a
          PlayForge drawing rebuilt from the page; players the scan cut off or hid were placed by educated guess and are marked on the diagram.
        </p>
        <div className="bk-legend">
          <span>{counts.high} diagrams match the page closely</span>
          <span>{counts.medium + counts.low} rebuilt and flagged for a check</span>
          <span>{counts.guessed} with guessed placements</span>
          {counts.scan > 0 && <span>{counts.scan} could not be rebuilt</span>}
        </div>
      </header>
      <LibraryBar bookId={book.id} libraryUrl={`${base}/library.json`} built={book.built} />
      {inRange(1) && <PrintToc book={book} />}
      {book.pages
        .filter((p) => inRange(p.n))
        .map((p) => (
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

function PageSection({ page, book, base, cellMap, loading }: { page: BookPage; book: Book; base: string; cellMap: Map<string, BookCell>; loading: Loading }) {
  const section = book.sections[page.section];
  const startsSection = section && section.start === page.n;
  const inTable = new Set<string>();
  for (const b of page.blocks)
    if (b.kind === 'table') for (const r of b.rows) for (const v of r) if (/^@c\w+$/.test(v.trim())) inTable.add(v.trim().slice(1));
  const gridCells = page.cells.filter((c) => !inTable.has(c.id) && c.kind === 'diagram');
  const cols = columnCount(gridCells);
  const rows = Math.max(1, Math.ceil(gridCells.length / cols));
  const titleCard = page.type === 'cover' || page.type === 'divider';

  return (
    <section className={`bk-page${titleCard ? ' bk-title-card' : ''}`} id={page.anchor} data-page={page.n} data-section={section?.id} aria-label={`Page ${page.n}`}>
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
      {titleCard ? (
        <div className="bk-card">
          <div className="bk-card-kicker">{page.type === 'cover' ? book.source : 'Section'}</div>
          <h3 className="bk-page-title bk-card-title" id={page.titleAnchor}>
            {page.title || (page.type === 'cover' ? book.title : 'Untitled')}
          </h3>
          {page.type === 'cover' && <div className="bk-card-sub">Rebuilt in PlayForge</div>}
        </div>
      ) : (
        page.title && (
          <h3 className="bk-page-title" id={page.titleAnchor}>
            {page.title}
            {page.titleRestored && (
              <span className="bk-chip bk-chip-guess" title="The scan cuts this title; restored from the page">
                restored
              </span>
            )}
          </h3>
        )
      )}
      {page.type === 'blank' && page.blocks.length === 0 && <p className="bk-muted">This page is blank in the book.</p>}
      {page.blocks.map((b, i) => (
        <Block key={i} block={b} page={page} cellMap={cellMap} book={book} />
      ))}
      {gridCells.length > 0 && (
        <div className="bk-grid" style={{ ['--cols' as string]: cols, ['--rows' as string]: rows, ['--print-h' as string]: `${printGridHeight(page).toFixed(2)}in` }}>
          {gridCells.map((c) => (
            <Cell key={c.id} cell={c} page={page} built={book.built} />
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
      {loading === 'eager' ? null : null}
    </section>
  );
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

function Restored({ children, on }: { children: ReactNode; on: boolean }) {
  if (!on) return <>{children}</>;
  return (
    <span className="bk-restored" title="The scan cut this off; restored from the rest of the book">
      {children}
    </span>
  );
}

function Block({ block, page, cellMap, book }: { block: BookBlock; page: BookPage; cellMap: Map<string, BookCell>; book: Book }) {
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
              <dt>
                <Restored on={!!block.restored?.includes(i)}>{k}</Restored>
              </dt>
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
                            <Art cell={cell} page={page} built={book.built} />
                            <CellFoot cell={cell} />
                          </td>
                        );
                      const href = j === 0 ? block.hrefs?.[i] : null;
                      const text = v === '@diagram' ? '(drawing)' : v;
                      const body = href ? <a href={href}>{text}</a> : text;
                      return (
                        <td key={j}>
                          <Restored on={j === 0 && !!block.restored?.includes(i)}>{body}</Restored>
                        </td>
                      );
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

function Cell({ cell, page, built }: { cell: BookCell; page: BookPage; built: string }) {
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
      <Art cell={cell} page={page} built={built} />
      <CellFoot cell={cell} />
    </figure>
  );
}

function Art({ cell, page, built }: { cell: BookCell; page: BookPage; built: string }) {
  const v = cell.vector;
  if (v && v.diagram) {
    const vw = v.view.maxX - v.view.minX;
    const vh = v.view.maxY - v.view.minY;
    const art = (
      <div className="bk-art" style={{ aspectRatio: `${vw} / ${vh}` }}>
        <PlaySvg diagram={v.diagram} view={v.view} theme={BOOK_RENDER_THEME} style={{ height: 'auto' }} />
      </div>
    );
    // your edited version from the PlayForge library replaces the built one once the library has loaded
    return cell.playId ? <LiveArt playId={cell.playId} built={built}>{art}</LiveArt> : art;
  }
  // nothing could be rebuilt for this cell: say so, and keep its words findable
  return (
    <div className="bk-art bk-art-empty">
      <p>
        Not rebuilt: the drawing on page {page.n} could not be traced.
        {cell.labels.length > 0 && <> Printed on it: {cell.labels.map((l) => l.text).join(' · ')}</>}
      </p>
    </div>
  );
}

function CellFoot({ cell }: { cell: BookCell }) {
  const v = cell.vector;
  const conf = v ? v.confidence : 'none';
  const unplaced = cell.labels.filter((l) => !l.at);
  const guessed = (cell.guesses ?? []).map((g) => g.split(':')[0].trim());
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
        {guessed.length > 0 && (
          <span className="bk-conf bk-conf-medium" title={(cell.guesses ?? []).join('\n')}>
            guessed: {guessed.join(', ')}
          </span>
        )}
        <span className={`bk-conf bk-conf-${conf === 'none' ? 'low' : conf}`} title={v?.issues.join('; ') || 'Not rebuilt'} style={guessed.length ? { marginLeft: 0 } : undefined}>
          {conf === 'high' ? 'matches the page' : conf === 'none' ? 'not rebuilt' : 'check against the page'}
        </span>
      </div>
      {unplaced.length > 0 && <div className="bk-labels-note">{unplaced.map((l) => l.text).join(' · ')}</div>}
    </>
  );
}
