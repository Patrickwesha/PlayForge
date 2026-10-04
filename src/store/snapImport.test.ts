import 'fake-indexeddb/auto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { applyDrawnAlignments, buildImportPlan, mergeFormationsJson, parseChartXlsx, parseFormationsJson, type ImportPlan } from '@/importers/snapChart';
import { EAGLES_2026_FORMATIONS, EAGLES_2026_SNAPS } from '@/seeds';
import { getDb } from './db';
import { repo, usageFromSnaps } from './repo';

const DATA = path.resolve(__dirname, '../../import-data');
const load = (mirror = false): ImportPlan =>
  buildImportPlan({ chart: parseChartXlsx(new Uint8Array(readFileSync(path.join(DATA, 'eagles-all22-chart.xlsx')))), json: parseFormationsJson(applyDrawnAlignments(mergeFormationsJson(readdirSync(DATA).filter((f) => /^W[0-9]+_.*_playforge[.]json$/.test(f)).sort().map((f) => readFileSync(path.join(DATA, f), 'utf8'))), JSON.parse(readFileSync(path.join(DATA, 'drawn-alignments.json'), 'utf8')))) }, { team: 'PHI', season: 2026, mirror, now: new Date().toISOString(), filmWinsWeeks: [1] });

describe('snap import into the library (Dexie on fake-indexeddb)', () => {
  beforeAll(async () => {
    await getDb().open();
  });

  it('the seeds already hold the Eagles pack: 130 snaps linked to formations that exist', async () => {
    const counts = await repo.counts();
    expect(counts.snaps).toBe(EAGLES_2026_SNAPS.length);
    expect(EAGLES_2026_SNAPS.length).toBe(130);
    const formations = await repo.listFormations('offense');
    const ids = new Set(formations.map((f) => f.id));
    for (const s of await repo.listSnaps()) expect(ids.has(s.formationId), s.playId).toBe(true);
    expect(formations.filter((f) => f.tags.includes('eagles-2026')).length).toBe(EAGLES_2026_FORMATIONS.length);
  });

  it('importing the same files again merges and never duplicates; a second pass changes nothing', async () => {
    const before = await repo.counts();
    const plan = load();
    const r1 = await repo.applySnapImport(plan);
    expect(r1).toMatchObject({ formationsAdded: 0, formationsMerged: plan.formations.length, snapsAdded: 0, snapsUpdated: 130, snapsSkipped: 0 });
    const mid = await repo.counts();
    expect(mid.formations).toBe(before.formations);
    expect(mid.snaps).toBe(130);
    const r2 = await repo.applySnapImport(plan);
    expect(r2).toMatchObject({ formationsAdded: 0, formationsMerged: plan.formations.length, snapsAdded: 0, snapsUpdated: 130 });
    expect(await repo.counts()).toEqual(mid);
    // usage is recomputed from the snaps table, so counts stay what the chart says
    const top = await repo.getFormation(plan.formations[0].formation.id);
    expect(top?.usage?.count).toBe(plan.formations[0].count);
    expect(top?.usage).toEqual(usageFromSnaps(await repo.snapsForFormation(top!.id)));
    expect(top?.builtin).toBe(false);
  });

  it('only the selected formations (and their snaps) are written', async () => {
    const plan = load();
    const pick = plan.formations[1].formation.id;
    const r = await repo.applySnapImport(plan, [pick]);
    expect(r.formationsMerged).toBe(1);
    expect(r.snapsUpdated).toBe(plan.formations[1].count);
    expect(r.snapsSkipped).toBe(130 - plan.formations[1].count);
  });

  it('a formation the user edited keeps its players and name; only usage and tags move', async () => {
    const plan = load();
    const target = plan.formations[0].formation;
    const mine = { ...(await repo.getFormation(target.id))! };
    mine.name = 'MY GUN DOUBLES';
    mine.players = { ...mine.players };
    const qb = Object.values(mine.players).find((p) => p.role === 'QB')!;
    mine.players[qb.id] = { ...qb, y: -4.5 };
    await repo.saveFormation(mine);
    await repo.applySnapImport(plan);
    const after = (await repo.getFormation(target.id))!;
    expect(after.name).toBe('MY GUN DOUBLES');
    expect(after.players[qb.id].y).toBe(-4.5);
    expect(after.usage?.count).toBe(plan.formations[0].count);
    for (const w of plan.formations[0].weeks) expect(after.tags).toContain(`W${w}`);
  });

  it('new snaps for an existing formation raise its usage; a mirror-merge import lands as its own formations', async () => {
    const plan = load();
    const extra = { ...plan.snaps[0], id: 'PHI-2026-W3-001', playId: 'W3-001', week: 3 };
    const fid = extra.formationId;
    const was = (await repo.getFormation(fid))!.usage!.count;
    await repo.applySnapImport({ ...plan, snaps: [...plan.snaps, extra] });
    const now = (await repo.getFormation(fid))!;
    expect(now.usage?.count).toBe(was + 1);
    expect(now.usage?.weeks).toContain(3);
    expect(now.tags).toContain('W3');
    expect(await repo.counts()).toMatchObject({ snaps: 131 });

    const mirrored = load(true);
    const before = await repo.counts();
    const r = await repo.applySnapImport(mirrored);
    expect(r.snapsAdded).toBe(0); // same snap ids, re-pointed at the merged formations
    expect(r.formationsAdded).toBeGreaterThan(0); // merged Lt+Rt formations are new ids
    expect((await repo.counts()).formations).toBe(before.formations + r.formationsAdded);
  });

  it('backups carry the snaps', async () => {
    const b = await repo.exportAll();
    expect(b.snaps?.length).toBe(131);
    expect(b.snaps?.[0]).toHaveProperty('formationId');
  });
});
