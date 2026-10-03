/**
 * Formations for snaps charted without per-player alignment (W1): a template keyed on
 * personnel + form family + backfield + strength. First choice is the most common alignment seen
 * on film for that key; otherwise a default shape for the family.
 */
import type { SnapBackfield, SnapStrength } from '@/model/types';
import type { AlignedPlayer, AlignedSide } from './alignment';
import { signatureOf } from './signature';

export type TemplateKeyParts = { personnel: string; formFamily: string; backfield: SnapBackfield; strength?: SnapStrength };

/** Str blank counts as Rt. */
export const templateKey = (k: TemplateKeyParts) => `${k.personnel}|${k.formFamily}|${k.backfield}|${k.strength ?? 'Rt'}`;

export type TemplateSource = { key: string; playId: string; players: AlignedPlayer[]; personnel: string; formFamily: string; backfield: SnapBackfield };

export type Template = { players: AlignedPlayer[]; from: 'film' | 'default'; /** Snap ids that share the chosen alignment (film templates). */ playIds: string[]; note: string };

/** For every key seen on film: the alignment used most often (ties: the first charted). */
export function templatesFromExact(sources: TemplateSource[]): Map<string, Template> {
  const byKey = new Map<string, Map<string, { players: AlignedPlayer[]; playIds: string[] }>>();
  for (const s of sources) {
    const sig = signatureOf(s);
    let m = byKey.get(s.key);
    if (!m) byKey.set(s.key, (m = new Map()));
    const hit = m.get(sig);
    if (hit) hit.playIds.push(s.playId);
    else m.set(sig, { players: s.players, playIds: [s.playId] });
  }
  const out = new Map<string, Template>();
  for (const [key, m] of byKey) {
    let best: { players: AlignedPlayer[]; playIds: string[] } | undefined;
    for (const v of m.values()) if (!best || v.playIds.length > best.playIds.length) best = v;
    if (best) out.set(key, { players: best.players, from: 'film', playIds: best.playIds, note: `Template: the alignment charted on ${best.playIds.join(', ')}` });
  }
  return out;
}

/** "11" -> 1 RB, 1 TE, 3 WR. Anything else is read as 11 personnel. */
export function personnelCounts(personnel: string): { rb: number; te: number; wr: number; known: boolean } {
  const m = personnel.trim().match(/^(\d)(\d)$/);
  if (!m) return { rb: 1, te: 1, wr: 3, known: false };
  const rb = Number(m[1]);
  const te = Number(m[2]);
  return { rb, te, wr: Math.max(0, 5 - rb - te), known: true };
}

type Pool = { te: number; wr: number; rb: number };
type Rcv = (pos: 'TE' | 'WR' | 'RB', side: AlignedSide, align: string, onLine: boolean, order: number, stackBehind?: number) => AlignedPlayer;

/** Default shapes per family. Strong side = Str (Rt when blank). */
export function fallbackTemplate(k: TemplateKeyParts): Template {
  const counts = personnelCounts(k.personnel);
  const pool: Pool = { te: counts.te, wr: counts.wr, rb: counts.rb };
  const strong: AlignedSide = k.strength === 'Lt' ? 'L' : 'R';
  const weak: AlignedSide = strong === 'R' ? 'L' : 'R';
  const players: AlignedPlayer[] = [];
  const rcv: Rcv = (pos, side, align, onLine, order, stackBehind) => ({ pos, side, align, on_line: onLine, order, ...(stackBehind ? { stack_behind: stackBehind } : {}) });
  /** Take a body from the pool: the preferred position if one is left, else the next kind that is. */
  const take = (...prefs: ('TE' | 'WR' | 'RB')[]): 'TE' | 'WR' | 'RB' | null => {
    for (const p of prefs) {
      const key = p.toLowerCase() as keyof Pool;
      if (pool[key] > 0) {
        pool[key]--;
        return p;
      }
    }
    return null;
  };
  const order = { L: 0, R: 0, C: 0 };
  const put = (side: AlignedSide, align: string, onLine: boolean, ...prefs: ('TE' | 'WR' | 'RB')[]) => {
    const pos = take(...prefs);
    if (!pos) return false;
    order[side] += 1;
    players.push(rcv(pos, side, align, onLine, order[side]));
    return true;
  };

  const fam = k.formFamily;
  const twoBack = fam === '2 Back' || (pool.rb >= 2 && fam !== 'Empty');
  // backs first (receivers get what is left)
  players.push({ pos: 'QB', side: 'C', align: k.backfield === 'Under Center' ? 'under_center' : k.backfield === 'Gun' ? 'gun' : 'pistol' });
  if (fam !== 'Empty') {
    const backPos = take('RB', 'TE', 'WR');
    if (backPos) {
      if (k.backfield === 'Under Center') players.push({ pos: backPos, side: 'C', align: 'deep' });
      else if (k.backfield === 'Gun') players.push({ pos: backPos, side: weak, align: 'gun_offset' });
      else players.push({ pos: backPos, side: 'C', align: 'pistol_back' });
    }
    if (twoBack) {
      // the second back: another RB, else a TE when two are in the game (12 "2 Back"), else a WR (the lone TE stays inline)
      const second = pool.rb > 0 ? take('RB') : pool.te >= 2 ? take('TE') : take('WR', 'TE');
      if (second) {
        if (k.backfield === 'Gun') players.push({ pos: second, side: strong, align: 'gun_offset' });
        else players.push({ pos: second, side: 'C', align: 'fb' });
      }
    }
  }

  switch (fam) {
    case "3x1 'T'":
      put(strong, 'inline', true, 'TE', 'WR');
      put(strong, 'slot', false, 'WR', 'TE', 'RB');
      put(strong, 'wide', true, 'WR', 'TE', 'RB');
      if (pool.te > 0) put(weak, 'inline', true, 'TE');
      else put(weak, 'wide', true, 'WR', 'RB');
      break;
    case "Bunch 'B'":
      if (pool.te > 0 && pool.te + pool.wr >= 4) put(weak, 'inline', true, 'TE');
      else put(weak, 'wide', true, 'WR', 'TE', 'RB');
      put(strong, 'slot', false, 'WR', 'TE', 'RB');
      put(strong, 'slot', true, 'TE', 'WR', 'RB');
      put(strong, 'slot', false, 'WR', 'TE', 'RB');
      break;
    case 'Big':
      put(strong, 'inline', true, 'TE', 'WR');
      put(weak, 'inline', true, 'TE', 'WR');
      if (pool.te > 0) put(strong, 'wing', false, 'TE');
      else put(strong, 'tight', true, 'WR', 'RB');
      put(weak, 'wide', true, 'WR', 'TE', 'RB');
      break;
    case 'Empty':
      put(strong, 'inline', true, 'TE', 'WR', 'RB');
      put(strong, 'slot', false, 'WR', 'TE', 'RB');
      put(strong, 'wide', true, 'WR', 'TE', 'RB');
      put(weak, 'slot', false, 'RB', 'WR', 'TE');
      put(weak, 'wide', true, 'WR', 'TE', 'RB');
      break;
    case '2 Back':
      put(strong, 'inline', true, 'TE', 'WR');
      put(strong, 'wide', true, 'WR', 'TE', 'RB');
      put(weak, 'wide', true, 'WR', 'TE', 'RB');
      break;
    case "2x2 Stack 'S'":
      put(strong, 'inline', true, 'TE', 'WR');
      put(strong, 'wide', true, 'WR', 'TE', 'RB');
      put(weak, 'wide', true, 'WR', 'TE', 'RB');
      {
        const pos = take('WR', 'TE', 'RB');
        if (pos) players.push(rcv(pos, weak, 'wide', false, ++order[weak], order[weak] - 1));
      }
      break;
    default: // 2x2 'D' and anything unknown
      put(strong, 'inline', true, 'TE', 'WR');
      put(strong, 'wide', true, 'WR', 'TE', 'RB');
      if (pool.te > 0) put(weak, 'inline', true, 'TE');
      else put(weak, 'slot', false, 'WR', 'RB');
      put(weak, 'wide', true, 'WR', 'TE', 'RB');
  }
  // anyone left over lines up in the slot, strong side first
  let side: AlignedSide = strong;
  while (pool.te + pool.wr + pool.rb > 0) {
    put(side, 'slot', false, 'WR', 'TE', 'RB');
    side = side === strong ? weak : strong;
  }
  const label = `${k.personnel} ${fam} ${k.backfield} ${k.strength ?? 'Rt'}`;
  return { players, from: 'default', playIds: [], note: counts.known ? `Template: default shape for ${label} (no W2 snap with this personnel, family, backfield and strength)` : `Template: default shape for ${label}; personnel "${k.personnel}" not understood, drawn as 11` };
}
