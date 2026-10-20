import { COLORS, HOLES } from './types';

/**
 * The line with its gap letters and hole numbers (odd left, even right). Plain SVG with inline attributes so
 * it prints the same as it shows.
 */
export function HoleChart({ width = 560 }: { width?: number }) {
  const W = 640;
  const H = 170;
  const step = 80;
  const cx = W / 2;
  const lineY = 70;
  const xs = HOLES.line.map((_, i) => cx + (i - 2) * step);
  const gapXs = [xs[0] - step / 2, ...xs.slice(0, -1).map((x) => x + step / 2), xs[4] + step / 2];
  // hole numbers sit under the linemen and gaps: 9 7 5 3 1 | 0 2 4 6 8
  const leftHoles = [xs[0] - step, xs[0], xs[1], xs[1] + step / 2, cx - 13];
  const rightHoles = [cx + 13, xs[3] - step / 2, xs[3], xs[4], xs[4] + step];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={width} style={{ maxWidth: '100%', height: 'auto' }} role="img" aria-label="Gaps and hole numbers">
      <rect x={0} y={0} width={cx} height={H} fill={COLORS.left.hex} opacity={0.18} />
      <rect x={cx} y={0} width={cx} height={H} fill={COLORS.right.hex} opacity={0.12} />
      <text x={12} y={20} fontFamily="Arial" fontSize={13} fontWeight={700}>ODD = LEFT</text>
      <text x={W - 12} y={20} textAnchor="end" fontFamily="Arial" fontSize={13} fontWeight={700}>EVEN = RIGHT</text>
      {HOLES.gaps.map((g, i) => (
        <text key={`g${i}`} x={gapXs[i]} y={lineY - 30} textAnchor="middle" fontFamily="Arial" fontSize={18} fontWeight={700} fill="#1F4FD1">{g}</text>
      ))}
      <line x1={20} x2={W - 20} y1={lineY} y2={lineY} stroke="#8C8C8C" strokeWidth={1.5} />
      {HOLES.line.map((l, i) =>
        l === 'C' ? (
          <g key={l}>
            <rect x={xs[i] - 18} y={lineY - 18} width={36} height={36} fill="#fff" stroke="#000" strokeWidth={2} />
            <text x={xs[i]} y={lineY + 6} textAnchor="middle" fontFamily="Arial" fontSize={15} fontWeight={700}>C</text>
          </g>
        ) : (
          <g key={l}>
            <circle cx={xs[i]} cy={lineY} r={18} fill="#fff" stroke="#000" strokeWidth={2} />
            <text x={xs[i]} y={lineY + 5} textAnchor="middle" fontFamily="Arial" fontSize={13} fontWeight={700}>{l}</text>
          </g>
        ),
      )}
      {HOLES.numbers.left.map((n, i) => (
        <text key={`l${n}`} x={leftHoles[i]} y={lineY + 52} textAnchor="middle" fontFamily="Arial" fontSize={22} fontWeight={700}>{n}</text>
      ))}
      {HOLES.numbers.right.map((n, i) => (
        <text key={`r${n}`} x={rightHoles[i]} y={lineY + 52} textAnchor="middle" fontFamily="Arial" fontSize={22} fontWeight={700}>{n}</text>
      ))}
      <text x={cx} y={H - 10} textAnchor="middle" fontFamily="Arial" fontSize={12} fill="#444">First number = who carries. Second number = the hole. 28 = 2 carries, hole 8 (outside right).</text>
    </svg>
  );
}
