import { FONT_STACK } from '@/model/constants';
import { pageSize } from '@/geometry/layout';
import type { Orientation, Paper } from '@/model/types';

export function CoverPage({ title, subtitle, team, season, paper, orientation }: { title: string; subtitle?: string; team?: string; season?: string; paper: Paper; orientation: Orientation }) {
  const { w, h } = pageSize(paper, orientation);
  return (
    <section className="sheet" style={{ width: `${w}in`, height: `${h}in`, padding: '0.75in', fontFamily: FONT_STACK, justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ border: '6px double #000', padding: '1in 0.75in', width: '100%' }}>
        {team && <div style={{ fontSize: '18pt', fontWeight: 700, letterSpacing: '0.2em', marginBottom: '0.5in' }}>{team.toUpperCase()}</div>}
        <div style={{ fontSize: '44pt', fontWeight: 700, lineHeight: 1.05, textTransform: 'uppercase' }}>{title}</div>
        {subtitle && <div style={{ fontSize: '20pt', marginTop: '0.3in', color: '#d0021b', fontWeight: 700 }}>&ldquo;{subtitle.toUpperCase()}&rdquo;</div>}
        {season && <div style={{ fontSize: '14pt', marginTop: '0.6in', color: '#444' }}>{season}</div>}
      </div>
    </section>
  );
}
