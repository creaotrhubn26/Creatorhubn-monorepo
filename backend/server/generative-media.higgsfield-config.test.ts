import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  higgsfieldConfigured, higgsfieldEstimate, higgsfieldPoll, higgsfieldSubmit,
} from './generative-media.js';

const envNames = [
  'HIGGSFIELD_API_KEY',
  'HIGGSFIELD_API_KEY_ID',
  'HIGGSFIELD_API_KEY_SECRET',
] as const;

const originalEnv = Object.fromEntries(
  envNames.map((name) => [name, process.env[name]]),
) as Record<(typeof envNames)[number], string | undefined>;

function clearHiggsfieldEnv() {
  for (const name of envNames) delete process.env[name];
}

function restoreHiggsfieldEnv() {
  for (const name of envNames) {
    const value = originalEnv[name];
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

describe('Higgsfield server credential resolution', () => {
  beforeEach(() => {
    clearHiggsfieldEnv();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    restoreHiggsfieldEnv();
  });

  it('stays disabled when only half of the separate credential is present', () => {
    process.env.HIGGSFIELD_API_KEY_ID = 'test-key-id';

    expect(higgsfieldConfigured()).toBe(false);
  });

  it('supports the legacy combined server credential', () => {
    process.env.HIGGSFIELD_API_KEY = 'legacy-id:legacy-secret';

    expect(higgsfieldConfigured()).toBe(true);
  });

  it('combines the two Render secrets without exposing them in responses', async () => {
    process.env.HIGGSFIELD_API_KEY_ID = 'separate-id';
    process.env.HIGGSFIELD_API_KEY_SECRET = 'separate-secret';
    process.env.HIGGSFIELD_API_KEY = 'legacy-id:legacy-secret';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        request_id: 'request-1',
        status_url: 'https://api.higgsfield.ai/requests/request-1/status',
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await higgsfieldSubmit({
      imageUrl: 'https://assets.example.com/storyboard.png',
      prompt: 'Controlled camera push-in',
    });

    expect(higgsfieldConfigured()).toBe(true);
    expect(result).toEqual({
      id: 'request-1',
      statusUrl: 'https://api.higgsfield.ai/requests/request-1/status',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.higgsfield.ai/higgsfield-ai/dop/turbo',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Key separate-id:separate-secret',
        }),
        body: JSON.stringify({
          prompt: 'Controlled camera push-in',
          image_url: 'https://assets.example.com/storyboard.png',
          enhance_prompt: false,
        }),
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(/separate-secret|legacy-secret/);
  });

  it('uses the official estimate endpoint before a paid submission', async () => {
    process.env.HIGGSFIELD_API_KEY_ID = 'estimate-id';
    process.env.HIGGSFIELD_API_KEY_SECRET = 'estimate-secret';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ credits: '6.400', usd: '0.400' }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(higgsfieldEstimate({
      imageUrl: 'https://assets.example.com/final.png',
      prompt: 'Preserve every graphite line',
    })).resolves.toEqual({ credits: 6.4, usd: 0.4 });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.higgsfield.ai/estimate/higgsfield-ai/dop/turbo',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('reads the current video response and rejects untrusted poll hosts', async () => {
    process.env.HIGGSFIELD_API_KEY_ID = 'poll-id';
    process.env.HIGGSFIELD_API_KEY_SECRET = 'poll-secret';
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        status: 'completed', video: { url: 'https://cdn.example.com/final.mp4' },
      }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(higgsfieldPoll(
      'https://api.higgsfield.ai/requests/request-2/status',
    )).resolves.toEqual({
      status: 'COMPLETED', outputUrl: 'https://cdn.example.com/final.mp4',
    });
    await expect(higgsfieldPoll(
      'https://attacker.example.com/requests/request-2/status',
    )).resolves.toEqual({
      status: 'ERROR', error: 'higgsfield_invalid_status_url',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
