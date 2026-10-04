/**
 * Import the Packers 2019 formation pack into the checked-in seeds.
 *
 *   npm run import:formations                      re-run from data/formations/packers-2019.source.json
 *   npm run import:formations -- path/to/new.json  refresh the in-repo source from another file first
 *
 * Rerunnable: entries are keyed on name + personnel (name alone repeats, e.g. "I Rt" exists in
 * 21, 23 and 20), the output file is rewritten whole, and ids are deterministic. Same input,
 * same bytes out.
 *
 * Alignment constants come from src/model/constants.ts, not from the source file. The source
 * declares the constants it was authored with (`constants_used`); anything that differs is
 * remapped here, so a file authored in PlayForge's own constants passes through unchanged.
 */
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { OL_SPACING, SYMBOL_R } from '../src/model/constants.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'data/formations/packers-2019.source.json');
const OUT = path.join(ROOT, 'src/seeds/data/packers2019.json');

const SPOTS = ['LT', 'LG', 'C', 'RG', 'RT', 'QB', 'Y', 'Z', 'X', 'F', 'H'];

const sourceSchema = z.object({
  schema_note: z.string(),
  source: z.string(),
  constants_used: z.object({
    OL_guard_split: z.number().positive(),
    OL_tackle_split: z.number().positive(),
    TE_attached: z.number().positive(),
    outside_WR: z.number().positive(),
    numbers: z.number().positive(),
    slot: z.number().positive(),
  }),
  formations: z.array(
    z.strictObject({
      name: z.string().min(1),
      personnel: z.string().min(1),
      family: z.string().min(1),
      strength: z.enum(['Left', 'Right']),
      qb_alignment: z.enum(['under', 'gun', 'pistol']),
      source_page: z.number().int().positive(),
      confidence: z.enum(['derived', 'needs-review']),
      note: z.string().nullable(),
      players: z.array(z.strictObject({ spot: z.enum(SPOTS), x: z.number(), y: z.number() })).min(1),
    }),
  ),
});

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const r2 = (n) => Math.round(n * 100) / 100 + 0; // + 0 turns -0 into 0
const near = (a, b) => Math.abs(a - b) < 1e-6;

const args = process.argv.slice(2);
const validate = !args.includes('--no-validate');
const external = args.find((a) => !a.startsWith('--'));
if (external) {
  mkdirSync(path.dirname(SOURCE), { recursive: true });
  copyFileSync(path.resolve(external), SOURCE);
  console.log(`source refreshed from ${path.resolve(external)}`);
}

const parsed = sourceSchema.safeParse(JSON.parse(readFileSync(SOURCE, 'utf8')));
if (!parsed.success) {
  for (const i of parsed.error.issues.slice(0, 20)) console.error(`  ${i.path.join('.')}: ${i.message}`);
  throw new Error(`${path.relative(ROOT, SOURCE)} does not match the expected source shape`);
}
const src = parsed.data;
const c = src.constants_used;

// PlayForge's line: OL_SPACING between centers, attached TE one more spacing outside the tackle
// (every built-in formation puts Y there).
const PF = { guard: OL_SPACING, tackle: 2 * OL_SPACING, te: 3 * OL_SPACING };
const SRC = { guard: c.OL_guard_split, tackle: c.OL_tackle_split, te: c.TE_attached };
// Field-anchored alignments (slot, numbers, outside) are not defined by PlayForge and pass through.
const fieldMin = Math.min(c.slot, c.numbers, c.outside_WR);

/** Inside the box: piecewise-linear through ball, guard, tackle, attached TE. */
function boxX(a) {
  const knots = [[0, 0], [SRC.guard, PF.guard], [SRC.tackle, PF.tackle], [SRC.te, PF.te]];
  for (let i = 1; i < knots.length; i++) {
    const [s0, p0] = knots[i - 1];
    const [s1, p1] = knots[i];
    if (a <= s1 + 1e-9) return p0 + ((a - s0) / (s1 - s0)) * (p1 - p0);
  }
  return PF.te;
}

/**
 * x in the source's constants -> x in PlayForge's constants.
 * - within the attached-TE spot: scale with the line
 * - out to the slot: a split measured in yards from the end man on the line of scrimmage, so keep
 *   the yards and move the anchor (attached TE if one is on the ball that side, else the tackle)
 * - slot and wider: field-anchored, unchanged
 */
function remapX(player, all) {
  const a = Math.abs(player.x);
  const sign = Math.sign(player.x);
  if (a <= SRC.te + 1e-9) return r2(sign * boxX(a));
  if (a >= fieldMin - 1e-9) return r2(player.x);
  const teOnBall = all.some((q) => q !== player && Math.sign(q.x) === sign && near(Math.abs(q.x), SRC.te) && near(q.y, 0));
  const anchor = teOnBall ? 'te' : 'tackle';
  return r2(sign * (PF[anchor] + (a - SRC[anchor])));
}

const seen = new Map();
const warnings = [];
const formations = src.formations.map((f, index) => {
  const key = `${slug(f.name)}-${slug(f.personnel)}`;
  if (seen.has(key)) throw new Error(`Duplicate key "${key}": entries ${seen.get(key)} and ${index} share name "${f.name}" and personnel "${f.personnel}"`);
  seen.set(key, index);

  const spots = f.players.map((p) => p.spot);
  const dupSpot = spots.find((s, i) => spots.indexOf(s) !== i);
  if (dupSpot) throw new Error(`${f.name} [${f.personnel}]: spot ${dupSpot} appears twice`);

  const players = f.players.map((p) => ({ spot: p.spot, x: remapX(p, f.players), y: r2(p.y) }));

  const label = `${f.name} [${f.personnel}]`;
  if (players.length !== 11) warnings.push(`${label}: ${players.length} players, not 11`);
  for (let i = 0; i < players.length; i++)
    for (let j = i + 1; j < players.length; j++) {
      const d = Math.hypot(players[i].x - players[j].x, players[i].y - players[j].y);
      if (d < 2 * SYMBOL_R) warnings.push(`${label}: ${players[i].spot} and ${players[j].spot} overlap (${d.toFixed(2)} yd apart, symbols are ${(2 * SYMBOL_R).toFixed(2)} wide)`);
    }

  return {
    key,
    name: f.name,
    personnel: f.personnel,
    family: f.family,
    strength: f.strength.toLowerCase(),
    qbAlignment: f.qb_alignment,
    sourcePage: f.source_page,
    confidence: f.confidence,
    ...(f.note && f.note.trim() ? { note: f.note.trim() } : {}),
    players,
  };
});

// The Eagles system pack: alignments read off the Rams 2022 vector diagrams (scripts/formations/rams_build.py),
// under system names. A Rams formation replaces the Green Bay one with the same name and personnel (those
// came from a cut-off scan and hand fixes); Rams-only formations are added; Green Bay-only ones stay.
const OVERLAY = path.join(ROOT, 'data/formations/rams-2022.system.json');
const overlay = JSON.parse(readFileSync(OVERLAY, 'utf8')).formations;
const byKey = new Map(formations.map((f, i) => [f.key, i]));
let replaced = 0;
let added = 0;
for (const o of overlay) {
  const entry = { key: o.key, name: o.name, personnel: o.personnel, family: o.family, strength: o.strength, qbAlignment: o.qbAlignment, sourcePage: o.sourcePage, source: 'Rams 2022 (McVay), general section', confidence: o.confidence, note: o.note, alias: o.ramsName.replace(/\[[^\]]*\]\s*/g, '').trim(), players: o.players };
  const i = byKey.get(o.key);
  if (i === undefined) {
    formations.push(entry);
    added++;
  } else {
    formations[i] = { ...entry, family: formations[i].family };
    replaced++;
  }
}
// Green Bay-only formations were drawn on the old pack spots (wide 20, numbers 18, slot 12.55, a -5- split at 6.5).
// Move them onto the landmarks the Rams formations use, so every formation in the pack snaps the same way.
const LANDMARK_X = [
  [5.2, 5.8, 7.08], // inside partner of a -5- split
  [6.2, 7.2, 8.08], // -5- split: Hash +5
  [7.3, 7.7, 9.08], // outside partner of a -5- split
  [7.8, 8.2, 8.08], // 5 from an inline tight end: Hash +5
  [10.5, 12.8, 10.84], // slot: halfway to the normal outside split
  [13, 14, 13.11],
  [15.5, 17.5, 14.67], // inside the numbers (Book): Top #s
  [17.6, 18.4, 15.67], // on the numbers: Mid #s
  [19.5, 23, 18.67], // normal outside split: #s +2
];
for (const f of formations) {
  if (f.source) continue;
  f.only = 'Green Bay only';
  f.players = f.players.map((p) => {
    const a = Math.abs(p.x);
    const hit = LANDMARK_X.find(([lo, hi]) => a >= lo && a <= hi);
    return hit ? { ...p, x: Math.sign(p.x) * hit[2] } : p;
  });
}
console.log(`Rams 2022 overlay: ${replaced} replaced, ${added} added, ${formations.length - replaced - added} Green Bay only`);

const constants = {
  applied: { olSpacing: OL_SPACING, guard: PF.guard, tackle: PF.tackle, teAttached: PF.te },
  declaredBySource: { guard: SRC.guard, tackle: SRC.tackle, teAttached: SRC.te },
  keptFromSource: { outsideWR: c.outside_WR, numbers: c.numbers, slot: c.slot },
};
const revision = createHash('sha1').update(JSON.stringify({ constants, formations })).digest('hex').slice(0, 12);

const out = {
  _generated: 'Written by scripts/import-formations.mjs from data/formations/packers-2019.source.json. Edit the source and run `npm run import:formations`; do not edit this file.',
  pack: 'packers-2019',
  source: src.source,
  revision,
  constants,
  formations,
};
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');

const review = formations.filter((f) => f.confidence === 'needs-review').length;
console.log(`${formations.length} formations (${review} needs-review) -> ${path.relative(ROOT, OUT)}  revision ${revision}`);
const moved = ['guard', 'tackle', 'te'].filter((k) => !near(SRC[k], PF[k]));
if (moved.length) console.log(`remapped to PlayForge constants: ${moved.map((k) => `${k} ${SRC[k]} -> ${PF[k]}`).join(', ')}`);
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings) console.log(`  - ${w}`);
}

if (validate) {
  console.log('\nvalidating against src/model/schema.ts ...');
  execSync('npx vitest run src/seeds/packers2019.test.ts', { cwd: ROOT, stdio: 'inherit' });
}
