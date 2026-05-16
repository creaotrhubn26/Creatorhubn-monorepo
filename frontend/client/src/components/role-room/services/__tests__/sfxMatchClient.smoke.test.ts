// @ts-nocheck
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mocker apiRequest så vi kan kontrollere svaret uten faktisk HTTP.
vi.mock('../castingApiService', () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from '../castingApiService';
import {
  matchSfx,
  getSfxLibraryStats,
  clearSfxMatchCache,
  _sfxMatchCacheSize,
} from '../sfxMatchClient';

beforeEach(() => {
  clearSfxMatchCache();
  (apiRequest as any).mockReset();
});

afterEach(() => {
  clearSfxMatchCache();
});

describe('Sprint A.7 — sfxMatchClient.matchSfx basis', () => {
  it('kaller POST /api/sfx/match med riktig body', async () => {
    (apiRequest as any).mockResolvedValue({
      matches: [],
      libraryStats: { sampleCount: 0, embeddingModel: 'x' },
    });
    await matchSfx({ prompt: 'door slam', topK: 3 });
    expect(apiRequest).toHaveBeenCalledWith(
      '/api/sfx/match',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ prompt: 'door slam', topK: 3 }),
      }),
    );
  });

  it('returnerer respons-payload direkte', async () => {
    const payload = {
      matches: [{ id: 'a', title: 'A', url: '/a.mp3', categoryId: 'door', license: 'CC0', score: 0.9 }],
      libraryStats: { sampleCount: 10, embeddingModel: 'clap' },
    };
    (apiRequest as any).mockResolvedValue(payload);
    const result = await matchSfx({ prompt: 'door' });
    expect(result).toEqual(payload);
  });
});

describe('Sprint A.7 — sfxMatchClient.matchSfx caching', () => {
  it('samme prompt + topK cacher — andre kall trigger ikke apiRequest', async () => {
    (apiRequest as any).mockResolvedValue({
      matches: [{ id: 'a', title: 'A', url: '/a.mp3', categoryId: 'door', license: 'CC0', score: 0.9 }],
      libraryStats: { sampleCount: 1, embeddingModel: 'x' },
    });

    await matchSfx({ prompt: 'door', topK: 3 });
    await matchSfx({ prompt: 'door', topK: 3 });
    await matchSfx({ prompt: 'door', topK: 3 });

    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it('forskjellig prompt cacher separat', async () => {
    (apiRequest as any).mockResolvedValue({
      matches: [],
      libraryStats: { sampleCount: 0, embeddingModel: 'x' },
    });
    await matchSfx({ prompt: 'door' });
    await matchSfx({ prompt: 'footstep' });
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  it('forskjellig categoryId cacher separat', async () => {
    (apiRequest as any).mockResolvedValue({
      matches: [],
      libraryStats: { sampleCount: 0, embeddingModel: 'x' },
    });
    await matchSfx({ prompt: 'door', categoryId: 'door-slam' });
    await matchSfx({ prompt: 'door', categoryId: 'door-open' });
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  it('case-insensitiv på prompt — "DOOR" og "door" deler cache', async () => {
    (apiRequest as any).mockResolvedValue({
      matches: [],
      libraryStats: { sampleCount: 0, embeddingModel: 'x' },
    });
    await matchSfx({ prompt: 'door' });
    await matchSfx({ prompt: 'DOOR' });
    await matchSfx({ prompt: '  door  ' });
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });

  it('skipCache=true tvinger nytt kall', async () => {
    (apiRequest as any).mockResolvedValue({
      matches: [],
      libraryStats: { sampleCount: 0, embeddingModel: 'x' },
    });
    await matchSfx({ prompt: 'door' });
    await matchSfx({ prompt: 'door' }, { skipCache: true });
    expect(apiRequest).toHaveBeenCalledTimes(2);
  });

  it('clearSfxMatchCache tømmer cache', async () => {
    (apiRequest as any).mockResolvedValue({
      matches: [],
      libraryStats: { sampleCount: 0, embeddingModel: 'x' },
    });
    await matchSfx({ prompt: 'door' });
    expect(_sfxMatchCacheSize()).toBe(1);
    clearSfxMatchCache();
    expect(_sfxMatchCacheSize()).toBe(0);
  });

  it('LRU: når cache er full, droppes eldste entry', async () => {
    (apiRequest as any).mockResolvedValue({
      matches: [],
      libraryStats: { sampleCount: 0, embeddingModel: 'x' },
    });
    // Fyll cache utover MAX (64).
    for (let i = 0; i < 70; i += 1) {
      await matchSfx({ prompt: `prompt-${i}` });
    }
    // Skal være max 64 entries.
    expect(_sfxMatchCacheSize()).toBeLessThanOrEqual(64);
    // Den første (prompt-0) er ute, så et nytt kall skal trigge apiRequest.
    const prevCallCount = (apiRequest as any).mock.calls.length;
    await matchSfx({ prompt: 'prompt-0' });
    expect((apiRequest as any).mock.calls.length).toBe(prevCallCount + 1);
  });
});

describe('Sprint A.7 — sfxMatchClient.getSfxLibraryStats', () => {
  it('kaller GET /api/sfx/library/stats', async () => {
    (apiRequest as any).mockResolvedValue({
      sampleCount: 42,
      embeddingModel: 'Xenova/clap-htsat-unfused',
      embeddingDim: 512,
      builtAt: '2026-01-01',
    });
    const stats = await getSfxLibraryStats();
    expect(apiRequest).toHaveBeenCalledWith(
      '/api/sfx/library/stats',
      expect.objectContaining({ method: 'GET' }),
    );
    expect(stats.sampleCount).toBe(42);
  });
});
