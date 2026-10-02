import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseBackup } from '@/io/backup';
import { annotationSchema, pathSchema, playSchema } from '@/model/schema';

describe('model additions for rebuilt diagrams', () => {
  it('accepts coloured, sized text and brown lines, and stays backward compatible', () => {
    expect(annotationSchema.parse({ id: 't1', kind: 'text', x: 0, y: 0, text: 'BLOCK CORNER', style: 'bold', color: 'red', fontSize: 0.4 })).toMatchObject({ color: 'red', fontSize: 0.4 });
    expect(annotationSchema.parse({ id: 't1', kind: 'text', x: 0, y: 0, text: 'old', style: 'plain' })).not.toHaveProperty('color');
    expect(pathSchema.parse({ id: 'l1', anchor: { kind: 'free' }, points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], end: 'dot', line: 'dotted', role: 'zone', color: 'brown' }).color).toBe('brown');
  });

  it('carries the rebuild score on a play', () => {
    const play = {
      id: 'p', name: 'n', category: 'Run', tags: [], positionNotes: {}, diagram: { players: {}, paths: {}, annotations: {} },
      sourcePage: 108, sourceCell: 'c4', rebuild: { confidence: 'medium', recall: 0.94, precision: 0.97, issues: ['x'], method: 'traced' },
      createdAt: 'a', updatedAt: 'b',
    };
    expect(playSchema.parse(play).rebuild?.confidence).toBe('medium');
  });
});

// The Green Bay 2019 library is built locally from a copyrighted scan and never committed: check it when it is here.
const LIB = path.join(process.cwd(), 'public', 'book', 'gb-2019', 'library.json');
describe.skipIf(!existsSync(LIB))('Green Bay 2019 library (local build)', () => {
  it('parses as a PlayForge backup and the playbook points only at real plays, in page order', () => {
    const parsed = parseBackup(readFileSync(LIB, 'utf8'));
    const { plays, formations, playbooks } = parsed.data;
    const ids = new Set(plays.map((p) => p.id));
    expect(ids.size).toBe(plays.length);
    expect(new Set(formations.map((f) => f.id)).size).toBe(formations.length);
    const pb = playbooks.find((p) => p.id === 'gb-2019');
    expect(pb?.name).toBe('Green Bay 2019');
    const order = pb!.sections.flatMap((s) => s.itemIds);
    expect(order.every((id) => ids.has(id))).toBe(true);
    expect(order.length).toBe(plays.length);
    const pages = order.map((id) => plays.find((p) => p.id === id)!.sourcePage!);
    expect(pages).toEqual([...pages].sort((a, b) => a - b));
    for (const p of plays) if (p.formationId) expect(formations.some((f) => f.id === p.formationId)).toBe(true);
  });
});
