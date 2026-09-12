// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./authSessionService', () => ({
  default: { getAuthHeadersSync: () => ({ Authorization: 'Bearer test-token' }) },
}));

describe('settingsService request deduplication', () => {
  beforeEach(() => {
    vi.resetModules();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shares concurrent reads and reuses the fresh remote result briefly', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { enabled: true } }),
    });
    vi.stubGlobal('fetch', fetchMock);
    const { default: settingsService } = await import('./settingsService');

    const [first, second] = await Promise.all([
      settingsService.getSetting('same-setting'),
      settingsService.getSetting('same-setting'),
    ]);
    const third = await settingsService.getSetting('same-setting');

    expect(first).toEqual({ enabled: true });
    expect(second).toEqual({ enabled: true });
    expect(third).toEqual({ enabled: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
