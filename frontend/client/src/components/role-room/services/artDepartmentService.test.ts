// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { ArtDepartmentConflictError, artDepartmentService } from './artDepartmentService';

vi.mock('./roleRoomAgentService', () => ({
  roleRoomAgentDefaultHeaders: () => ({ Authorization: 'Bearer test-session' }),
}));

const operations = {
  phase: 'concept' as const,
  palette: [],
  scenePlans: [],
  decisions: [],
  handoffs: [],
};

describe('artDepartmentService', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('loads through the project-scoped authenticated endpoint', async () => {
    const artDepartment = { projectId: 'troll project', operations, version: 0 };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ artDepartment }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(artDepartmentService.get('troll project')).resolves.toEqual(artDepartment);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/role-room/projects/troll%20project/art-department',
      { credentials: 'include', headers: { Authorization: 'Bearer test-session' } },
    );
  });

  it('sends the expected version and never silently accepts a conflict', async () => {
    const latest = { projectId: 'troll', operations: { ...operations, phase: 'design' }, version: 4 };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false, status: 409,
      json: async () => ({ error: 'version_conflict', message: 'Ny versjon finnes.', artDepartment: latest }),
    }));

    const conflict = await artDepartmentService.save('troll', 3, operations).catch((error) => error);
    expect(conflict).toBeInstanceOf(ArtDepartmentConflictError);
    expect(conflict.artDepartment).toEqual(latest);
  });

  it('posts a JSON write with the authenticated session', async () => {
    const saved = { projectId: 'troll', operations, version: 1 };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ artDepartment: saved }) });
    vi.stubGlobal('fetch', fetchMock);

    await expect(artDepartmentService.save('troll', 0, operations)).resolves.toEqual(saved);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/role-room/projects/troll/art-department',
      expect.objectContaining({
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-session' },
        body: JSON.stringify({ expectedVersion: 0, operations }),
      }),
    );
  });
});
