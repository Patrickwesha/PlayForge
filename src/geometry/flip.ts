import type { Annotation, Diagram, Formation, Path, Player } from '@/model/types';

const SWAP: Record<string, string> = {
  LT: 'RT', RT: 'LT', LG: 'RG', RG: 'LG', LE: 'RE', RE: 'LE',
  LTE: 'RTE', RTE: 'LTE', LW: 'RW', RW: 'LW', LH: 'RH', RH: 'LH',
  LOLB: 'ROLB', ROLB: 'LOLB', LCB: 'RCB', RCB: 'LCB',
};

export type FlipOptions = { swapXZ?: boolean };

export function flipLabel(label: string, opts: FlipOptions = {}): string {
  if (SWAP[label]) return SWAP[label];
  if (opts.swapXZ) {
    if (label === 'X') return 'Z';
    if (label === 'Z') return 'X';
  }
  return label;
}

export function flipPlayer(p: Player, opts: FlipOptions = {}): Player {
  const out: Player = { ...p, x: -p.x, label: flipLabel(p.label, opts) };
  if (p.shade === 'left') out.shade = 'right';
  else if (p.shade === 'right') out.shade = 'left';
  return out;
}

export function flipPath(path: Path): Path {
  return { ...path, points: path.points.map((pt) => ({ ...pt, x: -pt.x })) };
}

export function flipAnnotation(a: Annotation): Annotation {
  if (a.kind === 'text') return { ...a, x: -a.x, rotate: a.rotate ? (-a.rotate as 90 | -90) : a.rotate };
  return { ...a, x: -a.x };
}

export function flipDiagram(d: Diagram, opts: FlipOptions = {}): Diagram {
  const players: Diagram['players'] = {};
  for (const [id, p] of Object.entries(d.players)) players[id] = flipPlayer(p, opts);
  const paths: Diagram['paths'] = {};
  for (const [id, p] of Object.entries(d.paths)) paths[id] = flipPath(p);
  const annotations: Diagram['annotations'] = {};
  for (const [id, a] of Object.entries(d.annotations)) annotations[id] = flipAnnotation(a);
  return { players, paths, annotations };
}

export function flipFormationPlayers(f: Formation, opts: FlipOptions = {}): Formation['players'] {
  const players: Formation['players'] = {};
  for (const [id, p] of Object.entries(f.players)) players[id] = flipPlayer(p, opts);
  return players;
}

/** "BEAST RIGHT" -> "BEAST LEFT", "TRIPS RT" -> "TRIPS LT", "Beast Right" -> "Beast Left"; else unchanged. */
export function flipName(name: string): string {
  const pairs: [RegExp, string][] = [
    [/\bRIGHT\b/i, 'LEFT'],
    [/\bLEFT\b/i, 'RIGHT'],
    [/\bRT\b/i, 'LT'],
    [/\bLT\b/i, 'RT'],
  ];
  for (const [re, rep] of pairs) {
    const m = name.match(re);
    if (!m) continue;
    const src = m[0];
    const cased = src === src.toUpperCase() ? rep : src === src.toLowerCase() ? rep.toLowerCase() : rep[0] + rep.slice(1).toLowerCase();
    return name.replace(re, cased);
  }
  return name;
}
