import type { Formation, Play } from '@/model/types';
import type { SheetMetrics } from '@/geometry/layout';
import { playDefenseLabel, playHeaderLine1 } from '@/model/factories';
import { FORMATION_FIT } from '@/geometry/bounds';
import { PlayThumb } from '@/render/PlayThumb';
import type { RenderTheme } from '@/render/theme';

const cellStyle = { border: '1.5px solid #000', background: '#fff', display: 'flex', flexDirection: 'column' as const, minHeight: 0, overflow: 'hidden' };

export function PlayCell({ play, m, theme, big }: { play: Play; m: SheetMetrics; theme: RenderTheme; big: boolean }) {
  const line1 = playHeaderLine1(play);
  const footerL = playDefenseLabel(play);
  const footerR = play.wristband ?? '';
  const showFooter = !!(footerL || footerR);
  const headerFont = big ? 14 : 10;
  return (
    <div style={cellStyle}>
      <div
        style={{
          height: `${m.cellHeaderIn}in`,
          borderBottom: '1.5px solid #000',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1.15,
          textTransform: 'uppercase',
          fontWeight: 700,
          padding: '0 4px',
          textAlign: 'center',
        }}
      >
        {line1 && <div style={{ fontSize: `${headerFont}pt` }}>{line1}</div>}
        <div style={{ fontSize: `${headerFont + 1}pt` }}>{play.name}</div>
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <PlayThumb diagram={play.diagram} aspect={m.aspect} theme={theme} view={play.view} />
      </div>
      <div
        style={{
          height: `${m.cellFooterIn}in`,
          borderTop: showFooter ? '1px solid #000' : 'none',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '0 4px',
          fontSize: `${big ? 10 : 8}pt`,
          fontWeight: 700,
          textTransform: 'uppercase',
        }}
      >
        <span>{footerL}</span>
        <span>{footerR}</span>
      </div>
    </div>
  );
}

export function FormationCell({ formation, m, theme }: { formation: Formation; m: SheetMetrics; theme: RenderTheme }) {
  const diagram = { players: formation.players, paths: {}, annotations: {} };
  const label = formation.personnel ? `[${formation.personnel}] ${formation.name}` : formation.name;
  return (
    <div style={cellStyle}>
      <div
        style={{
          height: `${Math.min(m.cellHeaderIn, 0.3)}in`,
          borderBottom: '1.5px solid #000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textTransform: 'uppercase',
          fontWeight: 700,
          fontSize: '9pt',
        }}
      >
        {label}
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <PlayThumb diagram={diagram} aspect={m.svgW / (m.cellH - Math.min(m.cellHeaderIn, 0.3) - 0.05)} theme={theme} fit={FORMATION_FIT} />
      </div>
    </div>
  );
}
