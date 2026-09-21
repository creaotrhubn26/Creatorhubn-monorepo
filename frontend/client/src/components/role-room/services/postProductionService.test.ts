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

  it('loads only the safe picture source catalog contract', async () => {
    const pictureSources = {
      binding: { status: 'linked', workspaceProjectId: '6cae5551-4d32-4b22-8c26-79fa61f8c7b1' },
      versions: [{
        id: 'b70ea5f0-06a4-4a1b-b357-83d7872bdf9f', versionNumber: 2,
        versionLabel: 'Director cut', status: 'under_review', displayName: 'troll-v2.mp4',
        sizeBytes: 4096, createdAt: '2026-09-21T09:00:00.000Z', isLatest: true,
      }],
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ pictureSources }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(postProductionService.getPictureSources('troll project')).resolves.toEqual(pictureSources);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/role-room/projects/troll%20project/post-production/picture-sources',
      expect.any(Object),
    );
  });

  it('loads storyboard metadata and one locked preview through the post contract', async () => {
    const storyboardSources = { rounds: [{
      id: 'round-1', manuscriptId: 'manus-1', manuscriptTitle: 'Troll', version: 3,
      label: 'Regigodkjent', status: 'approved', snapshotHash: 'c'.repeat(64),
      frameCount: 1, totalDurationSeconds: 4, latestApprovedVersion: 3,
      submittedAt: '2026-09-21T08:00:00.000Z', approvedAt: '2026-09-21T09:00:00.000Z',
    }] };
    const storyboardSource = { ...storyboardSources.rounds[0], scenes: [{
      id: 'scene-1', heading: 'EXT. FJELL – NATT', frames: [{ id: 'frame-1', shotNumber: '1A' }],
    }] };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ storyboardSources }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ storyboardSource }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(postProductionService.getStoryboardSources('troll project')).resolves.toEqual(storyboardSources);
    await expect(postProductionService.getStoryboardSource('troll project', 'round/1')).resolves.toEqual(storyboardSource);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/role-room/projects/troll%20project/post-production/storyboard-sources',
      '/api/role-room/projects/troll%20project/post-production/storyboard-sources/round%2F1',
    ]);
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
