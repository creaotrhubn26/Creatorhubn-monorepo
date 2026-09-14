// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { analyzeLocation, clearLocationAnalysisCache } from './locationAnalysisService';

describe('locationAnalysisService', () => {
  afterEach(() => {
    clearLocationAnalysisCache();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses the shared Role Room session headers for analysis requests', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        success: true,
        data: {
          query: 'Skogveien 1',
          geocoded: null,
          permitInfo: null,
          recommendations: [],
          source: 'fallback',
          confidence: 'unverified',
          permitDataSource: 'none',
          analyzedAt: '2026-09-13T12:00:00.000Z',
          warnings: [],
        },
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await analyzeLocation('Skogveien 1', { bypassCache: true });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/role-room/locations/analysis/analyze',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer dev-admin-local-session' }),
      }),
    );
  });
});
