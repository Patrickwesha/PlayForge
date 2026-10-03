/**
 * Eagles 2026 system: a charted motion note ("who / from / path / timing") to a motion word.
 * Words are Green Bay 2019 pp. 31-36 (Rt/Lt, Righty/Lefty, Short, Fly, Behind, Hay/Hax, Lab/Rat); the
 * Rams 2022 names for the same motions (Zac, Fax, Yuck, Sock, Bolt, Ty/Tex) are aliases in the system file.
 * The job letter is only known for tight ends (Y) and backs (H); a receiver whose job cannot be read
 * from film is written "WR".
 */
import type { SnapBackfield } from '@/model/types';
import { ROSTER } from './roster';

export type SystemMotionName = { call: string; word: string; mover: 'Y' | 'H' | 'WR'; kind: 'motion' | 'shift'; note?: string };

const has = (s: string, re: RegExp) => re.test(s);

function moverOf(who: string): 'Y' | 'H' | 'WR' {
  const w = who.toLowerCase();
  if (ROSTER.tightEnds.some((n) => w.includes(n)) || /\bte\b/.test(w)) return 'Y';
  if (ROSTER.backs.some((n) => w.includes(n)) || /\b(rb|hb|back)\b/.test(w)) return 'H';
  return 'WR';
}

/** "to L", "toward R", "to slot L", "to tight L": the side the motion ends on or heads to. */
function direction(path: string): 'Lt' | 'Rt' | undefined {
  const m = path.match(/\b(?:to|toward|towards)\b[^/]*?\b(L|R|left|right)\b/i);
  if (!m) return undefined;
  return m[1].toLowerCase().startsWith('l') ? 'Lt' : 'Rt';
}

export function nameMotion(text: string | undefined, backfield: SnapBackfield): SystemMotionName | undefined {
  if (!text) return undefined;
  const parts = text.split('/').map((s) => s.trim());
  // some notes skip the "who" part: "R slot / in toward box / at snap"
  const hasWho = parts.length >= 4 || !/\b(slot|wide|wing|tight|inline|outside|detached|off the ball)\b/i.test(parts[0]);
  const who = hasWho ? parts[0] : '';
  const from = (hasWho ? parts[1] : parts[0]) ?? '';
  const path = (hasWho ? parts.slice(2) : parts.slice(1)).join(' / ');
  const mover = moverOf(who);
  const dir = direction(path);
  const inGun = backfield !== 'Under Center';
  const done = (word: string, kind: 'motion' | 'shift' = 'motion', note?: string): SystemMotionName => ({ call: `${mover} ${word}`, word, mover, kind, note });

  if (mover === 'H' && has(path, /into the backfield|back to the backfield/i)) return done(has(from, /\bL\b|left/i) ? 'Lab' : 'Rat', 'shift', 'Back starts as the widest receiver and comes back in.');
  if (mover === 'H' && has(path, /\bout\b/i)) return done('Hay / Hax', 'motion', 'Hay = out to the Y side, Hax = out to the X side.');
  if (has(path, /\b(jet|fly)\b/i)) return done('Fly', 'motion', 'Fly goes toward the play, Flow (Rams word) goes away from it.');
  if (has(path, /short move|in toward|in tight|toward (the )?(box|ball|formation|core)/i) && !has(path, /across/i)) return done('Short');
  if (has(path, /across|behind (the )?(los|line)/i)) {
    if (has(path, /backfield|behind (the )?(qb|quarterback)/i) && inGun) return done('Behind', 'motion', dir ? `Heads ${dir}.` : undefined);
    const outside = has(path, /\b(slot|wide|outside|numbers)\b/i);
    if (dir) return done(outside ? (dir === 'Lt' ? 'Lefty' : 'Righty') : dir);
    return done('Rt / Lt', 'motion', 'Direction not on the chart.');
  }
  if (has(path, /behind (the )?(qb|quarterback)/i)) return done('Behind');
  if (dir) return done(dir);
  return done('motion', 'motion', 'Not matched to a system word: read the note.');
}
