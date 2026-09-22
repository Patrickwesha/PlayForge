/**
 * Render pack formations to files with the shared renderer (src/render), the same call the
 * library cards make. Runs under vitest for the tsx + "@/" alias support:
 *
 *   npm run render:formations
 *   FORMATIONS="I Rt [21],Trips Rt" npm run render:formations
 *
 * Output: renders/packers-2019/<key>.svg + .png, and index.html with every formation in the pack.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { expect, it } from 'vitest';
import type { Formation } from '@/model/types';
import { FORMATION_FIT } from '@/geometry/bounds';
import { PlayThumb } from '@/render/PlayThumb';
import { PACKERS_2019_FORMATIONS, PACKERS_2019_ID_PREFIX } from '@/seeds';

const OUT = path.resolve(import.meta.dirname, '../renders/packers-2019');
const W = 1200;
const H = 800;

// One per family, plus the four named acceptance cases.
const DEFAULT = ['I Rt [21]', 'I Rt Ace [21]', 'West Rt [21]', 'Pistol Bone Rt [21]', 'Trips Rt [11]', 'Bunch Rt [11]', 'Deuce Rt [12]', 'Stack Rt [11]', 'Fast Rt [11]', 'Crip Rt [11]', 'I Rt Tighter [22Z]', 'I Rt [20]'];

const title = (f: Formation) => `${f.name} [${f.personnel}]`;
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function svgOf(f: Formation): string {
  const markup = renderToStaticMarkup(<PlayThumb diagram={{ players: f.players, paths: {}, annotations: {} }} aspect={W / H} fit={FORMATION_FIT} />);
  return markup.replace('<svg ', `<svg width="${W}" height="${H}" `);
}

it('renders formations to files', async () => {
  mkdirSync(OUT, { recursive: true });
  const wanted = (process.env.FORMATIONS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const picks = (wanted.length ? wanted : DEFAULT).map((w) => {
    const f = PACKERS_2019_FORMATIONS.find((g) => title(g) === w || g.name === w);
    if (!f) throw new Error(`No formation "${w}" in the pack`);
    return f;
  });

  for (const f of picks) {
    const key = f.id.slice(PACKERS_2019_ID_PREFIX.length);
    const svg = svgOf(f);
    writeFileSync(path.join(OUT, `${key}.svg`), svg);
    await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, `${key}.png`));
    console.log(`  ${title(f).padEnd(24)} ${path.join(OUT, key)}.svg / .png`);
  }

  const cards = PACKERS_2019_FORMATIONS.map(
    (f) => `<figure class="${f.confidence}"><figcaption><b>${esc(title(f))}</b> <span>${esc(f.family ?? '')} · p.${f.sourcePage}</span>${f.confidence === 'needs-review' ? ' <em>needs review</em>' : ''}</figcaption>${svgOf(f).replace(/ width="\d+" height="\d+"/, '')}${f.note ? `<p>${esc(f.note)}</p>` : ''}</figure>`,
  ).join('\n');
  const html = `<!doctype html><meta charset="utf-8"><title>Packers 2019 formations</title>
<style>body{font:13px Arial,sans-serif;margin:16px}main{display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:12px}figure{margin:0;border:1px solid #000}figcaption{padding:4px 6px;border-bottom:1px solid #000}figcaption span{color:#666}em{background:#fde68a;padding:0 4px;font-style:normal;font-weight:bold}svg{aspect-ratio:3/2}p{margin:0;padding:4px 6px;border-top:1px solid #ccc;color:#444}label{margin-right:12px}body.review figure.derived{display:none}</style>
<h1>Packers 2019 formations (${PACKERS_2019_FORMATIONS.length})</h1>
<p><label><input type="checkbox" onchange="document.body.classList.toggle('review',this.checked)"> Needs review only (${PACKERS_2019_FORMATIONS.filter((f) => f.confidence === 'needs-review').length})</label></p>
<main>
${cards}
</main>`;
  writeFileSync(path.join(OUT, 'index.html'), html);
  console.log(`  contact sheet            ${path.join(OUT, 'index.html')}`);
  expect(picks.length).toBeGreaterThan(0);
});
