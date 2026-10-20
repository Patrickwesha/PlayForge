/**
 * Render every play in a pack file (Settings > Import "pack" JSON) to a contact sheet, for a visual check.
 *
 *   PACK=source/cantu-2024/cantu-2024.pack.json npx vitest run --config vitest.render.config.mts scripts/render-pack.render.tsx
 *
 * Output: renders/pack/<pack file name>.png (gitignored).
 */
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { it } from 'vitest';
import type { Play } from '@/model/types';
import { PlayThumb } from '@/render/PlayThumb';

const W = 600;
const H = 420;

it('renders a pack', async () => {
  const file = process.env.PACK;
  if (!file) throw new Error('Set PACK to a pack JSON file');
  const pack = JSON.parse(readFileSync(path.resolve(file), 'utf8')) as { plays: Play[] };
  const out = path.resolve(import.meta.dirname, '../renders/pack');
  mkdirSync(out, { recursive: true });
  const cols = 4;
  const tiles = await Promise.all(
    pack.plays.map(async (p, i) => {
      const svg = renderToStaticMarkup(<PlayThumb diagram={p.diagram} aspect={W / H} />).replace('<svg ', `<svg width="${W}" height="${H}" `);
      const label = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="30"><rect width="100%" height="100%" fill="#000"/><text x="8" y="21" font-family="Arial" font-size="18" font-weight="700" fill="#fff">${p.name.replace(/&/g, '&amp;')}</text></svg>`;
      const art = await sharp(Buffer.from(svg)).resize(W, H, { fit: 'contain', background: '#ffffff' }).png().toBuffer();
      const input = await sharp({ create: { width: W, height: H + 30, channels: 4, background: '#ffffff' } })
        .composite([{ input: Buffer.from(label), top: 0, left: 0 }, { input: art, top: 30, left: 0 }])
        .png()
        .toBuffer();
      return { input, left: (i % cols) * W, top: Math.floor(i / cols) * (H + 30) };
    }),
  );
  await sharp({ create: { width: cols * W, height: Math.ceil(pack.plays.length / cols) * (H + 30), channels: 4, background: '#cccccc' } })
    .composite(tiles)
    .png()
    .toFile(path.join(out, `${path.basename(file, '.json')}.png`));
}, 120000);
