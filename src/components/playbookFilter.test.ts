import { describe, expect, it } from 'vitest';
import type { Playbook } from '@/model/types';
import { NOT_IN_PLAYBOOK, matchesPlaybook, playbookMembership } from './PlaybookFilter';

const book = (id: string, name: string, plays: string[], formations: string[]): Playbook => ({
  id,
  name,
  cover: { title: name, showCover: false },
  sections: [
    { id: `${id}-p`, title: 'Plays', kind: 'plays', itemIds: plays },
    { id: `${id}-f`, title: 'Formations', kind: 'formations', itemIds: formations },
  ],
  defaultLayout: '6up',
  paper: 'letter',
  createdAt: 't',
  updatedAt: 't',
});

describe('playbook filter', () => {
  const books = [book('a', 'BEAST', ['p1', 'p2', 'p2'], ['f1']), book('b', 'SPREAD', ['p2'], [])];

  it('maps every item to the playbooks that list it, per kind, without double counting', () => {
    const plays = playbookMembership(books, 'plays');
    expect(plays.get('p1')?.map((b) => b.id)).toEqual(['a']);
    expect(plays.get('p2')?.map((b) => b.id)).toEqual(['a', 'b']);
    expect(plays.get('f1')).toBeUndefined();
    expect(playbookMembership(books, 'formations').get('f1')?.map((b) => b.id)).toEqual(['a']);
  });

  it('matches all, not-in-a-playbook, or one playbook', () => {
    const m = playbookMembership(books, 'plays');
    expect(matchesPlaybook('', 'p9', m)).toBe(true);
    expect(matchesPlaybook(NOT_IN_PLAYBOOK, 'p9', m)).toBe(true);
    expect(matchesPlaybook(NOT_IN_PLAYBOOK, 'p1', m)).toBe(false);
    expect(matchesPlaybook('a', 'p1', m)).toBe(true);
    expect(matchesPlaybook('b', 'p1', m)).toBe(false);
    expect(matchesPlaybook('b', 'p2', m)).toBe(true);
  });
});
