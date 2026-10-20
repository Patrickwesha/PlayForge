// Print the Beast Offense 2026 book (/systems/beast-2026/book) to a PDF with headless Microsoft Edge.
//
//   node scripts/export-beast-book.mjs [url] [out.pdf]
//
// Needs the app running. Portrait and landscape pages come from the CSS named pages (@page land), so one
// print gives the mixed book, like the Rams 2022 sections. Every word stays real, selectable text.
import { chromium } from 'playwright';

const url = process.argv.find((a) => a.startsWith('http')) ?? 'http://localhost:3000/systems/beast-2026/book';
const out = process.argv.find((a) => a.endsWith('.pdf')) ?? 'renders/beast-2026/Beast-Offense-2026-Playbook.pdf';

const browser = await chromium.launch({ channel: process.env.PDF_BROWSER_CHANNEL ?? 'msedge' });
const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
await page.goto(url, { waitUntil: 'networkidle', timeout: 300_000 });
await page.waitForSelector('section.sheet');
await page.emulateMedia({ media: 'print', colorScheme: 'light' });
const sheets = await page.evaluate(() => document.querySelectorAll('section.sheet').length);
await page.pdf({ path: out, printBackground: true, preferCSSPageSize: true, tagged: true, outline: true, margin: { top: 0, bottom: 0, left: 0, right: 0 }, timeout: 0 });
await browser.close();
console.log(`${out}: ${sheets} sheets`);
