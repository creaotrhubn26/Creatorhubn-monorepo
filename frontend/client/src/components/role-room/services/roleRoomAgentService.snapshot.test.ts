import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getSettingMock, setSettingMock } = vi.hoisted(() => ({
  getSettingMock: vi.fn(),
  setSettingMock: vi.fn(),
}));

vi.mock('./settingsService', () => ({
  default: {
    getSetting: getSettingMock,
    setSetting: setSettingMock,
  },
}));

vi.mock('./authSessionService', () => ({
  authSessionService: {
    getAuthHeadersSync: () => ({ Authorization: 'Bearer test-session' }),
    getSessionSync: () => ({}),
  },
}));

import { roleRoomAgentService } from './roleRoomAgentService';

describe('roleRoomAgentService.getSnapshot', () => {
  beforeEach(() => {
    getSettingMock.mockReset();
    setSettingMock.mockReset();
    vi.restoreAllMocks();
  });

  it('restores and caches the latest durable research without generating a duplicate', async () => {
    const storedResult = {
      researchId: 'research-17',
      companyProfile: { companyName: 'MEDINNOVA AS' },
      merchSuppliers: { recommendations: [{ productId: 'polo' }] },
    };
    getSettingMock.mockResolvedValue(null);
    setSettingMock.mockResolvedValue(storedResult);
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, result: storedResult }),
    } as Response);

    await expect(roleRoomAgentService.getSnapshot('project-1')).resolves.toBe(storedResult);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/role-room/agent/research/latest?projectId=project-1',
      expect.objectContaining({ cache: 'no-store' }),
    );
    expect(setSettingMock).toHaveBeenCalledWith(
      'role-room-agent-snapshot',
      storedResult,
      { projectId: 'project-1' },
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('uses the active snapshot without calling the recovery endpoint', async () => {
    const active = { researchId: 'research-17' };
    getSettingMock.mockResolvedValue(active);
    const fetchMock = vi.spyOn(globalThis, 'fetch');

    await expect(roleRoomAgentService.getSnapshot('project-1')).resolves.toBe(active);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(setSettingMock).not.toHaveBeenCalled();
  });
});
