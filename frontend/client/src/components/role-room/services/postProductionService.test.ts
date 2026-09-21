import { afterEach, describe, expect, it, vi } from 'vitest';

import { PostProductionConflictError, postProductionService } from './postProductionService';

describe('postProductionService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads a project post-production ledger', async () => {
    const postProduction = { projectId: 'troll project', operations: { turnovers: [] }, version: 0 };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ postProduction }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(postProductionService.get('troll project')).resolves.toEqual(postProduction);
    expect(fetchMock).toHaveBeenCalledWith('/api/role-room/projects/troll%20project/post-production', expect.any(Object));
  });

  it('sends commands with the current optimistic version', async () => {
    const postProduction = { projectId: 'troll', operations: { turnovers: [] }, version: 1 };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ postProduction }) });
    vi.stubGlobal('fetch', fetchMock);

    await postProductionService.command('troll', 0, {
      type: 'create_turnover',
      label: 'Dag 1',
      productionDayId: 'day-1',
      mediaIds: ['media-1'],
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual(expect.objectContaining({
      expectedVersion: 0,
      command: expect.objectContaining({ type: 'create_turnover', productionDayId: 'day-1' }),
    }));
  });

  it('keeps the latest server state on a version conflict', async () => {
    const latest = { projectId: 'troll', operations: { turnovers: [] }, version: 3 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ error: 'version_conflict', message: 'Ny versjon finnes.', postProduction: latest }),
    }));

    const error = await postProductionService.command('troll', 2, {
      type: 'refresh_turnover', turnoverId: 'turnover-1',
    }).catch((caught) => caught);
    expect(error).toBeInstanceOf(PostProductionConflictError);
    expect(error.postProduction).toEqual(latest);
  });
});
