import { ANNOTATION_SIZE, COLORS, SPLIT_SIZE, STROKE } from '@/model/constants';
import type { Annotation, MarkAnnotation, TextAnnotation, ViewWindow } from '@/model/types';
import { toSvg, yd } from '@/geometry/transform';
import { fontFamily } from './svgText';

function TextGlyph({ a }: { a: TextAnnotation }) {
  const size = a.style === 'split' ? SPLIT_SIZE : ANNOTATION_SIZE[a.size ?? 'md'];
  const isRed = a.style === 'redCaps';
  const bold = a.style === 'redCaps' || a.style === 'bold';
  const text = isRed ? a.text.toUpperCase() : a.text;
  const lines = text.split('\n');
  return (
    <text
      textAnchor="middle"
      fontFamily={fontFamily}
      fontWeight={bold ? 700 : 400}
      fontSize={yd(size)}
      fill={isRed ? COLORS.red : COLORS.ink}
      transform={a.rotate ? `rotate(${a.rotate})` : undefined}
    >
      {lines.map((l, i) => (
        <tspan key={i} x={0} dy={i === 0 ? `${0.35 - (lines.length - 1) * 0.55}em` : '1.1em'}>
          {l}
        </tspan>
      ))}
    </text>
  );
}

function MarkGlyph({ a }: { a: MarkAnnotation }) {
  const sw = yd(STROKE.normal);
  switch (a.mark) {
    case 'handoffX': {
      const k = yd(0.28);
      return (
        <g stroke={COLORS.red} strokeWidth={sw * 1.2} strokeLinecap="round">
          <line x1={-k} y1={-k} x2={k} y2={k} />
          <line x1={-k} y1={k} x2={k} y2={-k} />
        </g>
      );
    }
    case 'ballDot':
      return <circle r={yd(0.18)} fill={COLORS.ink} />;
    case 'zoneBubble': {
      const r = yd(a.r ?? 2.5);
      return (
        <g>
          <ellipse rx={r} ry={r * 0.75} fill="none" stroke={COLORS.ink} strokeWidth={yd(STROKE.thin)} strokeDasharray={`${yd(0.3)} ${yd(0.2)}`} />
          {a.label && (
            <text textAnchor="middle" dy="0.35em" fontFamily={fontFamily} fontSize={yd(0.5)} fill={COLORS.ink}>
              {a.label}
            </text>
          )}
        </g>
      );
    }
    case 'fakeArrow': {
      const k = yd(0.6);
      return (
        <g stroke={COLORS.ink} strokeWidth={sw} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <line x1={-k} y1={0} x2={k} y2={0} />
          <polyline points={`${k * 0.55},${-k * 0.45} ${k},0 ${k * 0.55},${k * 0.45}`} />
        </g>
      );
    }
  }
}

export function AnnotationLayer({ annotations, view, selectedId }: { annotations: Record<string, Annotation>; view: ViewWindow; selectedId?: string }) {
  return (
    <g data-layer="annotations">
      {Object.values(annotations).map((a) => {
        const s = toSvg(a, view);
        return (
          <g key={a.id} transform={`translate(${s.x.toFixed(2)} ${s.y.toFixed(2)})`} data-hit={`ann:${a.id}`} style={{ cursor: 'pointer' }}>
            {selectedId === a.id && (
              <rect x={-yd(1.2)} y={-yd(0.5)} width={yd(2.4)} height={yd(1)} fill="none" stroke={COLORS.selection} strokeWidth={yd(0.04)} strokeDasharray={`${yd(0.15)} ${yd(0.1)}`} />
            )}
            {a.kind === 'text' ? <TextGlyph a={a} /> : <MarkGlyph a={a} />}
          </g>
        );
      })}
    </g>
  );
}
