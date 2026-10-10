/**
 * Render Rams 2022 remake plays to files with the shared renderer, for checking against the book's pages.
 *
 *   npx vitest run --config vitest.render.config.mts scripts/render-rams.render.tsx
 *   KEYS="wide-zone-p5-c1,3-step-p5-c1" ...   (cell keys; default = one cell per section)
 *
 * Output: renders/rams-2022/<key>.png + index.html
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { it } from 'vitest';
import { PlayThumb } from '@/render/PlayThumb';
import { composeRamsPlay } from '@/systems/rams/compose';
import type { RamsPlayPack } from '@/systems/rams/types';

const OUT = path.resolve(import.meta.dirname, '../renders/rams-2022');
const W = 1200;
const H = 900;

it('renders Rams plays to files', async () => {
  mkdirSync(OUT, { recursive: true });
  const pack = JSON.parse(readFileSync(path.resolve(import.meta.dirname, '../public/rams-2022/plays.json'), 'utf8')) as RamsPlayPack;
  const wanted = (process.env.KEYS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  const specs = wanted.length ? pack.plays.filter((p) => wanted.includes(p.key)) : [...new Map(pack.plays.map((p) => [p.section, p])).values()];
  const rows: string[] = [];
  for (const spec of specs) {
    const play = composeRamsPlay(spec);
    const svg = renderToStaticMarkup(<PlayThumb diagram={play.diagram} aspect={W / H} />).replace('<svg ', `<svg width="${W}" height="${H}" `);
    await sharp(Buffer.from(svg)).png().toFile(path.join(OUT, `${spec.key}.png`));
    rows.push(`<div><h3>${spec.key} - ${play.formationLabel} / ${play.name} (${play.defense?.front ?? ''})</h3><img src="${spec.key}.png" width="600"><pre>${(play.reviewNotes ?? []).join('\n')}</pre></div>`);
  }
  writeFileSync(path.join(OUT, 'index.html'), `<html><body>${rows.join('')}</body></html>`);
});
