import 'fake-indexeddb/auto';
import { beforeAll, describe, expect, it } from 'vitest';
import { BEAST_PACK, BEAST_PLAYS } from '@/systems/beast/plays';
import { BEAST_PLAYBOOK_ID } from '@/systems/beast/content';
import { getDb } from './db';
import { repo } from './repo';

describe('adding the Beast pack to the library', () => {
  beforeAll(async () => {
    await getDb().open();
  });

  it('adds every row once, queues it for sync, and a second click changes nothing', async () => {
    const before = await repo.counts();
    const first = await repo.addPack(BEAST_PACK);
    expect(first).toEqual({ added: 30, kept: 0 });
    const after = await repo.counts();
    expect(after.plays - before.plays).toBe(20);
    expect(after.formations - before.formations).toBe(9);
    expect(await repo.getPlaybook(BEAST_PLAYBOOK_ID)).toBeTruthy();
    expect(await getDb().outbox.get(`play:${BEAST_PLAYS[0].id}`)).toBeTruthy();

    const second = await repo.addPack(BEAST_PACK);
    expect(second).toEqual({ added: 0, kept: 30 });
    expect(await repo.counts()).toEqual(after);
  });

  it('never overwrites a play the coach edited', async () => {
    const id = BEAST_PLAYS[0].id;
    const mine = { ...(await repo.getPlay(id))!, name: 'MY TRAIN' };
    await repo.savePlay(mine);
    await repo.addPack(BEAST_PACK);
    expect((await repo.getPlay(id))!.name).toBe('MY TRAIN');
  });

  it('brings back a play the coach deleted when he adds the pack again', async () => {
    const id = BEAST_PLAYS[1].id;
    await repo.deletePlay(id);
    expect(await repo.getPlay(id)).toBeUndefined();
    const r = await repo.addPack(BEAST_PACK);
    expect(r.added).toBe(1);
    expect(await repo.getPlay(id)).toBeTruthy();
    expect(await getDb().tombstones.get(`play:${id}`)).toBeUndefined();
  });
});
