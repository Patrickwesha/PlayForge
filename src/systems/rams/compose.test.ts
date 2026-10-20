import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { playSchema } from '@/model/schema';
import { menOnLine } from '@/geometry/formationTags';
import { composeRamsPlay, playSearchText } from './compose';
import type { RamsPlayPack } from './types';

const pack = JSON.parse(readFileSync(new URL('../../../public/rams-2022/plays.json', import.meta.url), 'utf8')) as RamsPlayPack;

describe('Rams 2022 remake', () => {
  const plays = pack.plays.map(composeRamsPlay);

  it('composes every cell into a valid play', () => {
    expect(plays.length).toBe(pack.plays.length);
    for (const p of plays) {
      const r = playSchema.safeParse(p);
      if (!r.success) throw new Error(`${p.id}: ${r.error.issues[0]?.path.join('.')} ${r.error.issues[0]?.message}`);
    }
  });

  it('keeps seven on the line wherever the offense comes from the pack or the tag engine', () => {
    const bad: string[] = [];
    for (const p of plays) {
      if (p.tags.includes('alignment-check')) continue;
      const off = Object.values(p.diagram.players).filter((q) => q.side === 'offense');
      if (off.length !== 11 || menOnLine(off).length !== 7) bad.push(`${p.id} (${off.length} men, ${menOnLine(off).length} on the line)`);
    }
    expect(bad).toEqual([]);
  });

  it('names plays in the system and keeps the Rams call as a search alias', () => {
    const quatro = plays.find((p) => p.alias?.includes('ZAP FUP'));
    expect(quatro?.name).toMatch(/QUATRO/);
    const sticky = plays.find((p) => p.id.startsWith('rams22-3-step-p5'));
    expect(sticky?.name).toMatch(/300 JET STICKY|200 JET STICKY/);
    expect(playSearchText(sticky!)).toContain('stick');
  });

  it('puts every play in an install and the situations where the book has them', () => {
    const noInstall = plays.filter((p) => !p.install);
    expect(noInstall.map((p) => p.id)).toEqual([]);
    expect(plays.filter((p) => p.tags.includes('red-zone')).length).toBeGreaterThan(20);
    expect(plays.filter((p) => p.tags.includes('two-minute')).length).toBeGreaterThan(10);
  });

  it('carries the drawing: routes or blocks, labels, and the front with its defenders', () => {
    const withPaths = plays.filter((p) => Object.keys(p.diagram.paths).length > 0).length;
    expect(withPaths / plays.length).toBeGreaterThan(0.95);
    const withDefense = plays.filter((p) => Object.values(p.diagram.players).some((q) => q.side === 'defense')).length;
    expect(withDefense / plays.length).toBeGreaterThan(0.5);
    const zap = plays.find((p) => p.id === 'rams22-wide-zone-p5-c1')!;
    expect(zap.defense?.front).toBe('34 SUP');
    expect(Object.values(zap.diagram.annotations).map((a) => (a.kind === 'text' ? a.text : ''))).toContain('ZAP');
    expect(Object.values(zap.positionNotes).join(' ')).toMatch(/ZAP/);
  });
});
