/**
 * Render the Beast 2026 plays and formations with the shared renderer, for a visual check.
 *
 *   npm run render:beast              (SYSTEM=wco-2026 npm run render:beast for the West Coast)
 *
 * Output: renders/beast-2026/<id>.png and a contact sheet, renders/beast-2026/sheet.png (gitignored).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { it } from 'vitest';
import { FORMATION_FIT } from '@/geometry/bounds';
import { PlayThumb } from '@/render/PlayThumb';
import { YOUTH_SYSTEMS } from '@/systems/youth/registry';

const SYS = YOUTH_SYSTEMS[process.env.SYSTEM ?? 'beast-2026'];
const OUT = path.resolve(import.meta.dirname, `../renders/${SYS.id}`);
const W = 900;
const H = 600;

it('renders the beast pack', async () => {
  mkdirSync(OUT, { recursive: true });
  const tiles: { input: Buffer; left: number; top: number }[] = [];
  const items = [
    ...SYS.plays.map((p) => ({ id: p.id, title: `${p.wristband}  ${p.name}`, svg: renderToStaticMarkup(<PlayThumb diagram={p.diagram} aspect={W / H} />) })),
    ...SYS.formationRows.map((f) => ({ id: f.id, title: f.name, svg: renderToStaticMarkup(<PlayThumb diagram={{ players: f.players, paths: {}, annotations: {} }} aspect={W / H} fit={FORMATION_FIT} />) })),
  ];
  const cols = 4;
  for (const [i, it] of items.entries()) {
    const svg = it.svg.replace('<svg ', `<svg width="${W}" height="${H}" `);
    const label = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="40"><rect width="100%" height="100%" fill="#000"/><text x="10" y="28" font-family="Arial" font-size="24" font-weight="700" fill="#fff">${it.title.replace(/&/g, '&amp;')}</text></svg>`;
    const png = await sharp({ create: { width: W, height: H + 40, channels: 4, background: '#ffffff' } })
      .composite([{ input: Buffer.from(label), top: 0, left: 0 }, { input: Buffer.from(svg), top: 40, left: 0 }])
      .png()
      .toBuffer();
    writeFileSync(path.join(OUT, `${it.id}.png`), png);
    tiles.push({ input: await sharp(png).resize(W / 2).toBuffer(), left: (i % cols) * (W / 2), top: Math.floor(i / cols) * ((H + 40) / 2) });
  }
  const rows = Math.ceil(items.length / cols);
  await sharp({ create: { width: cols * (W / 2), height: rows * ((H + 40) / 2), channels: 4, background: '#cccccc' } })
    .composite(tiles)
    .png()
    .toFile(path.join(OUT, 'sheet.png'));
}, 120000);
