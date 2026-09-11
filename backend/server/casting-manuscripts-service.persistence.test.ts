import { describe, expect, it, vi } from 'vitest';

import { createCastingManuscriptsService } from './casting-manuscripts-service.js';

const createHarness = () => {
  const strictWrite = vi.fn(async () => {
    throw new Error('database unavailable');
  });
  const service = createCastingManuscriptsService({
    compatStoreGet: vi.fn(async () => null),
    compatStoreSet: vi.fn(async () => undefined),
    compatStoreSetStrict: strictWrite,
    compatStoreDelete: vi.fn(async () => undefined),
    compatStoreListByPrefix: vi.fn(async () => []),
  });
  return { service, strictWrite };
};

describe('casting manuscript durable persistence', () => {
  it('does not acknowledge or cache a manuscript when the durable write fails', async () => {
    const { service } = createHarness();

    await expect(service.replaceManuscript('manuscript-1', {
      id: 'manuscript-1',
      projectId: 'project-1',
      content: 'Tekst som må beholdes lokalt',
    })).rejects.toThrow('database unavailable');

    await expect(service.getManuscript('manuscript-1')).resolves.toBeNull();
  });

  it('does not expose an in-memory revision when its durable write fails', async () => {
    const { service } = createHarness();

    await expect(service.replaceRevisions('manuscript-1', [{
      id: 'revision-1',
      content: 'Snapshot',
    }], { bumpManuscriptVersion: false })).rejects.toThrow('database unavailable');

    await expect(service.getRevisions('manuscript-1')).resolves.toEqual([]);
  });
});
