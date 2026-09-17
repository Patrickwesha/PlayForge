# PlayForge

Football play, formation, and playbook designer that prints NFL/Visio-style play sheets from the browser.

- Draw plays on formations: drag players (they snap into the next open slot of a row at that row's spacing), draw routes, blocks (T-bar ends, 45-degree snapping), motion squiggles, red-caps annotations, split markers, handoff marks.
- Curves work like FirstDown PlayBook: draw straight segments, then drag the diamond handle in the middle of a segment to bend it into an arc. Drag it back to straighten.
- Block presets on the player toolbar: base, down, reach, crack, cutoff, trap, kick out, pull/lead, wrap, pass set, combo, and double team (select two linemen).
- Formation library (offense and defense) with flip, duplicate, and personnel tags. Youth counts (6 to 12 a side) supported.
- Playbooks with sections, cover page, and call sheet.
- Print 1-up, 2-up, 4-up, 6-up, or 8-up play sheets and 9-up or 10-up formation sheets on Letter or A4. Save as PDF from the print dialog. Export a single play as PNG.
- Everything is stored in the browser (IndexedDB). Export a JSON backup from Settings. Imports PlayForge-Lite exports.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000. The gallery of seed formations and demo plays is at `/dev/gallery`. Unit tests: `npm test`.

## Layout

- `src/model` types, zod schemas, constants (all sizes in yards)
- `src/geometry` pure math: yards to SVG, paths (Catmull-Rom curves), markers, snapping, flip, route tree, block presets, sheet layout
- `src/render` the one SVG renderer shared by the editor, thumbnails, print, and PNG export
- `src/editor` pointer state machine, canvas, mini toolbar, inspector, shortcuts
- `src/store` Dexie database, repo, editor store (zustand + immer, snapshot undo), autosave
- `src/print` sheets, cells, cover, call sheet, PNG export
- `src/io` backup and PlayForge-Lite import
- `src/seeds` built-in formations, fronts, and demo plays

Coordinates: x = 0 at the ball (positive right), y = 0 at the line of scrimmage (positive downfield). Route points are stored relative to their player, so moving a player moves its routes.

## Printing tips

In the Chrome or Edge print dialog turn off "Headers and footers", keep margins at "Default" or "None", and enable "Background graphics" only if you use the yard-line theme. The page size and orientation are set by the app for each layout.
