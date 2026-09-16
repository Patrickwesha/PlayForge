import { FONT_STACK } from '@/model/constants';
import { pageSize } from '@/geometry/layout';
import type { Orientation, Paper, Play } from '@/model/types';
import { playDefenseLabel, playHeaderLine1 } from '@/model/factories';

const th = { borderBottom: '2px solid #000', textAlign: 'left' as const, padding: '3px 6px', fontSize: '9pt', textTransform: 'uppercase' as const };
const td = { borderBottom: '1px solid #bbb', padding: '3px 6px', fontSize: '10pt' };

export function CallSheet({ rows, title, paper, orientation, pageNo, pageCount, startIndex }: { rows: Play[]; title: string; paper: Paper; orientation: Orientation; pageNo: number; pageCount: number; startIndex: number }) {
  const { w, h } = pageSize(paper, orientation);
  return (
    <section className="sheet" style={{ width: `${w}in`, height: `${h}in`, padding: '0.4in', fontFamily: FONT_STACK }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderBottom: '3px solid #000', paddingBottom: 4, marginBottom: 6 }}>
        <div style={{ fontSize: '16pt', fontWeight: 700, textTransform: 'uppercase' }}>{title} &middot; Call Sheet</div>
        <div style={{ fontSize: '9pt', color: '#444' }}>
          {pageNo} / {pageCount}
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...th, width: '5%' }}>#</th>
            <th style={{ ...th, width: '8%' }}>WB</th>
            <th style={{ ...th, width: '22%' }}>Formation</th>
            <th style={{ ...th, width: '30%' }}>Play</th>
            <th style={{ ...th, width: '10%' }}>Cat</th>
            <th style={{ ...th, width: '25%' }}>Vs</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={p.id} style={{ background: i % 2 ? '#f3f3f3' : '#fff' }}>
              <td style={td}>{startIndex + i + 1}</td>
              <td style={{ ...td, fontWeight: 700 }}>{p.wristband ?? ''}</td>
              <td style={{ ...td, textTransform: 'uppercase' }}>{playHeaderLine1(p)}</td>
              <td style={{ ...td, fontWeight: 700, textTransform: 'uppercase' }}>{p.name}</td>
              <td style={td}>{p.category}</td>
              <td style={{ ...td, textTransform: 'uppercase' }}>{playDefenseLabel(p)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
