import 'fake-indexeddb/auto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { applyDrawnAlignments, buildImportPlan, mergeFormationsJson, parseChartXlsx, parseFormationsJson, type ImportPlan } from '@/importers/snapChart';
import { EAGLES_2026_FORMATIONS, EAGLES_2026_SNAPS } from '@/seeds';
import { getDb } from './db';
import { repo, usageFromSnaps } from './repo';

const DATA = path.resolve(__dirname, '../../import-data');
const load = (merge = true): ImportPlan =>
  buildImportPlan({ chart: parseChartXlsx(new Uint8Array(readFileSync(path.join(DATA, 'eagles-all22-chart.xlsx')))), json: parseFormationsJson(applyDrawnAlignments(mergeFormationsJson(readdirSync(DATA).filter((f) => /^W[0-9]+_.*_playforge[.]json$/.test(f)).sort().map((f) => readFileSync(path.join(DATA, f), 'utf8'))), JSON.parse(readFileSync(path.join(DATA, 'drawn-alignments.json'), 'utf8')))) }, { team: 'PHI', season: 2026, mirror: merge, mergeByCall: merge, naming: 'system', now: new Date().toISOString(), filmWinsWeeks: [1] });

describe('snap import into the library (Dexie on fake-indexeddb)', () => {
  beforeAll(async () => {
    await getDb().open();
  });

  it('the seeds already hold the Eagles pack: every charted snap (W1 54, W2 76, W3 53) linked to a formation that exists', async () => {
    const counts = await repo.counts();
    expect(counts.snaps).toBe(EAGLES_2026_SNAPS.length);
    expect(EAGLES_2026_SNAPS.length).toBe(183);
    const formations = await repo.listFormations('offense');
    const ids = new Set(formations.map((f) => f.id));
    for (const s of await repo.listSnaps()) expect(ids.has(s.formationId), s.playId).toBe(true);
    expect(formations.filter((f) => f.tags.includes('eagles-2026')).length).toBe(EAGLES_2026_FORMATIONS.length);
  });

  it('importing the same files again merges and never duplicates; a second pass changes nothing', async () => {
    const before = await repo.counts();
    const plan = load();
    const r1 = await repo.applySnapImport(plan);
    expect(r1).toMatchObject({ formationsAdded: 0, formationsMerged: plan.formations.length, snapsAdded: 0, snapsUpdated: EAGLES_2026_SNAPS.length, snapsSkipped: 0 });
    const mid = await repo.counts();
    expect(mid.formations).toBe(before.formations);
    expect(mid.snaps).toBe(EAGLES_2026_SNAPS.length);
    const r2 = await repo.applySnapImport(plan);
    expect(r2).toMatchObject({ formationsAdded: 0, formationsMerged: plan.formations.length, snapsAdded: 0, snapsUpdated: EAGLES_2026_SNAPS.length });
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
    expect(r.snapsSkipped).toBe(EAGLES_2026_SNAPS.length - plan.formations[1].count);
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

  it('new snaps for an existing formation raise its usage; a split import (Rt and Lt apart) lands as its own formations', async () => {
    const plan = load();
    const extra = { ...plan.snaps[0], id: 'PHI-2026-W9-001', playId: 'W9-001', week: 9 };
    const fid = extra.formationId;
    const was = (await repo.getFormation(fid))!.usage!.count;
    await repo.applySnapImport({ ...plan, snaps: [...plan.snaps, extra] });
    const now = (await repo.getFormation(fid))!;
    expect(now.usage?.count).toBe(was + 1);
    expect(now.usage?.weeks).toContain(9);
    expect(now.tags).toContain('W9');
    expect(await repo.counts()).toMatchObject({ snaps: EAGLES_2026_SNAPS.length + 1 });

    const split = load(false);
    const before = await repo.counts();
    const r = await repo.applySnapImport(split);
    expect(r.snapsAdded).toBe(0); // same snap ids, re-pointed at the split formations
    expect(r.formationsAdded).toBeGreaterThan(0); // the Lt pictures are their own, new ids
    expect((await repo.counts()).formations).toBe(before.formations + r.formationsAdded);
  });

  it('backups carry the snaps', async () => {
    const b = await repo.exportAll();
    expect(b.snaps?.length).toBe(EAGLES_2026_SNAPS.length + 1);
    expect(b.snaps?.[0]).toHaveProperty('formationId');
  });
});
