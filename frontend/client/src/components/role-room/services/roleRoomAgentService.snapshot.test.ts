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
      researchSkills: [{
        id: 'audit_research_dataflow',
        version: '1.0.0',
        status: 'ready',
        executionKey: 'input:audit_research_dataflow:1.0.0',
      }],
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

  it('persists the research skill ledger with one settings PUT', async () => {
    const result = {
      researchId: 'research-18',
      researchSkills: [{
        id: 'audit_research_dataflow',
        version: '1.0.0',
        status: 'ready',
        executionKey: 'input:audit_research_dataflow:1.0.0',
        startedAt: '2026-09-04T10:00:00.000Z',
        finishedAt: '2026-09-04T10:00:00.010Z',
        durationMs: 10,
        evidenceCount: 12,
        sourceKinds: ['normalized_payload'],
        limitations: [],
      }],
    };
    setSettingMock.mockResolvedValue(result);

    await expect(roleRoomAgentService.saveSnapshot('project-1', result as never)).resolves.toBe(result);
    expect(setSettingMock).toHaveBeenCalledOnce();
    expect(setSettingMock).toHaveBeenCalledWith('role-room-agent-snapshot', result, {
      projectId: 'project-1',
    });
  });
});
