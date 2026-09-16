import type { ReactNode } from 'react';
import type { LayoutId, Paper } from '@/model/types';
import { LAYOUTS, sheetMetrics, type SheetMetrics } from '@/geometry/layout';
import { COLORS, FONT_STACK } from '@/model/constants';

export function TitleBar({ title, subtitle, heightIn, widthIn }: { title: string; subtitle?: string; heightIn: number; widthIn: number }) {
  const h = 100;
  const w = Math.round((widthIn / heightIn) * h);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="xMidYMid meet" style={{ width: '100%', height: `${heightIn}in`, display: 'block' }}>
      <rect x={0} y={0} width={w} height={h} fill={COLORS.ink} />
      <rect x={0} y={0} width={36} height={h} fill={COLORS.paper} stroke={COLORS.ink} strokeWidth={4} />
      <rect x={w - 36} y={0} width={36} height={h} fill={COLORS.paper} stroke={COLORS.ink} strokeWidth={4} />
      {subtitle ? (
        <>
          <text x={60} y={h / 2} dy="0.35em" fontFamily={FONT_STACK} fontWeight={700} fontSize={40} fill={COLORS.paper} textLength={undefined}>
            {title.toUpperCase()}
          </text>
          <text x={w / 2} y={h / 2} dy="0.35em" textAnchor="middle" fontFamily={FONT_STACK} fontWeight={700} fontSize={58} fill="#ff2a2a">
            &ldquo;{subtitle.toUpperCase()}&rdquo;
          </text>
        </>
      ) : (
        <text x={w / 2} y={h / 2} dy="0.35em" textAnchor="middle" fontFamily={FONT_STACK} fontWeight={700} fontSize={58} fill="#ff2a2a">
          &ldquo;{title.toUpperCase()}&rdquo;
        </text>
      )}
    </svg>
  );
}

export type SheetProps = {
  layout: LayoutId;
  paper: Paper;
  title: string;
  subtitle?: string;
  pageNo: number;
  pageCount: number;
  sectionTitle?: string;
  children: (m: SheetMetrics) => ReactNode;
};

/** One paper page: title bar, N-up grid of cells, footer. Rendered at true size. */
export function Sheet({ layout, paper, title, subtitle, pageNo, pageCount, sectionTitle, children }: SheetProps) {
  const m = sheetMetrics(layout, paper);
  const l = LAYOUTS[layout];
  return (
    <section
      className="sheet"
      style={{ width: `${m.pageW}in`, height: `${m.pageH}in`, padding: `${m.marginIn}in`, fontFamily: FONT_STACK }}
    >
      <TitleBar title={title} subtitle={subtitle} heightIn={m.titleIn} widthIn={m.pageW - 2 * m.marginIn} />
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: `repeat(${l.cols}, 1fr)`,
          gridTemplateRows: `repeat(${l.rows}, 1fr)`,
          gap: `${m.gapIn}in`,
          marginTop: `${m.gapIn}in`,
        }}
      >
        {children(m)}
      </div>
      <div style={{ height: `${m.footerIn}in`, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', fontSize: '8pt', color: '#444' }}>
        <span>{sectionTitle ?? ''}</span>
        <span>
          {title.toUpperCase()} &middot; {pageNo} / {pageCount}
        </span>
      </div>
    </section>
  );
}

export function EmptyCell() {
  return <div style={{ border: '1.5px solid #000', background: '#fff' }} />;
}
