// OCR every rasterized page with Tesseract (tesseract.js = the same engine compiled to WASM, no admin install).
//
//   npm i --no-save tesseract.js
//   node scripts/playbook/ocr.mjs [firstPage] [lastPage] [workers]
//
// Output (gitignored): data/packers-2019/ocr/txt/p-001.txt ... plus all-pages.txt with "===== p-001 =====" separators,
// and words/p-001.json = [text, x0, y0, x1, y1, confidence] per word, so table pages can be read column by column.
// Pages that already have a .txt are skipped, so it is safe to stop and rerun.
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createWorker } from 'tesseract.js';

const root = join('data', 'packers-2019', 'ocr');
const pngDir = join(root, 'png');
const txtDir = join(root, 'txt');
const jsonDir = join(root, 'words');
mkdirSync(txtDir, { recursive: true });
mkdirSync(jsonDir, { recursive: true });

const first = Number(process.argv[2] ?? 1);
const last = Number(process.argv[3] ?? 9999);
const nWorkers = Number(process.argv[4] ?? 3);

const pages = readdirSync(pngDir)
  .filter((f) => /^p-\d{3}\.png$/.test(f))
  .map((f) => Number(f.slice(2, 5)))
  .filter((n) => n >= first && n <= last)
  .sort((a, b) => a - b);
const todo = pages.filter((n) => !existsSync(join(txtDir, `p-${String(n).padStart(3, '0')}.txt`)));
console.log(`${pages.length} pages in range, ${todo.length} to OCR with ${nWorkers} workers`);

let done = 0;
async function run() {
  const worker = await createWorker('eng', 1, { cachePath: join(root, 'tessdata') });
  // PSM 3 = fully automatic page segmentation: these pages mix tables, headings, and diagrams
  await worker.setParameters({ tessedit_pageseg_mode: '3', preserve_interword_spaces: '1' });
  for (;;) {
    const n = todo.shift();
    if (n === undefined) break;
    const id = `p-${String(n).padStart(3, '0')}`;
    if (existsSync(join(txtDir, `${id}.txt`))) continue; // another run got there first
    const { data } = await worker.recognize(join(pngDir, `${id}.png`), {}, { text: true, blocks: true });
    const words = [];
    for (const b of data.blocks ?? []) for (const p of b.paragraphs ?? []) for (const l of p.lines ?? []) for (const w of l.words ?? []) words.push([w.text, w.bbox.x0, w.bbox.y0, w.bbox.x1, w.bbox.y1, Math.round(w.confidence)]);
    writeFileSync(join(jsonDir, `${id}.json`), JSON.stringify(words));
    writeFileSync(join(txtDir, `${id}.txt`), data.text);
    done += 1;
    if (done % 20 === 0) console.log(`${done} done (last ${id}, confidence ${Math.round(data.confidence)})`);
  }
  await worker.terminate();
}
await Promise.all(Array.from({ length: nWorkers }, run));

const all = readdirSync(txtDir)
  .filter((f) => /^p-\d{3}\.txt$/.test(f))
  .sort()
  .map((f) => `===== ${f.slice(0, 5)} =====\n${readFileSync(join(txtDir, f), 'utf8')}`)
  .join('\n');
writeFileSync(join(root, 'all-pages.txt'), all);
console.log(`done: ${done} new pages, all-pages.txt rebuilt`);
