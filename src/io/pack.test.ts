import { describe, expect, it } from 'vitest';
import { BEAST_PACK } from '@/systems/beast/plays';
import { parseBackup } from './backup';

describe('pack files', () => {
  it('a pack parses as a pack, with no settings to overwrite', () => {
    const text = JSON.stringify({ app: 'playforge', kind: 'pack', name: 'Beast', ...BEAST_PACK });
    const r = parseBackup(text);
    expect(r.source).toBe('playforge-pack');
    expect(r.data.settings).toBeUndefined();
    expect(r.data.plays).toHaveLength(BEAST_PACK.plays.length);
    expect(r.data.formations).toHaveLength(BEAST_PACK.formations.length);
  });

  it('a broken pack says what is wrong', () => {
    const text = JSON.stringify({ app: 'playforge', kind: 'pack', name: 'x', formations: [], plays: [{ id: 1 }], playbooks: [] });
    expect(() => parseBackup(text)).toThrow(/Pack failed validation/);
  });
});
