import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { higgsfieldConfigured, higgsfieldSubmit } from './generative-media.js';

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
        status_url: 'https://platform.higgsfield.ai/requests/request-1/status',
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
      statusUrl: 'https://platform.higgsfield.ai/requests/request-1/status',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://platform.higgsfield.ai/v1/image2video/dop',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Key separate-id:separate-secret',
        }),
      }),
    );
    expect(JSON.stringify(result)).not.toMatch(/separate-secret|legacy-secret/);
  });
});
