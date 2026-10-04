/**
 * Merge the chart (the snap record) with the per-player JSON (exact alignment where it exists),
 * dedupe snaps into unique formations, and produce everything the import has to write. Pure: no
 * database, so the same inputs always give the same ids, names and positions.
 */
import type { Formation, FormationUsage, QbAlignment, Snap, SnapBackfield, SnapHash, SnapSource, SnapStrength } from '@/model/types';
import { placePlayers, type AlignedPlayer } from './alignment';
import type { ChartRow, ParsedChart, SkippedRow } from './chart';
import { TAGS } from './config';
import type { ParsedFormationsJson } from './formationsJson';
import { canonicalize, formationIdFor, formationName } from './signature';
import { fallbackTemplate, templateKey, templatesFromExact, type Template } from './templates';
import { nameFormation } from '@/systems/eagles/nameFormation';
import { matchFormation } from '@/systems/eagles/matchFormation';
import { nameMotion } from '@/systems/eagles/nameMotion';

export type PlanOptions = {
  team: string;
  season: number;
  /** Merge Rt and Lt versions into one formation (the Lt snaps are stored mirrored). */
  mirror: boolean;
  /** Timestamp written on every row. */
  now: string;
  /** Mark the formations as built-ins (checked-in seeds). */
  builtin?: boolean;
  /** Provenance text, e.g. "Eagles 2026 All-22 chart". */
  source?: string;
  /**
   * 'chart' (default) names formations the way the chart does: "11 Gun 2x2 Rt".
   * 'system' names them in the Eagles system (systems/eagles): "Gun Dice Rt Close", keeps the chart
   * name in `chartName`, and gives each snap's motion its system word.
   */
  naming?: 'chart' | 'system';
  /**
   * Weeks where the per-player file is the better record (charted later, frame by frame, with the set
   * taken before any motion): its family, strength and backfield replace the workbook's. Other weeks
   * keep the rule that the workbook wins.
   */
  filmWinsWeeks?: number[];
};

export type PlannedFormation = {
  formation: Formation;
  signature: string;
  snapIds: string[];
  count: number;
  exact: number;
  template: number;
  weeks: number[];
  hashes: Record<string, number>;
  /** 'exact' = every snap had film alignment; 'template' = none did; 'mixed' = both. */
  source: SnapSource | 'mixed';
};

export type ImportPlan = {
  formations: PlannedFormation[];
  snaps: Snap[];
  skipped: SkippedRow[];
  warnings: string[];
  summary: { snaps: number; exact: number; template: number; formations: number; weeks: Record<string, number> };
};

type Draft = {
  playId: string;
  week: number;
  row?: number;
  chart?: ChartRow;
  quarter?: number;
  down?: number;
  distance?: number;
  fieldZone?: string;
  hash?: SnapHash;
  personnel: string;
  formFamily: string;
  strength?: SnapStrength;
  backfield: SnapBackfield;
  backfieldDetail?: string;
  playType?: string;
  callType: Snap['callType'];
  target?: string;
  result?: string;
  yards?: number;
  motion?: string;
  set?: string;
  notes?: string;
  players: AlignedPlayer[];
  source: SnapSource;
  /** The film description (JSON `formation`) or the template note. */
  description?: string;
};

const QB_ALIGNMENT: Record<SnapBackfield, QbAlignment> = { 'Under Center': 'under', Gun: 'gun', Pistol: 'pistol' };

const countBy = <T, K extends string | number>(items: T[], key: (t: T) => K | undefined): Record<K, number> => {
  const out = {} as Record<K, number>;
  for (const it of items) {
    const k = key(it);
    if (k === undefined) continue;
    out[k] = (out[k] ?? 0) + 1;
  }
  return out;
};
const mostCommon = <K extends string>(counts: Record<K, number>, tieBreak: K[]): K | undefined => {
  let best: K | undefined;
  for (const k of Object.keys(counts) as K[]) {
    if (best === undefined || counts[k] > counts[best] || (counts[k] === counts[best] && tieBreak.indexOf(k) < tieBreak.indexOf(best))) best = k;
  }
  return best;
};

export function snapId(team: string, season: number, playId: string): string {
  return `${team}-${season}-${playId}`;
}

/** Build everything the import would write. The UI shows this as the preview; apply writes it. */
export function buildImportPlan(input: { chart?: ParsedChart; json?: ParsedFormationsJson }, opts: PlanOptions): ImportPlan {
  const warnings: string[] = [...(input.chart?.warnings ?? []), ...(input.json?.warnings ?? [])];
  const skipped: SkippedRow[] = [...(input.chart?.skipped ?? []), ...(input.json?.skipped.map((s) => ({ playId: s.playId, reason: s.reason })) ?? [])];
  const jsonById = new Map((input.json?.snaps ?? []).map((s) => [s.id, s]));
  const drafts: Draft[] = [];
  const seen = new Set<string>();

  for (const r of input.chart?.rows ?? []) {
    const j = jsonById.get(r.playId);
    seen.add(r.playId);
    const film = !!j && !!opts.filmWinsWeeks?.includes(r.week);
    if (j && film) {
      for (const [what, c, f] of [['form family', r.formFamily, j.formFamily], ['strength', r.strength, j.strength], ['backfield', r.backfield, j.backfield]] as const)
        if (c !== f && f) warnings.push(`${r.playId}: ${what} differs (chart ${c ?? 'blank'}, film ${f}); the film chart wins this week`);
    } else if (j) {
      if (j.personnel !== r.personnel) warnings.push(`${r.playId}: personnel differs (chart ${r.personnel}, JSON ${j.personnel}); the chart wins`);
      if (j.formFamily !== r.formFamily) warnings.push(`${r.playId}: form family differs (chart ${r.formFamily}, JSON ${j.formFamily}); the chart wins`);
      if (j.backfield !== r.backfield) warnings.push(`${r.playId}: backfield differs (chart ${r.backfieldDetail}, JSON ${j.backfieldDetail}); the chart wins`);
    }
    drafts.push({
      playId: r.playId,
      week: r.week,
      row: r.row,
      chart: r,
      quarter: r.quarter ?? j?.quarter,
      down: r.down ?? j?.down,
      distance: r.distance ?? j?.distance,
      fieldZone: r.fieldZone,
      hash: r.hash ?? j?.hash,
      personnel: r.personnel,
      formFamily: film ? j!.formFamily : r.formFamily,
      strength: film ? (j!.strength ?? r.strength) : (r.strength ?? j?.strength),
      backfield: film ? j!.backfield : r.backfield,
      backfieldDetail: film ? (j!.backfieldDetail ?? r.backfieldDetail) : (r.backfieldDetail ?? j?.backfieldDetail),
      playType: r.playType,
      callType: r.callType,
      target: r.target,
      result: r.result,
      yards: r.yards,
      motion: film ? (j!.motion ?? undefined) : (r.motion ?? j?.motion),
      set: r.set ?? j?.formation,
      notes: r.notes,
      players: j?.players ?? [],
      source: j ? 'exact' : 'template',
      description: j?.formation,
    });
  }
  for (const j of input.json?.snaps ?? []) {
    if (seen.has(j.id)) continue;
    if (j.week === undefined) {
      skipped.push({ playId: j.id, reason: 'In the JSON only, and no week (game.week or a W#- id) to file it under' });
      continue;
    }
    if (input.chart) warnings.push(`${j.id}: in the JSON but not in the chart; game data taken from the JSON`);
    drafts.push({
      playId: j.id,
      week: j.week,
      quarter: j.quarter,
      down: j.down,
      distance: j.distance,
      hash: j.hash,
      personnel: j.personnel,
      formFamily: j.formFamily,
      strength: j.strength,
      backfield: j.backfield,
      backfieldDetail: j.backfieldDetail,
      callType: 'other',
      motion: j.motion,
      set: j.formation,
      notes: j.notes,
      players: j.players,
      source: 'exact',
      description: j.formation,
    });
  }

  // templates for the snaps without per-player data
  const exact = drafts.filter((d) => d.source === 'exact');
  const filmTemplates = templatesFromExact(exact.map((d) => ({ key: templateKey(d), playId: d.playId, players: d.players, personnel: d.personnel, formFamily: d.formFamily, backfield: d.backfield })));
  const defaults = new Map<string, Template>();
  for (const d of drafts) {
    if (d.source === 'exact') continue;
    const key = templateKey(d);
    let t = filmTemplates.get(key);
    if (!t) {
      t = defaults.get(key);
      if (!t) {
        t = fallbackTemplate(d);
        defaults.set(key, t);
        warnings.push(`${t.note.replace(/^Template: /, 'No film template: ')}; used by ${drafts.filter((x) => x.source === 'template' && templateKey(x) === key).map((x) => x.playId).join(', ')}`);
      }
    }
    d.players = t.players;
    d.description = t.note;
  }

  // one formation per signature
  type Group = { signature: string; drafts: { d: Draft; mirrored: boolean; players: AlignedPlayer[]; strength?: SnapStrength }[] };
  const groups = new Map<string, Group>();
  const snaps: Snap[] = [];
  // snaps with a charted strength first, so a blank-strength snap can join the formation it matches
  const ordered = [...drafts.filter((d) => d.strength), ...drafts.filter((d) => !d.strength)];
  const known = new Set<string>();
  for (const d of ordered) {
    const c = canonicalize({ personnel: d.personnel, formFamily: d.formFamily, backfield: d.backfield, players: d.players, strength: d.strength }, opts.mirror, known);
    known.add(c.signature);
    const fid = formationIdFor(c.signature);
    let g = groups.get(fid);
    if (!g) groups.set(fid, (g = { signature: c.signature, drafts: [] }));
    g.drafts.push({ d, mirrored: c.mirrored, players: c.players, strength: c.strength });
    snaps.push({
      id: snapId(opts.team, opts.season, d.playId),
      playId: d.playId,
      team: opts.team,
      season: opts.season,
      week: d.week,
      quarter: d.quarter,
      down: d.down,
      distance: d.distance,
      fieldZone: d.fieldZone,
      hash: d.hash,
      personnel: d.personnel,
      formFamily: d.formFamily,
      strength: d.strength,
      backfield: d.backfield,
      backfieldDetail: d.backfieldDetail,
      playType: d.playType,
      callType: d.callType,
      target: d.target,
      result: d.result,
      yards: d.yards,
      motion: d.motion,
      ...(opts.naming === 'system' && d.motion ? { motionCall: nameMotion(d.motion, d.backfield)?.call } : {}),
      set: d.set,
      notes: d.notes,
      formationId: fid,
      mirrored: c.mirrored,
      source: d.source,
      createdAt: opts.now,
      updatedAt: opts.now,
    });
  }

  const order = new Map(drafts.map((d, i) => [d.playId, i]));
  snaps.sort((a, b) => (order.get(a.playId) ?? 0) - (order.get(b.playId) ?? 0));
  for (const g of groups.values()) g.drafts.sort((a, b) => (order.get(a.d.playId) ?? 0) - (order.get(b.d.playId) ?? 0));

  const planned: PlannedFormation[] = [];
  for (const [fid, g] of groups) {
    const first = g.drafts[0];
    const d0 = first.d;
    const hashes = countBy(g.drafts, (x) => x.d.hash);
    const drawHash = mostCommon(hashes, ['Middle', 'Left', 'Right']);
    const strengthCounts = countBy(g.drafts, (x) => x.strength);
    const strength = mostCommon(strengthCounts, ['Rt', 'Lt']);
    const exactN = g.drafts.filter((x) => x.d.source === 'exact').length;
    const templateN = g.drafts.length - exactN;
    const placed = placePlayers(first.players, { hash: drawHash, strength, backfield: d0.backfield, idPrefix: fid, label: `${d0.playId} (${formationName(d0.personnel, d0.backfield, d0.formFamily, strength)})` });
    warnings.push(...placed.warnings);
    const weeks = [...new Set(g.drafts.map((x) => x.d.week))].sort((a, b) => a - b);
    const snapIds = g.drafts.map((x) => x.d.playId).sort();
    const noteLines: string[] = [];
    if (exactN === 0) noteLines.push(d0.description ?? 'Template');
    else {
      const descs = [...new Set(g.drafts.filter((x) => x.d.source === 'exact' && x.d.description).map((x) => `${x.d.playId}: ${x.d.description}`))];
      noteLines.push(...descs.slice(0, 4));
      if (descs.length > 4) noteLines.push(`+${descs.length - 4} more film descriptions`);
    }
    const sets = g.drafts.filter((x) => x.d.source === 'template' && x.d.set).map((x) => `${x.d.playId} Set: ${x.d.set}`);
    noteLines.push(...sets.slice(0, 8));
    if (sets.length > 8) noteLines.push(`+${sets.length - 8} more charted sets`);
    const hashText = Object.entries(hashes).map(([h, n]) => `${h} ${n}`).join(', ');
    noteLines.push(`Drawn on the ${drawHash ?? 'Middle'} hash${hashText ? ` (seen: ${hashText})` : ''}.`);
    if (g.drafts.some((x) => x.mirrored)) noteLines.push(`Mirrored snaps (charted Lt): ${g.drafts.filter((x) => x.mirrored).map((x) => x.d.playId).join(', ')}`);
    const usage: FormationUsage = { count: g.drafts.length, snapIds, weeks, hashes: Object.keys(hashes).sort(), exact: exactN, template: templateN };
    const tags = [TAGS.pack, d0.personnel, d0.formFamily, ...weeks.map((w) => `W${w}`)];
    if (exactN === 0) tags.push(TAGS.templateVerify);
    const chartName = formationName(d0.personnel, d0.backfield, d0.formFamily, strength);
    // system name: the formation + tags whose picture is this picture; the rule namer when nothing in the system draws it
    const rule = opts.naming === 'system' ? nameFormation({ personnel: d0.personnel, backfield: d0.backfield, formFamily: d0.formFamily, strength, players: first.players }) : undefined;
    const built = rule ? matchFormation({ personnel: d0.personnel, backfield: d0.backfield, strength, placed: placed.placed }) : undefined;
    const sys = rule && built ? { ...rule, ...built, confidence: 'rule' as const, back: rule.back } : rule ? { ...rule, notes: [...rule.notes, 'No formation plus tags in the system draws this exact picture: named from the picture by rule.'] } : undefined;
    if (sys) {
      tags.push(sys.base, sys.family);
      const lines = [`System call: ${sys.name} [${d0.personnel}]${sys.confidence === 'closest' ? ' (closest word, check it)' : ''}. Charted as ${chartName}.`];
      if (sys.back) lines.push(`Back on the ${sys.back} side of the quarterback.`);
      if (sys.alternates.length) lines.push(`Same picture, different jobs: ${sys.alternates.join(', ')}.`);
      lines.push(...sys.notes);
      noteLines.unshift(...lines);
    }
    const formation: Formation = {
      id: fid,
      name: sys ? sys.name : chartName,
      ...(sys ? { chartName, system: { id: 'eagles-2026', base: sys.base, family: sys.family, strength: sys.strength, tags: sys.tags, back: sys.back, alternates: sys.alternates, confidence: sys.confidence } } : {}),
      side: 'offense',
      personnel: d0.personnel,
      playersPerSide: 11,
      players: placed.players,
      tags,
      family: d0.formFamily,
      strength: strength === 'Lt' ? 'left' : strength === 'Rt' ? 'right' : undefined,
      qbAlignment: QB_ALIGNMENT[d0.backfield],
      source: opts.source ?? `${opts.team} ${opts.season} All-22 chart`,
      note: noteLines.join('\n'),
      confidence: exactN > 0 ? 'derived' : 'needs-review',
      builtin: opts.builtin ?? false,
      signature: g.signature,
      usage,
      createdAt: opts.now,
      updatedAt: opts.now,
    };
    planned.push({ formation, signature: g.signature, snapIds, count: g.drafts.length, exact: exactN, template: templateN, weeks, hashes, source: exactN === 0 ? 'template' : templateN === 0 ? 'exact' : 'mixed' });
  }

  // same name, different alignment: "#2", "#3" ... by usage
  planned.sort((a, b) => b.count - a.count || a.signature.localeCompare(b.signature));
  const byName = new Map<string, PlannedFormation[]>();
  for (const p of planned) {
    const list = byName.get(p.formation.name) ?? [];
    list.push(p);
    byName.set(p.formation.name, list);
  }
  // a hand-drawn alignment keeps the plain name; the charted look-alikes take the numbers
  for (const list of byName.values()) {
    list.sort((a, b) => Number(b.signature.includes('@')) - Number(a.signature.includes('@')));
    list.forEach((p, i) => i > 0 && (p.formation.name = `${p.formation.name} #${i + 1}`));
  }

  return {
    formations: planned,
    snaps,
    skipped,
    warnings: [...new Set(warnings)],
    summary: { snaps: snaps.length, exact: snaps.filter((s) => s.source === 'exact').length, template: snaps.filter((s) => s.source === 'template').length, formations: planned.length, weeks: countBy(snaps, (s) => `W${s.week}`) },
  };
}
