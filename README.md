# PlayForge

Football play, formation, and playbook designer that prints NFL/Visio-style play sheets from the browser.

- Draw plays on formations: drag players (they snap into the next open slot of a row at that row's spacing), draw routes, blocks (T-bar ends, 45-degree snapping), motion squiggles, red-caps annotations, split markers, handoff marks.
- Alignment landmarks: dragging a player sideways also snaps to real field spots (each yard from 2 inside to 5 outside the hash, top / middle / bottom of the numbers, 2 and 4 yards from the sideline, middle of the field) and names the spot while you drag. `G` or the Guides button shows them all faintly; they never print or export. The landmark is saved on the player (`alignment`), Flip sends him to the same landmark on the other side, and the right panel reads out where the selected player sits ("Hash +3 (R)", "0.5 yd outside Bottom #s (L)"). Add or remove landmarks in `src/geometry/landmarks.ts` (`LANDMARK_DEFS`); field levels (NFL, College, High School) live in `FIELD_PRESETS` in `src/model/constants.ts` and are picked in Settings.
- Curves work like FirstDown PlayBook: draw straight segments, then drag the diamond handle in the middle of a segment to bend it. A curved segment shows its apex control point as a hollow circle; drag that to reshape. Drag it back to the line to straighten.
- Every line has Thickness (thick, medium, thin), Style (solid, dashed, dotted, wavy), Endpoint (none, arrow, open arrow, dot, T block, angled block), Color (8), and Inserts (double bar, chip, zigzag, X placed anywhere along the line). "Branch" starts another line from a line's end for alternate routes.
- Lines start at the player's edge and stop at the edge of any symbol they run into, so T-bars and arrows never overlap a player.
- Block presets on the player toolbar: base, down, reach, crack, cutoff, trap, kick out, pull/lead, wrap, pass set, combo, and double team (select two linemen).
- Formation library (offense and defense) with flip, duplicate, and personnel tags. Youth counts (6 to 12 a side) supported.
- Playbooks with sections, cover page, and call sheet.
- Print 1-up, 2-up, 4-up, 6-up, or 8-up play sheets and 9-up or 10-up formation sheets on Letter or A4. Save as PDF from the print dialog. Export a single play as PNG.
- Everything is stored in the browser (IndexedDB) and works offline. Optional cloud sync keeps the library the same on every device (see below). Export a JSON backup from Settings. Imports PlayForge-Lite exports.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. The gallery of seed formations and demo plays is at `/dev/gallery`. Unit tests: `npm test`.

## Formation packs

The 2019 Packers pack (71 formations) is checked in as seeds. Source of truth: `data/formations/packers-2019.source.json`.

```bash
npm run import:formations                     # rebuild src/seeds/data/packers2019.json from the source, then validate it
npm run import:formations -- path/to/new.json # replace the source with a new file first
npm run render:formations                     # SVG + PNG + an index.html contact sheet in renders/packers-2019/
```

Entries are keyed on name + personnel, so re-running never duplicates. Alignment constants come from `src/model/constants.ts`; a source authored with a different line spacing is remapped. Open browsers pick up regenerated data on the next load, and a formation you edited in the app is never overwritten. Filter the library to `Needs review` to work through the entries whose positions are only a starting shape.

## Snap charts: formations and snaps from film (Eagles 2026)

**Formations > Import** turns an All-22 charting workbook into a formation library with usage counts, and keeps every charted snap (week, quarter, down and distance, field zone, hash, play type, target, result, yards, motion, notes) linked to its formation in a `snaps` table, so formations can later be filtered by down, distance or run/pass rate. Upload the chart (`.xlsx`, sheet "Chart", header on row 4), the per-player alignment JSON (`playforge-formations/v1`), or both; the preview shows every unique formation's diagram, usage count, snap ids and source (W2 exact vs W1 template); tick what you want and import. Re-importing the same files merges and never duplicates: formations are keyed on an alignment signature, snaps on their id, and usage is recomputed from the snaps table. Rows the import could not use are listed with the reason.

- The workbook is the snap record for every week. The JSON adds exact per-player alignment (pos, side, align, on_line, order, stack_behind) for the snaps it covers, joined on Play ID. Snaps without per-player data are drawn from a **template** keyed on personnel + form family + backfield + strength: the most common alignment seen on film for that key, else a default shape for the family. Every formation whose snaps are all template-built is tagged `template, verify` and shows as *needs review*; its note lists the charted "Set:" text of each snap so it can be checked against film.
- Alignment labels become yards in `src/importers/snapChart/config.ts` (every constant is there): the hash sets where the numbers are (NFL hashes 23.6 yd from the sideline, numbers 12 yd; left hash = near numbers 11.6 yd, far 17.7), inline = 1 yd outside the end man, wing = 1 outside and 1 off, tight = 3 outside, slot = halfway from the tackle to the numbers, numbers, wide = 3 outside the numbers, off the ball = 1 yd back, stack = 2 yd behind; QB 1 / 4 / 5 yd (under center / pistol / gun); backs deep 7, offset 7 and 1.5 over, gun offset level with the QB, fullback 4.5. A standard five-man line is always drawn; a player with an unknown name is drawn and labelled by position.
- Dedupe: a formation is personnel + family + backfield + every skill player's side / align / on_line / order (labels, not coordinates, so the hash never splits one). Names read `11 Gun 2x2 Rt`; a second alignment with the same name gets `#2`, `#3` by usage. **Merge Rt and Lt mirrors** folds a Lt snap into the Rt formation (the snap is stored `mirrored`).
- The first import (Eagles 2026 weeks 1 and 2: 54 W1 snaps from the chart, 76 W2 snaps with exact alignment) is checked in as seeds. Inputs live in `import-data/`; `npm run import:snaps` rebuilds `src/seeds/data/eagles2026.json` and `import-data/import-report.json` with the same engine the Import page uses, so importing the same files in the app merges into the seeded rows. Snaps stay on the device (they are not synced); formations sync like any other.

## Play and route packs

The 2019 Packers route library (159 routes, pages 70-103) and the Install #1 plays are checked in as seeds next to the formation pack. Nothing is traced from the scanned diagrams: route geometry is derived from the depths and breaks the book states in words, and a play is an imported formation + a protection + a route word per receiver (or a run family), drawn with `src/geometry/routeLibrary.ts` and the block presets.

```bash
python scripts/playbook/rasterize.py "path/to/playbook.pdf"   # one PNG per page at 200 DPI (needs: pip install pymupdf)
npm i --no-save tesseract.js && node scripts/playbook/ocr.mjs  # Tesseract OCR: text + word boxes per page
python scripts/playbook/parse_route_pages.py                  # route tree tables -> local raw records
python scripts/playbook/parse_calls.py 1 104 157              # install N, first page, last page -> calls.install-N.json
npm run import:plays                                          # bind calls + route words + formations, write the seed data, validate
npm run render:plays                                          # SVG + PNG + an index.html contact sheet in renders/packers-2019-plays/
```

- Sources you edit: `data/packers-2019/routes.source.json` (one record per route) and `data/packers-2019/tags.install-N.json` (route word per player, read from the page because those labels are too small for OCR).
- The scans, the OCR text, and anything verbatim from the book stay in `data/packers-2019/ocr/` and `local/`, which are gitignored. The checked-in records carry depths, breaks, page numbers, and short paraphrased notes.
- Tags: a call binds the BASE formation only. Every other word is applied when the play is composed by `src/geometry/formationTags.ts`: alignment tags after the direction (Close, Off, Book, Hip ...) change where a player starts; shift and motion tags before or after the formation (Y Mo, F Sh, Hax, Z Lt, F Ctr ...) give the player a pre-snap spot, a final spot, and a path (`Player.motion`), drawn as a dashed orange ghost and a dotted red path behind the line. Routes and blocks always hang off the final spot. Seven men on the line is asserted after every tag and for every composed play; a tag that breaks it throws. A tag the book only draws (no split or landmark in words) is applied and the play is marked needs-review.
- Can calls (two plays in one call): the primary is drawn, the alternate is stored on the play (`alternate`: name, trigger, run family or route words) and shown on the play card.
- Formation corrections made in the app are folded back into the repo with `python scripts/apply-formation-corrections.py data/formations/corrections-<date>.json`, then `npm run import:formations`.
- Rerunnable: plays are keyed on formation line + call line, so a rerun updates in place and never duplicates. A play you edited in the app is never overwritten.
- Every play carries `install`, `sourcePage`, `rawCall`, `personnel`, `protection`, `concept`, `routeTags`, `confidence`, and `reviewNotes` as real fields. `data/packers-2019/import-report.json` lists what was flagged UNPARSED or needs-review and why.

## The Green Bay 2019 book (reader, review, PDF)

The whole scanned playbook recreated as a readable, searchable document: `/playbooks/gb-2019/read`. Every one of the 477 pages, in the original order, each with its original page number and a `#page-N` anchor; a sticky contents sidebar (the book's own sections, page titles, and play names); all words as HTML or SVG text, so Ctrl+F finds them and everything can be selected. The book's index pages link to the pages they list. Every diagram is a PlayForge drawing (nothing is a scan): traced from the page, then completed. Players the scan cut off or hid are placed by educated guess (the formation pack's spot for that formation line, else the mirror of the opposite man, else a default spot for the letter) and every guess is listed on the cell ("guessed: X, C"). Text labels the scan cut off are restored from the rest of the book and underlined dotted. `/playbooks/gb-2019/review` puts every rebuild below high confidence next to its scan. "Add to my library" on the reader imports every diagram as a play and the book as the **Green Bay 2019** playbook; every cell then has an **Edit** link into the play editor. On the formation pages, a cell whose title names a formation PlayForge already ships (the Packers 2019 pack, matched by personnel + name in `src/book/formationMatch.ts`) is drawn from that library formation instead of the trace, tagged *library formation*, gets an **Edit formation** link, and those formations go into the playbook as a "Formations (PlayForge library)" section. Once you edit a cell's play or its library formation, the cell shows *edited by you* in place of the *check against the page* and *guessed* notes. A play you save in the editor shows in the reader at once ("your edit" tag), "Update from this build" never overwrites a play you edited, and "Save edits into the book" writes them to `source/book/edits/gb-2019.json` so the next `build_book.py` and PDF carry them (the cell is marked "edited by you").

Everything built from the scan is copyrighted source material and stays on the computer that built it (`source/` and `public/book/` are gitignored). A deployment serves a **sealed** copy instead: `python scripts/playbook/pack_book.py` gzips and AES-256-GCM-encrypts `book.json` and `library.json` into `data/book/gb-2019.*.enc` (committed, unreadable without the key). Set two environment variables on Vercel and redeploy: `BOOK_KEY` (the hex key in `source/book/book.key`, written on the first pack) opens the book, and `BOOK_ACCESS_CODE` (any phrase) is what the reader asks for once per browser, so the book is not on the open web. The scans, the review page and "Save edits into the book" exist only on the building machine; editing plays and the live "your edit" view work anywhere.

```bash
python scripts/playbook/render300.py              # source/pages: every page at 300 DPI (the ink layers' native resolution)
python scripts/playbook/ocr_rapid.py              # source/ocr: RapidOCR lines (pip install rapidocr_onnxruntime)
python scripts/playbook/detect_cells.py           # source/cells: the ruled diagram cells
python scripts/playbook/agent_inputs.py           # source/book/input: compact per-page briefs for the transcription pass
#   transcription: Claude agents follow source/book/INSTRUCTIONS.md and write source/book/pages/p-NNN.json,
#   every page checked against its image (titles, text, index tables, per-diagram titles, labels, ring letters, defenders)
bash scripts/playbook/run_vectorize.sh            # source/vector: traced diagrams + scores (one process: this PC runs short of memory)
python scripts/playbook/clean_crops.py            # public/book/gb-2019/crops + pages: cleaned scans (the review page and the "Original scan" links)
python scripts/playbook/compose_requests.py && npx vitest run --config vitest.render.config.mts scripts/compose-book.render.tsx
                                                  # source/book/compositions.json: the formation pack's positions for every formation line, and every library route
python scripts/playbook/build_book.py             # public/book/gb-2019/book.json + library.json, source/book/review.json
PLAYFORGE_LOW_MEMORY_BUILD=1 npx next build && npm run start   # then open /playbooks/gb-2019/read (low-memory flag: see next.config.ts)
python scripts/playbook/pack_book.py              # data/book/gb-2019.*.enc for the deployment (commit these; the key stays in source/book/book.key)
node scripts/playbook/export_pdf.mjs              # prints the reader in chunks with Edge, then finish_pdf.py merges them:
                                                  # source/book/Green-Bay-2019-Playbook.pdf, contents links + bookmarks (needs the app running)
python scripts/playbook/preview.py <page> [cell]  # side-by-side scan vs rebuild PNGs, for checking the tracer
```

- Tracing (`vectorize.py`): players are closed rings / squares / the filled HB disc; ring letters are read with the OCR recogniser on the ring's inside, then the template classifier (`glyphs.py`); defenders are coloured (or, on the front pages, black) letter words matched against the page's transcribed defender list; lines are the remaining ink, thinned and traced, with dashes chained, arrowheads / dots / block T's at the ends, and lines through a player joined. Frame: OL centres are 1 yd apart, x = 0 at the centre square.
- Transcription is the source of truth for words: ring letters, defenders and labels on a rebuilt diagram are checked against it, an unread ring takes the page's missing letter when only one fits, and a look-alike misread (Z for S, X for K) is corrected from the page.
- Confidence: the rebuild is drawn back over the scan. recall = drawn ink the rebuild covers, precision = rebuild strokes that land on ink. high = recall >= 95%, precision >= 96%, every ring letter read, nothing big missed; medium = 88% / 92%. The transcription then has the last word: ring letters and defenders that disagree with the page lower it. Every cell shows its drawing; anything below high is marked "check against the page" and listed on the review page (`public/book/gb-2019/review.json`), and the library play carries the same flag plus the guesses in its notes. Completion (`scripts/playbook/complete.py`): unread rings take the page's letters, missing players come from the composition / mirror / defaults, the view window grows to show everyone.

## Sync across devices (optional)

Without setup the app is fully local, exactly as before. With a free Supabase project it keeps plays, formations, and playbooks the same on every device you sign in on. The newest edit wins per play, deletes carry over, and it keeps working offline and catches up later. Untouched built-ins never upload. Settings (look, hashes, paper) stay per device.

Setup, done once in your own Supabase and Vercel dashboards:

1. Create a Supabase project (free tier). Keep the database password in your password manager. The app never uses it.
2. SQL Editor: paste and run `supabase/schema.sql`.
3. Authentication > URL Configuration: Site URL = your deployed URL (for example `https://playforge-kohl.vercel.app`), and add `https://playforge-kohl.vercel.app/**` to Redirect URLs.
4. Authentication > Email Templates: in both **Magic Link** and **Confirm signup**, add a line with the code next to the link: `Your code: {{ .Token }}`. The very first sign-in uses Confirm signup.
5. Project Settings > API: copy the Project URL and the publishable (anon) key. Never the secret or service_role key. It is not needed anywhere.
6. Vercel > Settings > Environment Variables (Production): `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Redeploy, because these are baked in at build time.
7. Settings > Sync across devices: enter your email, type the code from the email. Do the same on the other device.
8. Once every device is signed in, turn off "Allow new users to sign up" in Supabase Authentication settings. The key is public by design, so this keeps strangers from creating accounts on your project. Row Level Security already keeps every user's rows private.

Good to know: the free tier sends only a few emails per hour, and it pauses a project after about a week with no activity (press Restore in the dashboard; the app keeps working locally meanwhile). On iPad, Add to Home Screen keeps Safari from clearing the site's storage after a week away; sign in there with the code, not the link.

## Layout

- `src/model` types, zod schemas, constants (all sizes in yards)
- `src/geometry` pure math: yards to SVG, paths (Catmull-Rom curves), markers, snapping, flip, route tree, block presets, sheet layout
- `src/render` the one SVG renderer shared by the editor, thumbnails, print, and PNG export
- `src/editor` pointer state machine, canvas, mini toolbar, inspector, shortcuts
- `src/store` Dexie database, repo, editor store (zustand + immer, snapshot undo), autosave
- `src/sync` cloud sync: pure newest-wins merge, engine, Supabase adapter, sign-in, status store
- `src/print` sheets, cells, cover, call sheet, PNG export
- `src/io` backup and PlayForge-Lite import
- `src/importers/snapChart` snap-chart import: xlsx reader, chart and JSON parsers, alignment labels to yards (config.ts), signatures, templates, the import plan
- `src/seeds` built-in formations, fronts, demo plays, the Packers 2019 pack, and the Eagles 2026 snap chart

Coordinates: x = 0 at the ball (positive right), y = 0 at the line of scrimmage (positive downfield). Route points are stored relative to their player, so moving a player moves its routes.

## Printing tips

In the Chrome or Edge print dialog turn off "Headers and footers", keep margins at "Default" or "None", and enable "Background graphics" only if you use the yard-line theme. The page size and orientation are set by the app for each layout.
