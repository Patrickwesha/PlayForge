/**
 * Render pack plays to files with the shared renderer (src/render), the same call the library cards make.
 *
 *   npm run render:plays
 *   PLAYS="BOTH OMAHA,18 ZORRO" npm run render:plays     (substring match on the raw call)
 *
 * Output: renders/packers-2019-plays/<key>.svg + .png, and index.html with every play in the pack.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import type { Play } from '@/model/types';
import { PlayThumb } from '@/render/PlayThumb';
import { FORMATION_FIT, MAX_READABLE_WIDTH_YD, fitReport } from '@/geometry/bounds';
import { applyCallTags } from '@/geometry/formationTags';
import { PACKERS_2019_FORMATIONS, PACKERS_2019_PLAYS, PACKERS_2019_PLAY_ID_PREFIX } from '@/seeds';

const OUT = path.resolve(import.meta.dirname, '../renders/packers-2019-plays');
const W = 1200;
const H = 900;

// One of each kind that Install #1 has. Substrings of the raw call.
const DEFAULT = [
  'DEUCE RT / 18 STRUCTURE SIFT', // outside zone
  'I RT BOOK / 18 MIKE (CAN) 19 WEAK', // Can call
  'I LT CLAMP BUMP / TOSS 19 ZORRO', // outside zone from the I, Lt
  'I RT HOP / 15 WEAK Z GHOST', // inside zone from the I
  'SNUG RT / 15 WANDA F SIFT', // inside zone, single back
  'I RT TIGHT F LT / 200 JET X STICK', // quick game: Stick
  'DEUCE RT / 200 JET BOTH OMAHA', // quick game
  'SNUG RT / 3 JET Y COCO BOW', // dropback
  'WEST RT SLOT / 3 JET Z SHALLOW CROSS F ARCHO', // dropback
  'I RT BOOK / P15 WEAK Z STRIKE X BLAZE OUT', // play pass
  'DICE RT / FK 19 KEEP RT', // movement (keeper)
  'BUNCH RT / SPECIAL SCREEN LT', // screen
  'WEST RT HIP / 2 SCAT Y REDSKIN', // red zone
  'CRUSH RT Z RT / 2 SCAT Z SKINNER WHEEL DASH', // red zone, back on a wheel
];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const svgOf = (p: Play) => renderToStaticMarkup(<PlayThumb diagram={p.diagram} aspect={W / H}  />).replace('<svg ', `<svg width="${W}" height="${H}" `);

it('renders plays to files', async () => {
  mkdirSync(OUT, { recursive: true });
  const wanted = (process.env.PLAYS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const picks = (wanted.length ? wanted : DEFAULT).map((w) => {
    const p = PACKERS_2019_PLAYS.find((q) => (q.rawCall ?? '').includes(w));
    if (!p) throw new Error(`No play with "${w}" in its call`);
    return p;
  });
  // one play per tag family, picked from whatever the import produced
  const FAMILIES = ['ACE', 'BOOK', 'HIP', 'HOP', 'OFF', 'CLAMP', 'CLOSE', 'TIGHT', 'Y MO', 'F MO', 'H HAX', 'H HAY', 'F FOY', 'Z FLY', 'Y LT', 'X SHORTY'];
  const families: Record<string, string> = {};
  for (const fam of FAMILIES) {
    const hit = PACKERS_2019_PLAYS.find((q) => q.appliedTags?.includes(fam) && !picks.includes(q));
    if (hit) {
      picks.push(hit);
      families[fam] = hit.rawCall ?? hit.name;
    }
  }

  // the hand-built reference: Wax Rt Off, Y Mo (formation only)
  const wax = PACKERS_2019_FORMATIONS.find((f) => f.name === 'Wax Rt')!;
  const ref = applyCallTags(Object.values(wax.players), { pre: 'Y MO', post: ['OFF'], direction: 'RT', personnel: '13Z' });
  const refSvg = renderToStaticMarkup(<PlayThumb diagram={{ players: Object.fromEntries(ref.players.map((q) => [q.id, q])), paths: {}, annotations: {} }} aspect={W / H} fit={FORMATION_FIT} />).replace('<svg ', `<svg width="${W}" height="${H}" `);
  writeFileSync(path.join(OUT, 'reference-wax-rt-off-y-mo.svg'), refSvg);
  await sharp(Buffer.from(refSvg)).png().toFile(path.join(OUT, 'reference-wax-rt-off-y-mo.png'));

  // why each play is or is not derived, with counts per reason (the letters are blanked so reasons group)
  const reasons: Record<string, { count: number; pages: number[] }> = {};
  for (const q of PACKERS_2019_PLAYS)
    for (const n of q.reviewNotes ?? []) {
      const key = n.replace(/\([XYZFH]\)/g, '(player)').replace(/^[XYZFH] /, 'player ').replace(/: .*$/, '');
      reasons[key] ??= { count: 0, pages: [] };
      reasons[key].count += 1;
      if (!reasons[key].pages.includes(q.sourcePage!)) reasons[key].pages.push(q.sourcePage!);
    }
  const tagUse: Record<string, number> = {};
  for (const q of PACKERS_2019_PLAYS) for (const t of q.appliedTags ?? []) tagUse[t.replace(/^[XYZFH] /, '')] = (tagUse[t.replace(/^[XYZFH] /, '')] ?? 0) + 1;
  writeFileSync(
    path.resolve(import.meta.dirname, '../data/packers-2019/compose-report.json'),
    `${JSON.stringify(
      {
        plays: PACKERS_2019_PLAYS.length,
        derived: PACKERS_2019_PLAYS.filter((q) => q.confidence === 'derived').length,
        needsReview: PACKERS_2019_PLAYS.filter((q) => q.confidence === 'needs-review').length,
        canCalls: PACKERS_2019_PLAYS.filter((q) => q.alternate).length,
        playsWithMotion: PACKERS_2019_PLAYS.filter((q) => Object.values(q.diagram.players).some((pl) => pl.motion)).length,
        tagUse: Object.fromEntries(Object.entries(tagUse).sort((a, b) => b[1] - a[1])),
        reasons: Object.fromEntries(Object.entries(reasons).sort((a, b) => b[1].count - a[1].count)),
        renderedTagFamilies: families,
        // one long path (a screen, a jet motion) can force a window so wide the line is unreadable: these are reported, never clipped
        lineTooSmall: PACKERS_2019_PLAYS.filter((q) => fitReport(q.diagram, 4 / 3).lineTooSmall).map((q) => `${q.rawCall} (window ${fitReport(q.diagram, 4 / 3).widthYd.toFixed(1)} yd wide, limit ${MAX_READABLE_WIDTH_YD})`),
        windowWidthYd: Object.fromEntries([...new Set(PACKERS_2019_PLAYS.map((q) => Math.round(fitReport(q.diagram, 4 / 3).widthYd / 4) * 4))].sort((a, b) => a - b).map((w) => [w, PACKERS_2019_PLAYS.filter((q) => Math.round(fitReport(q.diagram, 4 / 3).widthYd / 4) * 4 === w).length])),
      },
      null,
      1,
    )}
`,
  );

  for (const p of picks) {
    const key = p.id.slice(PACKERS_2019_PLAY_ID_PREFIX.length);
    const svg = svgOf(p);
    writeFileSync(path.join(OUT, `${key}.svg`), svg);
    await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, `${key}.png`));
    console.log(`  ${(p.rawCall ?? '').padEnd(64)} ${key}.png`);
  }

  const cards = PACKERS_2019_PLAYS.map(
    (p) =>
      `<figure class="${p.confidence}"><figcaption><b>${esc(p.rawCall ?? p.name)}</b> <span>${p.category} · install ${p.install} · p.${p.sourcePage}</span>${p.confidence === 'needs-review' ? ' <em>needs review</em>' : ''}${p.appliedTags?.length ? `<br><small>tags: ${esc(p.appliedTags.join(', '))}</small>` : ''}${p.alternate ? `<br><small><b>CAN TO ${esc(p.alternate.name)}</b>${p.alternate.trigger ? ` vs. ${esc(p.alternate.trigger)}` : ''}</small>` : ''}</figcaption>${svgOf(p).replace(/ width="\d+" height="\d+"/, '')}${p.reviewNotes?.length ? `<ul>${p.reviewNotes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}${p.notes ? `<p>${esc(p.notes)}</p>` : ''}</figure>`,
  ).join('\n');
  const html = `<!doctype html><meta charset="utf-8"><title>Packers 2019 plays</title>
<style>body{font:13px Arial,sans-serif;margin:16px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(420px,1fr));gap:12px}figure{margin:0;border:1px solid #000}figcaption{padding:4px 6px;border-bottom:1px solid #000}figcaption span{color:#666}em{background:#fde68a;padding:0 4px;font-style:normal;font-weight:bold}svg{aspect-ratio:4/3}p,ul{margin:0;padding:4px 6px 4px 22px;border-top:1px solid #ccc;color:#444}p{padding-left:6px}</style>
<h1>Packers 2019 plays (${PACKERS_2019_PLAYS.length})</h1>
<main>
${cards}
</main>`;
  writeFileSync(path.join(OUT, 'index.html'), html);
  console.log(`  contact sheet  ${path.join(OUT, 'index.html')}`);
  expect(picks.length).toBeGreaterThanOrEqual(10);
});
