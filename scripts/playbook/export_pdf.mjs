// Print the book reader to a searchable PDF with headless Chromium (Microsoft Edge), in chunks.
//
//   node scripts/playbook/export_pdf.mjs [readerUrl] [--force]
//
// Needs the app running (npm run start). One print of all 477 pages is too much for Chromium on this machine,
// so the reader is printed ?pages=a-b at a time into source/book/pdf-parts/, then finish_pdf.py merges the
// parts, points every contents link at its page, and builds the bookmarks (section > page > play).
// Every word in the PDF is real text: HTML text and the SVG text of the rebuilt diagrams.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';

const reader = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:3000/playbooks/gb-2019/read';
const force = process.argv.includes('--force');
const CHUNK = Number(process.env.PDF_CHUNK ?? 40);
const LAST = Number(process.env.PDF_LAST ?? 477);
const outDir = 'source/book/pdf-parts';
mkdirSync(outDir, { recursive: true });

// Microsoft Edge is Chromium and ships with Windows: no browser download needed
const browser = await chromium.launch({ channel: process.env.PDF_BROWSER_CHANNEL ?? 'msedge' });
for (let a = 1; a <= LAST; a += CHUNK) {
  const b = Math.min(LAST, a + CHUNK - 1);
  const out = `${outDir}/part-${String(a).padStart(3, '0')}.pdf`;
  if (existsSync(out) && !force) continue;
  const page = await browser.newPage({ viewport: { width: 720, height: 960 } });
  // Edge defers the load event for lazy images forever: wait for the DOM, then for each image
  await page.goto(`${reader}?print=1&pages=${a}-${b}`, { waitUntil: 'domcontentloaded', timeout: 600_000 });
  await page.emulateMedia({ media: 'print', colorScheme: 'light' }); // after the load: emulating print first stalls Edge
  const stats = await page.evaluate(async () => {
    // links to pages outside this chunk: point them at the full reader so they survive as web links;
    // finish_pdf.py turns those into jumps inside the merged PDF
    for (const a of document.querySelectorAll('a[href^="#"]')) {
      const id = decodeURIComponent(a.getAttribute('href').slice(1));
      if (!document.getElementById(id)) a.setAttribute('href', `${location.origin}${location.pathname}#${id}`);
    }
    await Promise.all(
      [...document.images].map((img) =>
        img.complete && img.naturalWidth ? null : new Promise((r) => { img.onload = img.onerror = r; setTimeout(r, 60_000); }),
      ),
    );
    const sheet = 10.0 * 96; // letter height minus margins, in CSS px
    return {
      images: document.images.length,
      broken: [...document.images].filter((i) => !i.naturalWidth && i.offsetParent !== null).map((i) => i.src.split('/').pop()),
      tall: [...document.querySelectorAll('.bk-page')].filter((el) => el.getBoundingClientRect().height > sheet).map((el) => el.dataset.page),
    };
  });
  await page.pdf({
    path: out,
    format: 'Letter',
    printBackground: true,
    preferCSSPageSize: true,
    tagged: true,
    margin: { top: '0.45in', bottom: '0.5in', left: '0.5in', right: '0.5in' },
    timeout: 0,
  });
  await page.close();
  console.log(`pages ${a}-${b}: ${stats.images} images, ${stats.broken.length} broken ${stats.broken.slice(0, 3).join(' ')}, ${stats.tall.length} taller than a sheet ${stats.tall.join(' ')}`);
}
await browser.close();

const r = spawnSync('python', ['scripts/playbook/finish_pdf.py'], { stdio: 'inherit' });
process.exit(r.status ?? 1);
