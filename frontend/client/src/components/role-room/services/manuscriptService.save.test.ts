import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Manuscript } from '../models/casting';

const settingsMocks = vi.hoisted(() => ({
  getSetting: vi.fn(),
  setSetting: vi.fn(),
  listSettings: vi.fn(),
  deleteSetting: vi.fn(),
}));

vi.mock('./settingsService', () => ({
  settingsService: settingsMocks,
  default: settingsMocks,
}));

vi.mock('./authSessionService', () => ({
  default: {
    getAuthHeadersSync: () => ({ Authorization: 'Bearer test-token' }),
  },
}));

const manuscript = (version: number = 7): Manuscript => ({
  id: 'manuscript-1',
  projectId: 'project-1',
  title: 'Troll',
  content: 'INT. STUE - DAG',
  version,
  updatedAt: '2026-09-10T08:00:00.000Z',
});

const jsonResponse = (body: unknown, init: ResponseInit = {}): Response => new Response(
  JSON.stringify(body),
  {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...(init.headers || {}) },
    ...init,
  },
);

describe('manuscriptService.updateManuscript', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllGlobals();
    settingsMocks.getSetting.mockReset().mockResolvedValue(null);
    settingsMocks.setSetting.mockReset().mockImplementation(async (_namespace, data) => data);
    settingsMocks.listSettings.mockReset().mockResolvedValue([]);
    settingsMocks.deleteSetting.mockReset().mockResolvedValue(true);
  });

  it('sends If-Match and reports an actual cloud save with the new version', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: 'healthy' }))
      .mockResolvedValueOnce(jsonResponse(
        { ...manuscript(8), content: 'INT. STUE - NATT' },
        { headers: { ETag: 'W/"8"' } },
      ));
    vi.stubGlobal('fetch', fetchMock);
    const { manuscriptService } = await import('./manuscriptService');
    const input = { ...manuscript(7), content: 'INT. STUE - NATT' };

    const result = await manuscriptService.updateManuscript(input);

    const putOptions = fetchMock.mock.calls[1][1] as RequestInit;
    expect(putOptions.method).toBe('PUT');
    expect((putOptions.headers as Record<string, string>)['If-Match']).toBe('W/"7"');
    expect(result).toMatchObject({ cloud: true, local: false, cloudVersion: 8, retryPending: false });
    expect(result.manuscript.version).toBe(8);
    expect(input.updatedAt).toBe('2026-09-10T08:00:00.000Z');
    expect(settingsMocks.setSetting).not.toHaveBeenCalled();
  });

  it('reports local-only persistence when the cloud write fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: 'healthy' }))
      .mockRejectedValueOnce(new TypeError('network unavailable'));
    vi.stubGlobal('fetch', fetchMock);
    const { manuscriptService } = await import('./manuscriptService');

    const result = await manuscriptService.updateManuscript(manuscript());

    expect(result).toMatchObject({ cloud: false, local: true, cloudVersion: 7, retryPending: true });
    expect(settingsMocks.setSetting).toHaveBeenCalledTimes(1);
  });

  it('protects the first write of a legacy cloud manuscript with revision zero', async () => {
    const legacy = { ...manuscript(), version: '1.0' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse(legacy, { headers: { ETag: 'W/"0"' } }))
      .mockResolvedValueOnce(jsonResponse({ status: 'healthy' }))
      .mockResolvedValueOnce(jsonResponse({ ...legacy, version: 1 }, { headers: { ETag: 'W/"1"' } }));
    vi.stubGlobal('fetch', fetchMock);
    const { manuscriptService } = await import('./manuscriptService');

    await manuscriptService.getCloudManuscript(legacy.id);
    await manuscriptService.updateManuscript(legacy);

    const putOptions = fetchMock.mock.calls[2][1] as RequestInit;
    expect((putOptions.headers as Record<string, string>)['If-Match']).toBe('W/"0"');
  });

  it('throws a tagged conflict with the authoritative cloud copy on 412', async () => {
    const cloud = { ...manuscript(9), content: 'Skyens tekst' };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: 'healthy' }))
      .mockResolvedValueOnce(jsonResponse(
        { error: 'stale', currentVersion: 9 },
        { status: 412, headers: { ETag: 'W/"9"' } },
      ))
      .mockResolvedValueOnce(jsonResponse(cloud));
    vi.stubGlobal('fetch', fetchMock);
    const { manuscriptService } = await import('./manuscriptService');

    await expect(manuscriptService.updateManuscript(manuscript(7))).rejects.toMatchObject({
      code: 'manuscript_conflict',
      currentVersion: 9,
      cloudManuscript: cloud,
    });
    expect(settingsMocks.setSetting).not.toHaveBeenCalled();
  });

  it('does not turn an aborted request into a local success', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ status: 'healthy' }))
      .mockRejectedValueOnce(abortError);
    vi.stubGlobal('fetch', fetchMock);
    const { manuscriptService } = await import('./manuscriptService');

    await expect(manuscriptService.updateManuscript(manuscript())).rejects.toMatchObject({ name: 'AbortError' });
    expect(settingsMocks.setSetting).not.toHaveBeenCalled();
  });
});
