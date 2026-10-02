import Link from 'next/link';
import { connection } from 'next/server';
import { loadReview } from '@/book/loadBook';
import { PlaySvg } from '@/render/PlaySvg';
import { BOOK_RENDER_THEME } from '@/render/theme';
import '@/book/reader.css';

export const metadata = { title: 'Rebuild review - PlayForge' };

const FILTERS = ['medium', 'low', 'all'] as const;
type Filter = (typeof FILTERS)[number];
const PER_PAGE = 60;

/**
 * Every diagram that is not a high-confidence rebuild: the scan next to the PlayForge rebuild, with the reasons.
 * medium = close to the drawing, worth a check; low = the rebuild is only an attempt. The reader shows the scan for both.
 */
export default async function ReviewPage(props: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await connection();
  const { id } = await props.params;
  const sp = await props.searchParams;
  const filter: Filter = FILTERS.includes(sp.c as Filter) ? (sp.c as Filter) : 'medium';
  const review = await loadReview(id);
  if (!review) return <main className="p-8">No book data on this computer.</main>;
  const base = `/book/${review.id}`;
  const rows = review.cells.filter((c) => filter === 'all' || c.vector.confidence === filter);
  const count = (f: Filter) => review.cells.filter((c) => f === 'all' || c.vector.confidence === f).length;
  const at = typeof sp.at === 'string' ? rows.findIndex((r) => r.anchor === sp.at) : -1;
  const pages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const page = at >= 0 ? Math.floor(at / PER_PAGE) + 1 : Math.min(Math.max(Number(sp.p) || 1, 1), pages);
  const shown = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const link = (p: number, f: Filter = filter) => `?c=${f}&p=${p}`;

  const pager = (
    <div className="bk-tools" style={{ marginTop: '0.75rem' }}>
      {page > 1 && (
        <Link className="bk-btn" href={link(page - 1)}>
          Previous
        </Link>
      )}
      <span style={{ fontSize: '0.8rem', alignSelf: 'center' }}>
        {rows.length ? `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, rows.length)} of ${rows.length}` : 'Nothing to review'}
      </span>
      {page < pages && (
        <Link className="bk-btn" href={link(page + 1)}>
          Next
        </Link>
      )}
    </div>
  );

  return (
    <div className="bk-root" style={{ minHeight: '100%' }}>
      <main className="bk-main" style={{ maxWidth: '80rem', margin: '0 auto' }}>
        <div className="bk-doc-head" style={{ maxWidth: 'none' }}>
          <h1>Rebuild review</h1>
          <p>
            {review.title}: every diagram whose PlayForge rebuild is not high confidence. Left, the cleaned scan (what the reader shows); right, the rebuild
            and why it was flagged. The play in your library carries the same flag.
          </p>
          <div className="bk-tools" style={{ marginTop: '0.75rem' }}>
            {FILTERS.map((f) => (
              <Link key={f} className="bk-btn" aria-pressed={f === filter} href={link(1, f)}>
                {f === 'all' ? 'all to review' : f} ({count(f)})
              </Link>
            ))}
            <Link className="bk-btn" href={`/playbooks/${id}/read`}>
              Back to the reader
            </Link>
          </div>
          {pager}
        </div>
        {shown.map((c) => {
          const v = c.vector;
          const [x0, y0, x1, y1] = c.cropBox;
          return (
            <section key={`${c.page}-${c.cell}`} id={c.anchor} className="bk-page" style={{ maxWidth: 'none', contentVisibility: 'visible' }}>
              <div className="bk-page-head">
                <Link className="bk-page-no" href={`/playbooks/${id}/read#${c.anchor}`}>
                  Page {c.page} · {c.cell}
                </Link>
                <span className={`bk-conf bk-conf-${v.confidence}`} style={{ marginLeft: 0 }}>
                  {v.confidence}
                </span>
                <span>
                  covers {Math.round(v.recall * 100)}% of the drawing · {Math.round(v.precision * 100)}% on the drawing
                </span>
              </div>
              <h3 className="bk-page-title" style={{ fontSize: '1rem' }}>
                {c.lines.join(' / ') || 'Diagram'}
              </h3>
              <div className="bk-grid" style={{ ['--cols' as string]: 2 }}>
                <figure className="bk-cell">
                  <figcaption className="bk-cell-head">Scan</figcaption>
                  <div className="bk-art" style={{ aspectRatio: `${x1 - x0} / ${y1 - y0}` }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`${base}/${c.crop}`} alt="scan" loading="lazy" />
                  </div>
                </figure>
                <figure className="bk-cell">
                  <figcaption className="bk-cell-head">Rebuild</figcaption>
                  <div className="bk-art" style={{ aspectRatio: `${v.view.maxX - v.view.minX} / ${v.view.maxY - v.view.minY}` }}>
                    <PlaySvg diagram={v.diagram} view={v.view} theme={BOOK_RENDER_THEME} style={{ height: 'auto' }} />
                  </div>
                </figure>
              </div>
              {v.issues.length > 0 && (
                <ul style={{ fontSize: '0.8rem', color: 'var(--bk-muted)', margin: '0.5rem 0 0' }}>
                  {v.issues.map((i, k) => (
                    <li key={k}>{i}</li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}
        {pager}
      </main>
    </div>
  );
}
