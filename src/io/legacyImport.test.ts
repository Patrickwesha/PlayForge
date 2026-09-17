import { describe, expect, it } from 'vitest';
import { importLegacy, looksLegacy } from './legacyImport';
import { playSchema } from '@/model/schema';
import type { LegacyExport } from './legacyTypes';

const fixture: LegacyExport = {
  version: '1.0',
  exportedAt: '2025-12-17T00:00:00.000Z',
  plays: [
    {
      id: 'play-1',
      name: 'Rocket 28',
      fieldConfig: { zoom: 2, losEnabled: false, losY: 768 },
      layers: {
        players: {
          'player-1': {
            id: 'player-1', x: 512, y: 768, label: 'C', shape: 'square', fill: '#FFFFFF', stroke: '#000000', strokeWidth: 2, shaded: false,
            routes: [{ id: 'r1', type: 'straight', start: { x: 0, y: 0 }, end: { x: 0, y: -40 }, endpointStyle: 'T', stroke: '#000000', strokeWidth: 3, lineStyle: 'solid' }],
          },
          'player-2': {
            id: 'player-2', x: 512 + 154, y: 768, label: 'Z', shape: 'circle',
            routes: [
              { id: 'r2', type: 'straight', start: { x: 0, y: 0 }, end: { x: 0, y: -77 }, endpointStyle: 'none', lineStyle: 'solid' },
              { id: 'r3', type: 'curve', start: { x: 0, y: -77 }, end: { x: 60, y: -120 }, cp1: { x: 0, y: -120 }, cp2: { x: 0, y: -120 }, endpointStyle: 'arrow', lineStyle: 'solid' },
              { id: 'r4', type: 'straight', start: { x: 10, y: 10 }, end: { x: 40, y: 10 }, endpointStyle: 'arrow', lineStyle: 'wavy' },
            ],
          },
          'player-3': { id: 'player-3', x: 512, y: 768 - 77, label: 'M', shape: 'E' },
        },
      },
    },
  ],
  playbooks: [{ id: 'pb-1', name: 'Rockets', playIds: ['play-1', 'missing'] }],
};

describe('legacy import', () => {
  it('detects legacy exports', () => {
    expect(looksLegacy(fixture)).toBe(true);
    expect(looksLegacy({ app: 'playforge', version: 2 })).toBe(false);
  });
  it('maps pixels to yards with the LOS at 768 and flips y', () => {
    const r = importLegacy(fixture);
    const p = r.plays[0];
    expect(playSchema.safeParse(p).success).toBe(true);
    expect(p.diagram.players['player-1']).toMatchObject({ x: 0, y: 0, symbol: 'square', side: 'offense' });
    expect(p.diagram.players['player-2']).toMatchObject({ x: 10, y: 0 });
    expect(p.diagram.players['player-3']).toMatchObject({ x: 0, y: 5, symbol: 'letter', side: 'defense', label: 'M' });
  });
  it('chains segments into paths and keeps unchained ones separate', () => {
    const r = importLegacy(fixture);
    const paths = Object.values(r.plays[0].diagram.paths).filter((p) => p.anchor.kind === 'player' && p.anchor.playerId === 'player-2');
    expect(paths.length).toBe(2);
    const chained = paths[0];
    expect(chained.points.length).toBe(3);
    expect(chained.points[2].bend).toBeDefined();
    expect(chained.end).toBe('arrow');
    expect(chained.points[1]).toEqual({ x: 0, y: 5 });
    expect(paths[1].line).toBe('squiggle');
    expect(paths[1].role).toBe('motion');
  });
  it('maps T ends to blocks and categorizes the play as a run', () => {
    const r = importLegacy(fixture);
    const block = Object.values(r.plays[0].diagram.paths).find((p) => p.anchor.kind === 'player' && p.anchor.playerId === 'player-1')!;
    expect(block.end).toBe('tbar');
    expect(block.role).toBe('block');
    expect(r.plays[0].category).toBe('Run');
  });
  it('keeps playbook references and warns about missing ones', () => {
    const r = importLegacy(fixture);
    expect(r.playbooks[0].sections[0].itemIds).toEqual(['play-1']);
    expect(r.warnings.some((w) => w.includes('missing'))).toBe(true);
  });
  it('honors a scale override', () => {
    const r = importLegacy(fixture, { pxPerYard: 13.82 });
    expect(r.plays[0].diagram.players['player-2'].x).toBeCloseTo(11.25, 2);
  });
});
