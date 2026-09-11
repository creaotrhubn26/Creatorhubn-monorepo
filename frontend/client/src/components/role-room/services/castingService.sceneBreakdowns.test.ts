// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CastingProject } from '../models/casting';
import { castingService } from './castingService';

const projectShell = {
  id: 'project-1', name: 'Troll', roles: [], candidates: [], crew: [], schedules: [], locations: [], props: [],
} as CastingProject;

describe('castingService.getSceneBreakdowns', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('loads canonical manuscript scenes when the project shell does not embed them', async () => {
    vi.spyOn(castingService, 'getProject').mockResolvedValue(projectShell);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'manuscript-1' }] })
      .mockResolvedValueOnce({ ok: true, json: async () => [{ id: 'scene-1', characters: ['role-nora'] }] });
    vi.stubGlobal('fetch', fetchMock);

    const scenes = await castingService.getSceneBreakdowns(projectShell.id);

    expect(scenes).toEqual([{ id: 'scene-1', characters: ['role-nora'] }]);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/casting/manuscripts?projectId=project-1',
      '/api/casting/manuscripts/manuscript-1/scenes',
    ]);
  });

  it('uses embedded scenes without making an additional manuscript request', async () => {
    vi.spyOn(castingService, 'getProject').mockResolvedValue({
      ...projectShell,
      sceneBreakdowns: [{ id: 'embedded-scene', characters: ['NORA'] }],
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(castingService.getSceneBreakdowns(projectShell.id))
      .resolves.toEqual([{ id: 'embedded-scene', characters: ['NORA'] }]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
