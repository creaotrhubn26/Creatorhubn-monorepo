import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getAuthHeadersSync } = vi.hoisted(() => ({ getAuthHeadersSync: vi.fn() }));
vi.mock('./authSessionService', () => ({ default: { getAuthHeadersSync } }));

import { canQueryCastingRoleSelftapes, listCastingRoleSelftapes } from './roleRoomSelfTapesService';

describe('canQueryCastingRoleSelftapes', () => {
  beforeEach(() => {
    getAuthHeadersSync.mockReturnValue({ Authorization: 'Bearer role-room-token' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('accepts canonical roles persisted for the current project', () => {
    expect(canQueryCastingRoleSelftapes(
      { project_id: 'troll-project' },
      'troll-project',
    )).toBe(true);
    expect(canQueryCastingRoleSelftapes(
      { projectId: 'troll-project' },
      'troll-project',
    )).toBe(true);
  });

  it('rejects manuscript-only and cross-project role identifiers', () => {
    expect(canQueryCastingRoleSelftapes({}, 'troll-project')).toBe(false);
    expect(canQueryCastingRoleSelftapes(
      { project_id: 'another-project' },
      'troll-project',
    )).toBe(false);
  });

  it('authenticates production-side role requests with the Role Room session', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ selftapes: [] }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(listCastingRoleSelftapes('role-nora')).resolves.toEqual({ selftapes: [] });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/role-room/casting-roles/role-nora/selftapes',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({ Authorization: 'Bearer role-room-token' }),
      }),
    );
  });
});
