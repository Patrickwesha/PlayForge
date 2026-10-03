import { readFileSync } from 'node:fs';
import path from 'node:path';
import { strToU8, zipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { formationSchema, snapSchema } from '@/model/schema';
import type { Formation } from '@/model/types';
import { buildImportPlan, canonicalize, fallbackTemplate, formationIdFor, formationName, numbersForHash, parseChartRows, parseChartXlsx, parseFormationsJson, parseNotes, placePlayers, readSheet, signatureOf, templateKey, templatesFromExact, type AlignedPlayer } from './index';
import { HASH_FROM_MIDDLE, NUMBERS_FROM_MIDDLE } from './alignment';
import { BACK_SPOT, QB_DEPTH, RECEIVER, TAGS } from './config';

const DATA = path.resolve(__dirname, '../../../import-data');
const xlsx = () => new Uint8Array(readFileSync(path.join(DATA, 'eagles-all22-chart.xlsx')));
const jsonText = () => readFileSync(path.join(DATA, 'W2_PHI-TEN_playforge.json'), 'utf8');
const NOW = '2026-10-03T00:00:00.000Z';
const OPTS = { team: 'PHI', season: 2026, mirror: false, now: NOW };

/** A tiny workbook with every cell type the reader has to handle. */
function workbook(rows: Record<string, string | number | boolean | { f: string; cached: string } | { shared: number }>[], sharedStrings: string[]): Uint8Array {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const cell = (ref: string, v: string | number | boolean | { f: string; cached: string } | { shared: number }) => {
    if (typeof v === 'number') return `<c r="${ref}"><v>${v}</v></c>`;
    if (typeof v === 'boolean') return `<c r="${ref}" t="b"><v>${v ? 1 : 0}</v></c>`;
    if (typeof v === 'string') return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
    if ('shared' in v) return `<c r="${ref}" t="s"><v>${v.shared}</v></c>`;
    return `<c r="${ref}" t="str"><f>${esc(v.f)}</f><v>${esc(v.cached)}</v></c>`;
  };
  const sheet = rows.map((cells, i) => `<row r="${i + 1}">${Object.entries(cells).map(([col, v]) => cell(`${col}${i + 1}`, v)).join('')}</row>`).join('');
  const files: Record<string, Uint8Array> = {
    'xl/workbook.xml': strToU8(`<workbook xmlns:r="x"><sheets><sheet name="How to use" sheetId="1" r:id="rId1"/><sheet name="Chart" sheetId="2" r:id="rId2"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8(`<Relationships><Relationship Id="rId1" Type="w" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="w" Target="worksheets/sheet2.xml"/></Relationships>`),
    'xl/sharedStrings.xml': strToU8(`<sst>${sharedStrings.map((s) => `<si><t>${esc(s)}</t></si>`).join('')}</sst>`),
    'xl/worksheets/sheet1.xml': strToU8(`<worksheet><sheetData/></worksheet>`),
    'xl/worksheets/sheet2.xml': strToU8(`<worksheet><sheetData>${sheet}</sheetData></worksheet>`),
  };
  return zipSync(files);
}

const HEADER = { A: 'Play ID', B: 'Wk', C: 'Qtr', D: 'Down', E: 'Dist', F: 'Field Zone', G: 'Hash', H: 'Personnel', I: 'Form Family', K: 'Str', N: 'Backfield', O: 'Play Type', V: 'Target', W: 'Result', X: 'Yds', AE: 'Notes' };

describe('xlsx reader + chart parse', () => {
  it('reads shared strings, inline strings, numbers, booleans and cached formula values; stops at the first empty Play ID', () => {
    const wb = workbook(
      [
        { A: 'EAGLES' },
        {},
        {},
        HEADER,
        { A: { f: 'IF(B5="","","W"&B5)', cached: 'W1-001' }, B: 1, C: 1, D: '1', E: 10, F: { shared: 0 }, G: 'Left', H: '12', I: "3x1 'T'", K: 'Rt', N: 'Under Center', V: 'S.Barkley', W: 'Incomplete', X: 0, AE: 'PHI 35. pass incomplete. | Set: Wicks wide R, Smith slot R. Motion: Smith / slot R / across to L / at snap (2x2 as snapped).' },
        { A: 'W1-002', B: 2, C: 2, D: '3', E: 4, G: 'Middle', H: '11', I: "2x2 'D'", N: 'Gun, RB L', O: 'Run', W: 'Run - Gain', X: 5, AE: 'no set text' },
        { A: 'W1-003', B: 'x', H: '11', I: "2x2 'D'", N: 'Gun' },
        { A: 'W1-004', B: 1, I: "2x2 'D'", N: 'Gun' },
        { A: 'W1-002', B: 1, H: '11', I: "2x2 'D'", N: 'Gun' },
        { A: 'W1-005', B: 1, H: '11', I: "2x2 'D'", N: 'Wildcat' },
        { A: { f: 'IF(B10="","","W"&B10)', cached: '' } },
        { A: 'W1-099', B: 1, H: '11', I: "2x2 'D'", N: 'Gun' },
      ],
      ['Own 21-40'],
    );
    const sheet = readSheet(wb, 'Chart');
    expect(sheet.get(5)?.get('F')).toBe('Own 21-40');
    expect(sheet.get(5)?.get('A')).toBe('W1-001');
    expect(sheet.get(5)?.get('E')).toBe(10);
    expect(() => readSheet(wb, 'Nope')).toThrow(/No sheet named "Nope"/);

    const parsed = parseChartRows(sheet);
    expect(parsed.rows.map((r) => r.playId)).toEqual(['W1-001', 'W1-002']);
    const r1 = parsed.rows[0];
    expect(r1).toMatchObject({ week: 1, quarter: 1, down: 1, distance: 10, fieldZone: 'Own 21-40', hash: 'Left', personnel: '12', formFamily: "3x1 'T'", strength: 'Rt', backfield: 'Under Center', target: 'S.Barkley', result: 'Incomplete', yards: 0, callType: 'pass' });
    expect(r1.set).toBe('Wicks wide R, Smith slot R.');
    expect(r1.motion).toBe('Smith / slot R / across to L / at snap (2x2 as snapped).');
    const r2 = parsed.rows[1];
    expect(r2).toMatchObject({ week: 2, down: 3, distance: 4, hash: 'Middle', backfield: 'Gun', backfieldDetail: 'Gun, RB L', playType: 'Run', callType: 'run', yards: 5, strength: undefined, set: undefined });
    expect(parsed.skipped.map((s) => [s.row, s.reason])).toEqual([
      [7, 'Wk is not a number'],
      [8, 'Personnel is blank'],
      [9, 'Duplicate Play ID (first seen on row 6)'],
      [10, 'Backfield "Wildcat" not recognized (Under Center / Gun / Pistol) is blank'],
    ]);
  });

  it('parses the real Eagles chart: 130 snaps, 54 in W1 and 76 in W2, formula Play IDs by cached value', () => {
    const parsed = parseChartXlsx(xlsx());
    expect(parsed.rows.length).toBe(130);
    expect(parsed.skipped).toEqual([]);
    const weeks = parsed.rows.reduce<Record<number, number>>((a, r) => ((a[r.week] = (a[r.week] ?? 0) + 1), a), {});
    expect(weeks).toEqual({ 1: 54, 2: 76 });
    expect(parsed.rows[0]).toMatchObject({ playId: 'W1-001', week: 1, quarter: 1, down: 1, distance: 10, hash: 'Left', personnel: '12', formFamily: "3x1 'T'", strength: 'Rt', backfield: 'Under Center', result: 'Incomplete' });
    expect(parsed.rows[0].set).toBe('Wicks wide R, Smith slot R, Goedert inline R, Mundt inline L.');
    expect(parsed.rows[0].motion).toBe('Smith / slot R / across to L / at snap (2x2 as snapped).');
    expect(parsed.rows.at(-1)).toMatchObject({ playId: 'W2-076', week: 2, result: 'Touchdown', yards: 3 });
    // every row has a down, distance and personnel; blank Str and Hash are allowed
    expect(parsed.rows.every((r) => r.down && r.distance !== undefined && r.personnel && r.formFamily)).toBe(true);
    expect(parsed.rows.filter((r) => !r.hash).length).toBe(3);
    expect(parsed.rows.filter((r) => !r.strength).length).toBe(5);
    // the W2 notes carry "| Conf H/M/H, Both" after the set: it must not leak into the set text
    const w2 = parsed.rows.find((r) => r.playId === 'W2-001')!;
    expect(w2.set).toMatch(/^I-formation, Mundt inline L/);
    expect(w2.set).not.toMatch(/Conf/);
  });

  it('parseNotes handles missing parts', () => {
    expect(parseNotes(undefined)).toEqual({});
    expect(parseNotes('nothing charted')).toEqual({});
    expect(parseNotes('x | Set: Trips R | Conf H/H/H, Both')).toEqual({ set: 'Trips R' });
    expect(parseNotes('Motion: Y across')).toEqual({ motion: 'Y across' });
  });
});

describe('formations JSON parse', () => {
  it('parses the real W2 file: 76 snaps, labels normalized', () => {
    const j = parseFormationsJson(jsonText());
    expect(j.game).toMatchObject({ season: 2026, week: 2, team: 'PHI', opponent: 'TEN' });
    expect(j.snaps.length).toBe(76);
    expect(j.skipped).toEqual([]);
    const s2 = j.snaps.find((s) => s.id === 'W2-002')!;
    expect(s2).toMatchObject({ week: 2, backfield: 'Gun', backfieldDetail: 'Gun, RB R', strength: 'Rt', hash: 'Middle', personnel: '12', formFamily: "3x1 'T'" });
    expect(s2.players.length).toBe(6);
    const s25 = j.snaps.find((s) => s.id === 'W2-025')!;
    expect(s25.strength).toBeUndefined();
    expect(s25.players.filter((p) => p.id_unknown).length).toBe(3);
  });

  it('rejects other files with a reason', () => {
    expect(() => parseFormationsJson('not json')).toThrow('Not a JSON file');
    expect(() => parseFormationsJson({ schema: 'something/v9', snaps: [] })).toThrow(/playforge-formations\/v1/);
    expect(() => parseFormationsJson({ schema: 'playforge-formations/v1', snaps: [{ id: 'W2-001', personnel: '11', form_family: 'x', backfield: 'Gun', players: [] }] })).toThrow(/snaps\.0\.players/);
  });
});

describe('alignment labels to yards', () => {
  it('the hash sets the numbers: 11.6 near and 17.73 far from a hash, 14.67 from the middle', () => {
    expect(HASH_FROM_MIDDLE).toBeCloseTo(3.07, 2);
    expect(NUMBERS_FROM_MIDDLE).toBeCloseTo(14.67, 2);
    expect(numbersForHash('Left')).toEqual({ L: 11.6, R: 17.73 });
    expect(numbersForHash('Right')).toEqual({ L: 17.73, R: 11.6 });
    expect(numbersForHash('Middle')).toEqual({ L: 14.67, R: 14.67 });
    expect(numbersForHash(undefined)).toEqual(numbersForHash('Middle'));
  });

  const byLabel = (players: Record<string, { label: string; x: number; y: number }>, label: string) => {
    const p = Object.values(players).find((q) => q.label === label);
    if (!p) throw new Error(`no ${label} in ${Object.values(players).map((q) => q.label).join(',')}`);
    return p;
  };

  it('receivers: inline, wing, tight off the end man; slot, numbers, wide off the field; off the ball is 1 yd back', () => {
    const charted: AlignedPlayer[] = [
      { pos: 'QB', side: 'C', align: 'under_center' },
      { pos: 'RB', side: 'C', align: 'deep' },
      { pos: 'TE', side: 'R', align: 'inline', on_line: true, order: 1 },
      { pos: 'TE', side: 'R', align: 'wing', on_line: false, order: 2 },
      { pos: 'WR', side: 'R', align: 'wide', on_line: true, order: 3 },
      { pos: 'WR', side: 'L', align: 'slot', on_line: false, order: 1 },
      { pos: 'WR', side: 'L', align: 'numbers', on_line: true, order: 2 },
    ];
    const { players, warnings } = placePlayers(charted, { hash: 'Left', strength: 'Rt', backfield: 'Under Center', idPrefix: 'f' });
    expect(warnings).toEqual([]);
    expect(Object.keys(players).length).toBe(12);
    expect(Object.values(players).filter((p) => p.role === 'OL' || p.role === 'C').map((p) => [p.x, p.y])).toEqual([[-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0]]);
    expect(byLabel(players, 'Q')).toMatchObject({ x: 0, y: -QB_DEPTH.under_center });
    expect(byLabel(players, 'H')).toMatchObject({ x: 0, y: -BACK_SPOT.deep.depth });
    expect(byLabel(players, 'Y')).toMatchObject({ x: 3, y: 0 }); // 1 outside the tackle
    expect(byLabel(players, 'U')).toMatchObject({ x: 4, y: -1 }); // wing: 1 outside the end man (Y), 1 off
    expect(byLabel(players, 'Z')).toMatchObject({ x: 20.73, y: 0 }); // far numbers (17.73) + RECEIVER.wideOutsideNumbers (3)
    expect(byLabel(players, 'F')).toMatchObject({ x: -(2 + 11.6) / 2, y: -1 }); // halfway tackle to near numbers, off
    expect(byLabel(players, 'X')).toMatchObject({ x: -11.6, y: 0 });
  });

  it('tight is 3 outside the end man and moves the end man; a bunch steps outside the previous slot', () => {
    const charted: AlignedPlayer[] = [
      { pos: 'QB', side: 'C', align: 'gun' },
      { pos: 'RB', side: 'L', align: 'gun_offset' },
      { pos: 'TE', side: 'L', align: 'inline', on_line: true, order: 1 },
      { pos: 'TE', side: 'L', align: 'tight', on_line: true, order: 2 },
      { pos: 'WR', side: 'R', align: 'slot', on_line: false, order: 1 },
      { pos: 'WR', side: 'R', align: 'slot', on_line: true, order: 2 },
      { pos: 'WR', side: 'R', align: 'slot', on_line: false, order: 3 },
    ];
    const { players } = placePlayers(charted, { hash: 'Middle', strength: 'Rt', backfield: 'Gun', idPrefix: 'f' });
    expect(byLabel(players, 'Q')).toMatchObject({ x: 0, y: -5 });
    expect(byLabel(players, 'H')).toMatchObject({ x: -1.5, y: -5 });
    expect(byLabel(players, 'Y')).toMatchObject({ x: -3, y: 0 }); // both TEs weak side: Y is the one nearest the ball
    expect(byLabel(players, 'U')).toMatchObject({ x: -6, y: 0 }); // tight: 3 outside the end man (Y)
    const slots = Object.values(players).filter((p) => p.role === 'WR').sort((a, b) => a.x - b.x);
    expect(slots.map((p) => [p.x, p.y])).toEqual([[8.34, -1], [9.84, 0], [11.34, -1]]);
  });

  it('stack_behind puts the player 2 yd straight behind; pistol and gun backs sit at the configured depths', () => {
    const charted: AlignedPlayer[] = [
      { pos: 'QB', side: 'C', align: 'pistol' },
      { pos: 'RB', side: 'C', align: 'pistol_back' },
      { pos: 'WR', side: 'R', align: 'wide', on_line: true, order: 1 },
      { pos: 'WR', side: 'R', align: 'wide', on_line: false, order: 2, stack_behind: 1 },
    ];
    const { players } = placePlayers(charted, { hash: 'Middle', strength: 'Rt', backfield: 'Pistol', idPrefix: 'f' });
    expect(byLabel(players, 'Q').y).toBe(-QB_DEPTH.pistol);
    expect(byLabel(players, 'H').y).toBe(-BACK_SPOT.pistol_back.depth);
    const [front, back] = Object.values(players).filter((p) => p.role === 'WR').sort((a, b) => b.y - a.y);
    expect(front).toMatchObject({ x: 17.67, y: 0 });
    expect(back).toMatchObject({ x: 17.67, y: -RECEIVER.stackBehindDepth });
  });

  it('a snap with no QB charted still draws one from the backfield; unknown labels warn and still draw', () => {
    const { players, warnings } = placePlayers([{ pos: 'WR', name: null, side: 'R', align: 'flexed', on_line: true, order: 1, id_unknown: true }], { backfield: 'Gun', idPrefix: 'f' });
    expect(byLabel(players, 'Q').y).toBe(-QB_DEPTH.gun);
    expect(byLabel(players, 'Z')).toBeTruthy();
    expect(warnings[0]).toMatch(/"flexed" is not known/);
  });
});

describe('signature dedupe and mirror merge', () => {
  const base = { personnel: '11', formFamily: "2x2 'D'", backfield: 'Gun' as const };
  const rt: AlignedPlayer[] = [
    { pos: 'QB', side: 'C', align: 'gun' },
    { pos: 'RB', side: 'L', align: 'gun_offset' },
    { pos: 'TE', side: 'R', align: 'inline', on_line: true, order: 1 },
    { pos: 'WR', side: 'R', align: 'wide', on_line: true, order: 2 },
    { pos: 'WR', side: 'L', align: 'slot', on_line: false, order: 1 },
    { pos: 'WR', side: 'L', align: 'wide', on_line: true, order: 2 },
  ];
  const lt = rt.map((p) => ({ ...p, side: p.side === 'L' ? ('R' as const) : p.side === 'R' ? ('L' as const) : p.side }));

  it('same labels in a different order give the same signature; a changed on_line or align does not', () => {
    const shuffled = [...rt].reverse();
    expect(signatureOf({ ...base, players: shuffled })).toBe(signatureOf({ ...base, players: rt }));
    const offBall = rt.map((p) => (p.align === 'wide' && p.side === 'R' ? { ...p, on_line: false } : p));
    expect(signatureOf({ ...base, players: offBall })).not.toBe(signatureOf({ ...base, players: rt }));
    expect(signatureOf({ ...base, formFamily: "3x1 'T'", players: rt })).not.toBe(signatureOf({ ...base, players: rt }));
    expect(formationIdFor(signatureOf({ ...base, players: rt }))).toMatch(/^snapform-[0-9a-f]{16}$/);
  });

  it('mirror off keeps Rt and Lt apart; mirror on folds Lt into Rt and marks it mirrored', () => {
    const a = canonicalize({ ...base, players: rt, strength: 'Rt' }, false);
    const b = canonicalize({ ...base, players: lt, strength: 'Lt' }, false);
    expect(a.signature).not.toBe(b.signature);
    expect(b.mirrored).toBe(false);
    const c = canonicalize({ ...base, players: lt, strength: 'Lt' }, true);
    expect(c.signature).toBe(a.signature);
    expect(c.mirrored).toBe(true);
    expect(c.strength).toBe('Rt');
    expect(c.players.find((p) => p.pos === 'TE')?.side).toBe('R');
    // no strength charted: the two mirror images still land on one signature
    const d = canonicalize({ ...base, players: rt }, true);
    const e = canonicalize({ ...base, players: lt }, true);
    expect(d.signature).toBe(e.signature);
    expect(d.mirrored).not.toBe(e.mirrored);
  });

  it('names read personnel, backfield, family, strength', () => {
    expect(formationName('11', 'Gun', "2x2 'D'", 'Rt')).toBe('11 Gun 2x2 Rt');
    expect(formationName('12', 'Under Center', "3x1 'T'", 'Lt')).toBe('12 UC 3x1 Lt');
    expect(formationName('13', 'Pistol', 'Big', undefined)).toBe('13 Pistol Big');
    expect(formationName('11', 'Gun', "Diamond 'Q'", 'Rt')).toBe('11 Gun Diamond Rt');
  });
});

describe('W1 templates', () => {
  it('the most common W2 alignment for a key wins; ties go to the first charted', () => {
    const a: AlignedPlayer[] = [{ pos: 'QB', side: 'C', align: 'gun' }, { pos: 'WR', side: 'R', align: 'wide', on_line: true, order: 1 }];
    const b: AlignedPlayer[] = [{ pos: 'QB', side: 'C', align: 'gun' }, { pos: 'WR', side: 'R', align: 'slot', on_line: true, order: 1 }];
    const key = templateKey({ personnel: '11', formFamily: "2x2 'D'", backfield: 'Gun', strength: 'Rt' });
    const mk = (playId: string, players: AlignedPlayer[]) => ({ key, playId, players, personnel: '11', formFamily: "2x2 'D'" as const, backfield: 'Gun' as const });
    const t = templatesFromExact([mk('W2-001', b), mk('W2-002', a), mk('W2-003', a)]);
    expect(t.get(key)?.players).toBe(a);
    expect(t.get(key)?.playIds).toEqual(['W2-002', 'W2-003']);
    expect(templatesFromExact([mk('W2-001', b), mk('W2-002', a)]).get(key)?.players).toBe(b);
    expect(templateKey({ personnel: '11', formFamily: "2x2 'D'", backfield: 'Gun' })).toBe(key); // blank Str = Rt
  });

  it('default shapes follow the spec when W2 has no match', () => {
    const t = fallbackTemplate({ personnel: '11', formFamily: "3x1 'T'", backfield: 'Gun', strength: 'Rt' });
    expect(t.from).toBe('default');
    const r = t.players.filter((p) => p.side === 'R').map((p) => `${p.pos} ${p.align}`);
    expect(r).toEqual(['TE inline', 'WR slot', 'WR wide']);
    expect(t.players.filter((p) => p.side === 'L').map((p) => `${p.pos} ${p.align}`)).toEqual(['RB gun_offset', 'WR wide']); // gun back on the weak side
    const big = fallbackTemplate({ personnel: '13', formFamily: 'Big', backfield: 'Under Center', strength: 'Lt' });
    expect(big.players.map((p) => `${p.pos} ${p.side} ${p.align}`)).toEqual(['QB C under_center', 'RB C deep', 'TE L inline', 'TE R inline', 'TE L wing', 'WR R wide']);
    const empty = fallbackTemplate({ personnel: '11', formFamily: 'Empty', backfield: 'Gun', strength: 'Rt' });
    expect(empty.players.filter((p) => p.pos !== 'QB').map((p) => `${p.pos} ${p.side} ${p.align}`)).toEqual(['TE R inline', 'WR R slot', 'WR R wide', 'RB L slot', 'WR L wide']);
    const twoBack = fallbackTemplate({ personnel: '11', formFamily: '2 Back', backfield: 'Under Center' });
    expect(twoBack.players.map((p) => `${p.pos} ${p.side} ${p.align}`)).toEqual(['QB C under_center', 'RB C deep', 'WR C fb', 'TE R inline', 'WR R wide', 'WR L wide']);
    const twelve = fallbackTemplate({ personnel: '12', formFamily: "2x2 'D'", backfield: 'Pistol', strength: 'Rt' });
    expect(twelve.players.filter((p) => p.pos === 'TE').map((p) => `${p.side} ${p.align}`)).toEqual(['R inline', 'L inline']);
    expect(twelve.players.find((p) => p.pos === 'RB')?.align).toBe('pistol_back');
    expect(fallbackTemplate({ personnel: 'Jumbo', formFamily: 'Big', backfield: 'Gun' }).note).toMatch(/not understood/);
  });
});

describe('the whole plan on the real files', () => {
  const plan = buildImportPlan({ chart: parseChartXlsx(xlsx()), json: parseFormationsJson(jsonText()) }, OPTS);

  it('links 130 snaps (54 W1 template, 76 W2 exact) to formations that exist in the plan', () => {
    expect(plan.summary).toMatchObject({ snaps: 130, exact: 76, template: 54, weeks: { W1: 54, W2: 76 } });
    expect(plan.skipped).toEqual([]);
    const ids = new Set(plan.formations.map((p) => p.formation.id));
    for (const s of plan.snaps) {
      expect(ids.has(s.formationId), s.playId).toBe(true);
      expect(s.source).toBe(s.week === 2 ? 'exact' : 'template');
      expect(snapSchema.safeParse(s).success, s.playId).toBe(true);
    }
    expect(plan.snaps.find((s) => s.playId === 'W1-001')).toMatchObject({ id: 'PHI-2026-W1-001', down: 1, distance: 10, hash: 'Left', callType: 'pass', result: 'Incomplete', set: 'Wicks wide R, Smith slot R, Goedert inline R, Mundt inline L.' });
    expect(plan.snaps.find((s) => s.playId === 'W2-006')?.motion).toBe('M.Lemon / detached L / across backfield toward R / at snap');
  });

  it('every formation passes the schema, has a 5-man line and 11 players, and usage adds up to 130', () => {
    let total = 0;
    for (const p of plan.formations) {
      const f = p.formation;
      const r = formationSchema.safeParse(f);
      expect(r.success, `${f.name} ${r.success ? '' : JSON.stringify(r.error.issues[0])}`).toBe(true);
      if (r.success) expect(r.data).toEqual(f);
      const players = Object.values(f.players);
      expect(players.length, f.name).toBe(11);
      expect(players.filter((q) => q.role === 'OL' || q.role === 'C').map((q) => q.x).sort((a, b) => a - b)).toEqual([-2, -1, 0, 1, 2]);
      expect(players.filter((q) => q.role === 'QB').length).toBe(1);
      for (const q of players) expect(q.y, `${f.name} ${q.label}`).toBeLessThanOrEqual(0);
      // nobody drawn on top of anybody
      for (let i = 0; i < players.length; i++) for (let j = i + 1; j < players.length; j++) expect(Math.hypot(players[i].x - players[j].x, players[i].y - players[j].y), `${f.name}: ${players[i].label}/${players[j].label}`).toBeGreaterThan(0.84);
      expect(f.usage?.count).toBe(p.count);
      expect(f.usage?.snapIds).toEqual(p.snapIds);
      expect(f.tags).toContain(TAGS.pack);
      expect(f.tags).toContain(f.personnel);
      expect(f.tags).toContain(f.family);
      for (const w of p.weeks) expect(f.tags).toContain(`W${w}`);
      expect(f.tags.includes(TAGS.templateVerify)).toBe(p.exact === 0);
      expect(f.confidence).toBe(p.exact === 0 ? 'needs-review' : 'derived');
      total += p.count;
    }
    expect(total).toBe(130);
    const names = plan.formations.map((p) => p.formation.name);
    expect(new Set(names).size).toBe(names.length);
    expect(plan.formations[0].formation.name).toBe('11 Gun 2x2 Rt');
    expect(plan.formations[0].count).toBeGreaterThanOrEqual(plan.formations[1].count);
  });

  it('W2 formations draw from the exact alignment: W2-001 is an I with both TEs inline and reduced splits', () => {
    const snap = plan.snaps.find((s) => s.playId === 'W2-001')!;
    const f = plan.formations.find((p) => p.formation.id === snap.formationId)!.formation;
    const by = (label: string) => Object.values(f.players).find((q) => q.label === label)!;
    expect(f.name).toBe('12 UC 2x2 Rt');
    expect(by('Y')).toMatchObject({ x: 3, y: 0, role: 'TE' });
    expect(by('U')).toMatchObject({ x: -3, y: 0, role: 'TE' });
    expect(by('H')).toMatchObject({ x: 0, y: -7 });
    expect(by('Q')).toMatchObject({ x: 0, y: -1 });
    // right hash: near (right) numbers 11.6 -> slot 6.8; far (left) numbers 17.73 -> slot 9.87
    expect(by('Z')).toMatchObject({ x: 6.8, y: 0 });
    expect(by('X').y).toBe(0);
    expect(by('X').x).toBeCloseTo(-(2 + 17.73) / 2, 1);
    expect(f.note).toMatch(/^W2-001: I-formation/);
  });

  it('W1 snaps use the most common W2 alignment for their key, else a default shape, and the Set text lands in the note', () => {
    const w1 = plan.snaps.find((s) => s.playId === 'W1-001')!; // 12 3x1 UC Rt: seen in W2
    const f1 = plan.formations.find((p) => p.formation.id === w1.formationId)!;
    expect(f1.source).toBe('mixed');
    expect(f1.formation.note).toMatch(/W1-001 Set: Wicks wide R/);
    const w17 = plan.snaps.find((s) => s.playId === 'W1-017')!; // 11 2 Back UC: no W2 match
    const f17 = plan.formations.find((p) => p.formation.id === w17.formationId)!;
    expect(f17.source).toBe('template');
    expect(f17.formation.tags).toContain(TAGS.templateVerify);
    expect(f17.formation.note).toMatch(/^Template: default shape for 11 2 Back/);
    expect(plan.warnings.some((w) => w.startsWith('No film template: default shape for 11 2 Back'))).toBe(true);
  });

  it('is deterministic, and the mirror toggle merges Rt/Lt pairs without losing a snap', () => {
    const again = buildImportPlan({ chart: parseChartXlsx(xlsx()), json: parseFormationsJson(jsonText()) }, OPTS);
    expect(again.formations.map((p) => [p.formation.id, p.formation.name, p.count])).toEqual(plan.formations.map((p) => [p.formation.id, p.formation.name, p.count]));
    const mirrored = buildImportPlan({ chart: parseChartXlsx(xlsx()), json: parseFormationsJson(jsonText()) }, { ...OPTS, mirror: true });
    expect(mirrored.snaps.length).toBe(130);
    expect(mirrored.formations.length).toBeLessThan(plan.formations.length); // the data holds one exact Rt/Lt mirror pair
    // a blank-strength snap stays with the formation its charted orientation matches
    const w1008 = mirrored.snaps.find((s) => s.playId === 'W1-008')!;
    expect(w1008.formationId).toBe(plan.snaps.find((s) => s.playId === 'W1-008')!.formationId);
    expect(mirrored.formations.reduce((n, p) => n + p.count, 0)).toBe(130);
    expect(mirrored.snaps.some((s) => s.mirrored)).toBe(true);
    expect(mirrored.formations.every((p) => p.formation.strength !== 'left')).toBe(true);
    const top = mirrored.formations[0];
    expect(top.formation.name).toBe('11 Gun 2x2 Rt');
    expect(top.count).toBeGreaterThanOrEqual(plan.formations[0].count);
  });

  it('a JSON-only import still files every snap under its week', () => {
    const only = buildImportPlan({ json: parseFormationsJson(jsonText()) }, OPTS);
    expect(only.summary).toMatchObject({ snaps: 76, exact: 76, template: 0, weeks: { W2: 76 } });
    expect(only.snaps.every((s) => s.week === 2 && s.callType === 'other')).toBe(true);
  });

  it('matches the checked-in seed data (run `npm run import:snaps` after changing the inputs or the engine)', () => {
    const seed = JSON.parse(readFileSync(path.resolve(__dirname, '../../seeds/data/eagles2026.json'), 'utf8')) as { formations: Formation[]; snaps: { id: string; formationId: string }[] };
    expect(seed.formations.map((f) => [f.id, f.name, f.usage?.count])).toEqual(plan.formations.map((p) => [p.formation.id, p.formation.name, p.count]));
    expect(seed.snaps.map((s) => [s.id, s.formationId])).toEqual(plan.snaps.map((s) => [s.id, s.formationId]));
  });
});
