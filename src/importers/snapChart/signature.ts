/**
 * Formation identity: a signature of personnel + family + backfield + every skill player's
 * side / align / on_line / order (labels, never coordinates, so the hash the ball sat on does not split
 * a formation). Mirroring swaps L and R so a Lt and an Rt version can share one formation.
 */
import type { SnapBackfield, SnapStrength } from '@/model/types';
import { BACKFIELD_SHORT, FAMILY_SHORT, FORMATION_ID_PREFIX } from './config';
import { isBackfieldPlayer, isOnLine, type AlignedPlayer, type AlignedSide } from './alignment';

export type SignatureInput = { personnel: string; formFamily: string; backfield: SnapBackfield; players: AlignedPlayer[] };

const MIRROR: Record<AlignedSide, AlignedSide> = { L: 'R', R: 'L', C: 'C' };

export function mirrorPlayers(players: AlignedPlayer[]): AlignedPlayer[] {
  return players.map((p) => ({ ...p, side: MIRROR[p.side], ...(p.at ? { at: { x: -p.at.x + 0, y: p.at.y } } : {}) }));
}

export function signatureOf(s: SignatureInput): string {
  const entries = s.players.map((p) => {
    if (p.pos === 'QB') return `Q:${p.align}`;
    if (isBackfieldPlayer(p)) return `B:${p.pos}:${p.side}:${p.align}`;
    const stack = p.stack_behind ? `:s${typeof p.stack_behind === 'number' ? p.stack_behind : ''}` : '';
    // a hand-drawn spot is part of the identity, so two drawings with the same labels stay two formations
    const at = p.at ? `@${p.at.x},${p.at.y}${p.label ? `=${p.label}` : ''}` : '';
    return `R:${p.side}${p.order ?? '?'}:${p.pos}:${p.align}:${isOnLine(p) ? 'on' : 'off'}${stack}${at}`;
  });
  entries.sort();
  return `${s.personnel}|${s.formFamily}|${s.backfield}|${entries.join(',')}`;
}

export type Canonical = { players: AlignedPlayer[]; signature: string; strength?: SnapStrength; mirrored: boolean };

/**
 * With `mirror` on, a Lt snap is flipped so it shares the Rt formation. A snap with no strength keeps
 * its orientation when that matches a formation already seen (`known`), is flipped when only its mirror
 * image does, and otherwise takes whichever of the two sorts first, so two unknown-strength mirror
 * images still merge.
 */
export function canonicalize(s: SignatureInput & { strength?: SnapStrength }, mirror: boolean, known?: ReadonlySet<string>): Canonical {
  const plain = signatureOf(s);
  if (!mirror) return { players: s.players, signature: plain, strength: s.strength, mirrored: false };
  const flipped = mirrorPlayers(s.players);
  const flippedSig = signatureOf({ ...s, players: flipped });
  if (s.strength === 'Lt') return { players: flipped, signature: flippedSig, strength: 'Rt', mirrored: true };
  if (s.strength === 'Rt') return { players: s.players, signature: plain, strength: 'Rt', mirrored: false };
  const asIs: Canonical = { players: s.players, signature: plain, strength: undefined, mirrored: false };
  const asMirror: Canonical = { players: flipped, signature: flippedSig, strength: undefined, mirrored: true };
  if (known?.has(plain)) return asIs;
  if (known?.has(flippedSig)) return asMirror;
  return flippedSig < plain ? asMirror : asIs;
}

/** Two FNV-1a passes -> 16 hex characters. Same in Node and the browser, no crypto needed. */
export function hashString(s: string): string {
  const fnv = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h.toString(16).padStart(8, '0');
  };
  return fnv(0x811c9dc5) + fnv(0x050c5d1f);
}

export const formationIdFor = (signature: string) => `${FORMATION_ID_PREFIX}${hashString(signature)}`;

/** "11 Gun 2x2 Rt" */
export function formationName(personnel: string, backfield: SnapBackfield, formFamily: string, strength: SnapStrength | undefined): string {
  const fam = FAMILY_SHORT[formFamily] ?? formFamily.replace(/\s*'[A-Z]'$/, '');
  return [personnel, BACKFIELD_SHORT[backfield], fam, strength].filter(Boolean).join(' ');
}
