# PlayForge

Football play, formation, and playbook designer that prints NFL/Visio-style play sheets from the browser.

- Draw plays on formations: drag players (they snap into the next open slot of a row at that row's spacing), draw routes, blocks (T-bar ends, 45-degree snapping), motion squiggles, red-caps annotations, split markers, handoff marks.
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
- `src/seeds` built-in formations, fronts, demo plays, and the Packers 2019 pack

Coordinates: x = 0 at the ball (positive right), y = 0 at the line of scrimmage (positive downfield). Route points are stored relative to their player, so moving a player moves its routes.

## Printing tips

In the Chrome or Edge print dialog turn off "Headers and footers", keep margins at "Default" or "None", and enable "Background graphics" only if you use the yard-line theme. The page size and orientation are set by the app for each layout.
